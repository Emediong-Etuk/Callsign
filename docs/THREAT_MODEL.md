# Callsign threat model

## Assets

Vault tUSD; the integrity of the payee list, policy and scam flags; members' keys; the privacy of the messages employees receive.

## Actors

Requester (finance staff), principal (executive), owner (admin), external scammer, compromised device/agent, NEAR AI Cloud, the Callsign server, RPC providers.

## Attacks and mitigations

| Attack | Mitigation | Residual risk |
|---|---|---|
| Deepfake voice/video of an executive asks for an urgent payment | Payment to a new payee or above the limit is held until the claimed principal signs `confirm_payout` from their own account (G1, G2). The deepfake can't produce that signature. | Principal ignores the confirm screen's question and confirms anyway. |
| Look-alike receiver (`ce0.` vs `ceo.`) | Rules flag look-alikes (Levenshtein ≤2 / homoglyphs) as high risk; UI never truncates account ids; new payees are always held. | A look-alike of a *known payee* is still a new payee → held. |
| Compromised requester device or session key | The app key is a function-call key: protocol-limited to `request_payout`/`cancel_payout` (+`reject_payout` in wallet mode) on the vault, no deposits (T9, `demo:attack`). It can only create requests that someone else must confirm. | It can spam requests up to the pending cap, and burn its gas allowance. |
| Prompt-injected AI agent holding the requester's key | Same as above; plus the analyzer flags injection attempts as high risk. | None beyond the above. |
| Scammer social-engineers the principal directly ("please approve the payment Tolu will send") | Blunt confirm question, full account ids, red-flag categories and risk shown; high risk doubles the hold window. | A principal who is fully deceived can still confirm. k-of-n for large amounts is roadmap. |
| Owner compromise | Owner methods need a 1-yocto wallet signature; no code-upgrade method. | An owner can add the scammer as a payee or change policy. Timelocks on policy changes are roadmap. Whoever holds the vault account's full-access key could redeploy the contract (testnet: keys held by the deployer). |
| Principal account takeover | `set_member_active(false)` immediately stops that principal's pending approvals (unit test). | Window between takeover and deactivation. |
| Requester–principal collusion | Self-approval is blocked (`ERR_SELF_APPROVAL`). | Two colluding people can pay anyone. k-of-n is roadmap. |
| AI false negative | AI only adds friction: routing still holds every new payee / large amount (G5). A "low" verdict never skips a rule. G1–G3 don't depend on the AI. | A low verdict on a known payee under the limit lets it through — by policy. |
| Prompt injection against the analyzer | Message wrapped as `<untrusted_message>` (delimiter stripped from user text); the prompt orders an `instruction_injection` flag; the rules engine detects common injection phrases; final risk is `max(rules, ai)`. | A novel injection could lower the AI's verdict — but never below the rules' level. |
| Forged "verified" AI evidence | Verification runs server-side; the on-chain flag is labelled client-asserted; the evidence hash lets anyone holding the bundle re-check it. | The contract doesn't verify TEE signatures itself (on-chain `ecrecover` is roadmap). |
| Server sees message text in transit | `/api/analyze` is stateless, no logging; text never stored or put on-chain. | The server and NEAR AI gateway see the text in memory. E2E encryption to the TEE is roadmap. |
| Smuggling message text on-chain via evidence | Flags must be from a fixed 12-item list; hash must be 64 lowercase hex; all strings bounded (T14). | `memo` is free text — the UI warns it is public. |
| Storage spam | Pending cap per requester, bounded strings, only members can request. | A member can grow history slowly; owner can deactivate them. |
| Foreign token deposit inflating the balance | `ft_on_transfer` from any token other than tUSD is fully refunded (T1). | — |
| Payout to an unregistered account | The transfer fails, the callback marks `Failed` and restores the balance (T11). | — |
| Demo-mode abuse on the hosted site | Testnet only, fixed amounts/receivers server-side, 20 actions/hour/IP, demo keys can't touch owner functions. | In-memory rate limits are per server instance; the vault can be drained of mock tUSD until `demo:reset`. |

## Residual risks (summary)

Testnet-only and unaudited; owner centralisation; principal takeover; collusion; a deceived principal; client-asserted AI verification flag; message text transits the server; hardware attestation (Intel DCAP / NVIDIA) not verified by the app.
