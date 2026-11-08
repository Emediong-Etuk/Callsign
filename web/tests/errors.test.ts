import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CONTRACT_ERRORS, errorCode, friendlyError } from "../lib/errors";
import { root } from "./helpers";

describe("friendly error map", () => {
  const rust = readFileSync(
    path.join(root, "..", "contracts", "vault", "src", "errors.rs"),
    "utf8",
  );
  const codes = Array.from(rust.matchAll(/pub const (ERR_[A-Z_]+): &str = "(ERR_[A-Z_]+)"/g)).map(
    (m) => m[2]!,
  );

  it("covers every ERR_* the vault defines (and nothing else)", () => {
    expect(codes.length).toBeGreaterThan(15);
    expect(Object.keys(CONTRACT_ERRORS).sort()).toEqual([...codes].sort());
  });
  it("extracts codes from wrapped RPC errors", () => {
    expect(errorCode("Smart contract panicked: ERR_RECEIVER_FLAGGED")).toBe("ERR_RECEIVER_FLAGGED");
    expect(
      friendlyError(
        new Error('{ kind: ExecutionError("Smart contract panicked: ERR_NOT_PRINCIPAL") }'),
      ),
    ).toMatch(/Only the person/);
    expect(friendlyError("InvalidAccessKeyError(DepositWithFunctionCall)")).toMatch(/limited/);
  });
});
