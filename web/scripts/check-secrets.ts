/**
 * npm run check:secrets — scans every tracked (and not-ignored new) file for:
 *   - NEAR secret keys      ed25519:<base58, 80+ chars>   (public keys are ~44 chars and pass)
 *   - API keys              sk-<20+ chars>
 *   - seed phrases          12 or 24 consecutive BIP-39 English words
 * Exits 1 on any hit. Run before every commit.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { wordlists } from "ethers";

const repo = path.resolve(import.meta.dirname, "..", "..");
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { cwd: repo },
)
  .toString()
  .split("\0")
  .filter(Boolean);

const en = wordlists.en!;
const isBip39 = (w: string) => en.getWordIndex(w) >= 0;
const SECRET_KEY = /ed25519:[1-9A-HJ-NP-Za-km-z]{80,}/;
const API_KEY = /\bsk-[A-Za-z0-9_-]{20,}/;

function seedPhrase(line: string): string | null {
  const words = line
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
  let run = 0;
  for (const w of words) {
    run = isBip39(w) ? run + 1 : 0;
    if (run >= 12) return words.slice(0, 3).join(" ") + " …";
  }
  return null;
}

const hits: string[] = [];
for (const rel of files) {
  const abs = path.join(repo, rel);
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    continue; // deleted in the working tree
  }
  if (!stat.isFile() || stat.size > 5_000_000) continue;
  const buf = readFileSync(abs);
  if (buf.includes(0)) continue; // binary
  buf
    .toString("utf8")
    .split(/\r?\n/)
    .forEach((line, i) => {
      if (SECRET_KEY.test(line)) hits.push(`${rel}:${i + 1}: NEAR secret key`);
      if (API_KEY.test(line)) hits.push(`${rel}:${i + 1}: sk- API key`);
      const seed = seedPhrase(line);
      if (seed) hits.push(`${rel}:${i + 1}: possible seed phrase (${seed})`);
    });
}

if (hits.length) {
  console.error(
    `❌ check:secrets found ${hits.length} possible secret(s):\n` +
      hits.map((h) => `  ${h}`).join("\n"),
  );
  process.exit(1);
}
console.log(`✅ check:secrets: ${files.length} files scanned, no secrets found`);
