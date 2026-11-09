/**
 * Demo mode: the server signs with testnet-only demo keys so judges can run
 * the flows without a wallet. Tolu's key MUST be a function-call key (it can
 * only call request_payout / cancel_payout on the vault) — this is checked
 * on-chain before demo mode is allowed (G4). Ada's key is a full-access key of
 * a fictional testnet account. Never enabled on mainnet.
 */
import { KeyPair, type Account, type KeyPairString } from "near-api-js";
import { accountFor, getProvider } from "../near/client";
import { deploymentIds, type DemoIds } from "./deployment";

export interface DemoContext {
  ids: DemoIds;
  finance: Account;
  ceo: Account;
}

export type DemoGate =
  { ok: true; ctx: DemoContext } | { ok: false; status: number; error: string };

export const FINANCE_KEY_METHODS = ["request_payout", "cancel_payout"];

export type FinanceKeyStatus =
  | { kind: "function-call"; receiver: string; methods: string[] }
  | { kind: "full-access" }
  | { kind: "wrong-scope"; receiver: string; methods: string[] }
  | { kind: "missing"; detail: string };

let cache: { at: number; secret: string; status: FinanceKeyStatus } | null = null;

/**
 * Looks up Tolu's demo key ON-CHAIN and reports what it can do. A full-access
 * key here would contradict the whole demo ("Tolu's key can't move money"),
 * so the demo refuses to run with one.
 */
export async function financeKeyStatus(ids: DemoIds, secret: string): Promise<FinanceKeyStatus> {
  if (cache && cache.secret === secret && Date.now() - cache.at < 10 * 60 * 1000)
    return cache.status;
  let status: FinanceKeyStatus;
  try {
    const publicKey = KeyPair.fromString(secret as KeyPairString)
      .getPublicKey()
      .toString();
    const key = await getProvider().viewAccessKey({ accountId: ids.finance, publicKey });
    const perm = key.permission as unknown;
    if (
      perm === "FullAccess" ||
      (typeof perm === "object" && perm !== null && "FullAccess" in perm)
    ) {
      status = { kind: "full-access" };
    } else {
      const fc = (
        perm as {
          FunctionCall?: {
            receiver_id?: string;
            receiverId?: string;
            method_names?: string[];
            methodNames?: string[];
          };
        }
      ).FunctionCall;
      const receiver = fc?.receiver_id ?? fc?.receiverId ?? "";
      const methods = fc?.method_names ?? fc?.methodNames ?? [];
      const scoped =
        receiver === ids.vault &&
        methods.length > 0 &&
        methods.every((m) => FINANCE_KEY_METHODS.includes(m));
      status = scoped
        ? { kind: "function-call", receiver, methods }
        : { kind: "wrong-scope", receiver, methods };
    }
  } catch (e) {
    status = { kind: "missing", detail: (e as Error).message.slice(0, 160) };
  }
  cache = { at: Date.now(), secret, status };
  return status;
}

export async function demoContext(): Promise<DemoGate> {
  if (process.env.DEMO_MODE !== "true")
    return { ok: false, status: 403, error: "Demo mode is off on this server." };
  if ((process.env.NEAR_NETWORK || "testnet") !== "testnet") {
    return { ok: false, status: 403, error: "Demo mode only runs on testnet." };
  }
  const ids = deploymentIds();
  const fck = process.env.DEMO_FINANCE_FCK_SECRET?.trim();
  const ceo = process.env.DEMO_CEO_SECRET?.trim();
  if (!ids || !fck || !ceo) {
    return {
      ok: false,
      status: 503,
      error: "Demo isn't configured on this server (no testnet deployment or demo keys).",
    };
  }
  const key = await financeKeyStatus(ids, fck);
  if (key.kind !== "function-call") {
    const why =
      key.kind === "full-access"
        ? "DEMO_FINANCE_FCK_SECRET is a FULL-ACCESS key"
        : key.kind === "wrong-scope"
          ? `DEMO_FINANCE_FCK_SECRET is scoped to ${key.receiver || "?"} (${key.methods.join(", ") || "any method"}), not the vault's request methods`
          : "DEMO_FINANCE_FCK_SECRET is not a key on Tolu's account";
    return {
      ok: false,
      status: 503,
      error: `Demo disabled for safety: ${why}. Tolu's demo key must be the limited function-call key (see README).`,
    };
  }
  return {
    ok: true,
    ctx: { ids, finance: accountFor(ids.finance, fck), ceo: accountFor(ids.ceo, ceo) },
  };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
