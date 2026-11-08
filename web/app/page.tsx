import Link from "next/link";
import { STATS } from "@/lib/stats";
import { accountUrl } from "@/lib/near/config";

const VAULT = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID;
const TOKEN = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID;

export default function Home() {
  return (
    <div className="space-y-14">
      <section className="space-y-5 pt-4">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Payment firewall against deepfake impersonation
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          A deepfake can copy a face and a voice. It can’t sign with a private key.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Deepfake scams end the same way: <em>“send money now, to this new account.”</em> Callsign
          doesn’t try to tell whether the video is real. It asks a better question:{" "}
          <strong className="text-ink">did the real person sign this request?</strong>
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/demo"
            className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white"
          >
            Try the guided demo (no wallet)
          </Link>
          <Link
            href="/app"
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-paper px-5 font-semibold"
          >
            Use with a testnet wallet
          </Link>
        </div>
      </section>

      <section aria-labelledby="problem" className="space-y-4">
        <h2 id="problem" className="text-2xl font-semibold">
          The problem
        </h2>
        <p className="max-w-3xl text-muted">
          A finance officer gets an urgent voice note or video call from “the CEO”: a confidential
          deal, a new wallet, a deadline in an hour. The face and the voice are convincing, because
          generating them is now cheap. Detecting fakes is an arms race defenders keep losing. The
          money only moves because one person was persuaded — and nothing checked that the boss
          actually asked.
        </p>
        {STATS.length ? (
          <ul className="grid gap-4 sm:grid-cols-3">
            {STATS.map((s) => (
              <li key={s.url} className="rounded-xl border border-line bg-paper p-4">
                <div className="text-2xl font-bold text-bad">{s.figure}</div>
                <p className="mt-1 text-sm">{s.text}</p>
                <a
                  className="mt-2 inline-block text-xs text-brand underline"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.source}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="how" className="space-y-4">
        <h2 id="how" className="text-2xl font-semibold">
          How it works
        </h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {[
            [
              "1. Funds sit in a policy vault",
              "Company tUSD lives in a NEAR contract. Routine payments — a known payee, under the limit — go straight through.",
            ],
            [
              "2. Risky payments are held",
              "A new payee, a large amount, or a message our private AI rates high-risk: the payout is held and the claimed sender is asked.",
            ],
            [
              "3. Only their signature releases it",
              "The real person confirms from their own NEAR account. Silence means it expires. “I didn’t send this” blocks the receiver on-chain.",
            ],
          ].map(([t, d]) => (
            <li key={t} className="rounded-xl border border-line bg-paper p-5">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-2 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="near" className="space-y-4">
        <h2 id="near" className="text-2xl font-semibold">
          What NEAR enables
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {[
            [
              "Human-readable identity",
              "Named accounts like ceo.acme.testnet, with sub-accounts for each role — so the principal’s identity is the account, shown in full.",
            ],
            [
              "Protocol-level limited keys",
              "Finance staff use a function-call key that can only request payouts. NEAR itself refuses anything else, before contract code runs.",
            ],
            [
              "A confirmation a deepfake can’t forge",
              "Releasing a payout attaches 1 yoctoNEAR, which only a full-access key (the person’s wallet) can sign.",
            ],
            [
              "Funds under programmable policy",
              "NEP-141 tokens held by a contract that enforces limits, holds, expiry and an on-chain scam flag.",
            ],
            [
              "Fast finality",
              "Confirmations land in seconds, so holding a payment costs minutes, not days.",
            ],
            [
              "Private, verifiable AI",
              "NEAR AI Cloud runs the red-flag model in a TEE and signs its answer; only categories and a hash go on-chain.",
            ],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg border border-line bg-paper p-4">
              <h3 className="font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-line bg-paper p-5 text-sm">
        <h2 className="font-semibold">Open source, testnet contracts</h2>
        <ul className="mt-2 space-y-1 text-muted">
          <li>
            Code:{" "}
            <a className="text-brand underline" href="https://github.com/Emediong-Etuk/Callsign">
              github.com/Emediong-Etuk/Callsign
            </a>
          </li>
          {VAULT ? (
            <li>
              Vault:{" "}
              <a className="mono text-brand underline" href={accountUrl(VAULT)}>
                {VAULT}
              </a>
            </li>
          ) : null}
          {TOKEN ? (
            <li>
              Token (tUSD, a demo asset):{" "}
              <a className="mono text-brand underline" href={accountUrl(TOKEN)}>
                {TOKEN}
              </a>
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
