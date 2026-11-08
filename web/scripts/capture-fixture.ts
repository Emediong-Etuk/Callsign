/**
 * Captures real NEAR AI Cloud evidence into web/fixtures/ (fictional scenario only).
 *
 *   npm run capture:fixture -- --attestation-only   # no API key needed
 *   NEARAI_API_KEY=... npm run capture:fixture      # full signed completion
 *
 * The full fixture keeps the exact raw request/response bytes, the signature
 * payload and the attestation subset needed to re-verify offline. Large fields
 * we don't check (NVIDIA GPU payload, OHTTP keys) are dropped.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnv } from "./lib/env";
import { analyze } from "../lib/analyzer";
import { DEFAULT_MODEL, fetchAttestation, nearAiConfigFromEnv } from "../lib/analyzer/nearai";
import type { AttestationEvidence } from "../lib/verify/nearai-verify";

loadEnv();
const root = path.resolve(import.meta.dirname, "..");
const attestationOnly = process.argv.includes("--attestation-only");

function slim(a: AttestationEvidence): AttestationEvidence {
  const keep = (r: NonNullable<AttestationEvidence["gateway_attestation"]>) => ({
    model_name: r.model_name,
    signing_address: r.signing_address,
    signing_algo: r.signing_algo,
    request_nonce: r.request_nonce,
    intel_quote: r.intel_quote,
    event_log: r.event_log,
    info: { tcb_info: r.info.tcb_info },
  });
  return {
    ...a,
    gateway_attestation: a.gateway_attestation ? keep(a.gateway_attestation) : null,
    model_attestations: a.model_attestations.map(keep),
  };
}

async function main() {
  const model = process.env.NEARAI_MODEL?.trim() || DEFAULT_MODEL;
  if (attestationOnly) {
    const att = await fetchAttestation(model, fetch, false);
    const out = path.join(root, "fixtures", "nearai-attestation-sample.json");
    writeFileSync(out, JSON.stringify(slim(att), null, 2) + "\n");
    console.log(
      `wrote ${out} (${att.model_attestations.length} model candidate(s), nonce ${att.nonce})`,
    );
    return;
  }
  const cfg = nearAiConfigFromEnv();
  if (!cfg)
    throw new Error("NEARAI_API_KEY is not set (use --attestation-only to capture without a key)");

  const text = readFileSync(
    path.join(root, "fixtures", "scenarios", "ceo-urgent-wire.txt"),
    "utf8",
  );
  const ceo = { accountId: "ceo.callsign-demo.testnet", displayName: "Ada Okafor", title: "CEO" };
  // Capture the attestation ourselves so the exact preflight evidence lands in the fixture.
  const attestation = await fetchAttestation(cfg.model, fetch, false);
  const result = await analyze(
    {
      text,
      claimedPrincipal: ceo,
      receiverId: "fastpay-7f3a91.testnet",
      amount: "25000000000",
      knownPayees: ["vendor.callsign-demo.testnet"],
      members: [ceo],
      instantLimit: "500000000",
    },
    { ai: cfg },
  );
  if (!result.ai || !result.raw) throw new Error(`AI call failed: ${result.aiError}`);
  const fixture = {
    description:
      "Real NEAR AI Cloud response for the fictional ceo-urgent-wire scenario, captured by scripts/capture-fixture.ts",
    captured_at: new Date().toISOString(),
    model: cfg.model,
    raw_request: result.raw.request,
    raw_response: result.raw.response,
    signature: {
      text: undefined as string | undefined,
      signature: result.ai.signature,
      signing_address: result.ai.signing_address,
      signing_algo: result.ai.signing_algo,
      signature_kind: result.ai.verification.signature_kind,
    },
    attestation: slim(attestation),
    verification_at_capture: result.ai.verification,
  };
  // Re-fetch the signature text exactly as returned (analyze() only kept the parts it needed).
  const sigRes = await fetch(
    `https://cloud-api.near.ai/v1/signature/${encodeURIComponent(result.ai.chat_id)}?signing_algo=ecdsa`,
    { headers: { Authorization: `Bearer ${cfg.apiKey}`, Accept: "application/json" } },
  );
  const sig = (await sigRes.json()) as { text: string };
  fixture.signature.text = sig.text;
  const out = path.join(root, "fixtures", "nearai-verified-sample.json");
  writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
  console.log(`wrote ${out}; ai status at capture: ${result.aiStatus}`);
  console.log(JSON.stringify(result.ai.verification, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
