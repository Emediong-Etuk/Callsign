import flagsJson from "../../shared/flags.json";

/** The single source of truth for flag categories, shared with the Rust vault (test T16). */
export const FLAG_TYPES = flagsJson as readonly string[];

export type FlagType =
  | "urgency"
  | "secrecy"
  | "authority_pressure"
  | "new_payee"
  | "changed_payment_details"
  | "unusual_channel"
  | "bypass_process"
  | "emotional_pressure"
  | "lookalike_account"
  | "credential_or_code_request"
  | "amount_anomaly"
  | "instruction_injection";

export function isFlagType(value: string): value is FlagType {
  return FLAG_TYPES.includes(value);
}

export const FLAG_LABELS: Record<FlagType, string> = {
  urgency: "Urgency",
  secrecy: "Secrecy",
  authority_pressure: "Authority pressure",
  new_payee: "New payee",
  changed_payment_details: "Changed payment details",
  unusual_channel: "Unusual channel",
  bypass_process: "Asks to bypass process",
  emotional_pressure: "Emotional pressure",
  lookalike_account: "Look-alike account",
  credential_or_code_request: "Asks for a code or password",
  amount_anomaly: "Unusual amount",
  instruction_injection: "Tries to instruct the AI reviewer",
};
