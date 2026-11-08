/**
 * Red-flag analysis = deterministic rules (always) + NEAR AI Cloud TEE model (when configured).
 *
 * G5 — the AI can only ADD friction:
 *   finalRisk = max(rules, ai). If the AI fails, times out or returns invalid
 *   output, finalRisk = max(rules, "medium"). An AI "low" never lowers anything.
 */
import { evidenceHash, toOnChainEvidence } from "./evidence";
import {
  AI_TIMEOUT_MS,
  complete,
  fetchAttestation,
  fetchSignature,
  type NearAiConfig,
} from "./nearai";
import { runRules } from "./rules";
import { isVerified, sha256Hex, verifyNearAiResponse } from "../verify/nearai-verify";
import {
  analysisInputSchema,
  maxRisk,
  type AiStatus,
  type AiVerdict,
  type AnalysisInput,
  type AnalysisResult,
  type EvidenceBundle,
  type Flag,
  type RiskLevel,
  type RulesVerdict,
} from "./types";

export { runRules } from "./rules";

/** Union of rule and AI flags, one per type; the AI's wording wins where both exist. */
export function mergeFlags(rules: Flag[], ai: Flag[]): Flag[] {
  const byType = new Map<string, Flag>();
  for (const f of rules) byType.set(f.type, f);
  for (const f of ai) byType.set(f.type, f);
  return Array.from(byType.values());
}

export function combineRisk(rules: RiskLevel, ai: RiskLevel | null, aiFailed: boolean): RiskLevel {
  if (aiFailed) return maxRisk(rules, "medium");
  return ai ? maxRisk(rules, ai) : rules;
}

function rulesSummary(rules: RulesVerdict): string {
  if (rules.flags.length === 0) return "No red flags found by the rule checks.";
  return `Rule checks found: ${rules.flags.map((f) => f.type.replace(/_/g, " ")).join(", ")}.`;
}

export interface AnalyzeOptions {
  ai: NearAiConfig | null;
  now?: () => Date;
}

export async function analyze(
  rawInput: AnalysisInput,
  opts: AnalyzeOptions,
): Promise<AnalysisResult> {
  const input = analysisInputSchema.parse(rawInput);
  const rules = runRules(input);

  let aiStatus: AiStatus = opts.ai ? "unavailable" : "disabled";
  let ai: AiVerdict | null = null;
  let aiError: string | null = null;
  let raw: AnalysisResult["raw"] = null;
  let hashes: { req: string; resp: string } | null = null;

  if (opts.ai) {
    const cfg = opts.ai;
    const signal = AbortSignal.timeout(AI_TIMEOUT_MS);
    try {
      // Preflight evidence must be fetched BEFORE the completion (docs).
      const attestation = await fetchAttestation(cfg.model, cfg.fetchImpl);
      const completion = await complete(cfg, input, signal);
      raw = { request: completion.rawRequest, response: completion.rawResponse };
      hashes = { req: sha256Hex(completion.rawRequest), resp: sha256Hex(completion.rawResponse) };
      let signature = null;
      let verification;
      try {
        signature = await fetchSignature(cfg, completion.chatId, signal);
        verification = verifyNearAiResponse({
          model: cfg.model,
          rawRequest: completion.rawRequest,
          rawResponse: completion.rawResponse,
          signature,
          attestation,
        });
      } catch (e) {
        verification = {
          hashes_match: false,
          signature_valid: false,
          address_in_attestation: false,
          attestation_bindings_valid: false,
          hardware_verified: false as const,
          signature_kind: null,
          notes: [`signature unavailable: ${(e as Error).message}`],
        };
      }
      ai = {
        model: cfg.model,
        chat_id: completion.chatId,
        output: completion.output,
        verification,
        signing_address: signature?.signing_address ?? null,
        signing_algo: signature?.signing_algo ?? null,
        signature: signature?.signature ?? null,
      };
      aiStatus = isVerified(verification) ? "verified" : "unverified";
    } catch (e) {
      // Never surface the message text in errors; only the failure reason.
      aiError = (e as Error).name === "TimeoutError" ? "NEAR AI timed out" : (e as Error).message;
      aiStatus = "unavailable";
    }
  }

  const aiFlags: Flag[] =
    ai?.output.flags.map((f) => ({
      type: f.type as Flag["type"],
      quote: f.quote,
      explanation: f.explanation,
      source: "ai" as const,
    })) ?? [];
  const flags = mergeFlags(rules.flags, aiFlags);
  const finalRisk = combineRisk(
    rules.level,
    ai?.output.risk_level ?? null,
    aiStatus === "unavailable",
  );

  const bundle: EvidenceBundle = {
    version: 1,
    created_at: (opts.now?.() ?? new Date()).toISOString(),
    model: ai?.model ?? null,
    chat_id: ai?.chat_id ?? null,
    request_sha256: hashes?.req ?? null,
    response_sha256: hashes?.resp ?? null,
    signature: ai?.signature ?? null,
    signing_address: ai?.signing_address ?? null,
    signing_algo: ai?.signing_algo ?? null,
    signature_kind: ai?.verification.signature_kind ?? null,
    verification: ai?.verification ?? null,
    ai_verdict: ai?.output ?? null,
    rules_verdict: rules,
    final_risk: finalRisk,
    ai_status: aiStatus,
  };
  const hash = evidenceHash(bundle);
  return {
    finalRisk,
    flags,
    summary: ai?.output.summary ?? rulesSummary(rules),
    rules,
    ai,
    aiStatus,
    aiError,
    evidenceBundle: bundle,
    evidenceHash: hash,
    onChainEvidence: toOnChainEvidence(bundle, hash, flags),
    raw,
  };
}
