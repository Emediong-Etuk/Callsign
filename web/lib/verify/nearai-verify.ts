/**
 * Response-signature verification for NEAR AI Cloud (G8), following
 * docs.near.ai/cloud/verification/cloud-api/response-signatures and
 * docs.near.ai/cloud/verification/reference/response-signature-verification.
 *
 *   request_hash  = sha256(exact request-body bytes)
 *   response_hash = sha256(exact response-body bytes)
 *   provider_tee: text = "<MODEL_ID>:<request_hash>:<response_hash>", signer must
 *                 match exactly one model report verified BEFORE the request
 *   gateway:      text = "<request_hash>:<response_hash>", signer must match the
 *                 gateway report verified before the request
 *
 * Pure and offline: everything it needs is passed in, so the same code checks
 * live calls and the committed fixture (`npm run verify:fixture`).
 */
import { createHash, timingSafeEqual } from "node:crypto";
import { verifyMessage } from "ethers";
import { z } from "zod";
import type { Verification } from "../analyzer/types";
import { checkNearReport, nearReportSchema, type NearReport } from "./tdx";

export const sha256Hex = (s: string | Uint8Array) => createHash("sha256").update(s).digest("hex");

export const signatureSchema = z.object({
  text: z.string(),
  signature: z.string(),
  signing_address: z.string(),
  signing_algo: z.string(),
  signature_kind: z.string().optional().nullable(),
});
export type SignaturePayload = z.infer<typeof signatureSchema>;

export const attestationSchema = z.object({
  nonce: z.string().regex(/^[0-9a-f]{64}$/),
  model: z.string(),
  fetched_at: z.string(),
  gateway_attestation: nearReportSchema.optional().nullable(),
  model_attestations: z.array(nearReportSchema).default([]),
});
export type AttestationEvidence = z.infer<typeof attestationSchema>;

export interface VerifyInput {
  model: string;
  rawRequest: string;
  rawResponse: string;
  signature: SignaturePayload;
  attestation: AttestationEvidence;
}

function hexBytes(value: string, expected: number): Buffer {
  const hex = value.replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2) throw new Error("not hex");
  const b = Buffer.from(hex, "hex");
  if (b.length !== expected) throw new Error(`expected ${expected} bytes`);
  return b;
}

const sameAddress = (a: string, b: string) => {
  try {
    return timingSafeEqual(hexBytes(a, 20), hexBytes(b, 20));
  } catch {
    return false;
  }
};

/** Runs every check and reports each one separately (never throws). */
export function verifyNearAiResponse(input: VerifyInput): Verification {
  const notes: string[] = [];
  const { signature, attestation, model } = input;
  const kind = signature.signature_kind ?? null;
  const reqHash = sha256Hex(input.rawRequest);
  const respHash = sha256Hex(input.rawResponse);

  // 1. The signed text must equal the hashes of the exact bytes we kept.
  let expectedText: string | null = null;
  if (kind === "provider_tee") expectedText = `${model}:${reqHash}:${respHash}`;
  else if (kind === "gateway") expectedText = `${reqHash}:${respHash}`;
  else notes.push(`unknown signature_kind ${JSON.stringify(kind)}: cannot build the expected text`);
  const hashes_match = expectedText !== null && signature.text === expectedText;
  if (expectedText !== null && !hashes_match)
    notes.push("signed text does not match the exact request/response bytes");

  // 2. ECDSA (EIP-191 personal-sign) signature must recover to signing_address.
  let signature_valid = false;
  if (signature.signing_algo !== "ecdsa") {
    notes.push(`signing_algo ${signature.signing_algo} not supported by this app (ecdsa only)`);
  } else {
    try {
      hexBytes(signature.signature, 65);
      const recovered = verifyMessage(
        signature.text,
        signature.signature.startsWith("0x") ? signature.signature : `0x${signature.signature}`,
      );
      signature_valid = sameAddress(recovered, signature.signing_address);
      if (!signature_valid) notes.push("signature does not recover to signing_address");
    } catch (e) {
      notes.push(`signature malformed: ${(e as Error).message}`);
    }
  }

  // 3. The signer must match preflight evidence (fetched before the request, with our nonce).
  const verifiedReport = (r: NearReport) => {
    const check = checkNearReport(r, attestation.nonce);
    if (!check.ok)
      notes.push(`attestation candidate ${r.signing_address}: ${check.failures.join("; ")}`);
    return check.ok;
  };
  let address_in_attestation = false;
  let attestation_bindings_valid = false;
  if (kind === "provider_tee") {
    const candidates = attestation.model_attestations.filter(
      (r) =>
        r.signing_algo === signature.signing_algo &&
        sameAddress(r.signing_address, signature.signing_address),
    );
    address_in_attestation = candidates.length === 1;
    if (candidates.length === 0) notes.push("signer is not among the model attestation candidates");
    if (candidates.length > 1) notes.push("signer matches more than one model report (ambiguous)");
    attestation_bindings_valid = address_in_attestation && verifiedReport(candidates[0]!);
  } else if (kind === "gateway") {
    const gw = attestation.gateway_attestation;
    address_in_attestation =
      !!gw &&
      gw.signing_algo === signature.signing_algo &&
      sameAddress(gw.signing_address, signature.signing_address);
    if (!address_in_attestation) notes.push("signer does not match the gateway attestation");
    attestation_bindings_valid = address_in_attestation && !!gw && verifiedReport(gw);
    notes.push("gateway signature: binds the reply to the TEE gateway, not to a model report");
  }

  return {
    hashes_match,
    signature_valid,
    address_in_attestation,
    attestation_bindings_valid,
    hardware_verified: false,
    signature_kind: kind,
    notes,
  };
}

/** `verified` needs every check this app performs to pass. */
export function isVerified(v: Verification): boolean {
  return (
    v.hashes_match && v.signature_valid && v.address_in_attestation && v.attestation_bindings_valid
  );
}
