/**
 * Checks on one NEAR AI attestation report (gateway or model), following
 * docs.near.ai/cloud/verification/reference/quote-nonce-signer.
 *
 * What this does:   reads the Intel TDX quote bytes and checks that
 *   - the echoed `request_nonce` equals our nonce,
 *   - quote report_data = signing identity (zero-padded) || our nonce,
 *   - TDX debug mode is off,
 *   - MRCONFIGID = 0x01 || sha256(app_compose) || 15 zero bytes,
 *   - replaying the RTMR3 event log gives the quote's RTMR3.
 * What this does NOT do: verify the quote's Intel signature chain (DCAP
 *   collateral) or the NVIDIA GPU evidence. Those "hardware" checks are left to
 *   NEAR's Verification Center (https://cloud.near.ai/verify). So a report that
 *   passes here is internally consistent and fresh, not hardware-proven.
 */
import { createHash } from "node:crypto";
import { z } from "zod";

export const nearReportSchema = z.object({
  signing_address: z.string(),
  signing_algo: z.string(),
  request_nonce: z.string(),
  intel_quote: z.string().regex(/^[0-9a-fA-F]+$/),
  event_log: z.union([z.string(), z.array(z.unknown())]),
  info: z
    .object({ tcb_info: z.union([z.string(), z.record(z.string(), z.unknown())]) })
    .passthrough(),
  model_name: z.string().optional(),
});
export type NearReport = z.infer<typeof nearReportSchema>;

// TDX quote v4 layout: 48-byte header, then the 584-byte TD report body.
const HEADER = 48;
const BODY_LEN = 584;
const OFF_TD_ATTRIBUTES = 120;
const OFF_MR_CONFIG_ID = 184;
const OFF_RTMR3 = 472;
const OFF_REPORT_DATA = 520;
const TEE_TYPE_TDX = 0x81;

export interface ReportCheck {
  ok: boolean;
  failures: string[];
}

const sha = (alg: "sha256" | "sha384", data: Buffer) => createHash(alg).update(data).digest();

const eventSchema = z.object({
  imr: z.number(),
  event_type: z.number(),
  event: z.string(),
  event_payload: z.string().optional().nullable(),
  digest: z.string().optional().nullable(),
});

export function replayRtmr3(eventLog: NearReport["event_log"]): Buffer {
  const events = z
    .array(z.unknown())
    .parse(typeof eventLog === "string" ? JSON.parse(eventLog) : eventLog);
  let rtmr3 = Buffer.alloc(48);
  for (const raw of events) {
    const parsed = eventSchema.safeParse(raw);
    if (!parsed.success || parsed.data.imr !== 3) continue;
    const e = parsed.data;
    const typeBytes = Buffer.alloc(4);
    typeBytes.writeUInt32LE(e.event_type);
    const digest = sha(
      "sha384",
      Buffer.concat([
        typeBytes,
        Buffer.from(":"),
        Buffer.from(e.event, "utf8"),
        Buffer.from(":"),
        Buffer.from(e.event_payload ?? "", "hex"),
      ]),
    );
    if (e.digest && !Buffer.from(e.digest, "hex").equals(digest)) {
      throw new Error(`event digest mismatch for ${e.event}`);
    }
    rtmr3 = sha("sha384", Buffer.concat([rtmr3, digest]));
  }
  return rtmr3;
}

function signingIdentity(report: NearReport): Buffer {
  const hex = report.signing_address.replace(/^0x/i, "");
  const id = Buffer.from(hex, "hex");
  const expected =
    report.signing_algo === "ecdsa" ? 20 : report.signing_algo === "ed25519" ? 32 : -1;
  if (id.length !== expected) throw new Error("unsupported signing identity");
  return id;
}

export function checkNearReport(report: NearReport, nonceHex: string): ReportCheck {
  const failures: string[] = [];
  try {
    if (report.request_nonce.toLowerCase() !== nonceHex.toLowerCase()) {
      failures.push("echoed nonce does not match ours");
    }
    const quote = Buffer.from(report.intel_quote, "hex");
    if (quote.length < HEADER + BODY_LEN) throw new Error("quote too short");
    if (quote.readUInt16LE(0) !== 4) failures.push("unexpected quote version");
    if (quote.readUInt32LE(4) !== TEE_TYPE_TDX) failures.push("quote is not a TDX quote");
    const body = quote.subarray(HEADER, HEADER + BODY_LEN);

    if ((body[OFF_TD_ATTRIBUTES]! & 1) === 1) failures.push("TDX debug mode is enabled");

    const reportData = body.subarray(OFF_REPORT_DATA, OFF_REPORT_DATA + 64);
    const identity = Buffer.alloc(32);
    signingIdentity(report).copy(identity);
    const expected = Buffer.concat([identity, Buffer.from(nonceHex, "hex")]);
    if (!reportData.equals(expected))
      failures.push("quote report data does not bind signer + nonce");

    const tcb =
      typeof report.info.tcb_info === "string"
        ? JSON.parse(report.info.tcb_info)
        : report.info.tcb_info;
    const appCompose = z.object({ app_compose: z.string() }).parse(tcb).app_compose;
    const mrConfig = body.subarray(OFF_MR_CONFIG_ID, OFF_MR_CONFIG_ID + 48);
    const expectedConfig = Buffer.concat([
      Buffer.from([1]),
      sha("sha256", Buffer.from(appCompose, "utf8")),
      Buffer.alloc(15),
    ]);
    if (!mrConfig.equals(expectedConfig)) failures.push("MRCONFIGID does not match app_compose");

    const rtmr3 = body.subarray(OFF_RTMR3, OFF_RTMR3 + 48);
    if (!replayRtmr3(report.event_log).equals(rtmr3))
      failures.push("event log does not match RTMR3");
  } catch (e) {
    failures.push(`malformed report: ${(e as Error).message}`);
  }
  return { ok: failures.length === 0, failures };
}
