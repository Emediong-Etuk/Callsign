/** Small presentational building blocks shared by every page. */
import type { ReactNode } from "react";
import type { Status } from "@/lib/near/types";
import { formatTusd } from "@/lib/near/format";
import { txUrl, accountUrl } from "@/lib/near/config";

export function AccountId({ id, name }: { id: string; name?: string | null }) {
  // Always the FULL account id: truncation is how look-alike accounts hide.
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {name ? <span className="font-medium">{name}</span> : null}
      <a
        href={accountUrl(id)}
        className="mono text-[0.9em] text-brand underline decoration-dotted underline-offset-2"
        target="_blank"
        rel="noreferrer"
      >
        {id}
      </a>
    </span>
  );
}

export function Amount({ base, big = false }: { base: string; big?: boolean }) {
  return (
    <span className={big ? "text-2xl font-semibold tabular-nums" : "tabular-nums"}>
      {formatTusd(base)} <span className="text-sm font-normal text-muted">(test dollars)</span>
    </span>
  );
}

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  Pending: { label: "Held — awaiting confirmation", cls: "bg-held-bg text-held border-held-line" },
  Executing: { label: "Sending…", cls: "bg-wash text-muted border-line" },
  Executed: { label: "Paid", cls: "bg-ok-bg text-ok border-ok-line" },
  Rejected: { label: "Blocked", cls: "bg-bad-bg text-bad border-bad-line" },
  Expired: { label: "Expired — nothing sent", cls: "bg-wash text-muted border-line" },
  Cancelled: { label: "Cancelled", cls: "bg-wash text-muted border-line" },
  Failed: { label: "Failed — funds kept", cls: "bg-bad-bg text-bad border-bad-line" },
};

export function StatusChip({ status, scam }: { status: Status; scam?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.cls}`}
    >
      {status === "Rejected" && scam ? "Blocked & reported" : s.label}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: string }) {
  const r = risk.toLowerCase();
  const cls =
    r === "high"
      ? "bg-bad-bg text-bad border-bad-line"
      : r === "medium"
        ? "bg-held-bg text-held border-held-line"
        : r === "low"
          ? "bg-ok-bg text-ok border-ok-line"
          : "bg-wash text-muted border-line";
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${cls}`}
    >
      {r} risk
    </span>
  );
}

export function TxLink({
  hash,
  label = "View transaction",
}: {
  hash: string | null | undefined;
  label?: string;
}) {
  if (!hash) return null;
  return (
    <a href={txUrl(hash)} target="_blank" rel="noreferrer" className="text-xs text-brand underline">
      {label} ↗
    </a>
  );
}

export function Card({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "held" | "ok" | "bad";
  className?: string;
}) {
  const toneCls = {
    neutral: "border-line",
    held: "border-held-line",
    ok: "border-ok-line",
    bad: "border-bad-line",
  }[tone];
  return (
    <section className={`rounded-xl border-2 bg-paper p-5 shadow-sm ${toneCls} ${className}`}>
      {children}
    </section>
  );
}

/** "What NEAR is doing here" explainer next to key moments. */
export function NearNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="mt-3 rounded-lg border border-line bg-wash px-3 py-2 text-sm">
      <summary className="cursor-pointer font-medium text-brand">
        What NEAR is doing here: {title}
      </summary>
      <div className="mt-2 text-muted">{children}</div>
    </details>
  );
}

export function Button({
  children,
  onClick,
  tone = "primary",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "ok" | "bad" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const cls = {
    primary: "bg-brand text-white hover:bg-[#16304f]",
    ok: "bg-ok text-white hover:bg-[#044e3a]",
    bad: "bg-bad text-white hover:bg-[#7f1515]",
    ghost: "border border-line bg-paper text-ink hover:bg-wash",
  }[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand"
      />
      {label}
    </span>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-bad-line bg-bad-bg px-3 py-2 text-sm text-bad"
    >
      {children}
    </div>
  );
}
