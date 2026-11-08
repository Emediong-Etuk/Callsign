import { createHash } from "node:crypto";
import type { FlagType } from "../flags";
import { toContractRisk, type EvidenceBundle, type Flag, type OnChainEvidence } from "./types";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/** JSON with object keys sorted recursively, no whitespace. Deterministic across runs. */
export function canonicalJson(value: unknown): string {
  const sort = (v: unknown): Json => {
    if (v === null || typeof v !== "object") return (v ?? null) as Json;
    if (Array.isArray(v)) return v.map(sort);
    const out: { [k: string]: Json } = {};
    for (const k of Object.keys(v as object).sort()) {
      const child = (v as Record<string, unknown>)[k];
      if (child !== undefined) out[k] = sort(child);
    }
    return out;
  };
  return JSON.stringify(sort(value));
}

/** sha256 of the canonical bundle. Raw request/response bodies are not part of the bundle. */
export function evidenceHash(bundle: EvidenceBundle): string {
  return createHash("sha256").update(canonicalJson(bundle)).digest("hex");
}

/**
 * The only thing that goes on-chain (G7): risk, flag *types*, the bundle hash and
 * verification metadata. Quotes, explanations and the summary stay off-chain.
 */
export function toOnChainEvidence(
  bundle: EvidenceBundle,
  hash: string,
  flags: Flag[],
): OnChainEvidence {
  const types = Array.from(new Set(flags.map((f) => f.type))).slice(0, 10) as FlagType[];
  return {
    evidence_hash: hash,
    risk: toContractRisk(bundle.final_risk),
    flags: types,
    model: (bundle.model ?? "rules-only").slice(0, 96),
    chat_id: (bundle.chat_id ?? "").slice(0, 96),
    signing_address: (bundle.signing_address ?? "").slice(0, 66),
    signature_verified: bundle.ai_status === "verified",
  };
}
