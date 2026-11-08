/** Offline re-verification of a captured NEAR AI fixture (no API key, no network). */
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  attestationSchema,
  isVerified,
  signatureSchema,
  verifyNearAiResponse,
} from "../../lib/verify/nearai-verify";
import type { Verification } from "../../lib/analyzer/types";

const fixtureSchema = z.object({
  model: z.string(),
  raw_request: z.string(),
  raw_response: z.string(),
  signature: signatureSchema,
  attestation: attestationSchema,
});

export interface FixtureResult {
  verification: Verification;
  verified: boolean;
  tamperedResponseFails: boolean;
  swappedAddressFails: boolean;
}

export function verifyFixtureFile(file: string): FixtureResult {
  const f = fixtureSchema.parse(JSON.parse(readFileSync(file, "utf8")));
  const base = {
    model: f.model,
    rawRequest: f.raw_request,
    rawResponse: f.raw_response,
    signature: f.signature,
    attestation: f.attestation,
  };
  const verification = verifyNearAiResponse(base);

  // Flip one byte of the response: the hash, and therefore the check, must fail.
  const i = Math.floor(f.raw_response.length / 2);
  const flipped =
    f.raw_response.slice(0, i) +
    (f.raw_response[i] === "a" ? "b" : "a") +
    f.raw_response.slice(i + 1);
  const tampered = verifyNearAiResponse({ ...base, rawResponse: flipped });

  const swapped = verifyNearAiResponse({
    ...base,
    signature: { ...f.signature, signing_address: "0x000000000000000000000000000000000000dead" },
  });
  return {
    verification,
    verified: isVerified(verification),
    tamperedResponseFails: !isVerified(tampered),
    swappedAddressFails: !isVerified(swapped),
  };
}
