import { vaultViews } from "@/lib/near/vault";
import { deploymentIds } from "@/lib/server/deployment";
import { json } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^\d{1,19}$/.test(id)) return json({ error: "bad id" }, 400);
  const ids = deploymentIds();
  if (!ids) return json({ error: "Vault not configured" }, 503);
  const v = vaultViews(ids.vault);
  try {
    const [request, members] = await Promise.all([v.request(id), v.members()]);
    if (!request) return json({ error: "Request not found" }, 404);
    const flag = await v.flag(request.receiver_id);
    return json({ request, members, flag, ids });
  } catch {
    return json({ error: "Couldn't reach NEAR testnet RPC." }, 502);
  }
}
