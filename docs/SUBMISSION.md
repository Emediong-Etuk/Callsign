# Submission draft (Greg submits — the agent never does)

Form: https://nearhackathon.com/#apply (or the JSON API described in HACKATHON.md, only after you confirm the exact payload). One submission per project; fixes via https://nearhackathon.com/request-changes. Deadline **2026-11-14 23:59 UTC (00:59 WAT on the 15th)**.

| Field | Draft value |
|---|---|
| Project name | Callsign |
| Team lead | _Greg — your full name_ |
| Email | _your contact email_ |
| Team size | `1` |
| Tracks | `security`, `privacy` (optional `realworld` — see below) |
| NEAR wallet (prizes) | _your **mainnet** account, e.g. `name.near` — not the testnet one_ |
| Repository | https://github.com/Emediong-Etuk/Callsign (must be public) |
| Demo post | _link to your X post_ |
| Description | below — **1,211 characters** (re-count with `node web/scripts/count-description.mjs`) |
| Hosted demo | https://callsign-nine.vercel.app (put it in the README and the X post — **not** in the form's website field) |
| Website | **Leave empty / don't send.** HACKATHON.md says `website` is a spam trap: any value rejects the submission. |
| Consent | read and agree: "I agree that the organizers may use these details to review our submission and contact us about this hackathon." |

**Track recommendation:** `security` (primary: policy engine, function-call keys, scam flagging, attack demo) and `privacy` (TEE inference on NEAR AI Cloud with attestation + signature checks; nothing sensitive on-chain). `realworld` is a stretch: we use a mock stablecoin on testnet and no NEAR Intents, so I'd leave it off unless you want to argue the "company payments" angle.

## Description

<!-- description:start -->
Deepfake scams end the same way: "send money now, to this new account." Callsign doesn't try to tell whether a voice or video is real. It asks whether the real person signed the request.

Company funds sit in a Rust vault contract on NEAR. Routine payments (known payee, under a limit) go out instantly. Anything risky — a new payee, a large amount, or a message our private AI rates high-risk — is held until the person who supposedly asked confirms from their own NEAR account. Confirming attaches 1 yoctoNEAR, which only a full-access key (their wallet) can sign. Silence means the request expires; "I didn't send this" flags the receiver on-chain and blocks it.

Finance staff use a NEAR function-call key that can only request payouts, so a hacked laptop or prompt-injected agent can't move money: the protocol itself refuses (our attack demo shows each refusal). A NEAR AI Cloud model in a TEE checks the message for urgency, secrecy and new payment details; the app verifies its signature against the attested signing key and puts only categories and a hash on-chain. The AI can only add friction.

Testnet only. Proven by 16 sandbox tests and a one-command check (npm run verify:all) that needs no keys.
<!-- description:end -->

## X post (must include "Built at NEAR HACKATHON", @NEARProtocol, #NEARHackathon, and the video)

> A deepfake can copy your CEO's face and voice. It can't sign with her private key.
>
> Callsign holds risky payments until the real person confirms from their own NEAR account. In the video: a fake "CEO" voice note asks for 25,000 → held → the real CEO taps "I didn't send this" → wallet blocked on-chain.
>
> NEAR makes it work: function-call keys that can't move money, 1-yocto wallet confirmations, and private TEE AI on NEAR AI Cloud.
>
> Built at NEAR HACKATHON @NEARProtocol #NEARHackathon
> Demo: https://callsign-nine.vercel.app · Code: https://github.com/Emediong-Etuk/Callsign
> Finance teams: who should have to confirm a payment like this?

(Optional extra tags from the guide: @NearLegion @NearBuilders.)

### Optional 3-post thread

1. A deepfake can copy your CEO's face and voice. It can't sign with her private key. Callsign: a payment firewall against deepfake scams. Built at NEAR HACKATHON @NEARProtocol #NEARHackathon 🎥 [video]
2. How: funds sit in a NEAR vault. New payee or big amount → held until the claimed sender confirms from their own account (1 yoctoNEAR = wallet signature). No answer → it expires. "I didn't send this" → receiver flagged on-chain.
3. Staff keys are NEAR function-call keys: even a hacked laptop can't move money. A TEE model on NEAR AI Cloud flags pressure tactics; only categories + a hash go on-chain. Try it: https://callsign-nine.vercel.app · Code: https://github.com/Emediong-Etuk/Callsign. Who in your company should confirm payments like this?

## Your manual checklist

- [ ] Repo made public (ask the agent to check `git log` for secrets first)
- [x] Hosted demo live (https://callsign-nine.vercel.app) — keep it up through 2026-11-25
- [ ] Video recorded per `docs/DEMO_SCRIPT.md` (fictional people only)
- [ ] X post published with the video; link copied
- [ ] Form submitted with your **mainnet** prize account, website field empty
- [ ] If you enter a second project, both READMEs name each other (max two projects)
