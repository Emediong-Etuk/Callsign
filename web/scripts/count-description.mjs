// Prints the character count of the description in docs/SUBMISSION.md (must be 20–2000).
import { readFileSync } from "node:fs";
const md = readFileSync(new URL("../../docs/SUBMISSION.md", import.meta.url), "utf8");
const text = /<!-- description:start -->\n([\s\S]*?)\n<!-- description:end -->/.exec(md)[1].trim();
const n = [...text].length;
console.log(
  `description: ${n} characters ${n >= 20 && n <= 2000 ? "✅ (20–2000)" : "❌ outside 20–2000"}`,
);
process.exit(n >= 20 && n <= 2000 ? 0 : 1);
