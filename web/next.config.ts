import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

const repoRoot = path.join(import.meta.dirname, "..");

// setup:testnet writes secrets and contract ids to the repo-root .env.local.
// Load it for local runs; anything already set (web/.env*, host env) wins.
const rootEnv = path.join(repoRoot, ".env.local");
if (existsSync(rootEnv)) {
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]!] === undefined) process.env[m[1]!] = m[2]!.replace(/^["']|["']$/g, "");
  }
}

const nextConfig: NextConfig = {
  // shared/flags.json lives one level up (shared with the Rust contract).
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  poweredByHeader: false,
};

export default nextConfig;
