import { DEFAULT_MODEL } from "@/lib/analyzer/nearai";
import { NETWORK, rpcUrls } from "@/lib/near/config";
import { deploymentIds } from "@/lib/server/deployment";
import { json } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/** Public configuration only. No secrets. */
export function GET() {
  const ids = deploymentIds();
  return json({
    ok: true,
    network: NETWORK,
    rpc: rpcUrls()[0],
    vault: ids?.vault ?? null,
    token: ids?.token ?? null,
    ai_enabled: !!process.env.NEARAI_API_KEY,
    ai_model: process.env.NEARAI_MODEL || DEFAULT_MODEL,
    demo_mode:
      process.env.DEMO_MODE === "true" &&
      !!process.env.DEMO_FINANCE_FCK_SECRET &&
      !!process.env.DEMO_CEO_SECRET,
  });
}
