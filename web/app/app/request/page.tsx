"use client";
import Link from "next/link";
import { useState } from "react";
import { AnalysisPanel } from "@/components/analysis";
import { Countdown } from "@/components/request";
import { useVault } from "@/components/use-vault";
import { WalletButton, useWallet } from "@/components/wallet";
import {
  Amount,
  Button,
  Card,
  ErrorBox,
  NearNote,
  Spinner,
  StatusChip,
  TxLink,
} from "@/components/ui";
import type { AnalysisResult } from "@/lib/analyzer/types";
import { friendlyError } from "@/lib/errors";
import { formatTusd, toBaseUnits } from "@/lib/near/format";
import type { RequestView } from "@/lib/near/types";

export default function NewRequest() {
  const { state, loading } = useVault();
  const { accountId, callVault } = useWallet();
  const [principal, setPrincipal] = useState("");
  const [receiver, setReceiver] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [busy, setBusy] = useState<"check" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ request: RequestView; hash: string | null } | null>(null);

  if (loading) return <Spinner label="Loading vault…" />;
  if (!state?.configured || state.error)
    return <ErrorBox>{state?.error ?? "No vault configured on this server."}</ErrorBox>;
  const principals = (state.members ?? []).filter(
    (m) => m.active && m.roles.includes("Principal") && m.account_id !== accountId,
  );
  let base: string | null = null;
  try {
    base = amount ? toBaseUnits(amount) : null;
  } catch {
    base = null;
  }

  const check = async () => {
    setBusy("check");
    setError(null);
    setAnalysis(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          claimedPrincipal: principal,
          receiverId: receiver.trim(),
          amount: base,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnalysis(json as AnalysisResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!analysis || !base) return;
    setBusy("submit");
    setError(null);
    try {
      const { hash, value } = await callVault("request_payout", {
        claimed_principal: principal,
        receiver_id: receiver.trim(),
        amount: base,
        memo,
        evidence: analysis.onChainEvidence,
      });
      const r = await (await fetch(`/api/vault/request/${String(value)}`)).json();
      setDone({ request: r.request as RequestView, hash });
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  if (done) {
    const p = state.members?.find((m) => m.account_id === done.request.claimed_principal);
    return (
      <Card tone={done.request.status === "Executed" ? "ok" : "held"} className="max-w-xl">
        <StatusChip status={done.request.status} />
        <h1 className="mt-3 text-2xl font-semibold">
          {done.request.status === "Executed"
            ? "Paid instantly (known payee, under limit)"
            : `Held until ${p?.display_name ?? "the principal"} confirms`}
        </h1>
        <p className="mt-2">
          <Amount base={done.request.amount} /> →{" "}
          <span className="mono">{done.request.receiver_id}</span>
        </p>
        {done.request.status === "Pending" ? (
          <p className="mt-1">
            <Countdown expiresNs={done.request.expires_at_ns} />
          </p>
        ) : null}
        <p className="mt-3 text-sm">
          Send {p?.display_name ?? "them"} this link:{" "}
          <Link className="text-brand underline" href={`/confirm/${done.request.id}`}>
            /confirm/{done.request.id}
          </Link>
        </p>
        <div className="mt-2">
          <TxLink hash={done.hash} />
        </div>
      </Card>
    );
  }

  const ready = principal && receiver.trim().length > 1 && base && BigInt(base) > 0n && text.trim();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">New payment request</h1>
        <WalletButton />
      </div>
      {!accountId ? (
        <p className="text-sm text-muted">
          Connect the requester’s testnet wallet to submit. You can still run the red-flag check.
        </p>
      ) : null}
      <Card>
        <fieldset className="space-y-2">
          <legend className="font-semibold">1. Who is asking for this payment?</legend>
          {principals.map((m) => (
            <label
              key={m.account_id}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-line px-3 py-2 has-[:checked]:border-brand"
            >
              <input
                type="radio"
                name="principal"
                value={m.account_id}
                checked={principal === m.account_id}
                onChange={() => setPrincipal(m.account_id)}
              />
              <span>
                <span className="font-medium">{m.display_name}</span>, {m.title}{" "}
                <span className="mono block text-xs text-muted">{m.account_id}</span>
              </span>
            </label>
          ))}
        </fieldset>
      </Card>
      <Card>
        <h2 className="font-semibold">2. Payment</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Receiver account
            <input
              className="mono mt-1 w-full rounded-lg border border-line px-3 py-2"
              value={receiver}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder="name.testnet"
              autoComplete="off"
            />
          </label>
          <label className="text-sm">
            Amount (tUSD)
            <input
              className="mt-1 w-full rounded-lg border border-line px-3 py-2"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="decimal"
              placeholder="250"
            />
            {base ? (
              <span className="text-xs text-muted">{formatTusd(base)} (test dollars)</span>
            ) : amount ? (
              <span className="text-xs text-bad">Enter a number like 250 or 250.50</span>
            ) : null}
          </label>
        </div>
        <label className="mt-3 block text-sm">
          Memo{" "}
          <span className="text-muted">
            (public on-chain — don’t put private details here; max 280)
          </span>
          <input
            className="mt-1 w-full rounded-lg border border-line px-3 py-2"
            value={memo}
            maxLength={280}
            onChange={(e) => setMemo(e.target.value)}
          />
        </label>
      </Card>
      <Card>
        <h2 className="font-semibold">3. The message you received</h2>
        <p className="text-sm text-muted">
          Paste the email, chat or voice-note transcript. It is checked privately and never stored
          or put on-chain. (Voice-note upload isn’t supported — paste the text.)
        </p>
        <textarea
          className="mt-2 h-40 w-full rounded-lg border border-line px-3 py-2 text-sm"
          maxLength={6000}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mt-2 text-xs text-muted">{text.length}/6000</div>
      </Card>
      <Card>
        <h2 className="font-semibold">4. Check for red flags</h2>
        <div className="mt-2">
          <Button onClick={check} disabled={!ready || !!busy}>
            {busy === "check" ? "Checking…" : "Check for red flags"}
          </Button>
        </div>
        {analysis ? (
          <div className="mt-4">
            <AnalysisPanel result={analysis} />
          </div>
        ) : null}
      </Card>
      <Card>
        <h2 className="font-semibold">5. Submit</h2>
        <p className="text-sm text-muted">
          Routine payments (known payee, ≤ {formatTusd(state.config?.policy.instant_limit ?? "0")},
          not high risk) go straight through. Anything else is held until the person you named
          confirms.
        </p>
        <div className="mt-2">
          <Button onClick={submit} disabled={!analysis || !accountId || !!busy}>
            {busy === "submit" ? "Submitting…" : "Submit request"}
          </Button>
        </div>
        <NearNote title="your limited key">
          Signing in created a function-call key that can only call <code>request_payout</code>,{" "}
          <code>cancel_payout</code> and <code>reject_payout</code> on the vault, so this submit
          doesn’t need a wallet pop-up — and the key can’t move money by itself.
        </NearNote>
      </Card>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
    </div>
  );
}
