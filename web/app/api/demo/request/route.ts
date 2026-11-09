import { z } from "zod";
import { demoContext, json } from "@/lib/server/demo";
import { demoRequest, demoRetry } from "@/lib/server/demo-flows";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.union([
  z.object({ scenario: z.enum(["scam", "routine", "supplier"]) }),
  z.object({ scenario: z.literal("retry"), receiverId: z.string().max(64) }),
]);

export async function POST(req: Request) {
  const gate = await demoContext();
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  const limit = rateLimit(`demo:${clientIp(req)}`, 20);
  if (!limit.ok)
    return json(
      {
        error: `Demo limit reached (20 actions/hour). Try again in ${Math.ceil(limit.retryAfterS / 60)} min, or run it yourself (README).`,
      },
      429,
    );
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad request" }, 400);
  try {
    if (parsed.data.scenario === "retry")
      return json(await demoRetry(gate.ctx, parsed.data.receiverId));
    return json(await demoRequest(gate.ctx, parsed.data.scenario));
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
