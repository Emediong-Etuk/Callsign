/**
 * npm run demo:attack — a compromised finance session (or a prompt-injected agent
 * holding Tolu's key) tries to move money. Every attempt must be blocked.
 */
import { call, transferNear, type TxResult } from "../lib/near/client";
import { ONE_YOCTO } from "../lib/near/config";
import { friendlyError } from "../lib/errors";
import { toBaseUnits } from "../lib/near/format";
import { confirmPayout, requestPayout } from "../lib/near/vault";
import {
  color,
  demoSigners,
  detail,
  expect,
  freshScamName,
  loadDeployment,
  runDemo,
  step,
  txLine,
} from "./lib/testnet";

runDemo(async () => {
  const d = loadDeployment();
  const s = demoSigners(d);
  const T = 7;
  const scam = freshScamName();

  // Set-up: a held request the attacker would love to release.
  const held = await requestPayout(s.finance, d.accounts.vault, {
    claimedPrincipal: d.accounts.ceo,
    receiverId: scam,
    amount: toBaseUnits(9_000),
    memo: "",
    evidence: null,
  });
  expect(held.ok, `setup request failed: ${held.error}`);
  const id = String(held.value);
  step(1, T, `Set-up: held request #${id} to ${scam} (waiting for Ada)`);
  txLine(held);

  const attempts: [string, () => Promise<TxResult>, RegExp][] = [
    [
      "Tolu's function-call key calls ft_transfer on the token (steal tUSD)",
      () =>
        call(s.finance, d.accounts.token, "ft_transfer", {
          receiver_id: scam,
          amount: toBaseUnits(1),
        }),
      /ReceiverMismatch/,
    ],
    [
      "…same, with the 1 yoctoNEAR that ft_transfer requires",
      () =>
        call(
          s.finance,
          d.accounts.token,
          "ft_transfer",
          { receiver_id: scam, amount: toBaseUnits(1) },
          { deposit: ONE_YOCTO },
        ),
      /DepositWithFunctionCall/,
    ],
    [
      "Tolu's function-call key calls confirm_payout on the held request",
      () => confirmPayout(s.finance, d.accounts.vault, id),
      /DepositWithFunctionCall/,
    ],
    [
      "Tolu's function-call key calls add_payee on the vault (allow-list the scammer)",
      () => call(s.finance, d.accounts.vault, "add_payee", { account_id: scam, label: "Partner" }),
      /MethodNameMismatch/,
    ],
    [
      "Tolu's function-call key sends NEAR directly",
      () => transferNear(s.finance, scam, 1n),
      /RequiresFullAccess/,
    ],
    [
      "Tolu's FULL-ACCESS key calls confirm_payout (she is not the claimed principal)",
      () => confirmPayout(s.financeFull, d.accounts.vault, id),
      /ERR_NOT_PRINCIPAL/,
    ],
  ];

  let n = 2;
  for (const [label, attempt, expected] of attempts) {
    const r = await attempt();
    step(n++, T, label);
    expect(!r.ok || !!r.error, `ATTACK SUCCEEDED: ${label}`);
    const err = r.error ?? "";
    expect(expected.test(err), `blocked, but not for the expected reason: ${err}`);
    const reason = err.match(expected)?.[0] ?? err;
    detail(
      `${color.green("✅ blocked as expected:")} ${reason} — ${color.dim(friendlyError(err))}`,
    );
  }

  // Clean up the bait so the vault's reservations don't pile up.
  const cancel = await call(s.finance, d.accounts.vault, "cancel_payout", { id });
  detail(
    color.dim(
      `cleanup: request #${id} cancelled (${cancel.ok ? "ok" : cancel.error}); nothing moved`,
    ),
  );
});
