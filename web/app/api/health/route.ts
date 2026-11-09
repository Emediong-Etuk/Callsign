import { DEFAULT_MODEL } from "@/lib/analyzer/nearai";
import { NETWORK, rpcUrls } from "@/lib/near/config";
import { deploymentIds } from "@/lib/server/deployment";
import { demoContext, financeKeyStatus, json } from "@/lib/server/demo";

export const dynamic = "force-dynamic";

/** Public configuration only. No secrets (the finance key is reported only by kind). */
export async function GET() {
  const ids = deploymentIds();
  const gate = await demoContext();
  const fck = process.env.DEMO_FINANCE_FCK_SECRET?.trim();
  const financeKey = ids && fck ? (await financeKeyStatus(ids, fck)).kind : null;
  return json({
    ok: true,
    network: NETWORK,
    rpc: rpcUrls()[0],
    vault: ids?.vault ?? null,
    token: ids?.token ?? null,
    ai_enabled: !!process.env.NEARAI_API_KEY,
    ai_model: process.env.NEARAI_MODEL || DEFAULT_MODEL,
    demo_mode: gate.ok,
    demo_error: gate.ok || process.env.DEMO_MODE !== "true" ? null : gate.error,
    finance_key: financeKey,
  });
}
