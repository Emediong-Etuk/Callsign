/** Minimal .env loader for scripts (no dependency). Reads web/.env.local then repo .env.local. */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export function loadEnv(): void {
  const web = path.resolve(import.meta.dirname, "..", "..");
  for (const file of [path.join(web, ".env.local"), path.join(web, "..", ".env.local")]) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m || line.trim().startsWith("#")) continue;
      const value = m[2]!.replace(/^["']|["']$/g, "");
      if (process.env[m[1]!] === undefined) process.env[m[1]!] = value;
    }
  }
}
