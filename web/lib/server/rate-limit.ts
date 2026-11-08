/**
 * Best-effort in-memory rate limiter (per server instance). On serverless hosts
 * each instance has its own window, so this slows abuse rather than stopping it.
 */
const windows = new Map<string, number[]>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs = 60 * 60 * 1000,
): { ok: boolean; retryAfterS: number } {
  const now = Date.now();
  const hits = (windows.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    windows.set(key, hits);
    return { ok: false, retryAfterS: Math.ceil((windowMs - (now - hits[0]!)) / 1000) };
  }
  hits.push(now);
  windows.set(key, hits);
  if (windows.size > 10_000) windows.clear();
  return { ok: true, retryAfterS: 0 };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}
