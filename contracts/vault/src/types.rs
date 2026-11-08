//! Data types stored by the vault and returned by its views.
//!
//! Privacy rule (G7): nothing here may hold the text of the message the
//! requester received. The only free-text fields on a request are `memo`
//! (written by the requester, shown as public in the UI) and `reason`
//! (written by the principal on reject). `Evidence` is categorical only.

use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, near};

/// The flag categories the analyzer may report. Must equal `shared/flags.json`
/// (checked by test T16).
pub const ALLOWED_FLAGS: [&str; 12] = [
    "urgency",
    "secrecy",
    "authority_pressure",
    "new_payee",
    "changed_payment_details",
    "unusual_channel",
    "bypass_process",
    "emotional_pressure",
    "lookalike_account",
    "credential_or_code_request",
    "amount_anomaly",
    "instruction_injection",
];

pub const MAX_NAME_LEN: usize = 64;
pub const MAX_MEMO_LEN: usize = 280;
pub const MAX_REASON_LEN: usize = 280;
pub const MAX_FLAGS: usize = 10;
pub const MAX_FLAG_LEN: usize = 32;
pub const MAX_MODEL_LEN: usize = 96;
pub const MAX_CHAT_ID_LEN: usize = 96;
pub const MAX_SIGNING_ADDRESS_LEN: usize = 66;
pub const EVIDENCE_HASH_LEN: usize = 64;

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Role {
    Requester,
    Principal,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Member {
    pub display_name: String,
    pub title: String,
    pub roles: Vec<Role>,
    pub active: bool,
}

impl Member {
    pub fn has_role(&self, role: Role) -> bool {
        self.roles.contains(&role)
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Payee {
    pub label: String,
    pub added_at_ns: U64,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Policy {
    /// Largest amount (in token base units) a known payee can receive without confirmation.
    pub instant_limit: U128,
    /// How long a held request waits for the principal before it expires.
    pub hold_window_ns: U64,
    /// High-risk requests wait `hold_window_ns * high_risk_hold_multiplier`.
    pub high_risk_hold_multiplier: u8,
    /// Caps how many held requests one requester can have open (storage-spam guard).
    pub max_pending_per_requester: u8,
}

pub const NS_PER_SEC: u64 = 1_000_000_000;
pub const MIN_HOLD_NS: u64 = 60 * NS_PER_SEC;
pub const MAX_HOLD_NS: u64 = 7 * 24 * 60 * 60 * NS_PER_SEC;
pub const MAX_MULTIPLIER: u8 = 10;

impl Default for Policy {
    fn default() -> Self {
        Self {
            instant_limit: U128(500_000_000), // 500 tUSD at 6 decimals
            hold_window_ns: U64(30 * 60 * NS_PER_SEC),
            high_risk_hold_multiplier: 2,
            max_pending_per_requester: 5,
        }
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Unknown,
}

/// Categorical evidence about the off-chain red-flag check. No message text (G7).
#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Evidence {
    /// sha256 (64 lowercase hex chars) of the off-chain evidence bundle.
    pub evidence_hash: String,
    pub risk: RiskLevel,
    /// Flag categories only, each from `ALLOWED_FLAGS`.
    pub flags: Vec<String>,
    pub model: String,
    pub chat_id: String,
    pub signing_address: String,
    /// Reported by the app, not re-checked on-chain (client-asserted).
    pub signature_verified: bool,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Route {
    Instant,
    NeedsConfirmation,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    Pending,
    Executing,
    Executed,
    Rejected,
    Expired,
    Cancelled,
    Failed,
}

impl Status {
    /// Terminal states never change again (invariant checked in tests).
    pub fn is_terminal(self) -> bool {
        matches!(
            self,
            Status::Executed
                | Status::Rejected
                | Status::Expired
                | Status::Cancelled
                | Status::Failed
        )
    }
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PayoutRequest {
    pub id: U64,
    pub requester: AccountId,
    pub claimed_principal: AccountId,
    pub receiver_id: AccountId,
    pub amount: U128,
    pub memo: String,
    pub evidence: Option<Evidence>,
    pub route: Route,
    pub status: Status,
    pub reported_as_scam: bool,
    pub created_at_ns: U64,
    pub expires_at_ns: Option<U64>,
    pub decided_by: Option<AccountId>,
    pub decided_at_ns: Option<U64>,
    pub reason: Option<String>,
}

#[near(serializers = [borsh, json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct FlagInfo {
    pub reports: u32,
    pub first_reported_by: AccountId,
    pub first_request_id: U64,
    pub flagged_at_ns: U64,
}

// ---------- view-only shapes ----------

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct RequestView {
    #[serde(flatten)]
    pub request: PayoutRequest,
    /// `Expired` for a `Pending` request whose hold window has passed but which
    /// nobody has finalised yet.
    pub effective_status: Status,
    pub needs_sweep: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct MemberView {
    pub account_id: AccountId,
    #[serde(flatten)]
    pub member: Member,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct PayeeView {
    pub account_id: AccountId,
    #[serde(flatten)]
    pub payee: Payee,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct FlagView {
    pub account_id: AccountId,
    #[serde(flatten)]
    pub flag: FlagInfo,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct Balances {
    pub vault_balance: U128,
    pub reserved: U128,
    pub available: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug)]
pub struct Config {
    pub owner_id: AccountId,
    pub token_id: AccountId,
    pub policy: Policy,
}
