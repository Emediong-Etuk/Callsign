//! Unit tests (mocked blockchain via `testing_env!`) for routing, expiry
//! arithmetic, validation and state transitions that don't need a real token.

use super::*;
use crate::policy::*;
use near_sdk::json_types::{U64, U128};
use near_sdk::test_utils::VMContextBuilder;
use near_sdk::{NearToken, PromiseOrValue, testing_env};

const TOKEN: &str = "token.test.near";
const VAULT: &str = "vault.test.near";
const OWNER: &str = "owner.test.near";
const CEO: &str = "ceo.test.near";
const FIN: &str = "finance.test.near";
const VENDOR: &str = "vendor.test.near";
const NEWBIE: &str = "new.test.near";
const T0: u64 = 1_000 * NS_PER_SEC;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn set_ctx(predecessor: &str, deposit: u128, now: u64) {
    testing_env!(
        VMContextBuilder::new()
            .current_account_id(acc(VAULT))
            .predecessor_account_id(acc(predecessor))
            .signer_account_id(acc(predecessor))
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(now)
            .build()
    );
}

fn evidence(risk: RiskLevel) -> Evidence {
    Evidence {
        evidence_hash: "a".repeat(64),
        risk,
        flags: vec!["urgency".into()],
        model: "m".into(),
        chat_id: "c".into(),
        signing_address: "0xabc".into(),
        signature_verified: true,
    }
}

/// Vault with owner, CEO principal, finance requester, a known vendor, 10_000 tokens.
fn setup() -> Vault {
    set_ctx(OWNER, 0, T0);
    let mut v = Vault::new(acc(OWNER), acc(TOKEN), None);
    set_ctx(OWNER, 1, T0);
    v.add_member(acc(CEO), "Ada".into(), "CEO".into(), vec![Role::Principal]);
    v.add_member(acc(FIN), "Tolu".into(), "Finance".into(), vec![Role::Requester]);
    v.add_payee(acc(VENDOR), "Harbor".into());
    set_ctx(TOKEN, 0, T0);
    let _ = v.ft_on_transfer(acc(OWNER), U128(10_000_000_000), String::new());
    v
}

fn assert_invariants(v: &Vault) {
    assert!(v.reserved <= v.vault_balance);
}

#[test]
fn routing_rules() {
    // known payee, under limit, not high → instant
    assert_eq!(route_for(true, 100, 500, RiskLevel::Low), Route::Instant);
    assert_eq!(route_for(true, 500, 500, RiskLevel::Unknown), Route::Instant);
    assert_eq!(route_for(true, 500, 500, RiskLevel::Medium), Route::Instant);
    // any single condition failing → hold
    assert_eq!(
        route_for(false, 1, 500, RiskLevel::Low),
        Route::NeedsConfirmation
    );
    assert_eq!(
        route_for(true, 501, 500, RiskLevel::Low),
        Route::NeedsConfirmation
    );
    assert_eq!(
        route_for(true, 1, 500, RiskLevel::High),
        Route::NeedsConfirmation
    );
    // G5: a Low verdict never rescues a new payee or a big amount
    assert_eq!(
        route_for(false, 10_000, 500, RiskLevel::Low),
        Route::NeedsConfirmation
    );
}

#[test]
fn expiry_arithmetic() {
    let p = Policy::default();
    let hold = p.hold_window_ns.0;
    assert_eq!(expiry_for(T0, &p, RiskLevel::Low), T0 + hold);
    assert_eq!(expiry_for(T0, &p, RiskLevel::Unknown), T0 + hold);
    assert_eq!(expiry_for(T0, &p, RiskLevel::High), T0 + 2 * hold);
    // saturates instead of wrapping
    assert_eq!(expiry_for(u64::MAX - 1, &p, RiskLevel::High), u64::MAX);
}

#[test]
#[should_panic(expected = "ERR_INVALID_POLICY")]
fn policy_rejects_short_hold() {
    let p = Policy {
        hold_window_ns: U64(59 * NS_PER_SEC),
        ..Policy::default()
    };
    assert_valid_policy(&p);
}

#[test]
#[should_panic(expected = "ERR_INVALID_POLICY")]
fn policy_rejects_long_hold() {
    let p = Policy {
        hold_window_ns: U64(MAX_HOLD_NS + 1),
        ..Policy::default()
    };
    assert_valid_policy(&p);
}

#[test]
#[should_panic(expected = "ERR_INVALID_POLICY")]
fn policy_rejects_zero_limit() {
    let p = Policy {
        instant_limit: U128(0),
        ..Policy::default()
    };
    assert_valid_policy(&p);
}

#[test]
#[should_panic(expected = "ERR_INPUT_BOUNDS")]
fn evidence_rejects_uppercase_hash() {
    let mut e = evidence(RiskLevel::Low);
    e.evidence_hash = "A".repeat(64);
    assert_valid_evidence(&e);
}

#[test]
#[should_panic(expected = "ERR_INPUT_BOUNDS")]
fn evidence_rejects_duplicate_flags() {
    let mut e = evidence(RiskLevel::Low);
    e.flags = vec!["urgency".into(), "urgency".into()];
    assert_valid_evidence(&e);
}

#[test]
#[should_panic(expected = "ERR_UNKNOWN_FLAG")]
fn evidence_rejects_free_text_flag() {
    let mut e = evidence(RiskLevel::Low);
    e.flags = vec!["send to new wallet".into()];
    assert_valid_evidence(&e);
}

#[test]
fn foreign_token_deposit_is_refunded() {
    let mut v = setup();
    set_ctx("evil-token.test.near", 0, T0);
    match v.ft_on_transfer(acc(OWNER), U128(77), String::new()) {
        PromiseOrValue::Value(refund) => assert_eq!(refund.0, 77),
        PromiseOrValue::Promise(_) => panic!("expected value"),
    }
    assert_eq!(v.vault_balance, 10_000_000_000);
}

#[test]
fn held_request_reserves_and_high_risk_doubles_hold() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(
        acc(CEO),
        acc(VENDOR),
        U128(1_000_000),
        String::new(),
        Some(evidence(RiskLevel::High)),
    );
    let r = v.get_request(id).unwrap();
    assert_eq!(r.request.status, Status::Pending);
    assert_eq!(r.request.route, Route::NeedsConfirmation);
    assert_eq!(
        r.request.expires_at_ns.unwrap().0,
        T0 + 2 * Policy::default().hold_window_ns.0
    );
    assert_eq!(v.reserved, 1_000_000);
    assert_invariants(&v);
}

#[test]
fn instant_request_deducts_before_promise() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(VENDOR), U128(200_000_000), String::new(), None);
    let r = v.get_request(id).unwrap();
    assert_eq!(r.request.status, Status::Executing);
    assert_eq!(v.vault_balance, 10_000_000_000 - 200_000_000);
    assert_eq!(v.reserved, 0);
}

#[test]
fn confirm_after_expiry_returns_false_and_releases() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(NEWBIE), U128(5_000_000), String::new(), None);
    let hold = Policy::default().hold_window_ns.0;
    set_ctx(CEO, 1, T0 + hold); // exactly at expiry counts as expired
    match v.confirm_payout(id) {
        PromiseOrValue::Value(ok) => assert!(!ok),
        PromiseOrValue::Promise(_) => panic!("must not execute after expiry"),
    }
    assert_eq!(v.get_request(id).unwrap().request.status, Status::Expired);
    assert_eq!(v.reserved, 0);
    assert_eq!(v.pending_by_requester.get(&acc(FIN)), None);
    assert_invariants(&v);
}

#[test]
fn view_reports_effective_expired_before_sweep() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(NEWBIE), U128(5), String::new(), None);
    set_ctx(OWNER, 0, T0 + MAX_HOLD_NS);
    let view = v.get_request(id).unwrap();
    assert_eq!(view.request.status, Status::Pending);
    assert_eq!(view.effective_status, Status::Expired);
    assert!(view.needs_sweep);
    assert_eq!(v.sweep_expired(10), 1);
    assert_eq!(v.get_request(id).unwrap().effective_status, Status::Expired);
}

#[test]
#[should_panic(expected = "ERR_NOT_EXPIRED")]
fn expire_before_deadline_fails() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(NEWBIE), U128(5), String::new(), None);
    v.expire_payout(id);
}

#[test]
fn reject_with_report_flags_receiver() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(NEWBIE), U128(5), String::new(), None);
    set_ctx(CEO, 0, T0 + 1);
    v.reject_payout(id, Some("I never asked".into()), true);
    let f = v.get_flag(acc(NEWBIE)).unwrap();
    assert_eq!(f.reports, 1);
    assert_eq!(f.first_request_id, id);
    let r = v.get_request(id).unwrap().request;
    assert_eq!(r.status, Status::Rejected);
    assert!(r.reported_as_scam);
    assert_eq!(v.reserved, 0);
}

#[test]
#[should_panic(expected = "ERR_RECEIVER_FLAGGED")]
fn flagged_receiver_is_blocked() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(NEWBIE), U128(5), String::new(), None);
    set_ctx(CEO, 0, T0 + 1);
    v.reject_payout(id, None, true);
    set_ctx(FIN, 0, T0 + 2);
    v.request_payout(acc(CEO), acc(NEWBIE), U128(5), String::new(), None);
}

#[test]
#[should_panic(expected = "ERR_NOT_YOUR_REQUEST")]
fn only_requester_can_cancel() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(NEWBIE), U128(5), String::new(), None);
    set_ctx(CEO, 0, T0);
    v.cancel_payout(id);
}

#[test]
#[should_panic(expected = "ERR_NOT_AUTHORIZED_TO_REJECT")]
fn stranger_cannot_reject() {
    let mut v = setup();
    set_ctx(FIN, 0, T0);
    let id = v.request_payout(acc(CEO), acc(NEWBIE), U128(5), String::new(), None);
    // The requester can't reject (and so can't flag arbitrary receivers either).
    v.reject_payout(id, None, true);
}

#[test]
fn inactive_member_cannot_request() {
    let mut v = setup();
    set_ctx(OWNER, 1, T0);
    v.set_member_active(acc(FIN), false);
    set_ctx(FIN, 0, T0);
    let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        v.request_payout(acc(CEO), acc(VENDOR), U128(5), String::new(), None)
    }));
    assert!(r.is_err());
}

#[test]
fn error_list_is_complete_and_unique() {
    let mut seen = std::collections::HashSet::new();
    for e in crate::errors::ALL_ERRORS {
        assert!(e.starts_with("ERR_"));
        assert!(seen.insert(*e), "duplicate {e}");
    }
}
