/**
 * POST /api/analyze — red-flag check. STATELESS: the message text is used for
 * this one request and then dropped. It is never logged, stored or written
 * on-chain. (No console.log of the body anywhere in this route.)
 */
import { z } from "zod";
import { analyzeAgainstVault } from "@/lib/server/analysis";
import { json } from "@/lib/server/demo";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const body = z.object({
  text: z.string().min(1).max(6000),
  claimedPrincipal: z.string().min(2).max(64),
  receiverId: z.string().min(2).max(64),
  amount: z.string().regex(/^\d{1,30}$/),
});

export async function POST(req: Request) {
  const limit = rateLimit(`analyze:${clientIp(req)}`, 30);
  if (!limit.ok)
    return json({ error: `Too many checks. Try again in ${limit.retryAfterS}s.` }, 429);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return json(
      { error: "Message must be 1–6,000 characters, with a receiver and an amount." },
      400,
    );
  try {
    return json(await analyzeAgainstVault(parsed.data));
  } catch {
    return json({ error: "Couldn't read the vault from NEAR testnet. Try again." }, 502);
  }
}
