"use client";
import { useEffect, useState } from "react";
import type { MemberView, RequestView } from "@/lib/near/types";
import { FLAG_LABELS, isFlagType } from "@/lib/flags";
import { AccountId, Amount, Button, Card, NearNote, RiskBadge, StatusChip, TxLink } from "./ui";

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
  const dot = { ok: "bg-ok", held: "bg-held-line", bad: "bg-bad", neutral: "bg-muted" };
  return (
    <ol className="space-y-2" aria-label="Request timeline">
      {steps.map((st) => (
        <li key={st.label} className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className={`h-3 w-3 rounded-full ${st.done ? dot[st.tone] : "border-2 border-line bg-paper"}`}
          />
          <span className={st.done ? "" : "text-muted"}>{st.label}</span>
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
}: {
  request: RequestView;
  members: MemberView[];
  viewerId: string | null;
  busy: boolean;
  onConfirm: () => void;
  onReject: () => void;
  confirmNote?: string;
}) {
  const requester = memberName(members, request.requester) ?? request.requester;
  const principal = memberName(members, request.claimed_principal) ?? request.claimed_principal;
  const pending = request.effective_status === "Pending";
  const isPrincipal = viewerId === request.claimed_principal;
  const flags = (request.evidence?.flags ?? []).filter(isFlagType);
  return (
    <Card
      tone={
        pending
          ? "held"
          : request.effective_status === "Executed"
            ? "ok"
            : request.effective_status === "Rejected"
              ? "bad"
              : "neutral"
      }
      className="mx-auto max-w-md"
    >
      <div className="flex items-center justify-between gap-2">
        <StatusChip status={request.effective_status} scam={request.reported_as_scam} />
        {pending ? <Countdown expiresNs={request.expires_at_ns} /> : null}
      </div>
      <h2 className="mt-4 text-xl font-semibold leading-snug">
        Did you ask {requester} to pay <Amount base={request.amount} /> to{" "}
        <span className="mono text-lg">{request.receiver_id}</span>?
      </h2>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-muted">Receiver (full account)</dt>
          <dd>
            <AccountId id={request.receiver_id} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Requested by</dt>
          <dd>
            <AccountId id={request.requester} name={memberName(members, request.requester)} />
          </dd>
        </div>
        <div>
          <dt className="text-muted">Claims to come from</dt>
          <dd>
            <AccountId id={request.claimed_principal} name={principal} />
          </dd>
        </div>
        {request.memo ? (
          <div>
            <dt className="text-muted">Memo (public)</dt>
            <dd>{request.memo}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted">Red-flag check</dt>
          <dd className="flex flex-wrap items-center gap-1.5">
            <RiskBadge risk={request.evidence?.risk ?? "Unknown"} />
            {flags.map((f) => (
              <span key={f} className="rounded bg-wash px-1.5 py-0.5 text-xs">
                {FLAG_LABELS[f]}
              </span>
            ))}
            {request.evidence?.signature_verified ? (
              <span className="text-xs text-ok">TEE-verified AI</span>
            ) : null}
          </dd>
        </div>
      </dl>
      {pending ? (
        <div className="mt-5 grid gap-2">
          {!isPrincipal ? (
            <p className="rounded-lg bg-wash px-3 py-2 text-sm text-muted">
              Only {principal} (<span className="mono">{request.claimed_principal}</span>) can
              answer this.{" "}
              {viewerId ? `You're signed in as ${viewerId}.` : "Sign in with that account."}
            </p>
          ) : null}
          <Button tone="ok" onClick={onConfirm} disabled={busy || !isPrincipal}>
            Yes, I asked for this — release
          </Button>
          <Button tone="bad" onClick={onReject} disabled={busy || !isPrincipal}>
            No, I didn’t send this — block and report
          </Button>
          {confirmNote ? <p className="text-xs text-muted">{confirmNote}</p> : null}
        </div>
      ) : null}
      <NearNote title="a wallet-signed confirmation">
        Releasing calls <code>confirm_payout</code> with exactly 1 yoctoNEAR attached. NEAR’s
        limited function-call keys can’t attach deposits, so only a full-access key — the
        principal’s own wallet — can sign it. A deepfake can copy a voice; it can’t produce that
        signature.
      </NearNote>
    </Card>
  );
}
