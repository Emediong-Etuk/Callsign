import Link from "next/link";
import {
  ArrowRight,
  AtSign,
  BrainCircuit,
  Coins,
  FileCheck2,
  Fingerprint,
  KeyRound,
  Landmark,
  Lock,
  ShieldCheck,
  Timer,
  Wallet,
} from "lucide-react";
import { GithubMark, REPO } from "@/components/brand";
import { CountUp, Reveal, SpotlightCard } from "@/components/motion";
import { ScamSimulator } from "@/components/scam-simulator";
import { STATS } from "@/lib/stats";

const VAULT = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID;

const STAT_NUMBERS: { to: number; prefix: string; suffix: string; decimals: number }[] = [
  { to: 893, prefix: "$", suffix: "M", decimals: 0 },
  { to: 263, prefix: "+", suffix: "%", decimals: 0 },
  { to: 25.6, prefix: "$", suffix: "M", decimals: 1 },
];

const STEPS = [
  {
    icon: Landmark,
    title: "Funds sit in a policy vault",
    body: "Company money lives in a NEAR contract. A known payee under the limit is paid instantly — finance keeps moving.",
  },
  {
    icon: Timer,
    title: "Risky payments are held",
    body: "A new payee, a big amount, or a message our private AI rates high-risk: the money is reserved, not sent.",
  },
  {
    icon: Fingerprint,
    title: "Only their signature releases it",
    body: "The person who supposedly asked confirms from their own NEAR account. Silence expires. “I didn’t send this” blocks the wallet on-chain.",
  },
];

const ATTACKS: [string, string][] = [
  ["ft_transfer on the token", "ReceiverMismatch"],
  ["confirm_payout with 1 yocto", "DepositWithFunctionCall"],
  ["add scammer as payee", "MethodNameMismatch"],
  ["send NEAR directly", "RequiresFullAccess"],
  ["confirm as the wrong person", "ERR_NOT_PRINCIPAL"],
];

export default function Home() {
  return (
    <>
      {/* HERO */}
      <section className="bg-hero relative overflow-hidden text-white">
        <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-32 lg:grid-cols-[1.1fr_1fr] lg:pt-36">
          <div className="animate-fade-up">
            <Link
              href={REPO}
              className="glass-dark inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white/80 transition hover:text-white"
            >
              <span className="rounded-full bg-gradient-to-r from-brand to-brand-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                New
              </span>
              Built at NEAR HACKATHON 2026 · live on testnet
              <ArrowRight size={13} />
            </Link>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              A deepfake can copy a face and a voice.{" "}
              <span className="text-gradient">It can’t sign with a private key.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
              Callsign is a payment firewall for finance teams. Instead of guessing whether a video
              is real, it asks one question the scammer can’t answer:{" "}
              <strong className="font-semibold text-white">
                did the real person sign this request?
              </strong>
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/demo"
                className="group inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-semibold text-night shadow-lg shadow-brand/30 transition hover:shadow-xl hover:shadow-brand/40"
              >
                Try the guided demo <span className="text-subtle">— no wallet</span>
                <ArrowRight size={17} className="transition group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/app"
                className="glass-dark inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-semibold text-white transition hover:bg-white/10"
              >
                <Wallet size={17} /> Use a testnet wallet
              </Link>
            </div>
            <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
              <li className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-300" /> 16 sandbox security tests
              </li>
              <li className="flex items-center gap-2">
                <BrainCircuit size={16} className="text-cyan-300" /> TEE-verified AI
              </li>
              <li className="flex items-center gap-2">
                <Lock size={16} className="text-indigo-300" /> No message text on-chain
              </li>
            </ul>
          </div>
          <div className="flex justify-center lg:justify-end">
            <ScamSimulator />
          </div>
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-wash"
          aria-hidden="true"
        />
      </section>

      {/* STATS */}
      <section className="relative mx-auto -mt-10 max-w-6xl px-4" aria-labelledby="problem">
        <h2 id="problem" className="sr-only">
          The problem
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          {STATS.map((s, i) => (
            <Reveal key={s.url} delay={i * 100}>
              <div className="h-full rounded-2xl border border-line bg-paper p-6 shadow-sm">
                <div className="text-4xl font-semibold tracking-tight text-bad">
                  {STAT_NUMBERS[i] ? <CountUp {...STAT_NUMBERS[i]} /> : s.figure}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.text}</p>
                <a
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {s.source} <ArrowRight size={12} />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* INSIGHT */}
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            The insight
          </p>
          <p className="mt-4 text-2xl font-medium leading-snug tracking-tight sm:text-3xl">
            Detecting fakes is an arms race defenders keep losing. But every deepfake scam ends with
            the same request —{" "}
            <span className="text-gradient-dark">“send money now, to this new account.”</span> That
            request is where Callsign stands guard.
          </p>
        </Reveal>
      </section>

      {/* HOW IT WORKS */}
      <section className="mx-auto max-w-6xl px-4 pb-24" aria-labelledby="how">
        <Reveal>
          <h2 id="how" className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <p className="mt-3 max-w-2xl text-muted">
            Routine payments stay instant. Risky ones wait for a signature a deepfake can’t produce.
          </p>
        </Reveal>
        <div className="relative mt-12">
          <div
            className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-brand/0 via-brand/40 to-brand-2/0 md:block"
            aria-hidden="true"
          />
          <ol className="relative grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 120} className="relative">
                <div>
                  <div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-lg shadow-brand/30">
                    <s.icon size={24} aria-hidden="true" />
                    <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-paper text-xs font-bold text-brand-ink ring-1 ring-line">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* BENTO: WHAT NEAR ENABLES */}
      <section className="bg-paper py-24" aria-labelledby="near">
        <div className="mx-auto max-w-6xl px-4">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Why NEAR</p>
            <h2 id="near" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              What NEAR makes possible
            </h2>
          </Reveal>
          <div className="mt-10 grid auto-rows-[minmax(180px,auto)] gap-4 md:grid-cols-6">
            <Reveal className="md:col-span-4">
              <SpotlightCard className="h-full">
                <Tile icon={KeyRound} title="A confirmation a deepfake can’t forge">
                  Releasing a held payout attaches exactly <b>1 yoctoNEAR</b>. NEAR’s limited keys
                  can’t attach deposits, so only the principal’s full-access key — their own wallet
                  — can sign it.
                </Tile>
                <div className="mt-5 rounded-xl bg-night p-4 font-mono text-[12px] leading-relaxed text-white/80">
                  <span className="text-cyan-300">confirm_payout</span>({"{"} id:{" "}
                  <span className="text-amber-200">&quot;10&quot;</span> {"}"}){" "}
                  <span className="text-white/40">· deposit</span>{" "}
                  <span className="text-emerald-300">1 yocto</span>
                  <br />
                  <span className="text-white/40">→ signer must be</span>{" "}
                  <span className="text-indigo-300">ceo.acme.testnet</span>
                </div>
              </SpotlightCard>
            </Reveal>
            <Reveal className="md:col-span-2" delay={80}>
              <SpotlightCard className="h-full">
                <Tile icon={Lock} title="Protocol-limited keys">
                  Finance staff hold a function-call key that can only <i>request</i> payouts. NEAR
                  refuses everything else before any contract code runs.
                </Tile>
              </SpotlightCard>
            </Reveal>
            <Reveal className="md:col-span-2" delay={60}>
              <SpotlightCard className="h-full">
                <Tile icon={AtSign} title="Human-readable identity">
                  Named accounts like <span className="mono text-brand-ink">ceo.acme.testnet</span>{" "}
                  — the vault checks the account, and the UI always shows it in full.
                </Tile>
              </SpotlightCard>
            </Reveal>
            <Reveal className="md:col-span-2" delay={120}>
              <SpotlightCard className="h-full">
                <Tile icon={BrainCircuit} title="Private, verifiable AI">
                  A NEAR AI Cloud model inside a TEE flags pressure tactics and signs its answer.
                  Only categories and a hash go on-chain.
                </Tile>
              </SpotlightCard>
            </Reveal>
            <Reveal className="md:col-span-2" delay={180}>
              <SpotlightCard className="h-full">
                <Tile icon={Coins} title="Money under programmable policy">
                  NEP-141 funds in a Rust vault: limits, holds, reservations, expiry and an on-chain
                  scam flag.
                </Tile>
              </SpotlightCard>
            </Reveal>
          </div>
        </div>
      </section>

      {/* TRY TO BREAK IT */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-24 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            Try to break it
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Even a hacked laptop can’t move the money.
          </h2>
          <p className="mt-4 leading-relaxed text-muted">
            In the guided demo, one button plays a compromised finance session — or a
            prompt-injected AI agent holding the key — and tries every way to move funds. Each
            attempt is refused, most of them by the NEAR protocol itself.
          </p>
          <Link
            href="/demo#attack"
            className="mt-6 inline-flex items-center gap-2 font-semibold text-brand hover:underline"
          >
            Run the attack yourself <ArrowRight size={16} />
          </Link>
        </Reveal>
        <Reveal delay={120}>
          <div className="overflow-hidden rounded-2xl bg-night shadow-2xl shadow-brand/10 ring-1 ring-white/10">
            <div
              className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3"
              aria-hidden="true"
            >
              <span className="h-3 w-3 rounded-full bg-red-400/80" />
              <span className="h-3 w-3 rounded-full bg-amber-300/80" />
              <span className="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span className="ml-3 font-mono text-xs text-white/40">npm run demo:attack</span>
            </div>
            <ul className="space-y-2 p-5 font-mono text-[12.5px]">
              {ATTACKS.map(([what, why], i) => (
                <li
                  key={what}
                  className="stagger text-white/80"
                  style={{ animationDelay: `${300 + i * 220}ms` }}
                >
                  <span className="text-emerald-300">✓ blocked</span>{" "}
                  <span className="text-white/50">{what}</span>
                  <span className="block pl-[4.6rem] text-cyan-300/90">{why}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <Reveal>
          <div className="bg-hero relative overflow-hidden rounded-3xl px-6 py-14 text-center text-white sm:px-12">
            <div className="bg-grid pointer-events-none absolute inset-0" aria-hidden="true" />
            <h2 className="relative text-3xl font-semibold tracking-tight sm:text-4xl">
              See it stop a deepfake in 60 seconds.
            </h2>
            <p className="relative mx-auto mt-3 max-w-xl text-white/70">
              Every step is a real NEAR testnet transaction you can open on the explorer.
            </p>
            <div className="relative mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/demo"
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-semibold text-night"
              >
                Start the guided demo <ArrowRight size={17} />
              </Link>
              <a
                href={REPO}
                className="glass-dark inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-semibold"
              >
                <GithubMark /> Read the code
              </a>
              {VAULT ? (
                <a
                  href={`https://testnet.nearblocks.io/address/${VAULT}`}
                  className="glass-dark inline-flex min-h-12 items-center gap-2 rounded-xl px-5 font-semibold"
                >
                  <FileCheck2 size={17} /> Vault on testnet
                </a>
              ) : null}
            </div>
          </div>
        </Reveal>
      </section>
    </>
  );
}

function Tile({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Lock;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand/10 to-brand-2/10 text-brand ring-1 ring-brand/15">
        <Icon size={20} aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 leading-relaxed text-muted">{children}</p>
    </>
  );
}
