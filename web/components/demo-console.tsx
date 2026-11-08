"use client";
import { useCallback, useEffect, useState } from "react";
import type { AnalysisResult } from "@/lib/analyzer/types";
import type { MemberView, RequestView } from "@/lib/near/types";
import { formatTusd } from "@/lib/near/format";
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

const CARDS: { id: Scenario; title: string; blurb: string }[] = [
  {
    id: "scam",
    title: "Deepfake CEO wire",
    blurb:
      "A “voice note” from Ada asks Tolu to wire 25,000 to a new wallet before 3pm and keep it quiet.",
  },
  {
    id: "routine",
    title: "Routine vendor invoice",
    blurb: "Harbor Office Supplies (a known payee) sends its usual 200 tUSD stationery invoice.",
  },
  {
    id: "supplier",
    title: "Real new supplier",
    blurb:
      "Ada genuinely onboarded Kestrel Logistics and asks Tolu to pay its first 2,000 tUSD invoice.",
  },
];

export function DemoConsole() {
  const [health, setHealth] = useState<Health | null>(null);
  const [members, setMembers] = useState<MemberView[]>([]);
  const [ids, setIds] = useState<{ ceo: string; finance: string } | null>(null);
  const [role, setRole] = useState<Role>("tolu");
  const [flows, setFlows] = useState<Partial<Record<Scenario, Flow>>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attack, setAttack] = useState<Attack | null>(null);
  const [available, setAvailable] = useState<string | null>(null);

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
    });
  const decide = (s: Scenario, action: "confirm" | "reject") =>
    run(`${action}-${s}`, async () => {
      const id = flows[s]?.req?.request?.id;
      if (!id) return;
      const decideRes = await post<StepResult & { flagged?: boolean }>(`/api/demo/${action}`, {
        id,
      });
      setFlows((f) => ({ ...f, [s]: { ...f[s], decide: decideRes } }));
      setRole("tolu");
    });
  const retry = () =>
    run("retry", async () => {
      const receiverId = flows.scam?.req?.receiverId;
      const r = await post<StepResult>("/api/demo/request", { scenario: "retry", receiverId });
      setFlows((f) => ({ ...f, scam: { ...f.scam, retry: r } }));
    });
  const runAttack = () =>
    run("attack", async () => {
      setAttack(await post<Attack>("/api/demo/attack"));
    });

  if (!health) return <Spinner label="Loading demo…" />;
  if (!health.demo_mode) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">The guided demo isn’t enabled on this server</h2>
        <p className="mt-2 text-sm text-muted">
          It needs a testnet deployment and the demo keys (see README → “Run it against testnet
          yourself”). You can still run <code>npm run verify:all</code> with no keys, or use the
          hosted demo linked in the README.
        </p>
      </Card>
    );
  }

  const pendingForAda = (Object.entries(flows) as [Scenario, Flow][]).filter(
    ([, f]) => f.req?.request?.status === "Pending" && !f.decide,
  );

  return (
    <div className="space-y-6">
      <div
        role="note"
        className="rounded-lg border border-held-line bg-held-bg px-4 py-3 text-sm text-held"
      >
        <strong>Demo mode:</strong> the server signs with testnet demo keys. Tolu’s key is a
        function-call key that can only request payouts. Every step below is a real NEAR testnet
        transaction — follow the links.
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="View as"
          className="inline-flex rounded-lg border border-line bg-paper p-1"
        >
          {(
            [
              ["tolu", "Tolu, Finance"],
              ["ada", `Ada, CEO${pendingForAda.length ? ` (${pendingForAda.length})` : ""}`],
            ] as const
          ).map(([r, label]) => (
            <button
              key={r}
              role="tab"
              aria-selected={role === r}
              onClick={() => setRole(r)}
              className={`min-h-11 rounded-md px-4 text-sm font-semibold ${role === r ? "bg-brand text-white" : "text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        {available ? (
          <span className="text-sm text-muted">Vault available: {formatTusd(available)}</span>
        ) : null}
      </div>

      {error ? <ErrorBox>{error}</ErrorBox> : null}

      {role === "ada" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            This is what Ada sees on her phone. Only she can answer — with her own NEAR account.
          </p>
          {pendingForAda.length === 0 ? (
            <Card>
              <p className="text-sm text-muted">
                Nothing is waiting for Ada. Start a scenario as Tolu first.
              </p>
            </Card>
          ) : (
            pendingForAda.map(([s, f]) => (
              <ConfirmCard
                key={s}
                request={f.req!.request!}
                members={members}
                viewerId={ids?.ceo ?? null}
                busy={!!busy}
                onConfirm={() => decide(s, "confirm")}
                onReject={() => decide(s, "reject")}
                confirmNote="Demo: the server signs Ada’s answer with her testnet key. In the wallet app this is a wallet approval."
              />
            ))
          )}
        </div>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-3">
          {CARDS.map((c) => (
            <ScenarioCard
              key={c.id}
              card={c}
              flow={flows[c.id]}
              busy={busy}
              onStart={() => start(c.id)}
              onGoToAda={() => setRole("ada")}
              onRetry={retry}
              onReset={() => setFlows((f) => ({ ...f, [c.id]: undefined }))}
            />
          ))}
        </div>
      )}

      <Card tone={attack ? (attack.attempts.every((a) => a.blocked) ? "ok" : "bad") : "neutral"}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Try to bypass it</h2>
            <p className="text-sm text-muted">
              Pretend Tolu’s laptop is compromised (or an AI agent holding her key was
              prompt-injected). Try to move the money anyway.
            </p>
          </div>
          <Button onClick={runAttack} disabled={!!busy}>
            {busy === "attack" ? "Attacking…" : "Run the attack"}
          </Button>
        </div>
        {busy === "attack" ? (
          <div className="mt-3">
            <Spinner label="Sending 8 testnet transactions…" />
          </div>
        ) : null}
        {attack ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm">
              Bait: held request #{attack.requestId} to a fake receiver{" "}
              <TxLink hash={attack.setupTx} label="setup tx" />
            </p>
            <ul className="space-y-2">
              {attack.attempts.map((a) => (
                <li
                  key={a.label}
                  className={`rounded-lg border px-3 py-2 text-sm ${a.blocked ? "border-ok-line bg-ok-bg" : "border-bad-line bg-bad-bg"}`}
                >
                  <div className="font-semibold">
                    {a.blocked ? "✅ Blocked" : "❌ NOT blocked"} — {a.label}{" "}
                    <span className="font-normal text-muted">({a.key})</span>
                  </div>
                  <div className="mt-0.5">
                    <code className="text-xs">{a.reason}</code> · {a.friendly}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted">
              Bait cancelled afterwards (status: {attack.finalStatus}){" "}
              <TxLink hash={attack.cleanupTx} label="cleanup tx" />
            </p>
          </div>
        ) : null}
        <NearNote title="function-call keys">
          Tolu’s app key is a NEAR <em>function-call access key</em>: the protocol itself only lets
          it call <code>request_payout</code> and <code>cancel_payout</code> on the vault, with no
          deposit attached. It can’t call other contracts, can’t send NEAR, and can’t confirm
          (confirming needs a 1-yocto deposit). These refusals happen before any contract code runs.
        </NearNote>
      </Card>
    </div>
  );
}

function ScenarioCard({
  card,
  flow,
  busy,
  onStart,
  onGoToAda,
  onRetry,
  onReset,
}: {
  card: { id: Scenario; title: string; blurb: string };
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
    <Card tone={tone} className={req ? "md:col-span-3 md:order-first" : ""}>
      <h2 className="text-lg font-semibold">{card.title}</h2>
      <p className="mt-1 text-sm text-muted">{card.blurb}</p>
      {!req ? (
        <div className="mt-4">
          <Button onClick={onStart} disabled={!!busy}>
            {busy === `req-${card.id}` ? "Checking & submitting…" : "Tolu: check it and submit"}
          </Button>
          {busy === `req-${card.id}` ? (
            <div className="mt-2">
              <Spinner label="Red-flag check, then request_payout on testnet…" />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">The message Tolu received</summary>
              <p className="mt-2 whitespace-pre-wrap rounded bg-wash p-2 text-muted">{req.text}</p>
            </details>
            <AnalysisPanel result={req.analysis} />
          </div>
          <div className="space-y-4">
            {req.ok && req.request ? (
              <div className="space-y-2 rounded-lg border border-line p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Step 1 · Tolu submits
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusChip status={req.request.status} />{" "}
                  <TxLink hash={req.txHash} label="request tx" />
                </div>
                <div>
                  <Amount base={req.request.amount} /> → <AccountId id={req.request.receiver_id} />
                </div>
                {req.request.status === "Executed" ? (
                  <p className="font-semibold text-ok">
                    Paid instantly (known payee, under the 500 tUSD limit, not high risk).
                  </p>
                ) : req.request.status === "Pending" && decided ? (
                  <p className="text-held">Held for Ada’s decision.</p>
                ) : req.request.status === "Pending" ? (
                  <p className="text-held">
                    <strong>Held until Ada confirms.</strong>{" "}
                    <Countdown expiresNs={req.request.expires_at_ns} />
                  </p>
                ) : null}
              </div>
            ) : (
              <ErrorBox>{req.friendly ?? req.error}</ErrorBox>
            )}
            {req.request?.status === "Pending" && !decided ? (
              <Button onClick={onGoToAda}>Switch to Ada’s phone →</Button>
            ) : null}
            {decided ? (
              <div className="space-y-2 rounded-lg border border-line p-3 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Step 2 · Ada answers
                </div>
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
                  <p className="font-semibold text-bad">
                    Ada: “I didn’t send this.” Nothing moved, and the receiver is now flagged
                    on-chain.
                  </p>
                ) : decided.request?.status === "Executed" ? (
                  <p className="font-semibold text-ok">
                    Ada confirmed from her own account — paid.
                  </p>
                ) : decided.request?.status === "Expired" ? (
                  <p>Too late — the hold window passed, so nothing was sent.</p>
                ) : (
                  <ErrorBox>{decided.friendly ?? decided.error}</ErrorBox>
                )}
              </div>
            ) : null}
            {card.id === "scam" && decided?.request?.status === "Rejected" ? (
              flow?.retry ? (
                <div className="rounded-lg border border-ok-line bg-ok-bg p-3 text-sm">
                  <strong>Retry refused ✅</strong>{" "}
                  <code className="text-xs">{flow.retry.code}</code> — {flow.retry.friendly}
                </div>
              ) : (
                <Button tone="ghost" onClick={onRetry} disabled={!!busy}>
                  {busy === "retry" ? "Retrying…" : "Scammer tries again → same wallet"}
                </Button>
              )
            ) : null}
            {final && final.status !== "Pending" ? (
              <button className="text-xs text-muted underline" onClick={onReset}>
                Run this scenario again
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
