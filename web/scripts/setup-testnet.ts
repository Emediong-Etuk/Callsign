/**
 * npm run setup:testnet — idempotent testnet deployment of the Callsign demo.
 *
 * Needs the master account you created with the faucet (see README), via
 * OWNER_ACCOUNT_ID + OWNER_SECRET in .env.local or near-cli's legacy keychain.
 * Creates sub-accounts, builds + deploys both contracts, initialises them,
 * registers storage, funds the vault, adds members/payee, creates Tolu's
 * function-call key, then writes deployments/testnet.json (no secrets) and
 * .env.local (secrets, gitignored).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { KeyPair, nearToYocto, type Account } from "near-api-js";
import { accountFor, call, getProvider, view, type TxResult } from "../lib/near/client";
import { TGAS } from "../lib/near/config";
import { formatTusd } from "../lib/near/format";
import {
  color,
  deploymentFile,
  envLocal,
  network,
  detail,
  repoRoot,
  requireTestnet,
  secretFor,
  upsertEnvLocal,
  type Deployment,
} from "./lib/testnet";

const TUSD = 1_000_000n;
const SUPPLY = 10_000_000n * TUSD;
const VAULT_TARGET = 100_000n * TUSD;
const HOLD_SECONDS = BigInt(process.env.HOLD_WINDOW_SECONDS || "300");
const FUNDING: Record<string, string> = {
  token: process.env.FUND_TOKEN_NEAR || "2.3",
  vault: process.env.FUND_VAULT_NEAR || "3.6",
  ceo: "0.4",
  cfo: "0.2",
  finance: "0.5",
  vendor: "0.05",
  supplier: "0.05",
};
const ENV_KEY: Record<string, string> = {
  token: "TOKEN_ACCOUNT_SECRET",
  vault: "VAULT_ACCOUNT_SECRET",
  ceo: "DEMO_CEO_SECRET",
  cfo: "DEMO_CFO_SECRET",
  finance: "DEMO_FINANCE_SECRET",
  vendor: "DEMO_VENDOR_SECRET",
  supplier: "DEMO_SUPPLIER_SECRET",
};
const FCK_METHODS = ["request_payout", "cancel_payout"];

const txs: Record<string, string> = {};
function must(label: string, r: TxResult): TxResult {
  if (!r.ok) throw new Error(`${label} failed: ${r.error}`);
  if (r.hash) txs[label] = r.hash;
  console.log(`  ${color.green("✓")} ${label}${r.hash ? color.dim(`  (${r.hash})`) : ""}`);
  return r;
}

async function exists(accountId: string): Promise<boolean> {
  try {
    await getProvider().viewAccount({ accountId });
    return true;
  } catch {
    return false;
  }
}

async function hasCode(accountId: string): Promise<boolean> {
  const a = (await getProvider().viewAccount({ accountId })) as unknown as {
    code_hash?: string;
    codeHash?: string;
  };
  const hash = a.code_hash ?? a.codeHash;
  return !!hash && hash !== "11111111111111111111111111111111";
}

/** A view that is expected to fail on a fresh account (e.g. "not initialized"); keeps the log quiet. */
async function viewOrNull<T>(
  contract: string,
  method: string,
  args: Record<string, unknown> = {},
): Promise<T | null> {
  const original = console.error;
  console.error = () => {};
  try {
    return await view<T>(contract, method, args);
  } catch {
    return null;
  } finally {
    console.error = original;
  }
}

function build(crate: "vault" | "test-token"): Uint8Array {
  const dir = path.join(repoRoot, "contracts", crate);
  console.log(color.dim(`  building ${crate} with cargo near …`));
  try {
    execFileSync("cargo", ["near", "build", "non-reproducible-wasm"], { cwd: dir, stdio: "pipe" });
  } catch (e) {
    console.error((e as { stderr?: Buffer }).stderr?.toString());
    throw new Error(`cargo near build failed for ${crate}`);
  }
  const name = crate === "vault" ? "callsign_vault" : "callsign_test_token";
  return readFileSync(path.join(repoRoot, "contracts", "target", "near", name, `${name}.wasm`));
}

async function main() {
  requireTestnet();
  const master = process.env.OWNER_ACCOUNT_ID?.trim();
  if (
    !master ||
    !(master.endsWith(".testnet") || (network === "sandbox" && master.endsWith(".near")))
  ) {
    throw new Error(
      "set OWNER_ACCOUNT_ID=<prefix>.testnet in .env.local (see README: create it with the faucet first)",
    );
  }
  const owner = accountFor(master, secretFor(master, "OWNER_SECRET"));
  const prefix = master.replace(/\.(testnet|near)$/, "");
  const ids = Object.fromEntries(
    Object.keys(FUNDING).map((k) => [k, `${k}.${master}`]),
  ) as Deployment["accounts"];

  const state = await getProvider().viewAccount({ accountId: master });
  console.log(
    `${color.bold("Master")} ${master} — balance ${(Number(BigInt(state.amount) / 10n ** 21n) / 1000).toFixed(3)} NEAR`,
  );

  // 1. Sub-accounts (each gets its own fresh full-access key, saved to .env.local).
  console.log(color.bold("\n1. Sub-accounts"));
  const signers: Record<string, Account> = {};
  for (const [name, id] of Object.entries(ids)) {
    if (await exists(id)) {
      console.log(`  ${color.dim("•")} ${id} exists`);
    } else {
      const kp = KeyPair.fromRandom("ed25519");
      must(
        `create ${id}`,
        await wrap(() =>
          owner.createSubAccount({
            accountOrPrefix: name,
            publicKey: kp.getPublicKey().toString(),
            nearToTransfer: nearToYocto(FUNDING[name]! as `${number}`),
          }),
        ),
      );
      upsertEnvLocal({ [ENV_KEY[name]!]: kp.toString() });
    }
    signers[name] = accountFor(id, secretFor(id, ENV_KEY[name]));
  }

  // 2–3. Build, deploy and init both contracts.
  console.log(color.bold("\n2. Contracts"));
  if (!(await hasCode(ids.token)))
    must("deploy token", await wrap(() => signers.token!.deployContract(build("test-token"))));
  if (!(await viewOrNull(ids.token, "ft_metadata"))) {
    must(
      "init token",
      await call(
        signers.token!,
        ids.token,
        "new",
        { owner_id: master, total_supply: SUPPLY.toString() },
        { gas: 50n * TGAS },
      ),
    );
  } else console.log(`  ${color.dim("•")} token initialised`);

  const policy = {
    instant_limit: (500n * TUSD).toString(),
    hold_window_ns: (HOLD_SECONDS * 1_000_000_000n).toString(),
    high_risk_hold_multiplier: 2,
    max_pending_per_requester: 5,
  };
  if (!(await hasCode(ids.vault)))
    must("deploy vault", await wrap(() => signers.vault!.deployContract(build("vault"))));
  if (!(await viewOrNull(ids.vault, "get_config"))) {
    must(
      "init vault",
      await call(
        signers.vault!,
        ids.vault,
        "new",
        { owner_id: master, token_id: ids.token, policy },
        { gas: 50n * TGAS },
      ),
    );
  } else console.log(`  ${color.dim("•")} vault initialised`);

  // 4. Storage registration (deliberately NOT for scam names, so payouts to them fail safely).
  console.log(color.bold("\n3. Token storage"));
  for (const id of [ids.vault, ids.vendor, ids.supplier, ids.finance, ids.ceo, ids.cfo]) {
    if (await viewOrNull(ids.token, "storage_balance_of", { account_id: id })) {
      console.log(`  ${color.dim("•")} ${id} registered`);
      continue;
    }
    must(
      `storage ${id}`,
      await call(
        owner,
        ids.token,
        "storage_deposit",
        { account_id: id, registration_only: true },
        { deposit: nearToYocto("0.00125") },
      ),
    );
  }

  // 5. Fund the vault up to 100,000 tUSD.
  console.log(color.bold("\n4. Fund vault"));
  const bal = await view<{ vault_balance: string }>(ids.vault, "get_balances");
  const missing = VAULT_TARGET - BigInt(bal.vault_balance);
  if (missing > 0n) {
    must(
      `deposit ${formatTusd(missing)}`,
      await call(
        owner,
        ids.token,
        "ft_transfer_call",
        { receiver_id: ids.vault, amount: missing.toString(), msg: "" },
        { deposit: 1n, gas: 100n * TGAS },
      ),
    );
  } else console.log(`  ${color.dim("•")} vault holds ${formatTusd(bal.vault_balance)}`);

  // 6. Members and payee.
  console.log(color.bold("\n5. Members & payees"));
  const members = [
    [ids.ceo, "Ada Okafor", "CEO", ["Principal"]],
    [ids.cfo, "Chidi Eze", "CFO", ["Principal"]],
    [ids.finance, "Tolu Bello", "Finance Officer", ["Requester"]],
  ] as const;
  for (const [id, name, title, roles] of members) {
    if (await viewOrNull(ids.vault, "get_member", { account_id: id })) {
      console.log(`  ${color.dim("•")} ${name} is a member`);
      continue;
    }
    must(
      `add member ${name}`,
      await call(
        owner,
        ids.vault,
        "add_member",
        { account_id: id, display_name: name, title, roles },
        { deposit: 1n },
      ),
    );
  }
  if (!(await view<boolean>(ids.vault, "is_known_payee", { account_id: ids.vendor }))) {
    must(
      "add payee Harbor Office Supplies",
      await call(
        owner,
        ids.vault,
        "add_payee",
        { account_id: ids.vendor, label: "Harbor Office Supplies" },
        { deposit: 1n },
      ),
    );
  } else console.log(`  ${color.dim("•")} Harbor Office Supplies is a payee`);

  // 7. Tolu's function-call key: vault only, request/cancel only, small gas allowance (G4).
  console.log(color.bold("\n6. Tolu's function-call key"));
  let fck: Deployment["finance_function_call_key"] = null;
  const existing = process.env.DEMO_FINANCE_FCK_SECRET;
  if (existing) {
    fck = {
      public_key: KeyPair.fromString(existing as `ed25519:${string}`)
        .getPublicKey()
        .toString(),
      methods: FCK_METHODS,
      allowance_near: "0.25",
    };
    console.log(`  ${color.dim("•")} key exists ${fck.public_key}`);
  } else {
    const kp = KeyPair.fromRandom("ed25519");
    must(
      "add function-call key",
      await wrap(() =>
        signers.finance!.addFunctionCallAccessKey({
          publicKey: kp.getPublicKey().toString(),
          contractId: ids.vault,
          methodNames: FCK_METHODS,
          allowance: nearToYocto("0.25"),
        }),
      ),
    );
    upsertEnvLocal({ DEMO_FINANCE_FCK_SECRET: kp.toString() });
    fck = {
      public_key: kp.getPublicKey().toString(),
      methods: FCK_METHODS,
      allowance_near: "0.25",
    };
  }

  // 8. Record the deployment (no secrets) and the public env values.
  const prev: Partial<Deployment> = existsSync(deploymentFile)
    ? JSON.parse(readFileSync(deploymentFile, "utf8"))
    : {};
  const deployment: Deployment = {
    network,
    prefix,
    master,
    accounts: ids,
    policy,
    finance_function_call_key: fck,
    txs: { ...(prev.txs ?? {}), ...txs },
    deployed_at: prev.deployed_at ?? new Date().toISOString(),
  };
  mkdirSync(path.dirname(deploymentFile), { recursive: true });
  writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2) + "\n");
  upsertEnvLocal({
    NEAR_NETWORK: network,
    NEXT_PUBLIC_NEAR_NETWORK: network === "sandbox" ? "testnet" : network,
    NEXT_PUBLIC_VAULT_CONTRACT_ID: ids.vault,
    NEXT_PUBLIC_TOKEN_CONTRACT_ID: ids.token,
    DEMO_FINANCE_ACCOUNT_ID: ids.finance,
    DEMO_CEO_ACCOUNT_ID: ids.ceo,
  });

  const b = await view<{ vault_balance: string; reserved: string; available: string }>(
    ids.vault,
    "get_balances",
  );
  console.log(color.bold("\nSummary"));
  detail(`vault    ${ids.vault}  (${formatTusd(b.available)} available)`);
  detail(`token    ${ids.token}`);
  detail(`members  Ada (${ids.ceo}), Chidi (${ids.cfo}), Tolu (${ids.finance})`);
  detail(`payee    Harbor Office Supplies (${ids.vendor}); new supplier: ${ids.supplier}`);
  detail(`policy   instant ≤ 500 tUSD, hold ${HOLD_SECONDS}s (×2 if high risk), max 5 pending`);
  detail(
    `wrote    ${path.relative(repoRoot, deploymentFile)} (no secrets) and ${path.basename(envLocal)} (secrets, gitignored)`,
  );
}

/** Converts a throwing near-api-js call into a TxResult. */
async function wrap(fn: () => Promise<unknown>): Promise<TxResult> {
  try {
    const res = (await fn()) as {
      transaction?: { hash?: string };
      transaction_outcome?: { id?: string };
    };
    return {
      ok: true,
      hash: res?.transaction?.hash ?? res?.transaction_outcome?.id ?? null,
      value: null,
      logs: [],
      error: null,
    };
  } catch (e) {
    return { ok: false, hash: null, value: null, logs: [], error: (e as Error).message };
  }
}

main().catch((e) => {
  console.error(color.red(`\n❌ ${e instanceof Error ? e.message : e}`));
  process.exit(1);
});
