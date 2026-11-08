/** npm run demo:reset — sweeps expired holds and tops the vault back up to 100,000 tUSD if below 50,000. */
import { call } from "../lib/near/client";
import { TGAS } from "../lib/near/config";
import { formatTusd } from "../lib/near/format";
import { sweepExpired, vaultViews } from "../lib/near/vault";
import { color, demoSigners, detail, loadDeployment, runDemo, step, txLine } from "./lib/testnet";

runDemo(async () => {
  const d = loadDeployment();
  const s = demoSigners(d);
  const v = vaultViews(d.accounts.vault);
  const sw = await sweepExpired(s.owner, d.accounts.vault, 50);
  step(1, 2, `Swept ${sw.ok ? String(sw.value) : `0 (${sw.error})`} expired request(s)`);
  txLine(sw);
  const b = await v.balances();
  const target = 100_000_000_000n;
  if (BigInt(b.vault_balance) < 50_000_000_000n) {
    const amount = target - BigInt(b.vault_balance);
    const t = await call(
      s.owner,
      d.accounts.token,
      "ft_transfer_call",
      { receiver_id: d.accounts.vault, amount: amount.toString(), msg: "" },
      { deposit: 1n, gas: 100n * TGAS },
    );
    step(
      2,
      2,
      `Topped up ${formatTusd(amount)} ${t.ok ? color.green("ok") : color.red(t.error ?? "")}`,
    );
    txLine(t);
  } else {
    step(2, 2, `Vault holds ${formatTusd(b.vault_balance)} — no top-up needed`);
  }
  detail(`available now: ${formatTusd((await v.balances()).available)}`);
});
