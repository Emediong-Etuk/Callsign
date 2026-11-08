//! Pure policy logic (no storage access), so it can be unit tested directly.

use crate::errors::*;
use crate::types::*;
use near_sdk::require;

/// Routing rule (step 7 of `request_payout`).
/// Instant only if: known payee AND amount <= instant_limit AND risk != High.
/// Note what is *not* here: a `Low` risk can never turn a held request into an
/// instant one, because risk only appears as an extra condition for holding (G5).
pub fn route_for(known_payee: bool, amount: u128, instant_limit: u128, risk: RiskLevel) -> Route {
    if known_payee && amount <= instant_limit && risk != RiskLevel::High {
        Route::Instant
    } else {
        Route::NeedsConfirmation
    }
}

/// Expiry for a held request. High risk waits longer (more time for the real
/// principal to notice), never shorter.
pub fn expiry_for(now_ns: u64, policy: &Policy, risk: RiskLevel) -> u64 {
    let multiplier = if risk == RiskLevel::High {
        u64::from(policy.high_risk_hold_multiplier)
    } else {
        1
    };
    // saturating: a huge window must not wrap around to "already expired".
    now_ns.saturating_add(policy.hold_window_ns.0.saturating_mul(multiplier))
}

pub fn assert_valid_policy(policy: &Policy) {
    require!(policy.instant_limit.0 > 0, ERR_INVALID_POLICY);
    require!(
        (MIN_HOLD_NS..=MAX_HOLD_NS).contains(&policy.hold_window_ns.0),
        ERR_INVALID_POLICY
    );
    require!(
        (1..=MAX_MULTIPLIER).contains(&policy.high_risk_hold_multiplier),
        ERR_INVALID_POLICY
    );
    require!(policy.max_pending_per_requester > 0, ERR_INVALID_POLICY);
}

fn is_lower_hex(s: &str) -> bool {
    s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// Bounds and allow-list checks on the categorical evidence (step 6).
pub fn assert_valid_evidence(e: &Evidence) {
    require!(
        e.evidence_hash.len() == EVIDENCE_HASH_LEN && is_lower_hex(&e.evidence_hash),
        ERR_INPUT_BOUNDS
    );
    require!(e.flags.len() <= MAX_FLAGS, ERR_INPUT_BOUNDS);
    for (i, flag) in e.flags.iter().enumerate() {
        require!(flag.len() <= MAX_FLAG_LEN, ERR_INPUT_BOUNDS);
        // Only known categories: stops anyone smuggling message text on-chain
        // inside a "flag" (G7).
        require!(ALLOWED_FLAGS.contains(&flag.as_str()), ERR_UNKNOWN_FLAG);
        require!(!e.flags[..i].contains(flag), ERR_INPUT_BOUNDS);
    }
    require!(e.model.len() <= MAX_MODEL_LEN, ERR_INPUT_BOUNDS);
    require!(e.chat_id.len() <= MAX_CHAT_ID_LEN, ERR_INPUT_BOUNDS);
    require!(
        e.signing_address.len() <= MAX_SIGNING_ADDRESS_LEN,
        ERR_INPUT_BOUNDS
    );
}

/// String length check in characters (the UI counts characters, not bytes).
pub fn assert_max_chars(s: &str, max: usize) {
    require!(s.chars().count() <= max, ERR_INPUT_BOUNDS);
}
