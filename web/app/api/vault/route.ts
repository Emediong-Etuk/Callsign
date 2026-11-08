/** GET /api/vault — everything the dashboards need, from contract views. */
import { vaultViews } from "@/lib/near/vault";
import { deploymentIds } from "@/lib/server/deployment";
import { json } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

export async function GET() {
  const ids = deploymentIds();
  if (!ids) return json({ configured: false }, 200);
  const v = vaultViews(ids.vault);
  try {
    const [config, balances, members, payees, flags, requests] = await Promise.all([
      v.config(),
      v.balances(),
      v.members(),
      v.payees(),
      v.flags(),
      v.requests(30),
    ]);
    return json({ configured: true, ids, config, balances, members, payees, flags, requests });
  } catch {
    return json({ configured: true, error: "Couldn't reach NEAR testnet RPC." }, 502);
  }
}
