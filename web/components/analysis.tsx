"use client";
import { motion } from "motion/react";
import {
  BadgeCheck,
  CircleCheck,
  CircleDashed,
  CircleX,
  Download,
  ShieldCheck,
} from "lucide-react";
import type { AnalysisResult } from "@/lib/analyzer/types";
import { FLAG_LABELS } from "@/lib/flags";
import { NearNote, RiskBadge } from "./ui";

const STATUS_TEXT: Record<AnalysisResult["aiStatus"], { text: string; cls: string }> = {
  verified: { text: "NEAR AI (TEE) · signature verified", cls: "bg-ok-bg text-ok ring-ok-line/40" },
  unverified: {
    text: "NEAR AI answered · signature NOT verified",
    cls: "bg-held-bg text-held ring-held-line/40",
  },
  unavailable: {
    text: "NEAR AI unavailable · rules only, risk raised to at least medium",
    cls: "bg-held-bg text-held ring-held-line/40",
  },
  disabled: {
    text: "Rules only · NEAR AI not configured on this server",
    cls: "bg-wash text-muted ring-line",
  },
};

/** Rule flags about the account or amount, not about words in the message. */
const DETAIL_FLAGS = new Set(["new_payee", "lookalike_account", "amount_anomaly"]);

export function AnalysisPanel({ result }: { result: AnalysisResult }) {
  const s = STATUS_TEXT[result.aiStatus];
  const v = result.ai?.verification;
  const download = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            ...result.evidenceBundle,
            raw_request: result.raw?.request ?? null,
            raw_response: result.raw?.response ?? null,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `callsign-evidence-${result.evidenceHash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge risk={result.finalRisk} />
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}
        >
          {result.aiStatus === "verified" ? <BadgeCheck size={13} aria-hidden="true" /> : null}
          {s.text}
        </span>
      </div>
      {result.flags.length > 0 || result.ai ? (
        <p className="text-sm leading-relaxed">{result.summary}</p>
      ) : null}

      {result.flags.length > 0 ? (
        <ul className="grid gap-2">
          {result.flags.map((f, i) => (
            <motion.li
              key={f.type}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-held-line" aria-hidden="true" />
                <span className="font-semibold">{FLAG_LABELS[f.type]}</span>
                <span className="text-xs text-subtle">
                  · {f.source === "ai" ? "NEAR AI" : "rule check"}
                </span>
              </div>
              {DETAIL_FLAGS.has(f.type) && f.source === "rules" ? (
                <div className="mono mt-1.5 text-xs text-muted">{f.quote}</div>
              ) : (
                <blockquote className="mt-1.5 rounded-lg bg-held-bg/60 px-2.5 py-1 text-[13px] italic text-ink/90">
                  “{f.quote}”
                </blockquote>
              )}
              <div className="mt-1.5 text-[13px] leading-relaxed text-muted">{f.explanation}</div>
            </motion.li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 rounded-xl bg-ok-bg/60 px-3.5 py-2.5 text-sm text-ok">
          <ShieldCheck size={16} aria-hidden="true" /> No red flags found.
        </p>
      )}

      {v ? (
        <div className="overflow-hidden rounded-xl border border-line">
          <div className="flex items-center gap-2 border-b border-line bg-wash px-3.5 py-2 text-sm font-semibold">
            <ShieldCheck size={15} className="text-brand" aria-hidden="true" /> Verified panel —
            what this app checked
          </div>
          <ul className="space-y-1.5 px-3.5 py-3 text-[13px]">
            <Check
              ok={v.hashes_match}
              text="Signature covers the exact request and response bytes"
            />
            <Check ok={v.signature_valid} text="ECDSA signature recovers to the signing address" />
            <Check
              ok={v.address_in_attestation}
              text="Signer is in the TEE attestation fetched before the request"
            />
            <Check
              ok={v.attestation_bindings_valid}
              text="Attestation binds that signer and our fresh nonce (config + RTMR3 checked)"
            />
            <li className="flex items-start gap-2 text-subtle">
              <CircleDashed size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                Not checked here: Intel/NVIDIA hardware signature chains —{" "}
                <a
                  className="underline"
                  href="https://cloud.near.ai/verify"
                  target="_blank"
                  rel="noreferrer"
                >
                  NEAR’s Verification Center
                </a>
              </span>
            </li>
          </ul>
          {result.ai ? (
            <div className="border-t border-line px-3.5 py-2 text-xs text-subtle">
              {result.ai.model} · chat {result.ai.chat_id.slice(0, 10)}… · signer{" "}
              <span className="mono">{result.ai.signing_address}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-xs text-subtle">
        <span>
          On-chain evidence (categories only):{" "}
          <span className="mono">{result.evidenceHash.slice(0, 16)}…</span>
        </span>
        <button
          onClick={download}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-paper px-2 py-1 font-medium text-ink transition hover:bg-wash"
        >
          <Download size={13} aria-hidden="true" /> Evidence file
        </button>
      </div>
      <NearNote title="private, TEE-verified AI">
        The message is checked by a model running inside a Trusted Execution Environment on NEAR AI
        Cloud. The model signs its answer; this app checks the signature against the model’s
        attestation. Only the risk level, flag categories and a hash go on-chain — never the message
        or quotes. The AI can only add friction: a “low” verdict never skips a rule.
      </NearNote>
    </div>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-start gap-2 ${ok ? "text-ok" : "text-bad"}`}>
      {ok ? (
        <CircleCheck size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      ) : (
        <CircleX size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      )}
      <span>{text}</span>
    </li>
  );
}
