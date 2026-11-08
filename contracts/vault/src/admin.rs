//! Owner-only configuration. Every method is `#[payable]` + `assert_one_yocto()`
//! so it needs a full-access key (wallet approval), and checks the caller is the owner.

use near_sdk::json_types::U64;
use near_sdk::serde_json::json;
use near_sdk::{AccountId, assert_one_yocto, env, near, require};

use crate::errors::*;
use crate::events::emit;
use crate::policy::{assert_max_chars, assert_valid_policy};
use crate::types::*;
use crate::{Vault, VaultExt};

#[near]
impl Vault {
    /// Adds a member, or updates one that already exists.
    #[payable]
    pub fn add_member(
        &mut self,
        account_id: AccountId,
        display_name: String,
        title: String,
        roles: Vec<Role>,
    ) {
        assert_one_yocto();
        self.assert_owner();
        assert_max_chars(&display_name, MAX_NAME_LEN);
        assert_max_chars(&title, MAX_NAME_LEN);
        require!(!roles.is_empty() && roles.len() <= 2, ERR_INPUT_BOUNDS);
        let mut roles_dedup: Vec<Role> = Vec::new();
        for r in roles {
            if !roles_dedup.contains(&r) {
                roles_dedup.push(r);
            }
        }
        let existed = self.members.contains_key(&account_id);
        let member = Member {
            display_name,
            title,
            roles: roles_dedup,
            active: true,
        };
        self.members.insert(account_id.clone(), member.clone());
        emit(
            if existed {
                "member_updated"
            } else {
                "member_added"
            },
            json!({ "account_id": account_id, "display_name": member.display_name,
                    "title": member.title, "roles": member.roles, "active": true }),
        );
    }

    #[payable]
    pub fn set_member_active(&mut self, account_id: AccountId, active: bool) {
        assert_one_yocto();
        self.assert_owner();
        let member = self
            .members
            .get_mut(&account_id)
            .unwrap_or_else(|| env::panic_str(ERR_MEMBER_NOT_FOUND));
        member.active = active;
        emit(
            "member_updated",
            json!({ "account_id": account_id, "active": active }),
        );
    }

    #[payable]
    pub fn add_payee(&mut self, account_id: AccountId, label: String) {
        assert_one_yocto();
        self.assert_owner();
        assert_max_chars(&label, MAX_NAME_LEN);
        // Paying the vault or the token contract itself makes no sense and
        // could confuse accounting.
        require!(
            account_id != env::current_account_id() && account_id != self.token_id,
            ERR_INVALID_RECEIVER
        );
        let payee = Payee {
            label,
            added_at_ns: U64(env::block_timestamp()),
        };
        self.payees.insert(account_id.clone(), payee.clone());
        emit(
            "payee_added",
            json!({ "account_id": account_id, "label": payee.label }),
        );
    }

    #[payable]
    pub fn remove_payee(&mut self, account_id: AccountId) {
        assert_one_yocto();
        self.assert_owner();
        require!(
            self.payees.remove(&account_id).is_some(),
            ERR_PAYEE_NOT_FOUND
        );
        emit("payee_removed", json!({ "account_id": account_id }));
    }

    #[payable]
    pub fn set_policy(&mut self, policy: Policy) {
        assert_one_yocto();
        self.assert_owner();
        assert_valid_policy(&policy);
        self.policy = policy.clone();
        // Applies to new requests only; existing holds keep their expiry.
        emit("policy_updated", json!({ "policy": policy }));
    }

    #[payable]
    pub fn clear_flag(&mut self, receiver_id: AccountId) {
        assert_one_yocto();
        self.assert_owner();
        require!(self.flags.remove(&receiver_id).is_some(), ERR_NOT_FLAGGED);
        emit("flag_cleared", json!({ "account_id": receiver_id }));
    }
}
