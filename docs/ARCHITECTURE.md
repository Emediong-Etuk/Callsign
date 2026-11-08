# Callsign architecture

## Components

```mermaid
flowchart LR
  subgraph Browser
    R[Requester UI /app/request]
    P[Principal UI /confirm/:id]
    D[Guided demo /demo]
  end
  subgraph "Next.js server (web/)"
    A[/api/analyze<br/>rules + NEAR AI/]
    V[/api/vault<br/>contract views/]
    DM[/api/demo/*<br/>testnet demo keys/]
  end
  AI[(NEAR AI Cloud<br/>Confidential TEE model)]
  subgraph "NEAR testnet"
    VA[vault.&lt;prefix&gt;.testnet<br/>policy engine]
    TK[token.&lt;prefix&gt;.testnet<br/>NEP-141 tUSD]
  end
  R -- message text --> A
  A -- signed completion + attestation --> AI
  R -- request_payout (function-call key) --> VA
  P -- confirm_payout (1 yocto, wallet) / reject_payout --> VA
  D --> DM --> VA
  V --> VA
  VA -- ft_transfer --> TK
```

- `contracts/vault` — Rust policy engine (near-sdk 5.27). Modules: `types` (data, flag allow-list), `policy` (pure routing/expiry/validation), `requests` (deposit + lifecycle + callback), `admin` (owner methods), `views`, `events` (NEP-297), `errors`.
- `contracts/test-token` — minimal NEP-141/145/148 tUSD.
- `web/lib/analyzer` — deterministic rules (`rules.ts`), NEAR AI client (`nearai.ts`), combination (`index.ts`, G5), evidence bundle/hash (`evidence.ts`).
- `web/lib/verify` — TDX quote checks (`tdx.ts`) and response-signature verification (`nearai-verify.ts`), both pure and offline.
- `web/lib/near` — one place for RPC, views and signed transactions; used by scripts and API routes.
- `web/scripts` — `setup-testnet`, `demo-*`, `verify-all`, `verify-fixture`, `capture-fixture`, `check-secrets`.

## Scam flow

```mermaid
sequenceDiagram
  actor T as Tolu (finance)
  participant W as web
  participant AI as NEAR AI (TEE)
  participant V as vault
  actor A as Ada (CEO)
  T->>W: paste message, pick "Ada", receiver, amount
  W->>AI: attestation (fresh nonce), then completion (exact bytes kept)
  AI-->>W: verdict + signature
  W-->>T: HIGH: urgency, secrecy, new payee · TEE-verified
  T->>V: request_payout(evidence: categories + hash) via function-call key
  V-->>T: Pending, reserved, expires_at = now + hold × 2
  A->>V: reject_payout(report_scam = true)
  V-->>V: Rejected, reservation released, receiver flagged
  T->>V: request_payout(same receiver)
  V-->>T: ERR_RECEIVER_FLAGGED
```

## Legit flow

```mermaid
sequenceDiagram
  actor T as Tolu
  participant V as vault
  participant K as tUSD token
  actor A as Ada
  T->>V: request_payout(vendor, 200 tUSD)
  V->>K: ft_transfer (1 yocto) — instant: known payee, ≤ limit, not high risk
  K-->>V: ok → Executed
  T->>V: request_payout(supplier, 2,000 tUSD)
  V-->>T: Pending (new payee)
  A->>V: confirm_payout (1 yocto ⇒ full-access key ⇒ wallet approval)
  V->>K: ft_transfer
  K-->>V: ok → Executed (failure → Failed, balance restored)
```

## Expiry

```mermaid
sequenceDiagram
  actor T as Tolu
  participant V as vault
  actor X as anyone
  T->>V: request_payout(new payee)
  V-->>T: Pending, expires_at
  Note over V: hold window passes, nobody confirms
  X->>V: sweep_expired / expire_payout (or the principal's late confirm)
  V-->>V: Expired, reservation released — can never execute
```

## Data model

`Member {display_name, title, roles[Requester|Principal], active}` · `Payee {label, added_at_ns}` · `Policy {instant_limit, hold_window_ns, high_risk_hold_multiplier, max_pending_per_requester}` · `Evidence {evidence_hash, risk, flags[], model, chat_id, signing_address, signature_verified}` · `PayoutRequest {id, requester, claimed_principal, receiver_id, amount, memo, evidence?, route, status, reported_as_scam, created_at_ns, expires_at_ns?, decided_by?, decided_at_ns?, reason?}` · `FlagInfo {reports, first_reported_by, first_request_id, flagged_at_ns}`.

State: `members`/`payees`/`flags` (`IterableMap`), `requests` (`LookupMap<u64,_>`, contiguous ids from 1), `pending_ids` (`IterableSet`), `pending_by_requester`, `requests_by_requester`, `vault_balance`, `reserved`.

Invariants (asserted after every integration test): `reserved ≤ vault_balance`; `available = vault_balance − reserved`; `reserved = Σ amount of Pending`; the token balance the vault holds = `vault_balance`; terminal states (`Executed`, `Rejected`, `Expired`, `Cancelled`, `Failed`) never change.

## Gas and storage

- `ft_transfer` gets 15 Tgas, the `on_payout_complete` callback 15 Tgas; clients attach 100 Tgas to request/confirm. Verified in the sandbox tests.
- Strings are bounded (names 64, memo/reason 280, model/chat 96, address 66, ≤10 flags of ≤32 chars). Request history is append-only and paid from the vault account's NEAR balance (~3.6 NEAR funded at setup; the wasm is ~291 KB). Pruning old requests is roadmap. The pending cap (5 per requester) bounds open holds.
