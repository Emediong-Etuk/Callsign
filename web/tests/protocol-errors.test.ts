import { describe, expect, it } from "vitest";
import {
  AccessKeyDepositWithFunctionCallActionError,
  AccessKeyMethodNameMismatchActionError,
  AccessKeyReceiverMismatchActionError,
  AccessKeyRequiresFullAccessActionError,
} from "near-api-js/rpc-errors";
import { friendlyError } from "../lib/errors";
import { describeTxError, protocolReason } from "../lib/near/protocol-errors";

/** Simulates a production bundle, where class names (and so error.name) are minified. */
function minified<T extends Error>(e: T): T {
  Object.defineProperty(e, "name", { value: "oI" });
  return e;
}

describe("protocol refusal classification survives minification", () => {
  const cases: [Error, string][] = [
    [new AccessKeyDepositWithFunctionCallActionError(0, "tx", "block"), "DepositWithFunctionCall"],
    [
      new AccessKeyReceiverMismatchActionError(
        "vault.x.testnet",
        "token.x.testnet",
        0,
        "tx",
        "block",
      ),
      "ReceiverMismatch",
    ],
    [
      new AccessKeyMethodNameMismatchActionError("add_payee", 0, "tx", "block"),
      "MethodNameMismatch",
    ],
    [new AccessKeyRequiresFullAccessActionError(0, "tx", "block"), "RequiresFullAccess"],
  ];
  it.each(cases)("%s → %s", (err, reason) => {
    const e = minified(err);
    expect(e.name).toBe("oI");
    expect(protocolReason(e)).toBe(reason);
    expect(describeTxError(e)).toContain(`InvalidAccessKeyError(${reason})`);
    expect(friendlyError(describeTxError(e))).toMatch(/Blocked by NEAR/);
  });
  it("falls back to NEAR's message text for plain errors", () => {
    expect(protocolReason(new Error("Deposit is not allowed with function call"))).toBe(
      "DepositWithFunctionCall",
    );
    expect(protocolReason(new Error("Access key does not allow method add_payee"))).toBe(
      "MethodNameMismatch",
    );
    expect(protocolReason(new Error("something else"))).toBeNull();
  });
});
