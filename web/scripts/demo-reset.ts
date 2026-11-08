/** npm run demo:reset — sweeps expired holds and tops the vault back up to 100,000 tUSD if below 50,000. */
import { call } from "../lib/near/client";
import { TGAS } from "../lib/near/config";
import { formatTusd } from "../lib/near/format";
import { accountFor } from "../lib/near/client";
import { ftBalance, sweepExpired, vaultViews } from "../lib/near/vault";
import {
  color,
  demoSigners,
  detail,
  loadDeployment,
  runDemo,
  secretFor,
  step,
  txLine,
} from "./lib/testnet";

runDemo(async () => {
  const d = loadDeployment();
  const s = demoSigners(d);
  const v = vaultViews(d.accounts.vault);
  const sw = await sweepExpired(s.owner, d.accounts.vault, 50);
  step(1, 2, `Swept ${sw.ok ? String(sw.value) : `0 (${sw.error})`} expired request(s)`);
  txLine(sw);
  // Recycle demo payouts: the vendor and supplier are our own demo accounts.
  for (const [name, envVar] of [
    ["vendor", "DEMO_VENDOR_SECRET"],
    ["supplier", "DEMO_SUPPLIER_SECRET"],
  ] as const) {
    const id = d.accounts[name];
    const held = await ftBalance(d.accounts.token, id);
    if (held === 0n) continue;
    try {
      const acct = accountFor(id, secretFor(id, envVar));
      const back = await call(
        acct,
        d.accounts.token,
        "ft_transfer_call",
        { receiver_id: d.accounts.vault, amount: held.toString(), msg: "" },
        { deposit: 1n, gas: 50n * TGAS },
      );
      detail(
        back.ok
          ? `recycled ${formatTusd(held)} from ${name} back into the vault`
          : color.red(`could not recycle from ${name}: ${back.error}`),
      );
    } catch (e) {
      detail(color.dim(`skip ${name}: ${(e as Error).message}`));
    }
  }
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
