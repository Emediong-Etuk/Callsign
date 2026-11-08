# Callsign — rules for coding agents

Source of truth: CALLSIGN_BUILD_PROMPT.md (live hackathon guide / official docs win if they differ; log differences in PROGRESS.md)

## Working rules (§0.1)
- Work phase by phase (§13); a phase is done only when its acceptance checks pass. Commit at phase ends and sensible points.
- Update PROGRESS.md at the end of every phase and before stopping.
- Verify library APIs against current official docs before use; pin verified versions.
- Never fake results: no mocked success paths in the demo, no hard-coded "verified ✅". README claims only what code/tests/demo scripts prove.
- Ask Greg before: creating/pushing a GitHub remote or making it public, deploying to Vercel, any mainnet action, spending money, posting publicly, submitting any form, installing admin-level global tools. Testnet txs OK once the master account is approved.
- Secrets: never commit keys, seed phrases, API keys. `.env*` gitignored except `.env.example`. Server secrets never get `NEXT_PUBLIC_`. Run `npm run check:secrets` before every commit.
- Don't stall: non-blocking questions → use the brief's default, log it, keep going.
- Content ethics: demo company/people are fictional; never imitate a real person/company/brand or clone a real voice/face. Mock token is "Callsign Test USD" (tUSD), never styled like USDC/USDT.
- Don't install or run third-party agent skills/scripts without asking (reading docs is fine).

## Hackathon hard requirements (§1)
- Deadline 2026-11-14 23:59 UTC (internal: 2026-11-14 12:00 UTC). Repo public by then, MIT LICENSE.
- Tracks: `security` (primary), `privacy` (secondary), `realworld` optional (decide in P5).
- Screeners (Claude Code/Codex) have NO API keys, wallet or testnet account → README needs "do X, see Y" steps that work without help.
- README discloses: no pre-hackathon code, third-party libraries, AI coding assistance.
- No NEAR Intents (no testnet). Testnet-only is eligible.
- Demo post on X (Greg posts): "Built at NEAR HACKATHON", @NEARProtocol, #NEARHackathon, video.
- Agents never submit the form or post on X. Prepare docs/SUBMISSION.md. Do NOT fill the `website` field (spam trap).

## Guarantees — each proven by a named test (§2.3)
- G1 funds move only via policy; requester alone can't pay new payee or above limit (T2,T3,T5)
- G2 held payouts execute only on claimed principal's `confirm_payout` with exactly 1 yocto (T4)
- G3 silence is safe: unconfirmed requests expire, release funds, never execute (T7)
- G4 requester session key is a function-call key: can't transfer or confirm (T9)
- G5 AI only adds friction; never removes a rule (T6 + analyzer tests)
- G6 scam-reported receivers flagged on-chain, blocked until owner clears (T8)
- G7 no message text/quotes on-chain — only categories, risk, hash, verification metadata (T14)
- G8 AI verdicts from a Confidential TEE model; signature verified vs attestation signing address (verify tests + fixture)

## Quality bar (§12)
- TS strict, no `any` in lib/, ESLint + Prettier; Rust fmt + `clippy -D warnings`.
- Comment every security-critical contract line with *why*.
- No dead buttons/TODOs in the demo flow; loading/empty/error states everywhere; every ERR_* has a friendly message.
- CI runs `verify:all` (must pass on fresh clone with no secrets/wallet/testnet account) and is green.
- check:secrets clean; git history clean before going public.
