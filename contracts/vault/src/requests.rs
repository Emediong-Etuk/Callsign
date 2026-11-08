//! Deposits and the payout request lifecycle.
//!
//! ```text
//!               ┌─ instant ─► Executing ─► Executed | Failed
//! request ──────┤
//!               └─ held ────► Pending ─┬─ confirm (principal, 1 yocto) ─► Executing ─► Executed | Failed
//!                                      ├─ reject (principal/owner) ─────► Rejected (+ optional scam flag)
//!                                      ├─ cancel (requester) ───────────► Cancelled
//!                                      └─ hold window passes ───────────► Expired
//! ```

use near_sdk::json_types::{U64, U128};
use near_sdk::serde_json::json;
use near_sdk::{
    AccountId, NearToken, Promise, PromiseError, PromiseOrValue, assert_one_yocto, env,
    ext_contract, near, require,
};

use crate::errors::*;
use crate::events::emit;
use crate::policy::{assert_max_chars, assert_valid_evidence, expiry_for, route_for};
use crate::types::*;
use crate::{GAS_FT_TRANSFER, GAS_PAYOUT_CALLBACK, Vault, VaultExt};

#[allow(dead_code)]
#[ext_contract(ext_ft)]
trait FungibleTokenCore {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[near]
impl Vault {
    // ------------------------------------------------------------------
    // Deposits (NEP-141 receiver)
    // ------------------------------------------------------------------

    /// Called by a token contract after `ft_transfer_call`. Only our configured
    /// token is accepted; anything else is refunded in full.
    pub fn ft_on_transfer(
        &mut self,
        sender_id: AccountId,
        amount: U128,
        msg: String,
    ) -> PromiseOrValue<U128> {
        let _ = msg;
        // The predecessor of ft_on_transfer is the token contract itself. A
        // foreign token (or anyone calling this directly) must not be able to
        // inflate vault_balance, so it gets its full amount back.
        if env::predecessor_account_id() != self.token_id {
            return PromiseOrValue::Value(amount);
        }
        self.vault_balance = self
            .vault_balance
            .checked_add(amount.0)
            .expect("balance overflow");
        emit(
            "deposit",
            json!({ "sender_id": sender_id, "amount": amount }),
        );
        PromiseOrValue::Value(U128(0))
    }

    // ------------------------------------------------------------------
    // Requester
    // ------------------------------------------------------------------

    /// Creates a payout request. Deliberately **not payable**, so a requester can
    /// call it with a function-call access key (no wallet popup) — and that same
    /// key can't do anything that moves money by itself.
    pub fn request_payout(
        &mut self,
        claimed_principal: AccountId,
        receiver_id: AccountId,
        amount: U128,
        memo: String,
        evidence: Option<Evidence>,
    ) -> U64 {
        let caller = env::predecessor_account_id();
        let now = env::block_timestamp();

        // 1. Caller must be an active requester.
        let is_requester = self
            .members
            .get(&caller)
            .is_some_and(|m| m.active && m.has_role(Role::Requester));
        require!(is_requester, ERR_NOT_REQUESTER);

        // 2. The principal must be a real, active principal and not the caller:
        //    nobody can approve their own request.
        let is_principal = self
            .members
            .get(&claimed_principal)
            .is_some_and(|m| m.active && m.has_role(Role::Principal));
        require!(is_principal, ERR_NOT_PRINCIPAL_MEMBER);
        require!(claimed_principal != caller, ERR_SELF_APPROVAL);

        // 3. Receiver checks: flagged scam destinations are blocked outright.
        require!(!self.flags.contains_key(&receiver_id), ERR_RECEIVER_FLAGGED);
        require!(
            receiver_id != env::current_account_id() && receiver_id != self.token_id,
            ERR_INVALID_RECEIVER
        );

        // 4. Amount must be positive and covered by unreserved funds, so two
        //    held requests can never both claim the same tokens.
        require!(amount.0 > 0, ERR_INVALID_AMOUNT);
        require!(amount.0 <= self.available(), ERR_INSUFFICIENT_AVAILABLE);

        // 5. Storage-spam guard.
        let pending = self.pending_by_requester.get(&caller).copied().unwrap_or(0);
        require!(
            pending < self.policy.max_pending_per_requester,
            ERR_TOO_MANY_PENDING
        );

        // 6. Bounded inputs. Evidence is categorical only (G7).
        assert_max_chars(&memo, MAX_MEMO_LEN);
        if let Some(e) = &evidence {
            assert_valid_evidence(e);
        }

        // 7. Routing. AI risk can only add friction (G5).
        let risk = evidence.as_ref().map_or(RiskLevel::Unknown, |e| e.risk);
        let known_payee = self.payees.contains_key(&receiver_id);
        let route = route_for(known_payee, amount.0, self.policy.instant_limit.0, risk);

        let id = self.next_id;
        self.next_id += 1;
        self.requests_by_requester
            .entry(caller.clone())
            .or_default()
            .push(id);

        let mut req = PayoutRequest {
            id: U64(id),
            requester: caller.clone(),
            claimed_principal: claimed_principal.clone(),
            receiver_id: receiver_id.clone(),
            amount,
            memo,
            evidence,
            route,
            status: Status::Pending,
            reported_as_scam: false,
            created_at_ns: U64(now),
            expires_at_ns: None,
            decided_by: None,
            decided_at_ns: None,
            reason: None,
        };

        let flags: Vec<String> = req
            .evidence
            .as_ref()
            .map(|e| e.flags.clone())
            .unwrap_or_default();

        match route {
            Route::Instant => {
                // 8. Deduct BEFORE the cross-contract call: if anything re-enters
                //    while the promise is in flight, the funds are already gone
                //    from `available`. The callback restores them on failure.
                req.status = Status::Executing;
                self.vault_balance -= amount.0;
                self.save_request(req);
                emit(
                    "payout_requested",
                    json!({ "id": U64(id), "requester": caller, "claimed_principal": claimed_principal,
                            "receiver_id": receiver_id, "amount": amount, "route": route,
                            "risk": risk, "flags": flags }),
                );
                emit("payout_executing", json!({ "id": U64(id) }));
                self.transfer_out(id, receiver_id, amount).detach();
            }
            Route::NeedsConfirmation => {
                // 9. Hold: reserve the funds and start the clock.
                let expires = expiry_for(now, &self.policy, risk);
                req.expires_at_ns = Some(U64(expires));
                self.reserved += amount.0;
                self.pending_ids.insert(id);
                self.pending_by_requester.insert(caller.clone(), pending + 1);
                self.save_request(req);
                emit(
                    "payout_requested",
                    json!({ "id": U64(id), "requester": caller, "claimed_principal": claimed_principal,
                            "receiver_id": receiver_id, "amount": amount, "route": route,
                            "risk": risk, "flags": flags, "expires_at_ns": U64(expires) }),
                );
            }
        }
        U64(id)
    }

    /// The requester withdraws their own held request.
    pub fn cancel_payout(&mut self, id: U64) {
        let mut req = self.get_request_or_panic(id.0);
        require!(
            req.requester == env::predecessor_account_id(),
            ERR_NOT_YOUR_REQUEST
        );
        require!(req.status == Status::Pending, ERR_NOT_PENDING);
        self.release_pending(&req);
        req.status = Status::Cancelled;
        req.decided_by = Some(env::predecessor_account_id());
        req.decided_at_ns = Some(U64(env::block_timestamp()));
        self.save_request(req);
        emit("payout_cancelled", json!({ "id": id }));
    }

    // ------------------------------------------------------------------
    // Principal
    // ------------------------------------------------------------------

    /// The claimed principal releases a held payout.
    ///
    /// G2: exactly 1 yoctoNEAR must be attached. NEAR function-call access keys
    /// cannot attach deposits, so this call can only be signed with a
    /// full-access key — a real wallet approval by the principal.
    #[payable]
    pub fn confirm_payout(&mut self, id: U64) -> PromiseOrValue<bool> {
        assert_one_yocto();
        let mut req = self.get_request_or_panic(id.0);
        // Only the person the request claims to come from can release it.
        require!(
            env::predecessor_account_id() == req.claimed_principal,
            ERR_NOT_PRINCIPAL
        );
        require!(req.status == Status::Pending, ERR_NOT_PENDING);

        let now = env::block_timestamp();
        if Self::is_expired(&req, now) {
            // G3: too late. Finalise as Expired WITHOUT panicking — a panic
            // would roll back this write and leave the request Pending.
            self.release_pending(&req);
            req.status = Status::Expired;
            req.decided_at_ns = Some(U64(now));
            self.save_request(req);
            emit("payout_expired", json!({ "id": id }));
            return PromiseOrValue::Value(false);
        }

        // Move the amount from "reserved" to "sent" before the promise.
        self.reserved -= req.amount.0;
        self.vault_balance -= req.amount.0;
        self.pending_ids.remove(&id.0);
        self.decrement_pending(&req.requester);
        req.status = Status::Executing;
        req.decided_by = Some(env::predecessor_account_id());
        req.decided_at_ns = Some(U64(now));
        let (receiver, amount) = (req.receiver_id.clone(), req.amount);
        self.save_request(req);
        emit("payout_executing", json!({ "id": id }));
        PromiseOrValue::Promise(self.transfer_out(id.0, receiver, amount))
    }

    /// The claimed principal (or the owner) refuses a held payout. With
    /// `report_scam`, the receiver is flagged and blocked for new requests (G6).
    /// No deposit needed: rejecting can only make things safer.
    pub fn reject_payout(&mut self, id: U64, reason: Option<String>, report_scam: bool) {
        let caller = env::predecessor_account_id();
        let mut req = self.get_request_or_panic(id.0);
        require!(
            caller == req.claimed_principal || caller == self.owner_id,
            ERR_NOT_AUTHORIZED_TO_REJECT
        );
        require!(req.status == Status::Pending, ERR_NOT_PENDING);
        if let Some(r) = &reason {
            assert_max_chars(r, MAX_REASON_LEN);
        }
        let now = env::block_timestamp();
        self.release_pending(&req);
        req.status = Status::Rejected;
        req.decided_by = Some(caller.clone());
        req.decided_at_ns = Some(U64(now));
        req.reason = reason;
        req.reported_as_scam = report_scam;
        let receiver = req.receiver_id.clone();
        self.save_request(req);
        emit(
            "payout_rejected",
            json!({ "id": id, "by": caller, "report_scam": report_scam }),
        );

        if report_scam {
            let info = match self.flags.get(&receiver) {
                Some(existing) => FlagInfo {
                    reports: existing.reports.saturating_add(1),
                    ..existing.clone()
                },
                None => FlagInfo {
                    reports: 1,
                    first_reported_by: caller.clone(),
                    first_request_id: id,
                    flagged_at_ns: U64(now),
                },
            };
            let reports = info.reports;
            self.flags.insert(receiver.clone(), info);
            emit(
                "receiver_flagged",
                json!({ "account_id": receiver, "request_id": id, "reported_by": caller, "reports": reports }),
            );
        }
    }

    // ------------------------------------------------------------------
    // Anyone
    // ------------------------------------------------------------------

    /// Finalises one held request whose hold window has passed.
    pub fn expire_payout(&mut self, id: U64) {
        let req = self.get_request_or_panic(id.0);
        require!(req.status == Status::Pending, ERR_NOT_PENDING);
        require!(
            Self::is_expired(&req, env::block_timestamp()),
            ERR_NOT_EXPIRED
        );
        self.finalize_expired(req);
    }

    /// Finalises up to `limit` expired held requests. Returns how many.
    pub fn sweep_expired(&mut self, limit: u32) -> u32 {
        let now = env::block_timestamp();
        let limit = limit.min(crate::MAX_PAGE) as usize;
        let expired: Vec<PayoutRequest> = self
            .pending_ids
            .iter()
            .filter_map(|id| self.requests.get(id))
            .filter(|r| Self::is_expired(r, now))
            .take(limit)
            .cloned()
            .collect();
        let n = expired.len() as u32;
        for req in expired {
            self.finalize_expired(req);
        }
        n
    }

    // ------------------------------------------------------------------
    // Callback
    // ------------------------------------------------------------------

    /// Result of the `ft_transfer`. `#[private]`: only the vault itself can call it,
    /// otherwise anyone could mark a payout as failed and re-credit the balance.
    #[private]
    pub fn on_payout_complete(&mut self, id: U64) -> bool {
        let mut req = self.get_request_or_panic(id.0);
        // Only an in-flight payout may be resolved (terminal states never change).
        require!(req.status == Status::Executing, ERR_NOT_PENDING);
        // ft_transfer returns no value. Only `Failed` means the tokens did not
        // move; `TooLong` would still be a successful call, so it must not
        // re-credit the balance.
        let ok = !matches!(
            env::promise_result_checked(0, 0),
            Err(PromiseError::Failed)
        );
        if ok {
            req.status = Status::Executed;
            self.save_request(req);
            emit("payout_executed", json!({ "id": id }));
        } else {
            // The transfer failed (e.g. receiver not storage-registered), so the
            // tokens never left: put them back on the books.
            self.vault_balance += req.amount.0;
            req.status = Status::Failed;
            self.save_request(req);
            emit("payout_failed", json!({ "id": id }));
        }
        ok
    }
}

impl Vault {
    fn transfer_out(&self, id: u64, receiver_id: AccountId, amount: U128) -> Promise {
        // NEP-141 ft_transfer requires exactly 1 yocto attached.
        ext_ft::ext(self.token_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FT_TRANSFER)
            .ft_transfer(receiver_id, amount, Some(format!("callsign:#{id}")))
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_PAYOUT_CALLBACK)
                    .on_payout_complete(U64(id)),
            )
    }

    fn finalize_expired(&mut self, mut req: PayoutRequest) {
        self.release_pending(&req);
        req.status = Status::Expired;
        req.decided_at_ns = Some(U64(env::block_timestamp()));
        let id = req.id;
        self.save_request(req);
        emit("payout_expired", json!({ "id": id }));
    }
}
