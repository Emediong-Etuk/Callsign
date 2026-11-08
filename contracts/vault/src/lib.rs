//! # Callsign vault
//!
//! Holds a company's NEP-141 funds and applies a payment policy:
//! routine payouts (known payee, under the instant limit, not high risk) go
//! out immediately; everything else is **held** until the person the request
//! claims to come from (the "claimed principal") confirms it from their own
//! account with a 1 yoctoNEAR deposit (which forces a full-access key, i.e. a
//! real wallet approval). Unconfirmed requests expire; rejected-as-scam
//! receivers are flagged and blocked.
//!
//! Not upgradeable: there is no code-upgrade method. Owner powers are listed in
//! `docs/THREAT_MODEL.md`.

pub mod admin;
pub mod errors;
pub mod events;
pub mod policy;
pub mod requests;
pub mod types;
pub mod views;

use near_sdk::borsh::BorshSerialize;
use near_sdk::store::{IterableMap, IterableSet, LookupMap};
use near_sdk::{AccountId, BorshStorageKey, Gas, PanicOnDefault, env, near, require};

use crate::errors::*;
use crate::types::*;

/// Gas for the cross-contract `ft_transfer` (a simple NEP-141 transfer).
pub const GAS_FT_TRANSFER: Gas = Gas::from_tgas(15);
/// Gas reserved for our own `on_payout_complete` callback.
pub const GAS_PAYOUT_CALLBACK: Gas = Gas::from_tgas(15);
/// Max items returned by list views.
pub const MAX_PAGE: u32 = 50;

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    Members,
    Payees,
    Requests,
    PendingIds,
    PendingByRequester,
    RequestsByRequester,
    Flags,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Vault {
    owner_id: AccountId,
    /// The only NEP-141 token this vault accepts and pays out.
    token_id: AccountId,
    policy: Policy,
    members: IterableMap<AccountId, Member>,
    payees: IterableMap<AccountId, Payee>,
    /// Request ids are 1..next_id, every id present (append-only history).
    requests: LookupMap<u64, PayoutRequest>,
    /// Ids currently in `Pending`; lets sweeps and principal inboxes avoid scanning history.
    pending_ids: IterableSet<u64>,
    next_id: u64,
    /// Tokens the vault accounts for (deposits via ft_transfer_call minus payouts).
    vault_balance: u128,
    /// Sum of amounts in held (Pending) requests. Always <= vault_balance.
    reserved: u128,
    pending_by_requester: LookupMap<AccountId, u8>,
    requests_by_requester: LookupMap<AccountId, Vec<u64>>,
    flags: IterableMap<AccountId, FlagInfo>,
}

#[near]
impl Vault {
    #[init]
    pub fn new(owner_id: AccountId, token_id: AccountId, policy: Option<Policy>) -> Self {
        let policy = policy.unwrap_or_default();
        policy::assert_valid_policy(&policy);
        Self {
            owner_id,
            token_id,
            policy,
            members: IterableMap::new(StorageKey::Members),
            payees: IterableMap::new(StorageKey::Payees),
            requests: LookupMap::new(StorageKey::Requests),
            pending_ids: IterableSet::new(StorageKey::PendingIds),
            next_id: 1,
            vault_balance: 0,
            reserved: 0,
            pending_by_requester: LookupMap::new(StorageKey::PendingByRequester),
            requests_by_requester: LookupMap::new(StorageKey::RequestsByRequester),
            flags: IterableMap::new(StorageKey::Flags),
        }
    }
}

// ---------- internal helpers (not exposed as contract methods) ----------
impl Vault {
    pub(crate) fn assert_owner(&self) {
        // Owner-only methods also require 1 yocto (checked by the caller) so a
        // leaked function-call key of the owner can't change policy.
        require!(env::predecessor_account_id() == self.owner_id, ERR_NOT_OWNER);
    }

    pub(crate) fn available(&self) -> u128 {
        // reserved <= vault_balance is an invariant; checked_sub makes a
        // violation abort loudly instead of wrapping.
        self.vault_balance
            .checked_sub(self.reserved)
            .expect("invariant: reserved <= vault_balance")
    }

    pub(crate) fn get_request_or_panic(&self, id: u64) -> PayoutRequest {
        self.requests
            .get(&id)
            .cloned()
            .unwrap_or_else(|| env::panic_str(ERR_REQUEST_NOT_FOUND))
    }

    pub(crate) fn save_request(&mut self, req: PayoutRequest) {
        self.requests.insert(req.id.0, req);
    }

    pub(crate) fn is_expired(req: &PayoutRequest, now_ns: u64) -> bool {
        matches!(req.expires_at_ns, Some(exp) if now_ns >= exp.0)
    }

    /// Leaves `Pending` for a non-executing outcome: releases the reservation
    /// and the requester's pending slot. Caller sets the new status.
    pub(crate) fn release_pending(&mut self, req: &PayoutRequest) {
        self.reserved = self
            .reserved
            .checked_sub(req.amount.0)
            .expect("invariant: reserved covers every pending request");
        self.pending_ids.remove(&req.id.0);
        self.decrement_pending(&req.requester);
    }

    pub(crate) fn decrement_pending(&mut self, requester: &AccountId) {
        let count = self.pending_by_requester.get(requester).copied().unwrap_or(0);
        if count <= 1 {
            self.pending_by_requester.remove(requester);
        } else {
            self.pending_by_requester.insert(requester.clone(), count - 1);
        }
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod unit_tests;
