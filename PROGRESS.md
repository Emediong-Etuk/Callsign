# Callsign — Progress

Source of truth: `CALLSIGN_BUILD_PROMPT.md`. This file tracks phase status, decisions, open questions and deviations.

## Phase checklist

- [x] **P0 Setup** — docs read, CLAUDE.md, PROGRESS.md, scaffold, toolchains, LICENSE (2026-11-08)
- [x] **P1 Contracts** — token + vault, unit + integration tests T1–T16, clippy clean (2026-11-08: 4 token unit + 21 vault unit + 16 sandbox integration tests green)
- [ ] **P2 Testnet** — scripts written and **rehearsed end to end on a local NEAR sandbox** (setup idempotent, demo:scam/legit/attack/expire/reset all exit 0). **Blocked:** testnet run needs Greg's approval of the master account `callsign-fdym.testnet`.
- [ ] **P3 AI** — rules, NEAR AI client, attestation + signature verification, evidence bundle, vitest (46 + 1 pending) done; real attestation fixture captured. **Blocked:** real signed completion fixture needs a NEAR AI API key (`npm run capture:fixture`).
- [ ] **P4 Web** — all pages + demo mode + API routes built; `/demo` driven end to end in headless Chromium against the sandbox (all flows OK, 6/6 attacks blocked, no console errors). **Pending:** hosted deploy (needs approval), wallet flow test with a real testnet wallet.
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

1. **Approve Phase 2:** create `callsign-fdym.testnet` with the faucet and run `setup:testnet` + demos on testnet? (Or give me your preferred prefix.)
2. **NEAR AI API key** (from cloud.near.ai or the NEAR Builders $10 credit) — needed for the real signed fixture and the "TEE-verified" badge.
3. The branch is pushed. Is the repo private? (It must be public by the deadline — I'll ask before changing anything.)
4. **Vercel deploy** for the hosted demo — approve, and which Vercel account/team?
5. §0.2 personal details for SUBMISSION.md (mainnet prize account, X handle, email) — or keep placeholders and fill them yourself.

## Session log

- **2026-11-08 (session 1)** — P0–P1 done; P2 scripts + P3 analyzer + P4 web + P5 docs drafted and verified locally (sandbox). Stopped at the approval gates above.
