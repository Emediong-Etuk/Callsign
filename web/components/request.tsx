"use client";
import { useEffect, useState } from "react";
import { Check, Fingerprint, ShieldAlert, X } from "lucide-react";
import type { MemberView, RequestView } from "@/lib/near/types";
import { FLAG_LABELS, isFlagType } from "@/lib/flags";
import { formatTusd } from "@/lib/near/format";
import { AccountId, NearNote, RiskBadge, StatusChip, TxLink } from "./ui";

export function memberName(members: MemberView[], id: string): string | null {
  return members.find((m) => m.account_id === id)?.display_name ?? null;
}

export function Countdown({ expiresNs }: { expiresNs: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!expiresNs) return null;
  const left = Math.max(0, Math.floor((Number(BigInt(expiresNs) / 1_000_000n) - now) / 1000));
  if (left === 0)
    return <span className="font-semibold text-muted">Expired — nothing was sent</span>;
  return (
    <span className="tabular-nums font-semibold text-held" aria-live="polite">
      Expires in {Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}
    </span>
  );
}

/** Requested → held → decided → executed, with explorer links where we have them. */
export function Timeline({
  request,
  txs = {},
}: {
  request: RequestView;
  txs?: Record<string, string | null | undefined>;
}) {
  const s = request.effective_status;
  const steps: {
    label: string;
    done: boolean;
    tone: "ok" | "held" | "bad" | "neutral";
    tx?: string | null;
  }[] = [{ label: "Requested", done: true, tone: "neutral", tx: txs.request }];
  if (request.route === "NeedsConfirmation") {
    steps.push({ label: "Held for confirmation", done: true, tone: "held" });
    if (s === "Rejected")
      steps.push({
        label: request.reported_as_scam ? "Rejected & reported as scam" : "Rejected",
        done: true,
        tone: "bad",
        tx: txs.decide,
      });
    else if (s === "Expired")
      steps.push({ label: "Expired (nobody confirmed)", done: true, tone: "neutral" });
    else if (s === "Cancelled")
      steps.push({ label: "Cancelled by requester", done: true, tone: "neutral", tx: txs.decide });
    else
      steps.push({
        label: "Confirmed by principal",
        done: ["Executing", "Executed", "Failed"].includes(s),
        tone: "ok",
        tx: txs.decide,
      });
  }
  if (!["Rejected", "Expired", "Cancelled"].includes(s)) {
    steps.push({
      label: s === "Failed" ? "Transfer failed — funds kept" : "Paid",
      done: s === "Executed" || s === "Failed",
      tone: s === "Failed" ? "bad" : "ok",
    });
  }
  const dot = { ok: "bg-ok-line", held: "bg-held-line", bad: "bg-bad-line", neutral: "bg-subtle" };
  return (
    <ol className="relative space-y-4 pl-1" aria-label="Request timeline">
      <span className="absolute bottom-2 left-[9px] top-2 w-px bg-line" aria-hidden="true" />
      {steps.map((st) => (
        <li key={st.label} className="relative flex items-center gap-3 text-sm">
          <span
            aria-hidden="true"
            className={`relative z-10 h-[18px] w-[18px] rounded-full border-4 border-paper ${st.done ? dot[st.tone] : "bg-line"}`}
          />
          <span className={st.done ? "font-medium" : "text-subtle"}>{st.label}</span>
          {st.tx ? <TxLink hash={st.tx} label="tx" /> : null}
        </li>
      ))}
    </ol>
  );
}

/**
 * The principal's question, phone-first: "Did you ask Tolu to pay X to Y?"
 * Account ids are shown in full so a look-alike can't hide.
 */
export function ConfirmCard({
  request,
  members,
  viewerId,
  busy,
  onConfirm,
  onReject,
  confirmNote,
  compact = false,
}: {
  request: RequestView;
  members: MemberView[];
  viewerId: string | null;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  confirmNote?: string;
  compact?: boolean;
}) {
  const requester = memberName(members, request.requester) ?? request.requester;
  const principal = memberName(members, request.claimed_principal) ?? request.claimed_principal;
  const pending = request.effective_status === "Pending";
  const isPrincipal = viewerId === request.claimed_principal;
  const flags = (request.evidence?.flags ?? []).filter(isFlagType);
  const high = request.evidence?.risk === "High";
  const ring =
    request.effective_status === "Executed"
      ? "ring-ok-line/50"
      : request.effective_status === "Rejected"
        ? "ring-bad-line/50"
        : pending
          ? "ring-held-line/50"
          : "ring-line";

  return (
    <section
      className={`mx-auto overflow-hidden rounded-3xl bg-paper shadow-xl shadow-ink/5 ring-1 ${ring} ${compact ? "w-full" : "max-w-md"}`}
    >
      {high && pending ? (
        <div className="flex items-center gap-2 bg-bad px-4 py-2 text-xs font-semibold text-white">
          <ShieldAlert size={14} aria-hidden="true" /> High-risk request — check carefully
        </div>
      ) : null}
      <div className={compact ? "p-4" : "p-6"}>
        <div className="flex items-center justify-between gap-2">
          <StatusChip status={request.effective_status} scam={request.reported_as_scam} />
          {pending ? <Countdown expiresNs={request.expires_at_ns} /> : null}
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
          {requester} is asking on your behalf
        </p>
        <h2
          className={`mt-1 font-semibold leading-snug tracking-tight ${compact ? "text-lg" : "text-2xl"}`}
        >
          Did you ask {requester.split(" ")[0]} to pay{" "}
          <span className="whitespace-nowrap">{formatTusd(request.amount)}</span> to{" "}
          <span className="mt-1.5 inline-block max-w-full rounded-lg bg-held-bg px-2 py-0.5 font-mono text-[0.8em] [overflow-wrap:anywhere] text-ink">
            {request.receiver_id}
          </span>
          ?
        </h2>

        <dl className="mt-5 grid gap-3 rounded-2xl bg-wash p-4 text-sm">
          <Row label="Receiver (full account)">
            <AccountId id={request.receiver_id} />
          </Row>
          <Row label="Requested by">
            <AccountId id={request.requester} name={memberName(members, request.requester)} />
          </Row>
          <Row label="Claims to come from">
            <AccountId id={request.claimed_principal} name={principal} />
          </Row>
          {request.memo ? <Row label="Memo (public)">{request.memo}</Row> : null}
          <Row label="Red-flag check">
            <span className="flex flex-wrap items-center gap-1.5">
              <RiskBadge risk={request.evidence?.risk ?? "Unknown"} />
              {flags.map((f) => (
                <span
                  key={f}
                  className="rounded-md bg-paper px-1.5 py-0.5 text-xs ring-1 ring-line"
                >
                  {FLAG_LABELS[f]}
                </span>
              ))}
              {request.evidence?.signature_verified ? (
                <span className="text-xs font-medium text-ok">✓ TEE-verified AI</span>
              ) : null}
            </span>
          </Row>
        </dl>

        {pending ? (
          <div className="mt-5 grid gap-2.5">
            {!isPrincipal ? (
              <p className="rounded-xl bg-wash px-3 py-2 text-sm text-muted">
                Only {principal} (<span className="mono">{request.claimed_principal}</span>) can
                answer this.{" "}
                {viewerId ? `You're signed in as ${viewerId}.` : "Sign in with that account."}
              </p>
            ) : null}
            <button
              onClick={onReject}
              disabled={busy || !isPrincipal}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-bad px-4 font-semibold text-white shadow-lg shadow-bad/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
            >
              <X size={18} aria-hidden="true" /> No, I didn’t send this — block and report
            </button>
            <button
              onClick={onConfirm}
              disabled={busy || !isPrincipal}
              className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border-2 border-ok-line/60 bg-ok-bg px-4 font-semibold text-ok transition hover:bg-ok-bg/70 active:scale-[0.98] disabled:opacity-50"
            >
              <Check size={18} aria-hidden="true" /> Yes, I asked for this — release
            </button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-subtle">
              <Fingerprint size={13} aria-hidden="true" /> Releasing needs a signature from your own
              NEAR account
            </p>
            {confirmNote ? <p className="text-center text-xs text-subtle">{confirmNote}</p> : null}
          </div>
        ) : null}
        {!compact ? (
          <NearNote title="a wallet-signed confirmation">
            Releasing calls <code>confirm_payout</code> with exactly 1 yoctoNEAR attached. NEAR’s
            limited function-call keys can’t attach deposits, so only a full-access key — the
            principal’s own wallet — can sign it. A deepfake can copy a voice; it can’t produce that
            signature.
          </NearNote>
        ) : null}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}
