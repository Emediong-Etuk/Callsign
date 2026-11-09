import { z } from "zod";
import { demoContext, json } from "@/lib/server/demo";
import { demoReject } from "@/lib/server/demo-flows";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({ id: z.string().regex(/^\d{1,19}$/) });

export async function POST(req: Request) {
  const gate = await demoContext();
  if (!gate.ok) return json({ error: gate.error }, gate.status);
  const limit = rateLimit(`demo:${clientIp(req)}`, 20);
  if (!limit.ok)
    return json(
      {
        error: `Demo limit reached (20 actions/hour). Try again in ${Math.ceil(limit.retryAfterS / 60)} min.`,
      },
      429,
    );
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad request" }, 400);
  try {
    return json(await demoReject(gate.ctx, parsed.data.id));
  } catch (e) {
    return json({ error: (e as Error).message }, 400);
  }
}
