"use client";
import type { AnalysisResult } from "@/lib/analyzer/types";
import { FLAG_LABELS } from "@/lib/flags";
import { NearNote, RiskBadge } from "./ui";

const STATUS_TEXT: Record<AnalysisResult["aiStatus"], { text: string; cls: string }> = {
  verified: { text: "NEAR AI (TEE) · signature verified", cls: "bg-ok-bg text-ok border-ok-line" },
  unverified: {
    text: "NEAR AI answered · signature NOT verified",
    cls: "bg-held-bg text-held border-held-line",
  },
  unavailable: {
    text: "NEAR AI unavailable · rules only, risk raised to at least medium",
    cls: "bg-held-bg text-held border-held-line",
  },
  disabled: {
    text: "Rules only · NEAR AI not configured on this server",
    cls: "bg-wash text-muted border-line",
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
      {
        type: "application/json",
      },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `callsign-evidence-${result.evidenceHash.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge risk={result.finalRisk} />
        <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${s.cls}`}>
          {s.text}
        </span>
      </div>
      {result.flags.length > 0 || result.ai ? <p className="text-sm">{result.summary}</p> : null}
      {result.flags.length > 0 ? (
        <ul className="space-y-2">
          {result.flags.map((f) => (
            <li key={f.type} className="rounded-lg border border-line bg-wash px-3 py-2 text-sm">
              <div className="font-semibold">
                {FLAG_LABELS[f.type]}{" "}
                <span className="text-xs font-normal text-muted">
                  · found by {f.source === "ai" ? "NEAR AI" : "rule check"}
                </span>
              </div>
              {DETAIL_FLAGS.has(f.type) && f.source === "rules" ? (
                <div className="mono mt-1 text-xs">{f.quote}</div>
              ) : (
                <blockquote className="mt-1 border-l-4 border-held-line pl-2 italic">
                  “{f.quote}”
                </blockquote>
              )}
              <div className="mt-1 text-muted">{f.explanation}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No red flags found.</p>
      )}
      {v ? (
        <div className="rounded-lg border border-line px-3 py-2 text-sm">
          <div className="font-semibold">What this app checked about the AI answer</div>
          <ul className="mt-1 space-y-0.5">
            <Check
              ok={v.hashes_match}
              text="Signature covers the exact request and response bytes"
            />
            <Check ok={v.signature_valid} text="ECDSA signature recovers to the signing address" />
            <Check
              ok={v.address_in_attestation}
              text="Signing address is in the TEE attestation fetched before the request"
            />
            <Check
              ok={v.attestation_bindings_valid}
              text="Attestation quote binds that address and our fresh nonce (config + RTMR3 checked)"
            />
            <li className="text-muted">
              ◻︎ Not checked here: Intel/NVIDIA hardware signature chains —{" "}
              <a
                className="underline"
                href="https://cloud.near.ai/verify"
                target="_blank"
                rel="noreferrer"
              >
                verify on NEAR’s Verification Center
              </a>
            </li>
          </ul>
          {result.ai ? (
            <div className="mt-1 text-xs text-muted">
              Model {result.ai.model} · chat {result.ai.chat_id} · signer{" "}
              <span className="mono">{result.ai.signing_address}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
        <span>
          On-chain evidence (categories only):{" "}
          <span className="mono">{result.evidenceHash.slice(0, 16)}…</span>
        </span>
        <button
          onClick={download}
          className="rounded border border-line bg-paper px-2 py-1 text-ink"
        >
          Download evidence file
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
    <li className={ok ? "text-ok" : "text-bad"}>
      {ok ? "✓" : "✗"} {text}
    </li>
  );
}
