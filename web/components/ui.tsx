/** Small presentational building blocks shared by every page. */
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  OctagonX,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Sparkles,
  XCircle,
} from "lucide-react";
import type { Status } from "@/lib/near/types";
import { formatTusd } from "@/lib/near/format";
import { accountUrl, txUrl } from "@/lib/near/config";

export function AccountId({ id, name }: { id: string; name?: string | null }) {
  // Always the FULL account id: truncation is how look-alike accounts hide.
  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-1.5">
      {name ? <span className="font-medium">{name}</span> : null}
      <a
        href={accountUrl(id)}
        className="mono rounded-md bg-ink/[0.04] px-1.5 py-0.5 text-[0.85em] text-brand-ink transition hover:bg-brand/10"
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
    <span
      className={
        big ? "text-3xl font-semibold tracking-tight tabular-nums" : "font-medium tabular-nums"
      }
    >
      {formatTusd(base)} <span className="text-sm font-normal text-subtle">(test dollars)</span>
    </span>
  );
}

const STATUS_STYLE: Record<Status, { label: string; cls: string; Icon: typeof Clock }> = {
  Pending: {
    label: "Held — awaiting confirmation",
    cls: "bg-held-bg text-held ring-held-line/40",
    Icon: Hourglass,
  },
  Executing: { label: "Sending…", cls: "bg-wash text-muted ring-line", Icon: Loader2 },
  Executed: { label: "Paid", cls: "bg-ok-bg text-ok ring-ok-line/40", Icon: CheckCircle2 },
  Rejected: { label: "Blocked", cls: "bg-bad-bg text-bad ring-bad-line/40", Icon: OctagonX },
  Expired: { label: "Expired — nothing sent", cls: "bg-wash text-muted ring-line", Icon: Clock },
  Cancelled: { label: "Cancelled", cls: "bg-wash text-muted ring-line", Icon: XCircle },
  Failed: {
    label: "Failed — funds kept",
    cls: "bg-bad-bg text-bad ring-bad-line/40",
    Icon: AlertTriangle,
  },
};

export function StatusChip({ status, scam }: { status: Status; scam?: boolean }) {
  const s = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${s.cls}`}
    >
      <s.Icon
        size={13}
        aria-hidden="true"
        className={status === "Executing" ? "animate-spin" : ""}
      />
      {status === "Rejected" && scam ? "Blocked & reported" : s.label}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: string }) {
  const r = risk.toLowerCase();
  const [cls, Icon] =
    r === "high"
      ? (["bg-bad text-white", ShieldAlert] as const)
      : r === "medium"
        ? (["bg-held-line text-ink", ShieldQuestion] as const)
        : r === "low"
          ? (["bg-ok text-white", ShieldCheck] as const)
          : (["bg-subtle text-white", ShieldQuestion] as const);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${cls}`}
    >
      <Icon size={13} aria-hidden="true" /> {r} risk
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
    <a
      href={txUrl(hash)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-0.5 text-xs font-medium text-brand underline-offset-2 hover:underline"
    >
      {label}
      <ArrowUpRight size={13} aria-hidden="true" />
    </a>
  );
}

const TONE = {
  neutral: "border-line",
  held: "border-held-line/70 shadow-[0_0_0_4px_rgb(245_158_11_/_0.08)]",
  ok: "border-ok-line/70 shadow-[0_0_0_4px_rgb(16_185_129_/_0.08)]",
  bad: "border-bad-line/70 shadow-[0_0_0_4px_rgb(239_68_68_/_0.08)]",
};

export function Card({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "held" | "ok" | "bad";
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border bg-paper p-5 shadow-sm transition-[box-shadow,border-color] duration-500 sm:p-6 ${TONE[tone]} ${className}`}
    >
      {children}
    </section>
  );
}

/** "What NEAR is doing here" explainer next to key moments. */
export function NearNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group mt-4 rounded-xl border border-brand/15 bg-gradient-to-br from-brand/[0.04] to-brand-2/[0.04] px-4 py-3 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-brand-ink">
        <Sparkles size={15} className="text-brand" aria-hidden="true" />
        What NEAR is doing here: {title}
        <span className="ml-auto text-subtle transition group-open:rotate-45" aria-hidden="true">
          +
        </span>
      </summary>
      <div className="mt-2 leading-relaxed text-muted">{children}</div>
    </details>
  );
}

export function Button({
  children,
  onClick,
  tone = "primary",
  disabled,
  type = "button",
  size = "md",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "ok" | "bad" | "ghost";
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "md" | "lg";
}) {
  const cls = {
    primary:
      "bg-gradient-to-r from-brand to-[#4338ca] text-white shadow-md shadow-brand/25 hover:shadow-lg hover:shadow-brand/30 hover:brightness-110",
    ok: "bg-ok text-white shadow-md shadow-ok/25 hover:brightness-110",
    bad: "bg-bad text-white shadow-md shadow-bad/25 hover:brightness-110",
    ghost: "border border-line bg-paper text-ink hover:border-subtle/40 hover:bg-wash",
  }[tone];
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${
        size === "lg" ? "min-h-12 px-5 text-base" : "min-h-11 px-4 text-sm"
      } ${cls}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-sm text-muted">
      <Loader2 size={16} className="animate-spin text-brand" aria-hidden="true" />
      {label}
    </span>
  );
}

export function ErrorBox({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-bad-line/50 bg-bad-bg px-3.5 py-2.5 text-sm text-bad"
    >
      <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}

/** Page header used by every non-landing page. */
export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden border-b border-line bg-paper">
      <div
        className="bg-dots pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-10">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>
        ) : null}
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {children ? <div className="mt-3 max-w-3xl text-muted">{children}</div> : null}
      </div>
    </div>
  );
}

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto max-w-6xl px-4 py-8 ${className}`}>{children}</div>;
}
