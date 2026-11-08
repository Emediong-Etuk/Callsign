/**
 * Demo mode: the server signs with testnet-only demo keys so judges can run
 * the flows without a wallet. Tolu's key is a FUNCTION-CALL key (it can only
 * call request_payout / cancel_payout on the vault). Ada's key is a full-access
 * key of a fictional testnet account. Never enabled on mainnet.
 */
import type { Account } from "near-api-js";
import { accountFor } from "../near/client";
import { deploymentIds, type DemoIds } from "./deployment";

export interface DemoContext {
  ids: DemoIds;
  finance: Account;
  ceo: Account;
}

export type DemoGate =
  { ok: true; ctx: DemoContext } | { ok: false; status: number; error: string };

export function demoContext(): DemoGate {
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
