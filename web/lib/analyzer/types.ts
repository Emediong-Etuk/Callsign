import { z } from "zod";
import { FLAG_TYPES, type FlagType } from "../flags";

export type RiskLevel = "low" | "medium" | "high";
export const RISK_ORDER: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

export function maxRisk(...levels: RiskLevel[]): RiskLevel {
  return levels.reduce<RiskLevel>((a, b) => (RISK_ORDER[b] > RISK_ORDER[a] ? b : a), "low");
}

/** Risk level as the vault contract spells it. */
export function toContractRisk(level: RiskLevel): "Low" | "Medium" | "High" {
  return level === "high" ? "High" : level === "medium" ? "Medium" : "Low";
}

export const flagTypeSchema = z
  .string()
  .refine((v): v is FlagType => FLAG_TYPES.includes(v), { message: "unknown flag type" });

export const memberSchema = z.object({
  accountId: z.string().min(2).max(64),
  displayName: z.string().max(64),
  title: z.string().max(64),
});

export const analysisInputSchema = z.object({
  text: z.string().min(1).max(6000),
  claimedPrincipal: memberSchema,
  receiverId: z.string().min(2).max(64),
  /** Amount in token base units (6 decimals), as a decimal string. */
  amount: z.string().regex(/^\d{1,30}$/),
  knownPayees: z.array(z.string().max(64)).max(200),
  members: z.array(memberSchema).max(200),
  /** Instant limit in token base units, as a decimal string. */
  instantLimit: z.string().regex(/^\d{1,30}$/),
});
export type AnalysisInput = z.infer<typeof analysisInputSchema>;

export interface Flag {
  type: FlagType;
  /** Exact text from the message (or a short description for account/amount checks). */
  quote: string;
  explanation: string;
  source: "rules" | "ai";
}

export interface RulesVerdict {
  level: RiskLevel;
  flags: Flag[];
}

/** Strict schema for the model's JSON answer. Anything else is treated as invalid output. */
export const aiOutputSchema = z.object({
  risk_level: z.enum(["low", "medium", "high"]),
  flags: z
    .array(
      z.object({
        type: flagTypeSchema,
        quote: z.string().max(300),
        explanation: z.string().max(400),
      }),
    )
    .max(12),
  summary: z.string().max(600),
  recommended_action: z.string().max(400),
});
export type AiOutput = z.infer<typeof aiOutputSchema>;

export type AiStatus = "verified" | "unverified" | "unavailable" | "disabled";

export interface Verification {
  /** Signed text equals the hashes of the exact request/response bytes we kept. */
  hashes_match: boolean;
  /** ECDSA signature recovers to the signing address. */
  signature_valid: boolean;
  /** The signer matches exactly one model attestation fetched *before* the request (with our nonce). */
  address_in_attestation: boolean;
  /** Quote report data binds the signing address and our nonce; config + RTMR3 checks pass. */
  attestation_bindings_valid: boolean;
  /** Intel TDX / NVIDIA hardware signature chains. Not checked by this app (see README). */
  hardware_verified: false;
  signature_kind: string | null;
  notes: string[];
}

export interface AiVerdict {
  model: string;
  chat_id: string;
  output: AiOutput;
  verification: Verification;
  signing_address: string | null;
  signing_algo: string | null;
  signature: string | null;
}

/** What may be written on-chain (G7): categories and metadata only. */
export interface OnChainEvidence {
  evidence_hash: string;
  risk: "Low" | "Medium" | "High";
  flags: FlagType[];
  model: string;
  chat_id: string;
  signing_address: string;
  signature_verified: boolean;
}

export interface EvidenceBundle {
  version: 1;
  created_at: string;
  model: string | null;
  chat_id: string | null;
  request_sha256: string | null;
  response_sha256: string | null;
  signature: string | null;
  signing_address: string | null;
  signing_algo: string | null;
  signature_kind: string | null;
  verification: Verification | null;
  ai_verdict: AiOutput | null;
  rules_verdict: RulesVerdict;
  final_risk: RiskLevel;
  ai_status: AiStatus;
}

export interface AnalysisResult {
  finalRisk: RiskLevel;
  flags: Flag[];
  summary: string;
  rules: RulesVerdict;
  ai: AiVerdict | null;
  aiStatus: AiStatus;
  aiError: string | null;
  evidenceBundle: EvidenceBundle;
  evidenceHash: string;
  onChainEvidence: OnChainEvidence;
  /** Exact bytes, only for the downloadable evidence file. Never sent on-chain. */
  raw: { request: string; response: string } | null;
}
