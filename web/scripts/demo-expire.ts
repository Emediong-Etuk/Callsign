/** npm run demo:expire — silence is safe: a held request expires and its funds are released. */
import { formatTusd, toBaseUnits } from "../lib/near/format";
import { requestPayout, sweepExpired, vaultViews } from "../lib/near/vault";
import {
  color,
  demoSigners,
  expect,
  loadDeployment,
  runDemo,
  step,
  txLine,
} from "./lib/testnet";

runDemo(async () => {
  const d = loadDeployment();
  const s = demoSigners(d);
  const v = vaultViews(d.accounts.vault);
  const r = await requestPayout(s.finance, d.accounts.vault, {
    claimedPrincipal: d.accounts.ceo,
    receiverId: d.accounts.supplier,
    amount: toBaseUnits(750),
    memo: "Will expire",
    evidence: null,
  });
  expect(r.ok, `request failed: ${r.error}`);
  const id = String(r.value);
  const req = (await v.request(id))!;
  step(1, 3, `Held request #${id}: ${formatTusd(req.amount)} → ${req.receiver_id}`);
  txLine(r);
  const expiresMs = Number(BigInt(req.expires_at_ns!) / 1_000_000n);
  while (Date.now() < expiresMs + 2_000) {
    const left = Math.max(0, Math.ceil((expiresMs - Date.now()) / 1000));
    process.stdout.write(
      `\r      waiting for the hold window… ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} `,
    );
    await new Promise((res) => setTimeout(res, 1000));
  }
  console.log();
  step(2, 3, `Nobody confirmed. View now reports: ${(await v.request(id))!.effective_status}`);
  // Anyone may sweep; Tolu's limited key can't (not in its method list), so the owner does it.
  const sw = await sweepExpired(s.owner, d.accounts.vault);
  expect(sw.ok, `sweep failed: ${sw.error}`);
  const final = (await v.request(id))!;
  expect(final.status === "Expired", `expected Expired, got ${final.status}`);
  step(
    3,
    3,
    `${color.green("EXPIRED")} — funds released, can never execute. Available: ${formatTusd((await v.balances()).available)}`,
  );
  txLine(sw);
});
