//! Read-only views.

use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, env, near};

use crate::errors::ALL_ERRORS;
use crate::types::*;
use crate::{MAX_PAGE, Vault, VaultExt};

fn page(from_index: Option<u32>, limit: Option<u32>) -> (usize, usize) {
    (
        from_index.unwrap_or(0) as usize,
        limit.unwrap_or(MAX_PAGE).min(MAX_PAGE) as usize,
    )
}

#[near]
impl Vault {
    pub fn get_config(&self) -> Config {
        Config {
            owner_id: self.owner_id.clone(),
            token_id: self.token_id.clone(),
            policy: self.policy.clone(),
        }
    }

    pub fn get_balances(&self) -> Balances {
        Balances {
            vault_balance: U128(self.vault_balance),
            reserved: U128(self.reserved),
            available: U128(self.available()),
        }
    }

    pub fn get_member(&self, account_id: AccountId) -> Option<Member> {
        self.members.get(&account_id).cloned()
    }

    pub fn list_members(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<MemberView> {
        let (from, n) = page(from_index, limit);
        self.members
            .iter()
            .skip(from)
            .take(n)
            .map(|(id, m)| MemberView {
                account_id: id.clone(),
                member: m.clone(),
            })
            .collect()
    }

    pub fn is_known_payee(&self, account_id: AccountId) -> bool {
        self.payees.contains_key(&account_id)
    }

    pub fn list_payees(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<PayeeView> {
        let (from, n) = page(from_index, limit);
        self.payees
            .iter()
            .skip(from)
            .take(n)
            .map(|(id, p)| PayeeView {
                account_id: id.clone(),
                payee: p.clone(),
            })
            .collect()
    }

    pub fn get_request(&self, id: U64) -> Option<RequestView> {
        self.requests.get(&id.0).map(|r| self.to_view(r))
    }

    /// Newest first. `from_index` counts back from the newest request.
    pub fn list_requests(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<RequestView> {
        let (from, n) = page(from_index, limit);
        let newest = self.next_id.saturating_sub(1);
        (1..=newest)
            .rev()
            .skip(from)
            .take(n)
            .filter_map(|id| self.requests.get(&id))
            .map(|r| self.to_view(r))
            .collect()
    }

    /// Held requests waiting for this principal (oldest first), including ones
    /// past expiry that haven't been swept (shown with `effective_status = Expired`).
    pub fn list_pending_for_principal(&self, account_id: AccountId) -> Vec<RequestView> {
        let mut out: Vec<RequestView> = self
            .pending_ids
            .iter()
            .filter_map(|id| self.requests.get(id))
            .filter(|r| r.claimed_principal == account_id)
            .map(|r| self.to_view(r))
            .collect();
        out.sort_by_key(|v| v.request.id.0);
        out
    }

    /// Newest first.
    pub fn list_requests_by_requester(
        &self,
        account_id: AccountId,
        limit: Option<u32>,
    ) -> Vec<RequestView> {
        let n = limit.unwrap_or(MAX_PAGE).min(MAX_PAGE) as usize;
        self.requests_by_requester
            .get(&account_id)
            .map(|ids| {
                ids.iter()
                    .rev()
                    .take(n)
                    .filter_map(|id| self.requests.get(id))
                    .map(|r| self.to_view(r))
                    .collect()
            })
            .unwrap_or_default()
    }

    pub fn get_flag(&self, account_id: AccountId) -> Option<FlagInfo> {
        self.flags.get(&account_id).cloned()
    }

    pub fn list_flags(&self, from_index: Option<u32>, limit: Option<u32>) -> Vec<FlagView> {
        let (from, n) = page(from_index, limit);
        self.flags
            .iter()
            .skip(from)
            .take(n)
            .map(|(id, f)| FlagView {
                account_id: id.clone(),
                flag: f.clone(),
            })
            .collect()
    }

    /// The flag categories the vault accepts (must equal `shared/flags.json`).
    pub fn allowed_flags(&self) -> Vec<String> {
        ALLOWED_FLAGS.iter().map(|s| s.to_string()).collect()
    }

    /// Every `ERR_*` code the vault can return.
    pub fn list_errors(&self) -> Vec<String> {
        ALL_ERRORS.iter().map(|s| s.to_string()).collect()
    }
}

impl Vault {
    fn to_view(&self, r: &PayoutRequest) -> RequestView {
        let overdue = r.status == Status::Pending && Self::is_expired(r, env::block_timestamp());
        RequestView {
            request: r.clone(),
            effective_status: if overdue { Status::Expired } else { r.status },
            needs_sweep: overdue,
        }
    }
}
