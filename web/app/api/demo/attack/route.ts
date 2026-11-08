import { demoContext, json } from "@/lib/server/demo";
import { demoAttack } from "@/lib/server/demo-flows";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const gate = demoContext();
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  // An attack run sends ~8 transactions, so it counts as 4 demo actions.
  for (let i = 0; i < 4; i++) {
    const limit = rateLimit(`demo:${clientIp(req)}`, 20);
    if (!limit.ok)
      return json(
        {
          error: `Demo limit reached. Try again in ${Math.ceil(limit.retryAfterS / 60)} min, or run npm run demo:attack yourself.`,
        },
        429,
      );
  }
  try {
    return json(await demoAttack(gate.ctx));
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
