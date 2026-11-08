/** TypeScript mirror of the vault's JSON views (enum values are PascalCase in the contract). */
import type { FlagType } from "../flags";

export type Role = "Requester" | "Principal";
export type Status =
  "Pending" | "Executing" | "Executed" | "Rejected" | "Expired" | "Cancelled" | "Failed";
export type Route = "Instant" | "NeedsConfirmation";
export type ContractRisk = "Low" | "Medium" | "High" | "Unknown";

export interface Policy {
  instant_limit: string;
  hold_window_ns: string;
  high_risk_hold_multiplier: number;
  max_pending_per_requester: number;
}
export interface VaultConfig {
  owner_id: string;
  token_id: string;
  policy: Policy;
}
export interface Balances {
  vault_balance: string;
  reserved: string;
  available: string;
}
export interface MemberView {
  account_id: string;
  display_name: string;
  title: string;
  roles: Role[];
  active: boolean;
}
export interface PayeeView {
  account_id: string;
  label: string;
  added_at_ns: string;
}
export interface Evidence {
  evidence_hash: string;
  risk: ContractRisk;
  flags: FlagType[];
  model: string;
  chat_id: string;
  signing_address: string;
  signature_verified: boolean;
}
export interface RequestView {
  id: string;
  requester: string;
  claimed_principal: string;
  receiver_id: string;
  amount: string;
  memo: string;
  evidence: Evidence | null;
  route: Route;
  status: Status;
  reported_as_scam: boolean;
  created_at_ns: string;
  expires_at_ns: string | null;
  decided_by: string | null;
  decided_at_ns: string | null;
  reason: string | null;
  effective_status: Status;
  needs_sweep: boolean;
}
export interface FlagView {
  account_id: string;
  reports: number;
  first_reported_by: string;
  first_request_id: string;
  flagged_at_ns: string;
}
