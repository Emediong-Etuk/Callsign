/** Server-side analysis helper: builds the analyzer input from the live vault (not from the client). */
import { analyze } from "../analyzer";
import { nearAiConfigFromEnv } from "../analyzer/nearai";
import type { AnalysisResult } from "../analyzer/types";
import { vaultViews } from "../near/vault";
import { deploymentIds } from "./deployment";

const DEFAULT_LIMIT = "500000000";

export async function analyzeAgainstVault(args: {
  text: string;
  claimedPrincipal: string;
  receiverId: string;
  amount: string;
}): Promise<AnalysisResult> {
  const ids = deploymentIds();
  let members: { accountId: string; displayName: string; title: string }[] = [];
  let knownPayees: string[] = [];
  let instantLimit = DEFAULT_LIMIT;
  if (ids) {
    const v = vaultViews(ids.vault);
    const [m, p, c] = await Promise.all([v.members(), v.payees(), v.config()]);
    members = m.map((x) => ({
      accountId: x.account_id,
      displayName: x.display_name,
      title: x.title,
    }));
    knownPayees = p.map((x) => x.account_id);
    instantLimit = c.policy.instant_limit;
  }
  const principal = members.find((m) => m.accountId === args.claimedPrincipal) ?? {
    accountId: args.claimedPrincipal,
    displayName: args.claimedPrincipal,
    title: "unknown",
  };
  return analyze(
    {
      text: args.text,
      claimedPrincipal: principal,
      receiverId: args.receiverId,
      amount: args.amount,
      knownPayees,
      members,
      instantLimit,
    },
    { ai: nearAiConfigFromEnv() },
  );
}

/** What the browser gets back. Same as AnalysisResult; raw bodies only feed the evidence download. */
export type AnalysisResponse = AnalysisResult;
