/**
 * Server-side NEAR access (scripts + API routes). One place for RPC, view calls
 * and signed transactions so signing logic is never duplicated.
 */
import { Account, FailoverRpcProvider, JsonRpcProvider, type KeyPairString } from "near-api-js";
import { CALL_GAS, rpcUrls } from "./config";

let provider: FailoverRpcProvider | null = null;
export function getProvider(): FailoverRpcProvider {
  provider ??= new FailoverRpcProvider(rpcUrls().map((url) => new JsonRpcProvider({ url })));
  return provider;
}

export async function view<T>(
  contractId: string,
  methodName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  return (await getProvider().callFunction({ contractId, method: methodName, args })) as T;
}

/**
 * Transactions go through one plain provider: the failover wrapper would turn a
 * protocol rejection (e.g. a function-call key misuse) into a generic
 * "RetriesExceeded" and hide the reason we want to show.
 */
let txProvider: JsonRpcProvider | null = null;
function getTxProvider(): JsonRpcProvider {
  txProvider ??= new JsonRpcProvider({ url: rpcUrls()[0]! });
  return txProvider;
}

export function accountFor(accountId: string, secretKey: string): Account {
  if (!/^ed25519:/.test(secretKey)) throw new Error(`invalid key for ${accountId}`);
  return new Account(accountId, getTxProvider(), secretKey as KeyPairString);
}

export interface TxResult {
  ok: boolean;
  hash: string | null;
  /** Decoded JSON return value on success. */
  value: unknown;
  logs: string[];
  /** Error text: contract panic, failed receipt, or protocol rejection. */
  error: string | null;
}

type Outcome = {
  transaction?: { hash?: string };
  transaction_outcome?: { id?: string; outcome?: { logs?: string[] } };
  receipts_outcome?: { outcome?: { logs?: string[]; status?: unknown } }[];
  status?: { SuccessValue?: string; Failure?: unknown } | string;
};

function decode(outcome: Outcome): TxResult {
  const hash = outcome.transaction?.hash ?? outcome.transaction_outcome?.id ?? null;
  const logs = [
    ...(outcome.transaction_outcome?.outcome?.logs ?? []),
    ...(outcome.receipts_outcome ?? []).flatMap((r) => r.outcome?.logs ?? []),
  ];
  const failedReceipts = (outcome.receipts_outcome ?? [])
    .map((r) => r.outcome?.status as { Failure?: unknown } | undefined)
    .filter((s) => s && typeof s === "object" && "Failure" in s)
    .map((s) => JSON.stringify(s!.Failure));
  const status = typeof outcome.status === "object" ? outcome.status : undefined;
  if (status && "Failure" in status && status.Failure) {
    return { ok: false, hash, value: null, logs, error: JSON.stringify(status.Failure) };
  }
  let value: unknown = null;
  if (status?.SuccessValue) {
    try {
      value = JSON.parse(Buffer.from(status.SuccessValue, "base64").toString("utf8"));
    } catch {
      value = null;
    }
  }
  // A transaction can "succeed" overall while an inner receipt (e.g. ft_transfer) failed.
  return { ok: true, hash, value, logs, error: failedReceipts[0] ?? null };
}

export async function call(
  account: Account,
  contractId: string,
  methodName: string,
  args: Record<string, unknown>,
  opts: { deposit?: bigint; gas?: bigint } = {},
): Promise<TxResult> {
  try {
    const res = await account.callFunctionRaw({
      contractId,
      methodName,
      args,
      deposit: opts.deposit ?? 0n,
      gas: opts.gas ?? CALL_GAS,
      waitUntil: "FINAL",
    });
    return decode(res as unknown as Outcome);
  } catch (e) {
    // Protocol-level rejections (e.g. a function-call key misuse) never reach the chain.
    const err = e as Error & { type?: string; cause?: unknown };
    const detail = [err.name, err.type, err.message, err.cause ? JSON.stringify(err.cause) : ""]
      .filter(Boolean)
      .join(" ");
    return { ok: false, hash: null, value: null, logs: [], error: detail || String(e) };
  }
}

/** Events from NEP-297 logs. */
export function events(logs: string[]): { event: string; data: Record<string, unknown>[] }[] {
  return logs
    .filter((l) => l.startsWith("EVENT_JSON:"))
    .map(
      (l) =>
        JSON.parse(l.slice("EVENT_JSON:".length)) as {
          event: string;
          data: Record<string, unknown>[];
        },
    );
}

/** Plain NEAR transfer (used by demo:attack to show a function-call key can't do it). */
export async function transferNear(
  account: Account,
  receiverId: string,
  yocto: bigint,
): Promise<TxResult> {
  try {
    const res = await account.transfer({ receiverId, amount: yocto });
    return decode(res as unknown as Outcome);
  } catch (e) {
    const err = e as Error & { type?: string };
    return {
      ok: false,
      hash: null,
      value: null,
      logs: [],
      error: [err.name, err.type, err.message].filter(Boolean).join(" "),
    };
  }
}
