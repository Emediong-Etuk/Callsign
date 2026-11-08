/** Runs the red-flag analyzer for a demo scenario against the live vault's members/payees. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { analyze } from "../../lib/analyzer";
import { nearAiConfigFromEnv } from "../../lib/analyzer/nearai";
import type { AnalysisResult } from "../../lib/analyzer/types";
import { vaultViews } from "../../lib/near/vault";
import { color, detail, type Deployment } from "./testnet";

export async function analyzeScenario(
  d: Deployment,
  file: string,
  receiverId: string,
  amount: string,
): Promise<AnalysisResult> {
  const text = readFileSync(
    path.resolve(import.meta.dirname, "..", "..", "fixtures", "scenarios", file),
    "utf8",
  );
  const v = vaultViews(d.accounts.vault);
  const [members, payees, config] = await Promise.all([v.members(), v.payees(), v.config()]);
  const ceo = members.find((m) => m.account_id === d.accounts.ceo)!;
  return analyze(
    {
      text,
      claimedPrincipal: {
        accountId: ceo.account_id,
        displayName: ceo.display_name,
        title: ceo.title,
      },
      receiverId,
      amount,
      knownPayees: payees.map((p) => p.account_id),
      members: members.map((m) => ({
        accountId: m.account_id,
        displayName: m.display_name,
        title: m.title,
      })),
      instantLimit: config.policy.instant_limit,
    },
    { ai: nearAiConfigFromEnv() },
  );
}

export function printAnalysis(r: AnalysisResult): string {
  const risk = r.finalRisk.toUpperCase();
  const paint =
    r.finalRisk === "high" ? color.red : r.finalRisk === "medium" ? color.amber : color.green;
  const source =
    r.aiStatus === "verified"
      ? `NEAR AI · ${r.ai?.model} · signature verified ✅`
      : r.aiStatus === "unverified"
        ? `NEAR AI · ${r.ai?.model} · signature NOT verified`
        : r.aiStatus === "unavailable"
          ? `NEAR AI unavailable (${r.aiError}) → rules + minimum medium`
          : "rules only — NEAR AI disabled (no NEARAI_API_KEY)";
  detail(r.flags.map((f) => f.type).join(" · ") || "no flags");
  return `${paint(risk)}  (${source})`;
}
