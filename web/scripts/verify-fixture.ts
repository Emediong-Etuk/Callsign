/**
 * npm run verify:fixture — re-checks captured NEAR AI evidence OFFLINE (no key, no network).
 *  1. fixtures/nearai-attestation-sample.json: real attestation report — quote binds signer +
 *     nonce, MRCONFIGID matches app_compose, RTMR3 event-log replay matches, debug off.
 *  2. fixtures/nearai-verified-sample.json (if present): real signed completion — exact-byte
 *     hashes, ECDSA signer recovery, signer ∈ preflight attestation; tampering must fail.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { attestationSchema } from "../lib/verify/nearai-verify";
import { checkNearReport } from "../lib/verify/tdx";
import { verifyFixtureFile } from "./lib/fixture";

const dir = path.resolve(import.meta.dirname, "..", "fixtures");
let failed = false;
const ok = (cond: boolean, label: string) => {
  console.log(`${cond ? "✅" : "❌"} ${label}`);
  if (!cond) failed = true;
};

const att = attestationSchema.parse(
  JSON.parse(readFileSync(path.join(dir, "nearai-attestation-sample.json"), "utf8")),
);
console.log(`Attestation sample: model ${att.model}, fetched ${att.fetched_at}`);
att.model_attestations.forEach((r, i) => {
  const c = checkNearReport(r, att.nonce);
  ok(
    c.ok,
    `model report #${i + 1} (${r.signing_address}) binds signer + nonce, config and RTMR3 match${c.ok ? "" : ": " + c.failures.join("; ")}`,
  );
});
if (att.gateway_attestation) {
  const c = checkNearReport(att.gateway_attestation, att.nonce);
  ok(
    c.ok,
    `gateway report binds signer + nonce, config and RTMR3 match${c.ok ? "" : ": " + c.failures.join("; ")}`,
  );
}

const signed = path.join(dir, "nearai-verified-sample.json");
if (existsSync(signed)) {
  const r = verifyFixtureFile(signed);
  const v = r.verification;
  console.log(`Signed completion sample (signature_kind: ${v.signature_kind}):`);
  ok(v.hashes_match, "signed text = hashes of the exact request/response bytes");
  ok(v.signature_valid, "ECDSA signature recovers to signing_address");
  ok(v.address_in_attestation, "signer matches exactly one preflight attestation report");
  ok(v.attestation_bindings_valid, "that report binds signer + nonce, config and RTMR3");
  ok(r.tamperedResponseFails, "flipping one response byte makes verification fail");
  ok(r.swappedAddressFails, "swapping the signing address makes verification fail");
} else {
  console.log(
    "ℹ️  fixtures/nearai-verified-sample.json not captured yet (needs a NEAR AI key: npm run capture:fixture)",
  );
}
console.log(
  "Not checked by this app: Intel DCAP quote signature chain, NVIDIA GPU evidence (see README).",
);
process.exit(failed ? 1 : 0);
