# Demo video storyboard (≤ 2:30)

All people and companies are fictional. **Never use a real person's face or voice.** For the hook, use on-screen text (recommended) or a clearly synthetic voice for the fictional "Ada"; label it "synthetic voice of a fictional CEO".

| Time | Screen | Voiceover |
|---|---|---|
| 0:00 | Black screen, then a phone notification: voice note from "Ada (CEO)". Caption: *"Tolu, it's Ada. I need 25,000 sent to our new partner wallet before 3pm… keep this between us."* Then: **"This voice note is fake. Ada never sent it."** | "This voice note is fake. Ada never sent it. Deepfakes like this already cost companies millions — one firm lost $25 million to a fake video call." |
| 0:15 | `/demo` → Deepfake CEO wire → **Tolu: check it and submit**. Red flags appear with quotes: urgency, secrecy, authority pressure, new payee. Badge: NEAR AI (TEE) · signature verified (or "Rules only" if no key — don't fake it). | "Tolu pastes the message. A private AI running in a secure enclave on NEAR AI Cloud flags the pressure tactics — and signs its answer, so we can prove which model said it." |
| 0:45 | Status chip **Held — awaiting confirmation**, countdown, the request tx link opened on testnet.nearblocks.io. | "Because it's a new payee and high risk, the vault holds it. The money is reserved, not sent." |
| 1:05 | Click **Ada’s phone just buzzed** (switches to Ada’s phone view). "Did you ask Tolu to pay 25,000 tUSD to fastpay-…?" Tap **No, I didn't send this — block and report**. **Blocked & reported**. | "The real Ada gets one plain question on her phone. She didn't ask. One tap blocks it and flags that wallet on-chain." |
| 1:25 | **Scammer tries again → same wallet** → **Refused by the vault · ERR_RECEIVER_FLAGGED**. | "If the scammer tries again, the contract refuses." |
| 1:35 | Real new supplier → Held → Ada taps **Yes, I asked for this** → **Paid**; supplier balance up. | "When it's real, Ada confirms from her own account and the money moves in seconds. A deepfake can copy a face and a voice. It can't sign with her key." |
| 1:55 | **Run the attack**: five attempts, all ✓ blocked (ReceiverMismatch, DepositWithFunctionCall ×2, MethodNameMismatch, RequiresFullAccess). The hosted site skips the sixth (Tolu's full-access key isn't on the server); `npm run demo:attack` shows it (ERR_NOT_PRINCIPAL). | "Even if Tolu's laptop is hacked: her key is a NEAR function-call key. The protocol itself refuses to let it move money or approve anything." |
| 2:10 | Landing page "What NEAR makes possible" section. | "Named accounts, protocol-limited keys, wallet-signed confirmations and private TEE inference — that's what NEAR makes possible here." |
| 2:20 | GitHub repo + demo URL on screen. | "Built at NEAR HACKATHON. Try the demo — and tell us: who in your company should have to confirm a payment like this?" |

## Shot list

1. Phone-notification mock with the fictional message (text on screen).
2. `/demo` full-screen at 1280×800, browser zoom 110%.
3. One nearblocks transaction page (the HELD request).
4. Mobile view (390×844) of Ada's confirm card.
5. Attack panel result.
6. Landing page sections.
7. End card: repo URL, demo URL, "Built at NEAR HACKATHON · @NEARProtocol #NEARHackathon".
