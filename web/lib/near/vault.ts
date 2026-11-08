/** Typed wrappers for the vault and token contracts. */
import type { Account } from "near-api-js";
import type { OnChainEvidence } from "../analyzer/types";
import { call, view, type TxResult } from "./client";
import { ONE_YOCTO } from "./config";
import type { Balances, FlagView, MemberView, PayeeView, RequestView, VaultConfig } from "./types";

export const vaultViews = (vaultId: string) => ({
  config: () => view<VaultConfig>(vaultId, "get_config"),
  balances: () => view<Balances>(vaultId, "get_balances"),
  members: () => view<MemberView[]>(vaultId, "list_members", { from_index: 0, limit: 50 }),
  payees: () => view<PayeeView[]>(vaultId, "list_payees", { from_index: 0, limit: 50 }),
  request: (id: string) => view<RequestView | null>(vaultId, "get_request", { id }),
  requests: (limit = 50) => view<RequestView[]>(vaultId, "list_requests", { from_index: 0, limit }),
  pendingFor: (accountId: string) =>
    view<RequestView[]>(vaultId, "list_pending_for_principal", { account_id: accountId }),
  byRequester: (accountId: string, limit = 50) =>
    view<RequestView[]>(vaultId, "list_requests_by_requester", { account_id: accountId, limit }),
  flag: (accountId: string) =>
    view<FlagView | null>(vaultId, "get_flag", { account_id: accountId }),
  flags: () => view<FlagView[]>(vaultId, "list_flags", { from_index: 0, limit: 50 }),
  isKnownPayee: (accountId: string) =>
    view<boolean>(vaultId, "is_known_payee", { account_id: accountId }),
});

export const ftBalance = async (tokenId: string, accountId: string) =>
  BigInt(await view<string>(tokenId, "ft_balance_of", { account_id: accountId }));

export interface RequestArgs {
  claimedPrincipal: string;
  receiverId: string;
  amount: string;
  memo: string;
  evidence: OnChainEvidence | null;
}

export const requestPayout = (
  requester: Account,
  vaultId: string,
  a: RequestArgs,
): Promise<TxResult> =>
  call(requester, vaultId, "request_payout", {
    claimed_principal: a.claimedPrincipal,
    receiver_id: a.receiverId,
    amount: a.amount,
    memo: a.memo,
    evidence: a.evidence,
  });

/** G2: 1 yoctoNEAR attached, so only a full-access key can sign this. */
export const confirmPayout = (principal: Account, vaultId: string, id: string) =>
  call(principal, vaultId, "confirm_payout", { id }, { deposit: ONE_YOCTO });

export const rejectPayout = (
  principal: Account,
  vaultId: string,
  id: string,
  reason: string | null,
  reportScam: boolean,
) => call(principal, vaultId, "reject_payout", { id, reason, report_scam: reportScam });

export const cancelPayout = (requester: Account, vaultId: string, id: string) =>
  call(requester, vaultId, "cancel_payout", { id });

export const sweepExpired = (anyone: Account, vaultId: string, limit = 20) =>
  call(anyone, vaultId, "sweep_expired", { limit });
