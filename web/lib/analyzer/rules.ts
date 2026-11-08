/**
 * Layer 1: deterministic red-flag rules. Always on, no network, no AI.
 * Every text flag carries the exact phrase it matched.
 */
import type { FlagType } from "../flags";
import type { AnalysisInput, Flag, RiskLevel, RulesVerdict } from "./types";

type TextRule = {
  type: Exclude<FlagType, "new_payee" | "lookalike_account" | "amount_anomaly">;
  patterns: RegExp[];
};

const TEXT_RULES: TextRule[] = [
  {
    type: "urgency",
    patterns: [
      /\burgent(?:ly)?\b/i,
      /\bimmediately\b/i,
      /\basap\b/i,
      /\bas soon as possible\b/i,
      /\bright (?:now|away)\b/i,
      /\bwithin the (?:next )?hour\b/i,
      /\bbefore \d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i,
      /\btoday only\b/i,
      // Nigerian Pidgin
      /\bsharp sharp\b/i,
      /\bquick quick\b/i,
      /\babeg,? send (?:am|it) (?:now|quick)\b/i,
    ],
  },
  {
    type: "secrecy",
    patterns: [
      /\bkeep (?:this|it) (?:between us|quiet|to yourself|confidential)\b/i,
      /\b(?:don'?t|do not) tell\b/i,
      /\bconfidential\b/i,
      /\b(?:don'?t|do not) call me\b/i,
      /\bno tell anybody\b/i,
      /\bno tell anyone\b/i,
    ],
  },
  {
    type: "authority_pressure",
    patterns: [
      /\bi'?m (?:in|stuck in) a meeting\b/i,
      /\bi am (?:in|stuck in) a meeting\b/i,
      /\bcan'?t talk\b/i,
      /\bcannot talk\b/i,
      /\b(?:the )?(?:ceo|cfo|md|chairman|director|board) (?:needs|wants|has asked|asked|says)\b/i,
      /\bon my authority\b/i,
    ],
  },
  {
    type: "changed_payment_details",
    patterns: [
      /\bnew (?:bank )?(?:account|wallet|bank details|payment details|address)\b/i,
      /\bnew (?:[a-z]+ ){1,2}(?:account|wallet)\b/i, // "new partner wallet", "new business account"
      /\bupdated (?:bank|account|payment|wallet) (?:details|info(?:rmation)?|number|address)\b/i,
      /\b(?:changed|change of) (?:bank|account|payment) (?:details|account)\b/i,
      /\bdifferent (?:account|wallet)\b/i,
    ],
  },
  {
    type: "bypass_process",
    patterns: [
      /\bskip (?:the )?(?:usual )?(?:approvals?|checks?|verification)\b/i,
      /\bno need to (?:verify|check|confirm)\b/i,
      /\b(?:don'?t|do not) go through the usual (?:process|channels?)\b/i,
      /\bbypass (?:the )?(?:usual )?(?:process|approvals?|checks?)\b/i,
    ],
  },
  {
    type: "unusual_channel",
    patterns: [
      /\bwhats ?app\b/i,
      /\btelegram\b/i,
      /\bnew (?:phone )?number\b/i,
      /\bvoice note\b/i,
      /\bpersonal email\b/i,
    ],
  },
  {
    type: "emotional_pressure",
    patterns: [/\bemergency\b/i, /\bhospital\b/i, /\bin trouble\b/i, /\barrested\b/i],
  },
  {
    type: "credential_or_code_request",
    patterns: [
      /\botp\b/i,
      /\b(?:verification|security|confirmation|login|one[- ]time) code\b/i,
      /\bsend (?:me )?the code\b/i,
      /\bseed phrase\b/i,
      /\brecovery phrase\b/i,
      /\bpassword\b/i,
      /\bprivate key\b/i,
    ],
  },
  {
    type: "instruction_injection",
    patterns: [
      /\bignore (?:all |any )?(?:previous|prior|above) (?:instructions|rules)?/i,
      /\bsystem prompt\b/i,
      /\bmark (?:this|it) as (?:safe|low[- ]risk|approved)\b/i,
      /\bclassify (?:this|it) as (?:safe|low[- ]risk)\b/i,
      /\bai reviewer\b/i,
      /\b(?:note|message) to (?:any|the) (?:ai|automated|bot)\b/i,
    ],
  },
];

const EXPLANATIONS: Record<FlagType, string> = {
  urgency: "Time pressure is the most common lever in payment scams: it stops people checking.",
  secrecy: "Asking to keep a payment quiet cuts out the colleagues who would spot a fake.",
  authority_pressure:
    "Invoking a senior person who 'can't talk' blocks the normal call-back check.",
  new_payee: "The receiving account is not on the company's known-payee list.",
  changed_payment_details:
    "New or changed payment details are the classic sign of invoice and CEO fraud.",
  unusual_channel: "The request came over a channel the company doesn't normally use for payments.",
  bypass_process: "Legitimate requests don't ask you to skip verification or approvals.",
  emotional_pressure: "Emergencies and distress are used to rush people into paying.",
  lookalike_account:
    "The receiver looks almost identical to a known account — a classic impersonation trick.",
  credential_or_code_request: "Nobody legitimate needs your codes, passwords or recovery phrases.",
  amount_anomaly: "The amount is far above what this company normally pays without review.",
  instruction_injection:
    "The message tries to instruct an automated reviewer, which a real colleague wouldn't do.",
};

/** Classic Levenshtein distance (small strings: account ids). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]!;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]!;
      prev[j] = Math.min(prev[j]! + 1, prev[j - 1]! + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length]!;
}

/** Maps visually confusable characters to one canonical form (`ce0` → `ceo`, `rn` → `m`). */
export function homoglyphNormalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/[0]/g, "o")
    .replace(/[1|!i]/g, "l")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/[_]/g, "-");
}

/** Returns the known account that `receiver` imitates, if any. */
export function findLookalike(receiver: string, known: string[]): string | null {
  const r = receiver.toLowerCase();
  if (known.some((k) => k.toLowerCase() === r)) return null; // exact match is not a look-alike
  for (const k of known) {
    const kk = k.toLowerCase();
    if (homoglyphNormalize(kk) === homoglyphNormalize(r) || levenshtein(kk, r) <= 2) return k;
  }
  return null;
}

/** Pulls a short (≤12 word) quote around the match, copied verbatim from the message. */
function quoteAround(text: string, index: number, length: number): string {
  const match = text.slice(index, index + length);
  const words = match.trim().split(/\s+/);
  return words.length <= 12 ? match.trim() : words.slice(0, 12).join(" ");
}

export function runRules(input: AnalysisInput): RulesVerdict {
  const flags: Flag[] = [];
  const add = (type: FlagType, quote: string) => {
    if (!flags.some((f) => f.type === type)) {
      flags.push({ type, quote, explanation: EXPLANATIONS[type], source: "rules" });
    }
  };

  for (const rule of TEXT_RULES) {
    for (const pattern of rule.patterns) {
      const m = pattern.exec(input.text);
      if (m) {
        add(rule.type, quoteAround(input.text, m.index, m[0].length));
        break;
      }
    }
  }

  const receiver = input.receiverId.trim().toLowerCase();
  if (!input.knownPayees.map((p) => p.toLowerCase()).includes(receiver)) {
    add("new_payee", receiver);
  }
  const lookalike = findLookalike(receiver, [
    ...input.knownPayees,
    ...input.members.map((m) => m.accountId),
  ]);
  if (lookalike) add("lookalike_account", `${receiver} ≈ ${lookalike}`);

  if (BigInt(input.amount) > 10n * BigInt(input.instantLimit)) {
    add("amount_anomaly", "amount is more than 10× the instant limit");
  }

  return { level: levelFor(flags.map((f) => f.type)), flags };
}

/** Rule levels (brief §7.2). */
export function levelFor(types: FlagType[]): RiskLevel {
  const has = (t: FlagType) => types.includes(t);
  const pressure = has("urgency") || has("secrecy") || has("authority_pressure");
  const destination =
    has("new_payee") || has("changed_payment_details") || has("lookalike_account");
  if (
    (pressure && destination) ||
    has("bypass_process") ||
    has("instruction_injection") ||
    has("credential_or_code_request") ||
    has("lookalike_account")
  ) {
    return "high";
  }
  if (types.length >= 2) return "medium";
  return "low";
}
