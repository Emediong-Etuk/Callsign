/**
 * Names NEAR's access-key refusals in a way that survives minification.
 * near-api-js sets `error.name` from the class name, which production
 * bundlers shorten (e.g. to "oI"), so we classify by `instanceof` and fall
 * back to the protocol's stable English messages.
 */
import {
  AccessKeyDepositWithFunctionCallActionError,
  AccessKeyMethodNameMismatchActionError,
  AccessKeyNotEnoughAllowanceActionError,
  AccessKeyReceiverMismatchActionError,
  AccessKeyRequiresFullAccessActionError,
} from "near-api-js/rpc-errors";

export type ProtocolReason =
  | "DepositWithFunctionCall"
  | "ReceiverMismatch"
  | "MethodNameMismatch"
  | "RequiresFullAccess"
  | "NotEnoughAllowance";

const BY_MESSAGE: [RegExp, ProtocolReason][] = [
  [/deposit is not allowed with function call/i, "DepositWithFunctionCall"],
  [/access key receiver .* does not match transaction receiver/i, "ReceiverMismatch"],
  [/access key does not allow method/i, "MethodNameMismatch"],
  [/access key requires full access/i, "RequiresFullAccess"],
  [/not enough allowance/i, "NotEnoughAllowance"],
];

export function protocolReason(e: unknown): ProtocolReason | null {
  if (e instanceof AccessKeyDepositWithFunctionCallActionError) return "DepositWithFunctionCall";
  if (e instanceof AccessKeyReceiverMismatchActionError) return "ReceiverMismatch";
  if (e instanceof AccessKeyMethodNameMismatchActionError) return "MethodNameMismatch";
  if (e instanceof AccessKeyRequiresFullAccessActionError) return "RequiresFullAccess";
  if (e instanceof AccessKeyNotEnoughAllowanceActionError) return "NotEnoughAllowance";
  const msg = e instanceof Error ? e.message : String(e);
  return BY_MESSAGE.find(([re]) => re.test(msg))?.[1] ?? null;
}

/** Error text for a failed transaction: the stable reason first, then the details. */
export function describeTxError(e: unknown): string {
  const err = e as Error & { type?: string; cause?: unknown };
  const reason = protocolReason(e);
  return [
    reason ? `InvalidAccessKeyError(${reason})` : err.name,
    err.type,
    err.message,
    err.cause ? JSON.stringify(err.cause) : "",
  ]
    .filter(Boolean)
    .join(" ");
}
