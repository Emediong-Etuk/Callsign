"use client";
/**
 * Hero animation: the whole Callsign story in ~12 seconds, and the visitor can
 * take Ada's role. Purely illustrative (the real thing is on /demo).
 */
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Hourglass,
  Lock,
  OctagonX,
  Play,
  RotateCcw,
  ScanLine,
  Smartphone,
} from "lucide-react";

const STEPS = ["incoming", "scanning", "flags", "held", "ask", "blocked"] as const;
type Step = (typeof STEPS)[number];
const AUTO_MS: Record<Step, number> = {
  incoming: 2600,
  scanning: 1800,
  flags: 2200,
  held: 2000,
  ask: 4500,
  blocked: 0,
};
const FLAGS = ["Urgency", "Secrecy", "Authority pressure", "New wallet"];

export function ScamSimulator() {
  const [step, setStep] = useState<Step>("incoming");
  const [tried, setTried] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idx = STEPS.indexOf(step);

  const go = useCallback((s: Step) => {
    if (timer.current) clearTimeout(timer.current);
    setStep(s);
  }, []);

  useEffect(() => {
    const ms = AUTO_MS[step];
    if (!ms) return;
    timer.current = setTimeout(() => setStep(STEPS[STEPS.indexOf(step) + 1]!), ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [step]);

  const replay = () => {
    setTried(false);
    go("incoming");
  };

  return (
    <div
      className="relative w-full max-w-md"
      aria-label="Animated example of Callsign stopping a deepfake payment request"
    >
      <div
        className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand/30 via-transparent to-brand-2/20 blur-2xl"
        aria-hidden="true"
      />
      <div className="glass-dark relative overflow-hidden rounded-3xl p-5 text-white shadow-2xl shadow-black/40">
        {/* progress rail */}
        <div className="flex gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
              <span
                className={`block h-full rounded-full transition-all duration-500 ${
                  i < idx
                    ? "w-full bg-white/60"
                    : i === idx
                      ? s === "blocked"
                        ? "w-full bg-bad-line"
                        : "w-full bg-gradient-to-r from-brand to-brand-2"
                      : "w-0"
                }`}
              />
            </span>
          ))}
        </div>

        {/* the incoming message */}
        <div className="relative mt-4 overflow-hidden rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-fuchsia-400 to-orange-300 text-sm font-bold text-night">
              A
            </div>
            <div className="text-sm">
              <div className="font-semibold">“Ada Okafor, CEO”</div>
              <div className="text-xs text-white/50">Voice note · just now</div>
            </div>
            <div
              className="wave ml-auto flex h-6 items-center gap-[3px] text-brand-2"
              aria-hidden="true"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    height: `${8 + ((i * 7) % 16)}px`,
                    animationDelay: `${i * 70}ms`,
                    animationPlayState: step === "incoming" ? "running" : "paused",
                  }}
                />
              ))}
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-white/80">
            “Tolu, I need <mark className="rounded bg-transparent text-white">25,000</mark> sent to
            our <Hl on={idx >= 2}>new partner wallet</Hl> <Hl on={idx >= 2}>before 3pm</Hl>. I’m in
            a meeting, can’t talk. <Hl on={idx >= 2}>Keep this between us.</Hl>”
          </p>
          {step === "scanning" ? (
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-16 animate-scan bg-gradient-to-b from-transparent via-brand-2/30 to-transparent"
              aria-hidden="true"
            />
          ) : null}
        </div>

        {/* what happens next */}
        <div className="mt-4 min-h-[188px]">
          <AnimatePresence mode="wait">
            {step === "incoming" ? (
              <Panel key="incoming">
                <Row
                  icon={<Play size={16} />}
                  title="Looks and sounds exactly like Ada"
                  sub="A cloned voice costs a few dollars to make."
                />
              </Panel>
            ) : null}
            {step === "scanning" ? (
              <Panel key="scanning">
                <Row
                  icon={<ScanLine size={16} className="animate-pulse" />}
                  title="Private AI check inside a TEE…"
                  sub="NEAR AI Cloud · response signed by the enclave"
                />
              </Panel>
            ) : null}
            {step === "flags" ? (
              <Panel key="flags">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-bad px-2 py-0.5 text-xs font-bold uppercase">
                    High risk
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                    <BadgeCheck size={14} /> TEE signature verified
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {FLAGS.map((f, i) => (
                    <motion.span
                      key={f}
                      initial={{ opacity: 0, scale: 0.8, y: 6 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: i * 0.18, type: "spring", stiffness: 380, damping: 22 }}
                      className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-medium text-amber-200 ring-1 ring-amber-300/30"
                    >
                      {f}
                    </motion.span>
                  ))}
                </div>
              </Panel>
            ) : null}
            {step === "held" ? (
              <Panel key="held">
                <Row
                  icon={<Hourglass size={16} />}
                  tone="amber"
                  title="HELD by the NEAR vault — not sent"
                  sub={
                    <span className="font-mono text-[12px]">
                      25,000 tUSD → fastpay-7f3a91.testnet
                    </span>
                  }
                />
                <p className="mt-3 text-xs text-white/60">
                  New payee + high risk: only the real Ada can release it, from her own account.
                </p>
              </Panel>
            ) : null}
            {step === "ask" ? (
              <Panel key="ask">
                <div className="rounded-2xl bg-white p-4 text-ink shadow-xl">
                  <div className="flex items-center gap-2 text-xs text-subtle">
                    <Smartphone size={14} /> Ada’s phone · Callsign
                  </div>
                  <p className="mt-2 text-[15px] font-semibold leading-snug">
                    Did you ask Tolu to pay 25,000 tUSD to fastpay-7f3a91.testnet?
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setTried(true)}
                      className="rounded-lg border border-line px-2 py-2 text-xs font-semibold text-muted transition hover:bg-wash"
                    >
                      Yes, release
                    </button>
                    <button
                      onClick={() => go("blocked")}
                      className="rounded-lg bg-bad px-2 py-2 text-xs font-semibold text-white transition hover:brightness-110"
                    >
                      No, I didn’t send this
                    </button>
                  </div>
                  {tried ? (
                    <p className="mt-2 text-xs text-bad" role="status">
                      This is the real Ada’s phone — she never asked. Tap “No”.
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-subtle">Tap to answer as Ada →</p>
                  )}
                </div>
              </Panel>
            ) : null}
            {step === "blocked" ? (
              <Panel key="blocked">
                <motion.div
                  initial={{ scale: 1.4, rotate: -8, opacity: 0 }}
                  animate={{ scale: 1, rotate: -4, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                  className="mx-auto w-fit rounded-xl border-4 border-bad-line px-4 py-1 text-2xl font-black tracking-widest text-red-300"
                >
                  BLOCKED
                </motion.div>
                <ul className="mt-4 space-y-1.5 text-sm text-white/80">
                  <li className="flex items-center gap-2">
                    <OctagonX size={15} className="text-red-300" /> Nothing moved. Funds released
                    back to the vault.
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock size={15} className="text-red-300" /> Wallet flagged on-chain — retries
                    are refused.
                  </li>
                </ul>
                <button
                  onClick={replay}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/15"
                >
                  <RotateCcw size={13} /> Replay
                </button>
              </Panel>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}

function Row({
  icon,
  title,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  sub: React.ReactNode;
  tone?: "amber";
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl p-3.5 ring-1 ${tone === "amber" ? "bg-amber-400/10 ring-amber-300/30" : "bg-white/[0.04] ring-white/10"}`}
    >
      <span
        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${tone === "amber" ? "bg-amber-400/20 text-amber-200" : "bg-white/10 text-brand-2"}`}
      >
        {icon}
      </span>
      <div>
        <div className={`text-sm font-semibold ${tone === "amber" ? "text-amber-100" : ""}`}>
          {title}
        </div>
        <div className="mt-0.5 text-xs text-white/60">{sub}</div>
      </div>
    </div>
  );
}

function Hl({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`rounded px-0.5 transition-colors duration-500 ${on ? "bg-amber-400/25 text-amber-100 underline decoration-amber-300/70 decoration-wavy underline-offset-4" : ""}`}
    >
      {children}
    </span>
  );
}
