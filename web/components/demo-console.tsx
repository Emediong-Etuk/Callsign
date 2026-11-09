"use client";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  FileText,
  Info,
  Landmark,
  MessageSquareWarning,
  OctagonX,
  PackagePlus,
  RotateCcw,
  ScanLine,
  ShieldX,
  Smartphone,
  Terminal,
  UserRound,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/analyzer/types";
import type { MemberView, RequestView } from "@/lib/near/types";
import { formatTusd } from "@/lib/near/format";
import { txUrl } from "@/lib/near/config";
import { AnalysisPanel } from "./analysis";
import { ConfirmCard, Countdown } from "./request";
import {
  AccountId,
  Amount,
  Button,
  Card,
  ErrorBox,
  NearNote,
  Spinner,
  StatusChip,
  TxLink,
} from "./ui";

type Health = { demo_mode: boolean; vault: string | null; ai_enabled: boolean; ai_model: string };
type StepResult = {
  ok: boolean;
  txHash: string | null;
  error: string | null;
  code: string | null;
  friendly: string | null;
  request: RequestView | null;
};
type RequestResult = StepResult & { receiverId: string; analysis: AnalysisResult; text: string };
type Attack = {
  setupTx: string | null;
  requestId: string;
  cleanupTx: string | null;
  finalStatus: string | null;
  attempts: { label: string; key: string; blocked: boolean; reason: string; friendly: string }[];
};
type Scenario = "scam" | "routine" | "supplier";
type Role = "tolu" | "ada";
interface Flow {
  req?: RequestResult;
  decide?: StepResult & { flagged?: boolean };
  retry?: StepResult;
}
interface Toast {
  id: number;
  tone: "ok" | "held" | "bad" | "info";
  title: string;
  hash?: string | null;
}

async function post<T>(path: string, body: unknown = {}): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

const CARDS: {
  id: Scenario;
  title: string;
  blurb: string;
  expect: string;
  tone: "bad" | "ok" | "held";
  icon: typeof FileText;
}[] = [
  {
    id: "scam",
    title: "Deepfake CEO wire",
    blurb:
      "A “voice note” from Ada asks Tolu to wire 25,000 to a new wallet before 3pm and keep it quiet.",
    expect: "Held → blocked & reported",
    tone: "bad",
    icon: MessageSquareWarning,
  },
  {
    id: "routine",
    title: "Routine vendor invoice",
    blurb: "Harbor Office Supplies, a known payee, sends its usual 200 tUSD stationery invoice.",
    expect: "Paid instantly",
    tone: "ok",
    icon: FileText,
  },
  {
    id: "supplier",
    title: "Real new supplier",
    blurb:
      "Ada really did onboard Kestrel Logistics and asks Tolu to pay its first 2,000 tUSD invoice.",
    expect: "Held → Ada confirms → paid",
    tone: "held",
    icon: PackagePlus,
  },
];

const TONE_PILL = {
  bad: "bg-bad-bg text-bad",
  ok: "bg-ok-bg text-ok",
  held: "bg-held-bg text-held",
};

export function DemoConsole() {
  const [health, setHealth] = useState<Health | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [ids, setIds] = useState<{ ceo: string; finance: string } | null>(null);
  const [role, setRole] = useState<Role>("tolu");
  const [active, setActive] = useState<Scenario>("scam");
  const [flows, setFlows] = useState<Partial<Record<Scenario, Flow>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attack, setAttack] = useState<Attack | null>(null);
  const [available, setAvailable] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 6500);
  }, []);

  const applyVault = useCallback(
    (v: {
      members?: MemberView[];
      ids?: { ceo: string; finance: string };
      balances?: { available: string };
    }) => {
      if (v.members) setMembers(v.members);
      if (v.ids) setIds(v.ids);
      if (v.balances) setAvailable(v.balances.available);
    },
    [],
  );
  const refreshVault = useCallback(
    () =>
      fetch("/api/vault")
        .then((r) => r.json())
        .then(applyVault),
    [applyVault],
  );

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: Health) => setHealth(h))
      .catch(() => setError("Couldn't reach this server."));
    fetch("/api/vault")
      .then((r) => r.json())
      .then(applyVault)
      .catch(() => undefined);
  }, [applyVault]);

  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      refreshVault().catch(() => undefined);
    }
  };

  const start = (s: Scenario) =>
    run(`req-${s}`, async () => {
      const req = await post<RequestResult>("/api/demo/request", { scenario: s });
      setFlows((f) => ({ ...f, [s]: { req } }));
      const st = req.request?.status;
      if (st === "Executed")
        toast({ tone: "ok", title: "Paid instantly on testnet", hash: req.txHash });
      else if (st === "Pending")
        toast({ tone: "held", title: "Payout held — waiting for Ada", hash: req.txHash });
    });
  const decide = (s: Scenario, action: "confirm" | "reject") =>
    run(`${action}-${s}`, async () => {
      const id = flows[s]?.req?.request?.id;
      if (!id) return;
      const decideRes = await post<StepResult & { flagged?: boolean }>(`/api/demo/${action}`, {
        id,
      });
      setFlows((f) => ({ ...f, [s]: { ...f[s], decide: decideRes } }));
      const st = decideRes.request?.status;
      toast(
        st === "Executed"
          ? { tone: "ok", title: "Ada confirmed — paid", hash: decideRes.txHash }
          : st === "Rejected"
            ? { tone: "bad", title: "Blocked & receiver flagged on-chain", hash: decideRes.txHash }
            : { tone: "info", title: "Decision recorded", hash: decideRes.txHash },
      );
      setActive(s);
      setRole("tolu");
    });
  const retry = () =>
    run("retry", async () => {
      const receiverId = flows.scam?.req?.receiverId;
      const r = await post<StepResult>("/api/demo/request", { scenario: "retry", receiverId });
      setFlows((f) => ({ ...f, scam: { ...f.scam, retry: r } }));
      toast({ tone: "ok", title: "Retry refused by the vault (ERR_RECEIVER_FLAGGED)" });
    });
  const runAttack = () =>
    run("attack", async () => {
      setAttack(null);
      setAttack(await post<Attack>("/api/demo/attack"));
    });

  if (!health) return <Spinner label="Loading demo…" />;
  if (!health.demo_mode) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">The guided demo isn’t enabled on this server</h2>
        <p className="mt-2 text-sm text-muted">
          It needs a testnet deployment and the demo keys (see README → “Run it against testnet
          yourself”). You can still run <code>npm run verify:all</code> with no keys.
        </p>
      </Card>
    );
  }

  const pendingForAda = (Object.entries(flows) as [Scenario, Flow][]).filter(
    ([, f]) => f.req?.request?.status === "Pending" && !f.decide,
  );
  const card = CARDS.find((c) => c.id === active)!;

  return (
    <div className="space-y-8">
      {/* status bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-start gap-2.5 rounded-xl border border-held-line/40 bg-held-bg/60 px-3.5 py-2.5 text-sm text-held">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <strong>Demo mode:</strong> the server signs with testnet demo keys. Tolu’s key is a
            function-call key that can only request payouts.
          </span>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
          {available ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5">
              <Landmark size={14} className="text-brand" aria-hidden="true" /> Vault available{" "}
              <b className="tabular-nums">{formatTusd(available)}</b>
            </span>
          ) : null}
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium ${health.ai_enabled ? "bg-ok-bg text-ok" : "bg-wash text-muted"}`}
          >
            <BadgeCheck size={14} aria-hidden="true" />{" "}
            {health.ai_enabled ? "NEAR AI (TEE) on" : "Rules-only mode"}
          </span>
        </div>
      </div>

      {/* role switcher */}
      <div
        role="tablist"
        aria-label="View as"
        className="inline-flex rounded-2xl border border-line bg-paper p-1.5 shadow-sm"
      >
        {(
          [
            ["tolu", "Tolu", "Finance officer", "from-sky-400 to-indigo-500"],
            ["ada", "Ada", "CEO", "from-fuchsia-400 to-orange-300"],
          ] as const
        ).map(([r, name, title, grad]) => (
          <button
            key={r}
            role="tab"
            aria-selected={role === r}
            onClick={() => setRole(r)}
            className={`relative flex min-h-12 items-center gap-2.5 rounded-xl px-4 text-left text-sm transition ${role === r ? "bg-ink text-white shadow-md" : "text-muted hover:bg-wash"}`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br text-xs font-bold text-white ${grad}`}
            >
              {name[0]}
            </span>
            <span>
              <span className="block font-semibold leading-tight">{name}</span>
              <span className={`block text-xs ${role === r ? "text-white/60" : "text-subtle"}`}>
                {title}
              </span>
            </span>
            {r === "ada" && pendingForAda.length ? (
              <span className="ml-1 grid h-5 min-w-5 animate-pop place-items-center rounded-full bg-held-line px-1.5 text-[11px] font-bold text-ink">
                {pendingForAda.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      <AnimatePresence mode="wait">
        {role === "ada" ? (
          <motion.div
            key="ada"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_400px]"
          >
            <div className="max-w-md">
              <h2 className="text-2xl font-semibold tracking-tight">Ada’s phone</h2>
              <p className="mt-2 text-muted">
                Only Ada can answer, with her own NEAR account. A deepfake of her voice can’t:
                releasing a payment needs a signature from her key.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-muted">
                <li className="flex gap-2">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-ok" />
                  <span>
                    “Yes” calls <code className="text-ink">confirm_payout</code> with 1 yoctoNEAR —
                    a wallet approval.
                  </span>
                </li>
                <li className="flex gap-2">
                  <ShieldX size={16} className="mt-0.5 shrink-0 text-bad" />
                  <span>“No” rejects it and flags the receiver on-chain.</span>
                </li>
                <li className="flex gap-2">
                  <Info size={16} className="mt-0.5 shrink-0 text-subtle" />
                  <span>Demo: the server signs with Ada’s testnet key.</span>
                </li>
              </ul>
            </div>
            <PhoneFrame>
              {pendingForAda.length === 0 ? (
                <div className="grid h-full place-items-center p-6 text-center">
                  <div>
                    <Smartphone className="mx-auto text-subtle" size={30} aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium">No requests waiting</p>
                    <p className="mt-1 text-xs text-subtle">Start a scenario as Tolu first.</p>
                    <button
                      onClick={() => setRole("tolu")}
                      className="mt-4 text-xs font-semibold text-brand"
                    >
                      ← Back to Tolu
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-3">
                  {pendingForAda.map(([s, f]) => (
                    <ConfirmCard
                      key={s}
                      request={f.req!.request!}
                      members={members}
                      viewerId={ids?.ceo ?? null}
                      busy={!!busy}
                      onConfirm={() => decide(s, "confirm")}
                      onReject={() => decide(s, "reject")}
                      confirmNote="Demo: the server signs Ada’s answer with her testnet key. In the wallet app this is a wallet approval."
                      compact
                    />
                  ))}
                </div>
              )}
            </PhoneFrame>
          </motion.div>
        ) : (
          <motion.div
            key="tolu"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="space-y-6"
          >
            {/* scenario picker */}
            <div role="radiogroup" aria-label="Scenario" className="grid gap-3 md:grid-cols-3">
              {CARDS.map((c) => {
                const f = flows[c.id];
                const st = f?.decide?.request?.status ?? f?.req?.request?.status;
                return (
                  <button
                    key={c.id}
                    role="radio"
                    aria-checked={active === c.id}
                    onClick={() => setActive(c.id)}
                    className={`group rounded-2xl border bg-paper p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${
                      active === c.id ? "border-brand ring-4 ring-brand/10" : "border-line"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-xl ${TONE_PILL[c.tone]}`}
                      >
                        <c.icon size={18} aria-hidden="true" />
                      </span>
                      <span className="font-semibold">{c.title}</span>
                      {st ? (
                        <span className="ml-auto">
                          <StatusChip status={st} scam={f?.decide?.request?.reported_as_scam} />
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{c.blurb}</p>
                    <p
                      className={`mt-3 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_PILL[c.tone]}`}
                    >
                      Expected: {c.expect}
                    </p>
                  </button>
                );
              })}
            </div>

            <ScenarioFlow
              card={card}
              flow={flows[active]}
              busy={busy}
              onStart={() => start(active)}
              onGoToAda={() => setRole("ada")}
              onRetry={retry}
              onReset={() => setFlows((f) => ({ ...f, [active]: undefined }))}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* attack */}
      <section
        id="attack"
        className="scroll-mt-24 overflow-hidden rounded-2xl bg-night text-white shadow-2xl shadow-brand/10 ring-1 ring-white/10"
      >
        <div className="flex flex-wrap items-center gap-4 border-b border-white/10 p-5 sm:p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-cyan-300">
            <Terminal size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold">Try to bypass it</h2>
            <p className="text-sm text-white/60">
              Pretend Tolu’s laptop is compromised — or an AI agent holding her key was
              prompt-injected. Try to move the money anyway.
            </p>
          </div>
          <button
            onClick={runAttack}
            disabled={!!busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-4 text-sm font-semibold shadow-lg shadow-red-500/20 transition hover:brightness-110 disabled:opacity-50"
          >
            <ShieldX size={16} />{" "}
            {busy === "attack" ? "Attacking…" : attack ? "Run it again" : "Run the attack"}
          </button>
        </div>
        <div className="p-5 font-mono text-[13px] sm:p-6">
          {busy === "attack" ? (
            <p className="flex items-center gap-2 text-white/70">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" /> sending ~8 testnet
              transactions with Tolu’s keys…
            </p>
          ) : null}
          {!attack && busy !== "attack" ? (
            <p className="text-white/40">$ waiting — press “Run the attack”</p>
          ) : null}
          {attack ? (
            <div className="space-y-3">
              <p className="text-white/60">
                $ bait: held request #{attack.requestId} to a fake receiver{" "}
                {attack.setupTx ? (
                  <a
                    className="text-cyan-300 underline-offset-2 hover:underline"
                    href={txUrl(attack.setupTx)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx ↗
                  </a>
                ) : null}
              </p>
              <ul className="space-y-2.5">
                {attack.attempts.map((a, i) => (
                  <motion.li
                    key={a.label}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.35 }}
                    className={`rounded-xl px-3.5 py-2.5 ring-1 ${a.blocked ? "bg-emerald-400/[0.07] ring-emerald-300/20" : "bg-red-500/10 ring-red-400/40"}`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className={a.blocked ? "text-emerald-300" : "text-red-300"}>
                        {a.blocked ? "✓ blocked" : "✗ NOT blocked"}
                      </span>
                      <span className="text-white/90">{a.label}</span>
                      <span className="text-white/40">({a.key})</span>
                    </div>
                    <div className="mt-1 font-sans text-xs text-white/60">
                      <span className="font-mono text-cyan-300">{a.reason}</span> — {a.friendly}
                    </div>
                  </motion.li>
                ))}
              </ul>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + attack.attempts.length * 0.35 }}
                className="text-white/60"
              >
                $ bait cancelled (status: {attack.finalStatus}) — nothing moved.{" "}
                {attack.cleanupTx ? (
                  <a
                    className="text-cyan-300 underline-offset-2 hover:underline"
                    href={txUrl(attack.cleanupTx)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    tx ↗
                  </a>
                ) : null}
              </motion.p>
            </div>
          ) : null}
        </div>
        <div className="px-5 pb-5 sm:px-6">
          <details className="rounded-xl bg-white/[0.04] px-4 py-3 text-sm ring-1 ring-white/10">
            <summary className="cursor-pointer font-medium text-white/80">
              What NEAR is doing here: function-call keys
            </summary>
            <p className="mt-2 leading-relaxed text-white/60">
              Tolu’s app key is a NEAR function-call access key: the protocol itself only lets it
              call <code>request_payout</code> and <code>cancel_payout</code> on the vault, with no
              deposit attached. It can’t call other contracts, can’t send NEAR, and can’t confirm
              (confirming needs a 1-yocto deposit). These refusals happen before any contract code
              runs.
            </p>
          </details>
        </div>
      </section>

      {/* toasts */}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-paper p-3.5 shadow-xl"
            >
              <span
                className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  t.tone === "ok"
                    ? "bg-ok-line"
                    : t.tone === "held"
                      ? "bg-held-line"
                      : t.tone === "bad"
                        ? "bg-bad-line"
                        : "bg-brand"
                }`}
              />
              <div className="text-sm">
                <div className="font-semibold">{t.title}</div>
                {t.hash ? <TxLink hash={t.hash} label="Open on nearblocks" /> : null}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

const STAGES = ["Message", "Red-flag check", "On-chain request", "Ada decides", "Result"] as const;

function ScenarioFlow({
  card,
  flow,
  busy,
  onStart,
  onGoToAda,
  onRetry,
  onReset,
}: {
  card: (typeof CARDS)[number];
  flow?: Flow;
  busy: string | null;
  onStart: () => void;
  onGoToAda: () => void;
  onRetry: () => void;
  onReset: () => void;
}) {
  const req = flow?.req;
  const decided = flow?.decide;
  const final = decided?.request ?? req?.request;
  const instant = req?.request?.status === "Executed";
  const stage = !req ? 0 : instant ? 4 : !decided ? 3 : 4;
  const working = busy === `req-${card.id}`;
  const tone = !final
    ? "neutral"
    : final.status === "Executed"
      ? "ok"
      : final.status === "Pending"
        ? "held"
        : final.status === "Rejected"
          ? "bad"
          : "neutral";

  return (
    <Card tone={tone} className="!p-0">
      {/* stepper */}
      <ol
        className="flex flex-wrap gap-y-2 border-b border-line px-5 py-4 sm:px-6"
        aria-label="Progress"
      >
        {STAGES.map((s, i) => {
          const done = i < stage || (i === stage && stage === 4);
          const current = i === stage && stage !== 4;
          const skipped = instant && i === 3;
          return (
            <li key={s} className="flex items-center text-xs sm:text-sm">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold transition ${
                  skipped
                    ? "bg-wash text-subtle line-through"
                    : done
                      ? "bg-ink text-white"
                      : current
                        ? "bg-brand text-white ring-4 ring-brand/15"
                        : "bg-wash text-subtle"
                }`}
              >
                {done && !skipped ? "✓" : i + 1}
              </span>
              <span
                className={`ml-2 ${current ? "font-semibold text-ink" : skipped ? "text-subtle line-through" : done ? "text-ink" : "text-subtle"}`}
              >
                {s}
              </span>
              {i < STAGES.length - 1 ? (
                <ChevronRight size={14} className="mx-2 text-line" aria-hidden="true" />
              ) : null}
            </li>
          );
        })}
      </ol>

      <div className="p-5 sm:p-6">
        {!req ? (
          <div className="grid items-center gap-6 md:grid-cols-[1.2fr_1fr]">
            <ChatBubble text={null} blurb={card.blurb} />
            <div>
              <h3 className="text-xl font-semibold tracking-tight">{card.title}</h3>
              <p className="mt-2 text-sm text-muted">
                As Tolu, run the red-flag check and submit the payout to the vault. Expected:{" "}
                <b>{card.expect}</b>.
              </p>
              <div className="mt-5">
                <Button onClick={onStart} disabled={!!busy} size="lg">
                  {working ? (
                    <>
                      <ScanLine size={18} className="animate-pulse" /> Checking & submitting…
                    </>
                  ) : (
                    <>
                      <UserRound size={18} /> Tolu: check it and submit <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </div>
              {working ? (
                <p className="mt-3 text-xs text-subtle">
                  Private AI check in a TEE, then <code>request_payout</code> on NEAR testnet (~5
                  s).
                </p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <ChatBubble text={req.text} />
              <AnalysisPanel result={req.analysis} />
            </div>
            <div className="space-y-4">
              {req.ok && req.request ? (
                <TimelineCard
                  label="On-chain request · Tolu"
                  tone={req.request.status === "Executed" ? "ok" : "held"}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusChip status={req.request.status} />{" "}
                    <TxLink hash={req.txHash} label="request tx" />
                  </div>
                  <div className="mt-2 text-sm">
                    <Amount base={req.request.amount} /> →{" "}
                    <AccountId id={req.request.receiver_id} />
                  </div>
                  {req.request.status === "Executed" ? (
                    <p className="mt-2 text-sm font-semibold text-ok">
                      Paid instantly — known payee, under the 500 tUSD limit, not high risk.
                    </p>
                  ) : decided ? (
                    <p className="mt-2 text-sm text-held">Held for Ada’s decision.</p>
                  ) : (
                    <p className="mt-2 text-sm text-held">
                      <strong>Held until Ada confirms.</strong>{" "}
                      <Countdown expiresNs={req.request.expires_at_ns} />
                    </p>
                  )}
                </TimelineCard>
              ) : (
                <ErrorBox>{req.friendly ?? req.error}</ErrorBox>
              )}

              {req.request?.status === "Pending" && !decided ? (
                <button
                  onClick={onGoToAda}
                  className="group flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-held-line/60 bg-held-bg/40 p-4 text-left transition hover:bg-held-bg/70"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-fuchsia-400 to-orange-300 font-bold text-white">
                    A
                  </span>
                  <span className="flex-1">
                    <span className="block font-semibold">Ada’s phone just buzzed</span>
                    <span className="block text-sm text-muted">
                      Switch to Ada to answer “Did you ask for this?”
                    </span>
                  </span>
                  <ArrowRight
                    size={18}
                    className="text-held transition group-hover:translate-x-1"
                  />
                </button>
              ) : null}

              {decided ? (
                <TimelineCard
                  label="Decision · Ada"
                  tone={
                    decided.request?.status === "Executed"
                      ? "ok"
                      : decided.request?.status === "Rejected"
                        ? "bad"
                        : "neutral"
                  }
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {decided.request ? (
                      <StatusChip
                        status={decided.request.status}
                        scam={decided.request.reported_as_scam}
                      />
                    ) : null}
                    <TxLink hash={decided.txHash} label="decision tx" />
                  </div>
                  {decided.request?.status === "Rejected" ? (
                    <p className="mt-2 text-sm font-semibold text-bad">
                      “I didn’t send this.” Nothing moved, and the receiver is now flagged on-chain.
                    </p>
                  ) : decided.request?.status === "Executed" ? (
                    <p className="mt-2 text-sm font-semibold text-ok">
                      Ada confirmed from her own account — paid.
                    </p>
                  ) : decided.request?.status === "Expired" ? (
                    <p className="mt-2 text-sm">
                      Too late — the hold window passed, so nothing was sent.
                    </p>
                  ) : (
                    <ErrorBox>{decided.friendly ?? decided.error}</ErrorBox>
                  )}
                </TimelineCard>
              ) : null}

              {card.id === "scam" && decided?.request?.status === "Rejected" ? (
                flow?.retry ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                  >
                    <TimelineCard label="Scammer retries" tone="ok">
                      <p className="flex items-center gap-2 text-sm font-semibold text-ok">
                        <OctagonX size={16} /> Refused by the vault
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        <code className="text-ink">{flow.retry.code}</code> — {flow.retry.friendly}
                      </p>
                    </TimelineCard>
                  </motion.div>
                ) : (
                  <Button tone="ghost" onClick={onRetry} disabled={!!busy}>
                    {busy === "retry" ? "Retrying…" : "Scammer tries again → same wallet"}
                  </Button>
                )
              ) : null}

              {final && final.status !== "Pending" ? (
                <button
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
                  onClick={onReset}
                >
                  <RotateCcw size={14} /> Run this scenario again
                </button>
              ) : null}
            </div>
          </div>
        )}
        {card.id === "scam" && !req ? null : (
          <NearNote title="every step is a real transaction">
            Each status above comes from the vault contract on NEAR testnet, and every link opens
            the transaction on nearblocks. Nothing here is simulated in the browser.
          </NearNote>
        )}
      </div>
    </Card>
  );
}

function ChatBubble({ text, blurb }: { text: string | null; blurb?: string }) {
  return (
    <div className="rounded-2xl bg-wash p-4 ring-1 ring-line">
      <div className="flex items-center gap-2 text-xs text-subtle">
        <MessageSquareWarning size={14} aria-hidden="true" /> Message Tolu received
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink/90">
        {text ?? blurb}
      </p>
    </div>
  );
}

function TimelineCard({
  label,
  tone,
  children,
}: {
  label: string;
  tone: "ok" | "held" | "bad" | "neutral";
  children: React.ReactNode;
}) {
  const bar = { ok: "bg-ok-line", held: "bg-held-line", bad: "bg-bad-line", neutral: "bg-line" }[
    tone
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-line bg-paper p-4 pl-5"
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} aria-hidden="true" />
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
        {label}
      </div>
      {children}
    </motion.div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label="Ada’s phone"
      className="mx-auto w-[min(100%,380px)] rounded-[2.75rem] bg-night p-3 shadow-2xl shadow-brand/20 ring-1 ring-white/10"
    >
      <div className="relative overflow-hidden rounded-[2.1rem] bg-wash">
        <div className="flex items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold text-ink/70">
          <span>9:41</span>
          <span className="h-5 w-24 rounded-full bg-night" aria-hidden="true" />
          <span>NEAR</span>
        </div>
        <div className="max-h-[640px] min-h-[520px] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
