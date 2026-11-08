/** npm run demo:legit — routine invoice paid instantly; new supplier held → Ada confirms (1 yocto) → paid. */
import { formatTusd, toBaseUnits } from "../lib/near/format";
import { confirmPayout, ftBalance, requestPayout, vaultViews } from "../lib/near/vault";
import { analyzeScenario, printAnalysis } from "./lib/demo-analyze";
import { color, demoSigners, expect, loadDeployment, runDemo, step, txLine } from "./lib/testnet";

runDemo(async () => {
  const d = loadDeployment();
  const s = demoSigners(d);
  const v = vaultViews(d.accounts.vault);
  const T = 4;

  // Routine vendor invoice → instant.
  const small = toBaseUnits(200);
  const a1 = await analyzeScenario(d, "routine-invoice.txt", d.accounts.vendor, small);
  step(1, T, `Routine invoice from Harbor Office Supplies: ${printAnalysis(a1)}`);
  const vendorBefore = await ftBalance(d.accounts.token, d.accounts.vendor);
  const r1 = await requestPayout(s.finance, d.accounts.vault, {
    claimedPrincipal: d.accounts.ceo,
    receiverId: d.accounts.vendor,
    amount: small,
    memo: "Invoice HOS-4470",
    evidence: a1.onChainEvidence,
  });
  expect(r1.ok, `request failed: ${r1.error}`);
  const req1 = await v.request(String(r1.value));
  expect(
    req1?.status === "Executed",
    `expected PAID INSTANTLY, got ${req1?.status} (risk ${a1.finalRisk})`,
  );
  const vendorDelta = (await ftBalance(d.accounts.token, d.accounts.vendor)) - vendorBefore;
  step(
    2,
    T,
    `${color.green("PAID INSTANTLY")} (known payee, under limit) → vendor +${formatTusd(vendorDelta)}`,
  );
  txLine(r1);
  expect(vendorDelta === BigInt(small), "vendor balance did not increase by the payout");

  // Real new supplier → held → confirmed by Ada with a 1-yocto wallet approval.
  const amount = toBaseUnits(2_000);
  const supplierBefore = await ftBalance(d.accounts.token, d.accounts.supplier);
  const r2 = await requestPayout(s.finance, d.accounts.vault, {
    claimedPrincipal: d.accounts.ceo,
    receiverId: d.accounts.supplier,
    amount,
    memo: "Kestrel Logistics — first shipment",
    evidence: null,
  });
  expect(r2.ok, `request failed: ${r2.error}`);
  const id = String(r2.value);
  expect(
    (await v.request(id))?.status === "Pending",
    "expected the new supplier payout to be HELD",
  );
  step(
    3,
    T,
    `Tolu requested ${formatTusd(amount)} → Kestrel Logistics (${d.accounts.supplier}): ${color.amber("HELD")} (new payee)`,
  );
  txLine(r2);

  const c = await confirmPayout(s.ceo, d.accounts.vault, id);
  expect(c.ok, `confirm failed: ${c.error}`);
  const req2 = await v.request(id);
  expect(req2?.status === "Executed", `expected PAID after confirmation, got ${req2?.status}`);
  const supplierDelta = (await ftBalance(d.accounts.token, d.accounts.supplier)) - supplierBefore;
  step(
    4,
    T,
    `Ada confirmed from her own account (1 yoctoNEAR) → ${color.green("PAID")} · supplier +${formatTusd(supplierDelta)}`,
  );
  txLine(c);
  expect(supplierDelta === BigInt(amount), "supplier balance did not increase by the payout");
});
