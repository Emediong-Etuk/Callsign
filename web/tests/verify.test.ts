import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";
import { describe, expect, it } from "vitest";
import { analyze } from "../lib/analyzer";
import {
  isVerified,
  sha256Hex,
  verifyNearAiResponse,
  attestationSchema,
} from "../lib/verify/nearai-verify";
import { checkNearReport } from "../lib/verify/tdx";
import { input, root, scenario, syntheticReport } from "./helpers";

const MODEL = "Qwen/Qwen3.6-35B-A3B-FP8";

describe("real NEAR AI attestation report (captured, no key needed)", () => {
  const att = attestationSchema.parse(
    JSON.parse(readFileSync(path.join(root, "fixtures", "nearai-attestation-sample.json"), "utf8")),
  );
  it("model candidate binds its signing address and our nonce; config + RTMR3 replay match", () => {
    expect(att.model_attestations.length).toBeGreaterThan(0);
    const c = checkNearReport(att.model_attestations[0]!, att.nonce);
    expect(c.failures).toEqual([]);
  });
  it("gateway report checks pass too", () => {
    expect(checkNearReport(att.gateway_attestation!, att.nonce).ok).toBe(true);
  });
  it("a different nonce is rejected (freshness)", () => {
    const c = checkNearReport(att.model_attestations[0]!, "00".repeat(32));
    expect(c.ok).toBe(false);
  });
  it("a tampered app_compose is rejected", () => {
    const r = structuredClone(att.model_attestations[0]!);
    const tcb =
      typeof r.info.tcb_info === "string" ? JSON.parse(r.info.tcb_info) : { ...r.info.tcb_info };
    tcb.app_compose = String(tcb.app_compose) + " ";
    r.info.tcb_info = JSON.stringify(tcb);
    expect(checkNearReport(r, att.nonce).failures).toContain(
      "MRCONFIGID does not match app_compose",
    );
  });
});

describe("signature verification logic (synthetic key — test vectors, not NEAR data)", () => {
  const wallet = Wallet.createRandom();
  const nonce = randomBytes(32).toString("hex");
  const rawRequest = JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "x" }] });
  const rawResponse = '{"id":"chatcmpl-test","choices":[{"message":{"content":"{}"}}]}';
  const text = `${MODEL}:${sha256Hex(rawRequest)}:${sha256Hex(rawResponse)}`;
  const attestation = {
    nonce,
    model: MODEL,
    fetched_at: new Date().toISOString(),
    gateway_attestation: null,
    model_attestations: [syntheticReport(wallet.address.toLowerCase(), nonce)],
  };
  const sign = async () => ({
    text,
    signature: await wallet.signMessage(text),
    signing_address: wallet.address,
    signing_algo: "ecdsa",
    signature_kind: "provider_tee",
  });

  it("passes when bytes, signature and attestation all line up", async () => {
    const v = verifyNearAiResponse({
      model: MODEL,
      rawRequest,
      rawResponse,
      signature: await sign(),
      attestation,
    });
    expect(v.notes).toEqual([]);
    expect(isVerified(v)).toBe(true);
    expect(v.hardware_verified).toBe(false);
  });
  it("fails when one byte of the response is altered", async () => {
    const v = verifyNearAiResponse({
      model: MODEL,
      rawRequest,
      rawResponse: rawResponse.replace("test", "tesT"),
      signature: await sign(),
      attestation,
    });
    expect(v.hashes_match).toBe(false);
    expect(isVerified(v)).toBe(false);
  });
  it("fails when the signing address is swapped", async () => {
    const sig = { ...(await sign()), signing_address: Wallet.createRandom().address };
    const v = verifyNearAiResponse({
      model: MODEL,
      rawRequest,
      rawResponse,
      signature: sig,
      attestation,
    });
    expect(v.signature_valid).toBe(false);
    expect(v.address_in_attestation).toBe(false);
    expect(isVerified(v)).toBe(false);
  });
  it("fails when the signer is not in the preflight attestation", async () => {
    const other = {
      ...attestation,
      model_attestations: [syntheticReport(Wallet.createRandom().address.toLowerCase(), nonce)],
    };
    const v = verifyNearAiResponse({
      model: MODEL,
      rawRequest,
      rawResponse,
      signature: await sign(),
      attestation: other,
    });
    expect(v.signature_valid).toBe(true);
    expect(v.address_in_attestation).toBe(false);
    expect(isVerified(v)).toBe(false);
  });
  it("fails when the model id in the signed text differs (aliasing)", async () => {
    const v = verifyNearAiResponse({
      model: "some/alias",
      rawRequest,
      rawResponse,
      signature: await sign(),
      attestation,
    });
    expect(v.hashes_match).toBe(false);
  });
  it("gateway signatures use the two-hash format and the gateway report", async () => {
    const gwText = `${sha256Hex(rawRequest)}:${sha256Hex(rawResponse)}`;
    const sig = {
      text: gwText,
      signature: await wallet.signMessage(gwText),
      signing_address: wallet.address,
      signing_algo: "ecdsa",
      signature_kind: "gateway",
    };
    const att = {
      ...attestation,
      model_attestations: [],
      gateway_attestation: syntheticReport(wallet.address.toLowerCase(), nonce),
    };
    expect(
      isVerified(
        verifyNearAiResponse({
          model: MODEL,
          rawRequest,
          rawResponse,
          signature: sig,
          attestation: att,
        }),
      ),
    ).toBe(true);
  });
});

describe("G7: nothing but categories goes on-chain", () => {
  it("on-chain evidence carries no quote, explanation or summary text", async () => {
    const text = scenario("ceo-urgent-wire");
    const r = await analyze(input(text), { ai: null });
    const onChain = JSON.stringify(r.onChainEvidence);
    for (const f of r.flags) {
      if (f.quote.length > 3) expect(onChain).not.toContain(f.quote);
      expect(onChain).not.toContain(f.explanation);
    }
    expect(onChain).not.toContain(r.summary);
    expect(Object.keys(r.onChainEvidence).sort()).toEqual(
      [
        "chat_id",
        "evidence_hash",
        "flags",
        "model",
        "risk",
        "signature_verified",
        "signing_address",
      ].sort(),
    );
    expect(r.onChainEvidence.evidence_hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("evidence hash is deterministic for the same bundle", async () => {
    const now = () => new Date("2026-11-08T12:00:00Z");
    const a = await analyze(input(scenario("ceo-urgent-wire")), { ai: null, now });
    const b = await analyze(input(scenario("ceo-urgent-wire")), { ai: null, now });
    expect(a.evidenceHash).toBe(b.evidenceHash);
  });
});

const realFixture = path.join(root, "fixtures", "nearai-verified-sample.json");
describe.runIf(existsSync(realFixture))("real signed NEAR AI response (fixture)", () => {
  it("verifies offline; tampering breaks it", async () => {
    const { verifyFixtureFile } = await import("../scripts/lib/fixture");
    const result = verifyFixtureFile(realFixture);
    expect(result.verified).toBe(true);
    expect(result.tamperedResponseFails).toBe(true);
    expect(result.swappedAddressFails).toBe(true);
  });
});
