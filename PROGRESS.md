# Callsign — Progress

Source of truth: `CALLSIGN_BUILD_PROMPT.md`. This file tracks phase status, decisions, open questions and deviations.

## Phase checklist

- [x] **P0 Setup** — docs read, CLAUDE.md, PROGRESS.md, scaffold, toolchains, LICENSE (2026-11-08)
- [x] **P1 Contracts** — token + vault, unit + integration tests T1–T16, clippy clean (2026-11-08: 4 token unit + 21 vault unit + 16 sandbox integration tests green)
- [ ] **P2 Testnet** — master account (needs Greg's approval), setup:testnet, demo:scam/legit/attack
- [ ] **P3 AI** — rules, NEAR AI client, verification, evidence bundle, fixture, vitest
- [ ] **P4 Web** — pages, demo mode, wallet flow, hosted demo (ask before Vercel)
- [ ] **P5 Docs + judge simulation**
- [ ] **P6 Handoff**

## Start-of-project questions (§0.2) — defaults in use until Greg answers

| # | Question | Status / value in use |
|---|---|---|
| 1 | OS | Detected: build sandbox is Linux x86_64 (cloud session). Greg's own OS still unknown — README covers Linux/macOS, and WSL2 for Windows. |
| 2 | Testnet prefix | Default generated: `callsign-fdym` → master `callsign-fdym.testnet` (not created yet; needs approval) |
| 3 | NEAR AI Cloud API key | Not yet. Building rules-only fallback first. |
| 4 | GitHub repo | `Emediong-Etuk/Callsign` (from the existing git remote; private/public status unknown) |
| 5 | Mainnet prize account, X handle, contact email | Placeholders in docs/SUBMISSION.md |

## Decision log

- **2026-11-08** — Build environment: cloud sandbox had no access to NEAR hosts. Created a personal cloud environment `callsign` (Greg approved) allowing nearhackathon.com, docs.near.org, docs.near.ai, cloud-api.near.ai, testnet RPCs, nearblocks, crates.io etc.
- **2026-11-08** — Rust toolchain: current `cargo near new` template (github.com/near/cargo-near-new-project-template, main) pins `1.86.0` with `near-sdk 5.24`, `near-workspaces 0.22`. Latest near-sdk (5.30.1) needs Rust 1.95, so we pin **near-sdk / near-contract-standards 5.27.0** (newest with `rust-version = 1.86`) and toolchain **1.86.0** per §5. 
- **2026-11-08** — Generated testnet prefix `callsign-fdym`.
- **2026-11-08** — Toolchain versions verified: node v22.23.4, cargo-near 0.23.0, near-cli-rs 0.31.1 (both built from crates.io; needed `libudev-dev`), Rust 1.86.0 for contracts (rust-toolchain.toml), near-workspaces 0.22.1 (newest without an MSRV above 1.86), sandbox neard 2.13.4.
- **2026-11-08** — Sandbox in containers: neard insists on a 65535 open-files limit; this container's hard limit is 20000 and can't be raised. Added `contracts/tools/fdlimit-shim.c`, an LD_PRELOAD shim that clamps the request; `contracts/tools/test.sh` builds/uses it only when the hard limit is too low. Judges' containers may hit the same limit, so it's in the repo.
- **2026-11-08** — Contract design choices within the brief: request history in `LookupMap<u64, _>` with contiguous ids from 1 plus an `IterableSet` of pending ids (cheap sweeps and principal inboxes) and a per-requester id list; `ERR_TOO_MANY_PENDING` applies to every new request (rule 5 runs before routing); extra error codes `ERR_NOT_EXPIRED`, `ERR_NOT_YOUR_REQUEST`, `ERR_NOT_AUTHORIZED_TO_REJECT`, `ERR_REQUEST_NOT_FOUND`, `ERR_INVALID_POLICY`, `ERR_NOT_FLAGGED`, `ERR_MEMBER_NOT_FOUND`, `ERR_PAYEE_NOT_FOUND`; duplicate flags rejected; enum JSON values are PascalCase (`"Pending"`, `"High"`).
- **2026-11-08** — Extra safety beyond the brief: `confirm_payout` also requires the claimed principal to still be an *active* principal, so deactivating a compromised principal kills their pending approvals (unit test `deactivated_principal_cannot_confirm`). The callback treats only `PromiseError::Failed` as failure.
- **2026-11-08** — Git push to `origin` was blocked by the session's permission check (consistent with brief rule 5). Commits stay local until Greg approves pushing.

## Differences between the brief and live sources

| Topic | Brief says | Live source says | Action |
|---|---|---|---|
| Submission form "website" field | Optional website | HACKATHON.md: `website` is a **spam trap**; any non-empty value rejects the submission | SUBMISSION.md will say: leave it empty / don't send it |
| Code start date | Window starts 2026-11-01 | Q-001: code from the announcement on 2026-10-19 counts; earlier is baseline | No effect (no pre-hackathon code). README states dev dates. |
| Demo post | Video required | Guide says "video or screenshots", but Q-012 says screenshots aren't enough when judges can't open the demo | Keep video (stricter). Optional extra tags @NearLegion, @NearBuilders. |
| Hosted demo uptime | Through 2026-11-25 | Q-012: up to 2026-11-18, ideally 2026-11-25 | Keep 2026-11-25 target |
| Submission method | Greg submits the form | Guide also offers POST /api/applications (only with the human's confirmation of the exact payload) | Greg still submits; SUBMISSION.md will contain the field values |
| NEAR AI verification docs | `docs.near.ai/cloud/verification/chat.md` | docs.near.ai restructured: `cloud/verification/cloud-api/response-signatures.md`, `.../model-attestations.md`, `reference/response-signature-verification.md` | Follow the live pages in P3 |
| Access keys docs URL | docs.near.org/protocol/access-keys | docs.near.org/protocol/accounts-contracts/access-keys | Use live URL |

## Organizer track prompts — scope notes

- `security` prompt asks for: a function-call key scoped to one contract with its limits explained in the README; an attack demo script where a prompt-injected agent tries to pay a known-bad address and gets stopped, with the log shown; read the access-keys caveats (an account with only function-call keys can't transfer NEAR or add keys, and can lock itself out if the gas allowance runs out). → README must explain the FCK allowance caveat; `demo:attack` log goes in the README.
- `privacy` prompt asks for: TEE model chosen from the models endpoint; attestation fetched with a fresh random nonce; a "Verified" panel listing exactly what was checked; nothing kept server-side, obvious in code; fictional sample documents. → Already in scope (§7.5, §8.2, fixtures).
- `realworld` prompt centres on 1Click/Intents, meta-tx relayers and USDC — mostly out of our scope. Decide in P5 whether to list the track.

## Open questions for Greg

1. Answers to the §0.2 questions above (OS, prefix OK?, NEAR AI key, repo visibility, prize account / X handle / email).
2. **Phase 2 approval:** OK to create `callsign-fdym.testnet` via the faucet and run testnet transactions?

## Session log

- **2026-11-08 (session 1)** — P0 started.
