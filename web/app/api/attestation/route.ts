/** GET /api/attestation?model= — summary of the model's TEE attestation, checked server-side with a fresh nonce. */
import { DEFAULT_MODEL, fetchAttestation } from "@/lib/analyzer/nearai";
import { checkNearReport } from "@/lib/verify/tdx";
import { json } from "@/lib/server/demo";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!rateLimit(`att:${clientIp(req)}`, 60).ok) return json({ error: "Too many requests" }, 429);
  const model =
    new URL(req.url).searchParams.get("model") || process.env.NEARAI_MODEL || DEFAULT_MODEL;
  if (!/^[\w.\-/]{3,96}$/.test(model)) return json({ error: "bad model id" }, 400);
  try {
    const att = await fetchAttestation(model); // cached per model for 10 minutes
    const candidates = att.model_attestations.map((r) => ({
      signing_address: r.signing_address,
      signing_algo: r.signing_algo,
      checks: checkNearReport(r, att.nonce),
    }));
    const gateway = att.gateway_attestation
      ? {
          signing_address: att.gateway_attestation.signing_address,
          checks: checkNearReport(att.gateway_attestation, att.nonce),
        }
      : null;
    return json({
      model,
      nonce: att.nonce,
      fetched_at: att.fetched_at,
      model_attestations: candidates,
      gateway,
      checked: [
        "nonce echoed",
        "quote report_data binds signer + nonce",
        "TDX debug off",
        "MRCONFIGID = app_compose hash",
        "RTMR3 event-log replay",
      ],
      not_checked: ["Intel DCAP quote signature chain", "NVIDIA GPU attestation"],
      verify_yourself: "https://cloud.near.ai/verify",
    });
  } catch (e) {
    return json({ error: `attestation unavailable: ${(e as Error).message}` }, 502);
  }
}
