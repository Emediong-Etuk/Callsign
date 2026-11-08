"use client";
import Link from "next/link";
import { use } from "react";
import { Timeline, memberName } from "@/components/request";
import { useRequest } from "@/components/request-loader";
import { AccountId, Amount, Card, ErrorBox, RiskBadge, Spinner, StatusChip } from "@/components/ui";
import { FLAG_LABELS, isFlagType } from "@/lib/flags";
import { formatTime } from "@/lib/near/format";

export default function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error } = useRequest(id);
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!data) return <Spinner label="Loading request…" />;
  const r = data.request;
  const n = (a: string) => memberName(data.members, a);
  return (
    <div className="grid gap-6 md:grid-cols-[2fr_1fr]">
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Request #{r.id}</h1>
          <StatusChip status={r.effective_status} scam={r.reported_as_scam} />
        </div>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Amount</dt>
            <dd>
              <Amount base={r.amount} />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Receiver</dt>
            <dd>
              <AccountId id={r.receiver_id} />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Requested by</dt>
            <dd>
              <AccountId id={r.requester} name={n(r.requester)} />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Claimed principal</dt>
            <dd>
              <AccountId id={r.claimed_principal} name={n(r.claimed_principal)} />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Route</dt>
            <dd>{r.route === "Instant" ? "Instant (policy allowed)" : "Needs confirmation"}</dd>
          </div>
          <div>
            <dt className="text-muted">Created</dt>
            <dd>{formatTime(r.created_at_ns)}</dd>
          </div>
          {r.expires_at_ns ? (
            <div>
              <dt className="text-muted">Hold expires</dt>
              <dd>{formatTime(r.expires_at_ns)}</dd>
            </div>
          ) : null}
          {r.decided_by ? (
            <div>
              <dt className="text-muted">Decided by</dt>
              <dd>
                <AccountId id={r.decided_by} name={n(r.decided_by)} />
              </dd>
            </div>
          ) : null}
          {r.memo ? (
            <div className="sm:col-span-2">
              <dt className="text-muted">Memo (public)</dt>
              <dd>{r.memo}</dd>
            </div>
          ) : null}
          {r.reason ? (
            <div className="sm:col-span-2">
              <dt className="text-muted">Reason</dt>
              <dd>{r.reason}</dd>
            </div>
          ) : null}
        </dl>
        {r.evidence ? (
          <div className="mt-4 rounded-lg border border-line p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge risk={r.evidence.risk} />
              {r.evidence.flags.filter(isFlagType).map((f) => (
                <span key={f} className="rounded bg-wash px-1.5 py-0.5 text-xs">
                  {FLAG_LABELS[f]}
                </span>
              ))}
            </div>
            <div className="mt-2 text-xs text-muted">
              Evidence hash <span className="mono">{r.evidence.evidence_hash}</span> · model{" "}
              {r.evidence.model} · signature verified by app:{" "}
              {r.evidence.signature_verified ? "yes" : "no"}
            </div>
          </div>
        ) : null}
        {r.effective_status === "Pending" ? (
          <p className="mt-4 text-sm">
            Principal’s link:{" "}
            <Link className="text-brand underline" href={`/confirm/${r.id}`}>
              /confirm/{r.id}
            </Link>
          </p>
        ) : null}
      </Card>
      <Card>
        <h2 className="font-semibold">Timeline</h2>
        <div className="mt-3">
          <Timeline request={r} />
        </div>
        {data.flag ? (
          <p className="mt-4 text-sm text-bad">
            Receiver is flagged as a scam ({data.flag.reports} report
            {data.flag.reports > 1 ? "s" : ""}).
          </p>
        ) : null}
      </Card>
    </div>
  );
}
