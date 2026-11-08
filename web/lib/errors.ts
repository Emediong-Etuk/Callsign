/** Friendly text for every vault error code and the protocol errors users can hit. */

export const CONTRACT_ERRORS: Record<string, string> = {
  ERR_NOT_OWNER: "Only the vault administrator can do this.",
  ERR_NOT_REQUESTER: "This account isn't allowed to request payments from the vault.",
  ERR_NOT_PRINCIPAL_MEMBER: "The person you said is asking isn't a registered approver.",
  ERR_SELF_APPROVAL: "You can't name yourself as the person asking — someone else has to confirm.",
  ERR_RECEIVER_FLAGGED:
    "This receiver was reported as a scam and is blocked. Payments to it are refused.",
  ERR_INVALID_RECEIVER: "You can't pay the vault or the token contract itself.",
  ERR_INVALID_AMOUNT: "Enter an amount greater than zero.",
  ERR_INSUFFICIENT_AVAILABLE: "Not enough unreserved funds in the vault for this amount.",
  ERR_TOO_MANY_PENDING:
    "You already have the maximum number of held requests. Wait for them to be decided or cancel one.",
  ERR_INPUT_BOUNDS: "Some text is too long or badly formatted (memo is limited to 280 characters).",
  ERR_UNKNOWN_FLAG: "The red-flag report contained an unknown category.",
  ERR_NOT_PRINCIPAL: "Only the person this request claims to come from can release it.",
  ERR_NOT_PENDING: "This request is no longer waiting for a decision.",
  ERR_NOT_EXPIRED: "This request hasn't expired yet.",
  ERR_NOT_YOUR_REQUEST: "Only the person who made this request can cancel it.",
  ERR_NOT_AUTHORIZED_TO_REJECT:
    "Only the named approver or the administrator can reject this request.",
  ERR_REQUEST_NOT_FOUND: "That request doesn't exist.",
  ERR_INVALID_POLICY: "Those policy settings aren't allowed (hold window must be 60 s to 7 days).",
  ERR_NOT_FLAGGED: "That account isn't flagged.",
  ERR_MEMBER_NOT_FOUND: "That account isn't a member.",
  ERR_PAYEE_NOT_FOUND: "That account isn't on the payee list.",
};

const PROTOCOL_ERRORS: [RegExp, string][] = [
  [
    /Requires attached deposit of exactly 1 yoctoNEAR/i,
    "This step needs a wallet approval (1 yoctoNEAR) from a full-access key.",
  ],
  [
    /DepositWithFunctionCall/,
    "Blocked by NEAR: a limited (function-call) key can't attach a deposit, so it can't approve or move funds.",
  ],
  [/MethodNameMismatch/, "Blocked by NEAR: this limited key isn't allowed to call that method."],
  [
    /ReceiverMismatch/,
    "Blocked by NEAR: this limited key only works with the Callsign vault, not other contracts.",
  ],
  [/RequiresFullAccess/, "Blocked by NEAR: sending NEAR needs a full-access key."],
  [
    /NotEnoughAllowance/,
    "This limited key has used up its gas allowance. Sign in again to get a fresh key.",
  ],
  [
    /not registered/i,
    "The receiver isn't registered with the token, so the payment failed and the funds stayed in the vault.",
  ],
];

/** Finds the ERR_* code inside any error message (contract panics are wrapped by the RPC). */
export function errorCode(message: string): string | null {
  return /\b(ERR_[A-Z_]+)\b/.exec(message)?.[1] ?? null;
}

export function friendlyError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code = errorCode(message);
  if (code && CONTRACT_ERRORS[code]) return CONTRACT_ERRORS[code];
  for (const [pattern, text] of PROTOCOL_ERRORS) if (pattern.test(message)) return text;
  return "Something went wrong talking to NEAR testnet. Please try again.";
}
