import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FLAG_LABELS, FLAG_TYPES } from "../lib/flags";
import { root } from "./helpers";

describe("shared flag list", () => {
  it("matches the Rust ALLOWED_FLAGS constant (same order)", () => {
    const rust = readFileSync(
      path.join(root, "..", "contracts", "vault", "src", "types.rs"),
      "utf8",
    );
    const block = /ALLOWED_FLAGS: \[&str; \d+\] = \[([\s\S]*?)\];/.exec(rust)![1]!;
    const rustFlags = Array.from(block.matchAll(/"([a-z_]+)"/g)).map((m) => m[1]);
    expect(rustFlags).toEqual([...FLAG_TYPES]);
  });
  it("has a label for every flag", () => {
    expect(Object.keys(FLAG_LABELS).sort()).toEqual([...FLAG_TYPES].sort());
  });
});
