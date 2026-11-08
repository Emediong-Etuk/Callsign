/** Server-side demo flows. All amounts and receivers are fixed here (never taken from the client). */
import { randomBytes } from "node:crypto";
import { call, events, transferNear, type TxResult } from "../near/client";
import { ONE_YOCTO } from "../near/config";
import {
  cancelPayout,
  confirmPayout,
  rejectPayout,
  requestPayout,
  sweepExpired,
  vaultViews,
} from "../near/vault";
import type { RequestView } from "../near/types";
import { errorCode, friendlyError } from "../errors";
import { SCENARIOS } from "../scenarios";
import { analyzeAgainstVault } from "./analysis";
import type { DemoContext } from "./demo";

export type DemoScenario = "scam" | "routine" | "supplier";

const PLAN: Record<DemoScenario, { text: keyof typeof SCENARIOS; amount: string; memo: string }> = {
  scam: { text: "ceo-urgent-wire", amount: "25000000000", memo: "Partner wallet — Lisbon deal" },
  routine: { text: "routine-invoice", amount: "200000000", memo: "Invoice HOS-4470" },
  supplier: {
    text: "supplier-first-invoice",
    amount: "2000000000",
    memo: "Kestrel Logistics — invoice KL-0098",
  },
};

export const SCAM_RECEIVER = /^fastpay-[0-9a-f]{6}\.testnet$/;

export interface StepResult {
  ok: boolean;
  txHash: string | null;
  error: string | null;
  code: string | null;
  friendly: string | null;
  request: RequestView | null;
}

function outcome(r: TxResult, request: RequestView | null): StepResult {
  const err = r.error; // on success this may still describe a failed inner receipt
  return {
    ok: r.ok,
    txHash: r.hash,
    error: r.ok ? null : err,
    code: err ? errorCode(err) : null,
    friendly: !r.ok && err ? friendlyError(err) : null,
    request,
  };
}

export async function demoRequest(ctx: DemoContext, scenario: DemoScenario) {
  const plan = PLAN[scenario];
  const receiverId =
    scenario === "scam"
      ? `fastpay-${randomBytes(3).toString("hex")}.testnet`
      : scenario === "routine"
        ? ctx.ids.vendor
        : ctx.ids.supplier;
  const analysis = await analyzeAgainstVault({
    text: SCENARIOS[plan.text],
    claimedPrincipal: ctx.ids.ceo,
    receiverId,
    amount: plan.amount,
  });
  const tx = await requestPayout(ctx.finance, ctx.ids.vault, {
    claimedPrincipal: ctx.ids.ceo,
    receiverId,
    amount: plan.amount,
    memo: plan.memo,
    evidence: analysis.onChainEvidence,
  });
  const request = tx.ok ? await vaultViews(ctx.ids.vault).request(String(tx.value)) : null;
  return { ...outcome(tx, request), receiverId, analysis, text: SCENARIOS[plan.text] };
}

/** Retries the scam payout to a receiver that must already be flagged: shows ERR_RECEIVER_FLAGGED. */
export async function demoRetry(ctx: DemoContext, receiverId: string) {
  if (!SCAM_RECEIVER.test(receiverId)) throw new Error("not a demo scam receiver");
  if (!(await vaultViews(ctx.ids.vault).flag(receiverId)))
    throw new Error("receiver is not flagged yet");
  const tx = await requestPayout(ctx.finance, ctx.ids.vault, {
    claimedPrincipal: ctx.ids.ceo,
    receiverId,
    amount: PLAN.scam.amount,
    memo: "",
    evidence: null,
  });
  return outcome(tx, null);
}

async function demoOwned(ctx: DemoContext, id: string): Promise<RequestView> {
  const r = await vaultViews(ctx.ids.vault).request(id);
  if (!r || r.requester !== ctx.ids.finance || r.claimed_principal !== ctx.ids.ceo)
    throw new Error("not a demo request");
  return r;
}

export async function demoConfirm(ctx: DemoContext, id: string) {
  await demoOwned(ctx, id);
  const tx = await confirmPayout(ctx.ceo, ctx.ids.vault, id);
  return { ...outcome(tx, await vaultViews(ctx.ids.vault).request(id)), returned: tx.value };
}

export async function demoReject(ctx: DemoContext, id: string) {
  await demoOwned(ctx, id);
  const tx = await rejectPayout(ctx.ceo, ctx.ids.vault, id, "I never sent this request", true);
  const flagged = events(tx.logs).some((e) => e.event === "receiver_flagged");
  return { ...outcome(tx, await vaultViews(ctx.ids.vault).request(id)), flagged };
}

export interface AttackAttempt {
  label: string;
  key: "function-call key" | "full-access key";
  blocked: boolean;
  reason: string;
  friendly: string;
}

/** The "Try to bypass it" button: every attempt uses Tolu's keys and must fail. */
export async function demoAttack(ctx: DemoContext) {
  const bait = `fastpay-${randomBytes(3).toString("hex")}.testnet`;
  const setup = await requestPayout(ctx.finance, ctx.ids.vault, {
    claimedPrincipal: ctx.ids.ceo,
    receiverId: bait,
    amount: "9000000000",
    memo: "",
    evidence: null,
  });
  if (!setup.ok) throw new Error(friendlyError(setup.error));
  const id = String(setup.value);
  const fullKey = process.env.DEMO_FINANCE_SECRET?.trim();
  const tries: [string, AttackAttempt["key"], () => Promise<TxResult>, RegExp][] = [
    [
      "Call ft_transfer on the token to send tUSD to the scammer",
      "function-call key",
      () =>
        call(ctx.finance, ctx.ids.token, "ft_transfer", { receiver_id: bait, amount: "1000000" }),
      /ReceiverMismatch/,
    ],
    [
      "Same, attaching the 1 yoctoNEAR that ft_transfer needs",
      "function-call key",
      () =>
        call(
          ctx.finance,
          ctx.ids.token,
          "ft_transfer",
          { receiver_id: bait, amount: "1000000" },
          { deposit: ONE_YOCTO },
        ),
      /DepositWithFunctionCall/,
    ],
    [
      `Release the held request #${id} with confirm_payout`,
      "function-call key",
      () => confirmPayout(ctx.finance, ctx.ids.vault, id),
      /DepositWithFunctionCall/,
    ],
    [
      "Add the scammer to the payee allow-list (add_payee)",
      "function-call key",
      () => call(ctx.finance, ctx.ids.vault, "add_payee", { account_id: bait, label: "Partner" }),
      /MethodNameMismatch/,
    ],
    [
      "Send NEAR directly to the scammer",
      "function-call key",
      () => transferNear(ctx.finance, bait, 1n),
      /RequiresFullAccess/,
    ],
  ];
  if (fullKey) {
    const { accountFor } = await import("../near/client");
    const full = accountFor(ctx.ids.finance, fullKey);
    tries.push([
      `Release #${id} with Tolu's own full-access key`,
      "full-access key",
      () => confirmPayout(full, ctx.ids.vault, id),
      /ERR_NOT_PRINCIPAL/,
    ]);
  }
  const attempts: AttackAttempt[] = [];
  for (const [label, key, run, expected] of tries) {
    const r = await run();
    const err = r.error ?? "";
    attempts.push({
      label,
      key,
      blocked: !r.ok && expected.test(err),
      reason: err.match(expected)?.[0] ?? (r.ok ? "NOT BLOCKED" : err.slice(0, 160)),
      friendly: r.ok ? "This attempt was not blocked." : friendlyError(err),
    });
  }
  const cleanup = await cancelPayout(ctx.finance, ctx.ids.vault, id);
  const after = await vaultViews(ctx.ids.vault).request(id);
  return {
    setupTx: setup.hash,
    requestId: id,
    attempts,
    cleanupTx: cleanup.hash,
    finalStatus: after?.status ?? null,
  };
}

export async function demoResetCheck(ctx: DemoContext) {
  const sw = await sweepExpired(ctx.ceo, ctx.ids.vault, 20);
  const balances = await vaultViews(ctx.ids.vault).balances();
  return {
    swept: sw.ok ? Number(sw.value ?? 0) : 0,
    sweepTx: sw.hash,
    balances,
    lowFunds: BigInt(balances.available) < 30_000_000_000n,
  };
}
