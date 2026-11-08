import { demoContext, json } from "@/lib/server/demo";
import { demoResetCheck } from "@/lib/server/demo-flows";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const gate = demoContext();
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  if (!rateLimit(`demo:${clientIp(req)}`, 20).ok)
    return json({ error: "Demo limit reached." }, 429);
  try {
    return json(await demoResetCheck(gate.ctx));
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
