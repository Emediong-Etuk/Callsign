/**
 * npm run verify:all — the judges' one-command check. Needs NO secrets, wallet or
 * testnet account: everything runs locally (contracts in a local NEAR sandbox).
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const web = path.join(root, "web");
const contracts = path.join(root, "contracts");

const steps: { name: string; cmd: string; args: string[]; cwd: string }[] = [
  {
    name: "Rust format check (cargo fmt --check)",
    cmd: "cargo",
    args: ["fmt", "--all", "--", "--check"],
    cwd: contracts,
  },
  {
    name: "Rust lint (clippy -D warnings)",
    cmd: "cargo",
    args: ["clippy", "--workspace", "--all-targets", "--", "-D", "warnings"],
    cwd: contracts,
  },
  {
    name: "Contract unit + sandbox tests (T1–T16)",
    cmd: "bash",
    args: ["tools/test.sh"],
    cwd: contracts,
  },
  { name: "Web typecheck (tsc --strict)", cmd: "npx", args: ["tsc", "--noEmit"], cwd: web },
  { name: "Web lint (eslint)", cmd: "npx", args: ["eslint", "."], cwd: web },
  { name: "Analyzer + verification tests (vitest)", cmd: "npx", args: ["vitest", "run"], cwd: web },
  {
    name: "NEAR AI fixture re-verification (offline)",
    cmd: "npx",
    args: ["tsx", "scripts/verify-fixture.ts"],
    cwd: web,
  },
  {
    name: "Secret scan (check:secrets)",
    cmd: "npx",
    args: ["tsx", "scripts/check-secrets.ts"],
    cwd: web,
  },
];

const results: { name: string; ok: boolean; seconds: number }[] = [];
for (const s of steps) {
  console.log(`\n━━━ ${s.name} ━━━`);
  const t0 = Date.now();
  const r = spawnSync(s.cmd, s.args, { cwd: s.cwd, stdio: "inherit", env: process.env });
  results.push({ name: s.name, ok: r.status === 0, seconds: Math.round((Date.now() - t0) / 1000) });
}

console.log("\n══════════════ verify:all summary ══════════════");
for (const r of results)
  console.log(`${r.ok ? "✅" : "❌"}  ${r.name.padEnd(46)} ${String(r.seconds).padStart(4)}s`);
console.log(`
Guarantee → proof
  G1 funds move only via policy ............ T2, T3, T5 (+T10)
  G2 1-yocto confirm by claimed principal .. T4
  G3 silence is safe (expiry) .............. T7
  G4 requester key is a function-call key .. T9
  G5 AI only adds friction ................. T6 + tests/analyzer.test.ts
  G6 scam receiver flagged & blocked ....... T8
  G7 no message text on-chain .............. T14 + tests/verify.test.ts
  G8 TEE signature + attestation checks .... tests/verify.test.ts + verify:fixture`);
const failed = results.filter((r) => !r.ok).length;
console.log(failed ? `\n❌ ${failed} step(s) failed` : "\n✅ all checks passed");
process.exit(failed ? 1 : 0);
