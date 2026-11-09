# Callsign — Progress

Source of truth: `CALLSIGN_BUILD_PROMPT.md`. This file tracks phase status, decisions, open questions and deviations.

## Phase checklist

- [x] **P0 Setup** — docs read, CLAUDE.md, PROGRESS.md, scaffold, toolchains, LICENSE (2026-11-08)
- [x] **P1 Contracts** — token + vault, unit + integration tests T1–T16, clippy clean (2026-11-08: 4 token unit + 21 vault unit + 16 sandbox integration tests green)
- [x] **P2 Testnet** — (2026-11-08, Greg approved) master `callsign-fdym.testnet` created via faucet; `setup:testnet` deployed everything (idempotent re-run makes no changes); `demo:scam`, `demo:legit`, `demo:attack`, `demo:reset` exit 0 on testnet with expected output; `deployments/testnet.json` committed (no secrets).
- [x] **P3 AI** — (2026-11-08) live NEAR AI checks verified (`provider_tee`, all checks pass): ceo-urgent-wire high, routine-invoice low, injection-attempt high; real signed fixture captured and re-verified offline (tamper tests fail as they should); vitest 47/47; `demo:scam` on testnet shows "signature verified ✅" and the on-chain evidence carries categories + hash only.
- [ ] **P4 Web** — all pages + demo mode + API routes built; `/demo` driven end to end in headless Chromium against the sandbox (all flows OK, 6/6 attacks blocked, no console errors). Also driven end to end in a browser **against testnet** (all flows, 6/6 attacks blocked, no console errors). **Pending:** hosted deploy (needs approval), wallet flow test with a real testnet wallet.
- [ ] **P5 Docs + judge simulation** — README, ARCHITECTURE, THREAT_MODEL, DEMO_SCRIPT, SUBMISSION drafted; CI workflow written; `verify:all` green from repo root. **Pending:** judge simulation on a fresh clone after testnet + hosting; CI can't run until the branch is pushed.
- [ ] **P6 Handoff**

## Start-of-project questions (§0.2) — defaults in use until Greg answers

| # | Question | Status / value in use |
|---|---|---|
| 1 | OS | Build sandbox is Linux x86_64 (cloud). Greg's own OS unknown — README covers Linux/macOS; Windows → WSL2. |
| 2 | Testnet prefix | Default generated: `callsign-fdym` → master `callsign-fdym.testnet` (not created yet) |
| 3 | NEAR AI Cloud API key | Not yet. Rules-only fallback works and is labelled. |
| 4 | GitHub repo | `Emediong-Etuk/Callsign` (existing remote). Visibility unknown. |
| 5 | Mainnet prize account, X handle, email | Placeholders in docs/SUBMISSION.md |

## Decision log

- **2026-11-08** — Build environment: the cloud sandbox couldn't reach NEAR hosts. Created personal cloud environment `callsign` (Greg approved) allowing nearhackathon.com, docs.near.org, docs.near.ai, cloud-api.near.ai, testnet RPCs, nearblocks, crates.io, the sandbox binary host; later added www.ic3.gov, www.trmlabs.com, edition.cnn.com, www.arup.com to verify README stats.
- **2026-11-08** — Rust: the current `cargo near new` template pins toolchain `1.86.0` (near-sdk 5.24, near-workspaces 0.22). Latest near-sdk 5.30.1 needs Rust 1.95, so we pin **near-sdk / near-contract-standards 5.27.0** (newest with rust-version 1.86) and **near-workspaces 0.22.1**. Contracts build with `cargo near build non-reproducible-wasm` (vault 291 KB, token 170 KB).
- **2026-11-08** — Tools: node v22.23.4, cargo-near 0.23.0, near-cli-rs 0.31.1 (built from crates.io; needed `libudev-dev`), sandbox neard 2.13.4.
- **2026-11-08** — Sandbox in containers: neard insists on a 65535 open-files limit; this container's hard limit is 20000. Added `contracts/tools/fdlimit-shim.c` (LD_PRELOAD clamp) used by `contracts/tools/test.sh` only when needed — judges' containers may hit the same limit.
- **2026-11-08** — Contract design within the brief: contiguous request ids from 1 in a `LookupMap` + `IterableSet` of pending ids + per-requester id list; `ERR_TOO_MANY_PENDING` applies to every new request (rule 5 runs before routing); extra codes `ERR_NOT_EXPIRED`, `ERR_NOT_YOUR_REQUEST`, `ERR_NOT_AUTHORIZED_TO_REJECT`, `ERR_REQUEST_NOT_FOUND`, `ERR_INVALID_POLICY`, `ERR_NOT_FLAGGED`, `ERR_MEMBER_NOT_FOUND`, `ERR_PAYEE_NOT_FOUND`; duplicate flags rejected; enum JSON values PascalCase; multiplier capped at 10.
- **2026-11-08** — Extra safety: `confirm_payout` also requires the claimed principal to still be an **active** principal (deactivating a compromised principal kills their pending approvals). The payout callback treats only `PromiseError::Failed` as failure.
- **2026-11-08** — NEAR AI model: `openai/gpt-oss-120b` is no longer listed. `/v1/models` has no explicit privacy-tier field, so "Confidential TEE" was confirmed by `GET /v1/attestation/report?provider=near` returning a NEAR model attestation. Chose **`Qwen/Qwen3.6-35B-A3B-FP8`** (Qwen TEE model, supports `json_mode`). Reasoning disabled via `chat_template_kwargs.enable_thinking=false`. No Confidential-TEE audio model was found in the list (`openai/whisper-large-v3` is listed but not attestation-checked) → voice notes cut (scope ladder #1): paste text only, UI says so.
- **2026-11-08** — Verification follows the **live** NEAR AI docs, which differ from the brief: `provider_tee` signed text is `<MODEL_ID>:<req_hash>:<resp_hash>` (gateway signatures: `<req_hash>:<resp_hash>`); attestation must be fetched **before** the completion; requests send `x-no-aliasing: true` and `Accept-Encoding: identity`; `/v1/signature` takes `signing_algo` only. The app additionally checks quote report-data binding (signer + nonce), debug bit, MRCONFIGID and RTMR3 replay, and requires these for "verified" (stricter than the brief's three checks).
- **2026-11-08** — Scope cut #2: Intel DCAP quote signature-chain and NVIDIA NRAS verification not implemented (needs Intel/Phala collateral hosts; time). README states exactly what is and isn't checked and links the Verification Center.
- **2026-11-08** — Scope cut #3 (partial): `/admin` is a read-only settings view; owner changes go through scripts.
- **2026-11-08** — Wallet: `@hot-labs/near-connect` pinned to 0.11.4 because `function-call-key-plugin@2.2.0` (the docs' FCK-at-login path) requires `^0.11.1`. The login key is scoped to the vault and `request_payout`, `cancel_payout`, `reject_payout` with a 0.25 NEAR allowance.
- **2026-11-08** — Demo hosting needs: Tolu's FCK allowance raised to 2 NEAR by default (each 100 Tgas request reserves ~0.01 NEAR of allowance); `demo:reset` recycles tUSD from the demo vendor/supplier back to the vault; demo API amounts/receivers fixed server-side; attack run counts as 4 rate-limit actions.
- **2026-11-08** — Transactions use a plain `JsonRpcProvider` (views use the failover provider), because the failover wrapper turns protocol rejections into a generic `RetriesExceeded` and hides the reason.
- **2026-11-08** — Scripts support `NEAR_NETWORK=sandbox` (only with a localhost RPC) for rehearsal; writes `deployments/sandbox.json` (gitignored) and uses `CALLSIGN_ENV_FILE` instead of `.env.local`.
- **2026-11-08** — README stats verified against primary sources: FBI IC3 2025 report PDF ($893,346,472 adjusted losses, 22,364 AI-related complaints; the report does **not** say it's the first year, so that claim was dropped), TRM Labs 2026 AI-in-Crime Adoption Index page (+263%), CNN May 2024 (Arup, HK$200M ≈ $25.6M in 15 transfers).
- **2026-11-08** — First push attempt was blocked by the session's permission check; a later push (requested by the session's stop hook) succeeded. Only the feature branch `claude/happy-allen-4kb7ao` was pushed — `main` and repo visibility untouched.
- **2026-11-08** — Pre-simulation: fresh `git clone` of the branch into a temp dir → `npm install` → `npm run verify:all`: all 8 steps ✅ (cold Rust build included). Full judge simulation (README literally, hosted demo) still pending testnet + hosting.
- **2026-11-08** — Lint: `npm audit` reports 8 moderate advisories in dev-only ESLint/typescript-eslint dependencies; not shipped to users.

## Differences between the brief and live sources

| Topic | Brief says | Live source says | Action |
|---|---|---|---|
| Submission form "website" | Optional website | HACKATHON.md: `website` is a **spam trap**; any value rejects the submission | SUBMISSION.md says leave it empty |
| Code start date | Window starts 2026-11-01 | Q-001: code from 2026-10-19 counts | No effect (no pre-hackathon code) |
| Demo post | Video required | "video or screenshots", but Q-012: screenshots aren't enough when judges can't open the demo | Keep video; optional tags @NearLegion @NearBuilders |
| Hosted demo uptime | Through 2026-11-25 | Q-012: to 2026-11-18, ideally 2026-11-25 | Keep 2026-11-25 |
| Submission method | Greg submits the form | Also a JSON API (only with the human's confirmation) | Greg submits |
| NEAR AI verification | `verification/chat.md`, `text` = request:response hashes | Restructured docs; `provider_tee` text includes the model id; preflight attestation; `x-no-aliasing` | Followed live docs |
| Preferred model | `openai/gpt-oss-120b` | Not offered | Qwen TEE model |
| Access keys docs URL | /protocol/access-keys | /protocol/accounts-contracts/access-keys | Live URL used |

## Organizer track prompts — scope notes

- `security`: wants a function-call key scoped to one contract with limits explained in the README, an attack demo where a prompt-injected agent tries to pay a known-bad address (log shown), and the access-key caveats (allowance lockout). → README "About Tolu's function-call key" section + `demo:attack` log.
- `privacy`: wants a TEE model chosen from the models endpoint, attestation with a fresh nonce, a "Verified" panel listing exactly what was checked, nothing kept server-side, fictional samples. → All in scope (`AnalysisPanel`, `/api/analyze` stateless, fixtures).
- `realworld`: centred on 1Click/Intents, relayers, USDC → recommend not listing it (SUBMISSION.md).

## Open questions for Greg

1. ~~Approve Phase 2~~ — done 2026-11-08.
2. ~~NEAR AI API key~~ — done 2026-11-08.
3. The branch is pushed. Is the repo private? (It must be public by the deadline — I'll ask before changing anything.)
4. **Vercel deploy** for the hosted demo — approve, and which Vercel account/team?
5. §0.2 personal details for SUBMISSION.md (mainnet prize account, X handle, email) — or keep placeholders and fill them yourself.

## CI notes

- 2026-11-08: first CI run on PR #1 failed only the contract sandbox tests: `near_workspaces::compile_project` (cargo-near-build 0.11.5) shells out to the **`cargo near` CLI**, which the runner lacked. My local fresh-clone check passed only because cargo-near was installed here. Fixes: CI installs `cargo-near@0.23.0` from crates.io (not the curl installer script, per rule 9); `contracts/tools/test.sh` fails fast with an install hint; README prerequisites now list cargo-near. GitHub also warns that actions/checkout@v4 and setup-node@v4 run on Node 20 (deprecated) — warning only.

## Hosted demo + redesign (2026-11-09)

- Greg deployed to Vercel himself: **https://callsign-nine.vercel.app** (root dir `web`). Verified live: `/api/health` shows testnet, demo mode, AI enabled, no secrets; the deepfake scenario ran end to end with "NEAR AI (TEE) · signature verified".
- Greg asked for a more modern, interactive frontend. Redesign keeps the brief's tone (calm fraud desk, not crypto casino), the amber/green/red signal system and accessibility (focus rings, reduced-motion support): Geist fonts, glass sticky nav with live-testnet indicator, dark animated hero with an interactive scam simulator (visitor can answer as Ada), count-up stats, scroll reveals, bento "What NEAR enables" grid with cursor spotlight, terminal-style attack teaser; demo page with scenario picker cards, 5-step progress tracker, Ada's view in a phone frame, toast notifications with explorer links, attack results revealed one by one. New deps (pinned to releases ≥2 weeks old): geist 1.8.2, lucide-react 1.61.0, motion 14.6.0.
- **Bug found and fixed while testing the production build:** the attack panel labelled every protocol refusal "NOT blocked" because near-api-js names errors after their class, and production minification renames classes (`oI`). This affected the live site (scripts and dev server don't minify, so earlier tests passed). Fix: `lib/near/protocol-errors.ts` classifies refusals with `instanceof` (classes are shared via `near-api-js/rpc-errors`) plus NEAR's stable messages; regression test `tests/protocol-errors.test.ts` simulates minified names. Re-verified on a production build: 6/6 blocked.
- `npm run dev` now uses `next dev --webpack`: Turbopack's dev server got stuck in a rebuild→reload loop in this container (production builds still use Turbopack and are unaffected).

## Live-site key misconfiguration (2026-11-09)

- After PR #2 deployed, the live attack panel still showed "NOT blocked" — but the errors were *contract* panics ("Requires attached deposit…", "account doesn't have enough balance", "Account … does not exist"), which a function-call key could never reach. Conclusion: on Vercel, `DEMO_FINANCE_FCK_SECRET` holds Tolu's **full-access** key (likely `DEMO_FINANCE_SECRET` pasted by mistake). Nothing moved, but the hosted demo contradicted G4 and kept a full-access key on the server.
- Fix asked of Greg: replace `DEMO_FINANCE_FCK_SECRET` in Vercel with the value of that exact line from `.env.local`, then redeploy.
- Defence in depth (merged in PR #3): the server now looks up Tolu's demo key on-chain and refuses demo mode unless it is a function-call key scoped to the vault's `request_payout`/`cancel_payout`; `/api/health` reports `finance_key` (kind only) and `demo_error`. Verified locally against testnet with both the correct key and the full-access key.
- **Resolved (2026-11-09):** Greg replaced the Vercel variable and redeployed. Live `/api/health` reports `demo_mode: true`, `finance_key: "function-call"`, `ai_enabled: true`. A browser run of the hosted site completed all three scenarios; the attack panel showed 5/5 attempts blocked by NEAR (ReceiverMismatch, DepositWithFunctionCall ×2, MethodNameMismatch, RequiresFullAccess). The sixth attempt (Tolu's full-access key) is skipped on purpose because that key is not on Vercel.

## Judge dry run (2026-11-09)

- Fresh clone of `main` with an empty `$HOME` (no `.env.local`, no NEAR credentials, no npm cache): `npm install` 22 s; `npm run verify:all` ✅ all checks passed in 7 m 51 s on 4 cores (clippy 130 s, sandbox tests 315 s). Counts: 25 unit + 16 sandbox + 52 vitest.
- Hosted demo driven by a new visitor following the README click path literally: every label exists, every step passed in 59 s total (AI check 9 s, verified), 5/5 attacks blocked, no console errors, all API calls 200. About 7 rate-limited actions per full run (limit 20/h).
- README fixes: test count 47 → 52; heading no longer promises "5 minutes" (real cold-run time stated); `cargo-near` pinned to 0.23.0 to match CI (also in `test.sh`'s hint).
- Each full demo run moves 2,200 tUSD to vendor/supplier. Ran `demo:reset` afterwards → vault back to 100,000 tUSD. Run it again before judging starts. Gas is ample: Ada 0.39 NEAR, Tolu's key allowance 1.98 NEAR left.

## Testnet notes

- Master balance after setup: ~2.14 NEAR (faucet gave 10; sub-accounts funded per `setup-testnet.ts`).
- Tolu's function-call key: granted 2 NEAR allowance; 4 requests used ~0.0023 NEAR (≈0.0006 each), so it lasts thousands of demo requests.
- **Keys live only in this cloud container** (`.env.local`, gitignored, plus `~/.near-credentials`). Greg should copy `.env.local` to a password manager; if the container is reclaimed without a backup, a new prefix and re-run of `setup:testnet` would be needed.
- `next.config.ts` loads the repo-root `.env.local` for local runs (Next.js only reads `web/.env*` by itself). `setup:testnet` now also writes `DEMO_MODE=true`.
- nearblocks.io returns 403 to curl from this sandbox (bot protection); links work in a browser.

## NEAR AI key

- 2026-11-08: Greg's key saved as a network secret on the `callsign` cloud environment (proxy injects it for cloud-api.near.ai; code uses `NEARAI_API_KEY=proxy-injected` locally). First returned 402 (no credits); Greg added ~$5 credits; live calls now succeed. Measured cost ≈ $0.0006 per check ($0.17/M input, $1.10/M output tokens); latency 1–2.5 s.

## Session log

- **2026-11-08 (session 1)** — P0–P1 done; P2 scripts + P3 analyzer + P4 web + P5 docs drafted and verified locally (sandbox). Then Greg approved testnet: P2 done on testnet; README updated with real testnet output and contract ids.
- **2026-11-09 (session 2)** — CI fixed; PR #1 merged; Greg deployed to Vercel; UI redesign (PR #2) and on-chain demo-key guard (PR #3) merged; live site verified end to end.
