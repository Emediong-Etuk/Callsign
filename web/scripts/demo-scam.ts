/** npm run demo:scam — the deepfake-CEO wire: held → "I didn't send this" → flagged → retry blocked. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { friendlyError, errorCode } from "../lib/errors";
import { formatTime, formatTusd, toBaseUnits } from "../lib/near/format";
import { events } from "../lib/near/client";
import { rejectPayout, requestPayout, vaultViews } from "../lib/near/vault";
import { analyzeScenario, printAnalysis } from "./lib/demo-analyze";
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
  const v = vaultViews(d.accounts.vault);
  const T = 6;
  const scam = freshScamName();
  const amount = toBaseUnits(25_000);
  const before = await v.balances();

  const text = readFileSync(
    path.resolve(import.meta.dirname, "..", "fixtures", "scenarios", "ceo-urgent-wire.txt"),
    "utf8",
  );
  step(1, T, `Message loaded: "${text.slice(0, 74).trim()}…"`);

  const a = await analyzeScenario(d, "ceo-urgent-wire.txt", scam, amount);
  step(2, T, `Red-flag check: ${printAnalysis(a)}`);
  expect(a.finalRisk === "high", `expected HIGH risk, got ${a.finalRisk}`);

  const req = await requestPayout(s.finance, d.accounts.vault, {
    claimedPrincipal: d.accounts.ceo,
    receiverId: scam,
    amount,
    memo: "Partner wallet — Lisbon deal",
    evidence: a.onChainEvidence,
  });
  expect(req.ok, `request failed: ${req.error}`);
  const id = String(req.value);
  const r = await v.request(id);
  expect(r?.status === "Pending", `expected HELD (Pending), got ${r?.status}`);
  step(3, T, `Tolu requested ${formatTusd(amount)} → ${scam}`);
  detail(
    `${color.amber("HELD")} — waiting for Ada Okafor (${d.accounts.ceo}) · expires ${formatTime(r!.expires_at_ns!)}`,
  );
  txLine(req);

  const rej = await rejectPayout(s.ceo, d.accounts.vault, id, "I never sent this request", true);
  expect(rej.ok, `reject failed: ${rej.error}`);
  const flagged = events(rej.logs).some((e) => e.event === "receiver_flagged");
  expect(flagged, "expected a receiver_flagged event");
  step(
    4,
    T,
    `Ada: "I didn't send this" → ${color.red("BLOCKED & REPORTED")} · receiver flagged on-chain`,
  );
  txLine(rej);

  const retry = await requestPayout(s.finance, d.accounts.vault, {
    claimedPrincipal: d.accounts.ceo,
    receiverId: scam,
    amount,
    memo: "",
    evidence: a.onChainEvidence,
  });
  expect(
    !retry.ok && errorCode(retry.error ?? "") === "ERR_RECEIVER_FLAGGED",
    `expected ERR_RECEIVER_FLAGGED, got ${retry.error}`,
  );
  step(5, T, `Retry to ${scam} → rejected: ERR_RECEIVER_FLAGGED ✅`);
  detail(color.dim(friendlyError(retry.error)));

  const after = await v.balances();
  expect(
    after.available === before.available && after.vault_balance === before.vault_balance,
    "balances changed!",
  );
  step(6, T, `Vault available: ${formatTusd(after.available)} (unchanged) ✅`);
});
