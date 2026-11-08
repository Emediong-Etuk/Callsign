import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AnalysisInput } from "../lib/analyzer/types";
import type { NearReport } from "../lib/verify/tdx";

export const root = path.resolve(import.meta.dirname, "..");
export const scenario = (name: string) =>
  readFileSync(path.join(root, "fixtures", "scenarios", `${name}.txt`), "utf8");

export const CEO = {
  accountId: "ceo.callsign-demo.testnet",
  displayName: "Ada Okafor",
  title: "CEO",
};
export const CFO = {
  accountId: "cfo.callsign-demo.testnet",
  displayName: "Chidi Eze",
  title: "CFO",
};
export const VENDOR = "vendor.callsign-demo.testnet";

export function input(text: string, over: Partial<AnalysisInput> = {}): AnalysisInput {
  return {
    text,
    claimedPrincipal: CEO,
    receiverId: "fastpay-7f3a91.testnet",
    amount: "25000000000",
    knownPayees: [VENDOR],
    members: [
      CEO,
      CFO,
      {
        accountId: "finance.callsign-demo.testnet",
        displayName: "Tolu Bello",
        title: "Finance Officer",
      },
    ],
    instantLimit: "500000000",
    ...over,
  };
}

/**
 * A SYNTHETIC attestation report (test vector, not NEAR data) with a well-formed
 * TDX quote layout, so we can test verification against a key we control.
 */
export function syntheticReport(signingAddress: string, nonceHex: string): NearReport {
  const appCompose = '{"services":"synthetic-test"}';
  const events = [
    { imr: 3, event_type: 134217729, event: "compose-hash", event_payload: "abcd", digest: "" },
  ];
  const typeBytes = Buffer.alloc(4);
  typeBytes.writeUInt32LE(134217729);
  const digest = createHash("sha384")
    .update(Buffer.concat([typeBytes, Buffer.from(":compose-hash:"), Buffer.from("abcd", "hex")]))
    .digest();
  const rtmr3 = createHash("sha384")
    .update(Buffer.concat([Buffer.alloc(48), digest]))
    .digest();
  const quote = Buffer.alloc(48 + 584 + 16);
  quote.writeUInt16LE(4, 0);
  quote.writeUInt32LE(0x81, 4);
  const body = 48;
  Buffer.concat([
    Buffer.from([1]),
    createHash("sha256").update(appCompose).digest(),
    Buffer.alloc(15),
  ]).copy(quote, body + 184);
  rtmr3.copy(quote, body + 472);
  const identity = Buffer.alloc(32);
  Buffer.from(signingAddress.replace(/^0x/, ""), "hex").copy(identity);
  Buffer.concat([identity, Buffer.from(nonceHex, "hex")]).copy(quote, body + 520);
  return {
    signing_address: signingAddress,
    signing_algo: "ecdsa",
    request_nonce: nonceHex,
    intel_quote: quote.toString("hex"),
    event_log: JSON.stringify(events),
    info: { tcb_info: JSON.stringify({ app_compose: appCompose }) },
  };
}
