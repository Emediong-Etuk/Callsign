/** Shared helpers for the testnet setup and demo scripts. */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { Account } from "near-api-js";
import { accountFor, type TxResult } from "../../lib/near/client";
import { txUrl } from "../../lib/near/config";
import { loadEnv } from "./env";

loadEnv();

export const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
/** "sandbox" is only for local rehearsal against a localhost node (never deployed). */
export const network = (process.env.NEAR_NETWORK || "testnet") as "testnet" | "sandbox";
export const deploymentFile = path.join(repoRoot, "deployments", `${network}.json`);
export const envLocal = process.env.CALLSIGN_ENV_FILE || path.join(repoRoot, ".env.local");

const c = (code: number) => (s: string) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
export const color = { green: c(32), red: c(31), amber: c(33), dim: c(2), bold: c(1), cyan: c(36) };

export function requireTestnet(): void {
  const rpc = process.env.NEAR_RPC_URL || "";
  if (network === "sandbox" && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(rpc)) return;
  if (network !== "testnet")
    throw new Error(`refusing to run: NEAR_NETWORK=${network} (testnet only)`);
}

export interface Deployment {
  network: "testnet" | "sandbox";
  prefix: string;
  master: string;
  accounts: Record<"token" | "vault" | "ceo" | "cfo" | "finance" | "vendor" | "supplier", string>;
  policy: {
    instant_limit: string;
    hold_window_ns: string;
    high_risk_hold_multiplier: number;
    max_pending_per_requester: number;
  };
  finance_function_call_key: {
    public_key: string;
    methods: string[];
    allowance_near: string;
  } | null;
  txs: Record<string, string>;
  deployed_at: string;
}

export function loadDeployment(): Deployment {
  if (!existsSync(deploymentFile)) {
    throw new Error("deployments/testnet.json not found — run `npm run setup:testnet` first");
  }
  return JSON.parse(readFileSync(deploymentFile, "utf8")) as Deployment;
}

/** Reads a secret from env, or from near-cli's legacy keychain (~/.near-credentials/testnet/<id>.json). */
export function secretFor(accountId: string, envVar?: string): string {
  const fromEnv = envVar ? process.env[envVar]?.trim() : undefined;
  if (fromEnv) return fromEnv;
  const file = path.join(homedir(), ".near-credentials", network, `${accountId}.json`);
  if (existsSync(file)) {
    const j = JSON.parse(readFileSync(file, "utf8")) as {
      private_key?: string;
      secret_key?: string;
    };
    const k = j.private_key ?? j.secret_key;
    if (k) return k;
  }
  throw new Error(`no key for ${accountId}${envVar ? ` (set ${envVar} in .env.local)` : ""}`);
}

export function demoSigners(d: Deployment): {
  finance: Account;
  financeFull: Account;
  ceo: Account;
  owner: Account;
} {
  return {
    // Tolu's day-to-day key: a function-call key that can only request/cancel (G4).
    finance: accountFor(
      d.accounts.finance,
      secretFor(d.accounts.finance, "DEMO_FINANCE_FCK_SECRET"),
    ),
    // Tolu's full-access key: used ONLY by demo:attack to show it still can't confirm.
    financeFull: accountFor(
      d.accounts.finance,
      secretFor(d.accounts.finance, "DEMO_FINANCE_SECRET"),
    ),
    ceo: accountFor(d.accounts.ceo, secretFor(d.accounts.ceo, "DEMO_CEO_SECRET")),
    owner: accountFor(d.master, secretFor(d.master, "OWNER_SECRET")),
  };
}

/** Updates KEY=value pairs in .env.local without touching other lines. */
export function upsertEnvLocal(values: Record<string, string>): void {
  const lines = existsSync(envLocal) ? readFileSync(envLocal, "utf8").split(/\r?\n/) : [];
  for (const [k, v] of Object.entries(values)) {
    const i = lines.findIndex((l) => l.startsWith(`${k}=`));
    if (i >= 0) lines[i] = `${k}=${v}`;
    else lines.push(`${k}=${v}`);
    process.env[k] = v;
  }
  writeFileSync(
    envLocal,
    lines.filter((l, i, a) => l !== "" || i < a.length - 1).join("\n") + "\n",
    { mode: 0o600 },
  );
}

export const freshScamName = () => `fastpay-${randomBytes(3).toString("hex")}.testnet`;

export function step(n: number, total: number, text: string): void {
  console.log(`${color.bold(`[${n}/${total}]`)} ${text}`);
}
export const detail = (text: string) => console.log(`      ${text}`);
export const txLine = (r: TxResult) => r.hash && detail(color.dim(`tx: ${txUrl(r.hash)}`));

export class DemoFailure extends Error {}
export function expect(cond: boolean, message: string): asserts cond {
  if (!cond) throw new DemoFailure(message);
}

export async function runDemo(main: () => Promise<void>): Promise<void> {
  try {
    requireTestnet();
    await main();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      color.red(`\n❌ ${e instanceof DemoFailure ? "Unexpected outcome" : "Error"}: ${msg}`),
    );
    process.exit(1);
  }
}
