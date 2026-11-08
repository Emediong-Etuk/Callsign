//! Integration tests T1–T16 (near-workspaces sandbox). Each test name starts
//! with its ID from CALLSIGN_BUILD_PROMPT.md §6 / the README guarantees table.

mod common;

use common::*;
use near_workspaces::Account;
use near_workspaces::types::{AccessKey, Gas, KeyType, NearToken, SecretKey};
use serde_json::{Value, json};
use std::collections::BTreeSet;

/// T1 — deposits: tUSD via ft_transfer_call is credited; a foreign token is refunded in full.
#[tokio::test]
async fn t1_deposit_credits_token_and_refunds_foreign_token() -> anyhow::Result<()> {
    let env = setup(false).await?;
    deposit(&env, 1_234 * TUSD).await?;
    let (vb, reserved, _) = balances(&env).await?;
    assert_eq!(vb, 1_234 * TUSD);
    assert_eq!(reserved, 0);

    // A second, foreign token (same code, different account) tries to deposit.
    let foreign_acc = env
        .worker
        .root_account()?
        .create_subaccount("foreign")
        .initial_balance(NearToken::from_near(20))
        .transact()
        .await?
        .into_result()?;
    let foreign = foreign_acc
        .deploy(token_wasm().await)
        .await?
        .into_result()?;
    foreign
        .call("new")
        .args_json(json!({ "owner_id": env.owner.id(), "total_supply": SUPPLY.to_string() }))
        .transact()
        .await?
        .into_result()?;
    register(&foreign, &env.owner, env.vault.id().as_str()).await?;
    let res = env
        .owner
        .call(foreign.id(), "ft_transfer_call")
        .args_json(
            json!({ "receiver_id": env.vault.id(), "amount": (500 * TUSD).to_string(), "msg": "" }),
        )
        .deposit(ONE_YOCTO)
        .max_gas()
        .transact()
        .await?;
    assert!(res.is_success());
    let used: String = res.json()?;
    assert_eq!(used, "0", "foreign token must be fully refunded");
    let owner_foreign: String = foreign
        .view("ft_balance_of")
        .args_json(json!({ "account_id": env.owner.id() }))
        .await?
        .json()?;
    assert_eq!(owner_foreign.parse::<u128>()?, SUPPLY);
    let (vb_after, _, _) = balances(&env).await?;
    assert_eq!(
        vb_after,
        1_234 * TUSD,
        "foreign deposit must not be counted"
    );
    check_invariants(&env).await
}

/// T2 — instant route: known payee, 200 tUSD, risk Low → paid immediately.
#[tokio::test]
async fn t2_instant_payout_to_known_payee() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let before = ft_balance(&env, env.vendor.id().as_str()).await?;
    let id = request(
        &env,
        env.vendor.id().as_str(),
        200 * TUSD,
        Some(evidence("Low", &[])),
    )
    .await?;
    let r = get_request(&env, id).await?;
    assert_eq!(r["status"], "Executed");
    assert_eq!(r["route"], "Instant");
    assert_eq!(
        ft_balance(&env, env.vendor.id().as_str()).await? - before,
        200 * TUSD
    );
    let (vb, _, _) = balances(&env).await?;
    assert_eq!(vb, VAULT_FUNDING - 200 * TUSD);
    check_invariants(&env).await
}

/// T3 — new payee is held: Pending, funds reserved, receiver unchanged.
#[tokio::test]
async fn t3_new_payee_is_held() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let id = request(&env, env.supplier.id().as_str(), 50 * TUSD, None).await?;
    let r = get_request(&env, id).await?;
    assert_eq!(r["status"], "Pending");
    assert_eq!(r["route"], "NeedsConfirmation");
    let (_, reserved, available) = balances(&env).await?;
    assert_eq!(reserved, 50 * TUSD);
    assert_eq!(available, VAULT_FUNDING - 50 * TUSD);
    assert_eq!(ft_balance(&env, env.supplier.id().as_str()).await?, 0);
    check_invariants(&env).await
}

/// T4 — only the claimed principal, with exactly 1 yocto, can release a held payout.
#[tokio::test]
async fn t4_only_claimed_principal_with_one_yocto_confirms() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let id = request(&env, env.supplier.id().as_str(), 2_000 * TUSD, None).await?;

    assert_fails(
        confirm(&env, &env.finance, id, ONE_YOCTO).await,
        "ERR_NOT_PRINCIPAL",
    );
    assert_fails(
        confirm(&env, &env.stranger, id, ONE_YOCTO).await,
        "ERR_NOT_PRINCIPAL",
    );
    // A different principal (the CFO) is still not the *claimed* principal.
    assert_fails(
        confirm(&env, &env.cfo, id, ONE_YOCTO).await,
        "ERR_NOT_PRINCIPAL",
    );
    assert_fails(
        confirm(&env, &env.ceo, id, NearToken::from_yoctonear(0)).await,
        YOCTO_ERR,
    );
    assert_fails(
        confirm(&env, &env.ceo, id, NearToken::from_yoctonear(2)).await,
        YOCTO_ERR,
    );
    assert_eq!(status(&env, id).await?, "Pending");
    assert_eq!(ft_balance(&env, env.supplier.id().as_str()).await?, 0);

    let res = confirm(&env, &env.ceo, id, ONE_YOCTO).await?;
    assert!(res.is_success(), "{res:?}");
    let r = get_request(&env, id).await?;
    assert_eq!(r["status"], "Executed");
    assert_eq!(r["decided_by"], env.ceo.id().as_str());
    assert_eq!(
        ft_balance(&env, env.supplier.id().as_str()).await?,
        2_000 * TUSD
    );

    // Terminal: a second confirm can't pay twice.
    assert_fails(
        confirm(&env, &env.ceo, id, ONE_YOCTO).await,
        "ERR_NOT_PENDING",
    );
    assert_eq!(status(&env, id).await?, "Executed");
    check_invariants(&env).await
}

/// T5 — known payee above the instant limit is held.
#[tokio::test]
async fn t5_known_payee_above_limit_is_held() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let id = request(
        &env,
        env.vendor.id().as_str(),
        INSTANT_LIMIT + 1,
        Some(evidence("Low", &[])),
    )
    .await?;
    assert_eq!(status(&env, id).await?, "Pending");
    // exactly at the limit is still instant
    let id2 = request(&env, env.vendor.id().as_str(), INSTANT_LIMIT, None).await?;
    assert_eq!(status(&env, id2).await?, "Executed");
    check_invariants(&env).await
}

/// T6 — AI "High" holds even a small payment to a known payee, with a longer hold.
#[tokio::test]
async fn t6_high_risk_holds_known_payee_with_longer_window() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let id = request(
        &env,
        env.vendor.id().as_str(),
        10 * TUSD,
        Some(evidence("High", &["urgency", "secrecy"])),
    )
    .await?;
    let r = get_request(&env, id).await?;
    assert_eq!(r["status"], "Pending");
    let created: u64 = r["created_at_ns"].as_str().unwrap().parse()?;
    let expires: u64 = r["expires_at_ns"].as_str().unwrap().parse()?;
    assert_eq!(expires - created, HOLD_NS * 2);

    // Medium/Unknown risk get the normal window.
    let id2 = request(
        &env,
        env.supplier.id().as_str(),
        10 * TUSD,
        Some(evidence("Medium", &[])),
    )
    .await?;
    let r2 = get_request(&env, id2).await?;
    let c2: u64 = r2["created_at_ns"].as_str().unwrap().parse()?;
    let e2: u64 = r2["expires_at_ns"].as_str().unwrap().parse()?;
    assert_eq!(e2 - c2, HOLD_NS);
    check_invariants(&env).await
}

/// T7 — silence is safe: after expiry a confirm returns false and nothing moves.
#[tokio::test]
async fn t7_expired_request_can_never_execute() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let a = request(&env, env.supplier.id().as_str(), 1_000 * TUSD, None).await?;
    let b = request(&env, env.supplier.id().as_str(), 700 * TUSD, None).await?;
    forward_past_expiry(&env, a).await?;
    forward_past_expiry(&env, b).await?;

    let res = confirm(&env, &env.ceo, a, ONE_YOCTO).await?;
    assert!(res.is_success(), "{res:?}");
    let returned: bool = res.json()?;
    assert!(!returned, "confirm after expiry must return false");
    assert_eq!(status(&env, a).await?, "Expired");
    assert_eq!(ft_balance(&env, env.supplier.id().as_str()).await?, 0);

    assert_fails(
        confirm(&env, &env.ceo, a, ONE_YOCTO).await,
        "ERR_NOT_PENDING",
    );

    // b is overdue but not finalised yet: the view says so.
    let rb = get_request(&env, b).await?;
    assert_eq!(rb["status"], "Pending");
    assert_eq!(rb["effective_status"], "Expired");
    assert_eq!(rb["needs_sweep"], true);

    let swept: u32 = env
        .stranger
        .call(env.vault.id(), "sweep_expired")
        .args_json(json!({ "limit": 10 }))
        .transact()
        .await?
        .json()?;
    assert_eq!(swept, 1);
    assert_eq!(status(&env, b).await?, "Expired");
    assert_fails(
        confirm(&env, &env.ceo, b, ONE_YOCTO).await,
        "ERR_NOT_PENDING",
    );

    let (vb, reserved, available) = balances(&env).await?;
    assert_eq!((vb, reserved, available), (VAULT_FUNDING, 0, VAULT_FUNDING));
    check_invariants(&env).await
}

/// T8 — "I didn't send this": receiver flagged and blocked until the owner clears it.
#[tokio::test]
async fn t8_reject_as_scam_flags_and_blocks_receiver() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let scam = "fastpay-7f3a91.test.near";
    let id = request(
        &env,
        scam,
        25_000 * TUSD,
        Some(evidence("High", &["urgency"])),
    )
    .await?;

    // The requester can't reject (so can't flag arbitrary accounts).
    let res = env
        .finance
        .call(env.vault.id(), "reject_payout")
        .args_json(json!({ "id": id.to_string(), "reason": null, "report_scam": true }))
        .transact()
        .await;
    assert_fails(res, "ERR_NOT_AUTHORIZED_TO_REJECT");

    let res = env
        .ceo
        .call(env.vault.id(), "reject_payout")
        .args_json(json!({ "id": id.to_string(), "reason": "I never asked for this", "report_scam": true }))
        .transact()
        .await?;
    assert!(res.is_success(), "{res:?}");
    assert!(
        res.logs()
            .iter()
            .any(|l| l.contains("\"receiver_flagged\""))
    );
    let r = get_request(&env, id).await?;
    assert_eq!(r["status"], "Rejected");
    assert_eq!(r["reported_as_scam"], true);
    let flag: Value = env
        .vault
        .view("get_flag")
        .args_json(json!({ "account_id": scam }))
        .await?
        .json()?;
    assert_eq!(flag["reports"], 1);
    assert_eq!(flag["first_reported_by"], env.ceo.id().as_str());

    assert_fails(
        request_raw(&env, &env.finance, env.ceo.id().as_str(), scam, TUSD, None).await,
        "ERR_RECEIVER_FLAGGED",
    );
    // Terminal: a rejected request can't be confirmed later.
    assert_fails(
        confirm(&env, &env.ceo, id, ONE_YOCTO).await,
        "ERR_NOT_PENDING",
    );

    owner_call(&env, "clear_flag", json!({ "receiver_id": scam })).await?;
    let again = request(&env, scam, TUSD, None).await?;
    assert_eq!(status(&env, again).await?, "Pending");
    check_invariants(&env).await
}

/// T9 — G4: Tolu's function-call key can request, but can't confirm, move tokens,
/// move NEAR or touch admin methods. Enforced by the NEAR protocol, not our code.
#[tokio::test]
async fn t9_function_call_key_cannot_move_money() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let sk = SecretKey::from_random(KeyType::ED25519);
    env.finance
        .batch(env.finance.id())
        .add_key(
            sk.public_key(),
            AccessKey::function_call_access(
                env.vault.id(),
                &["request_payout", "cancel_payout"],
                Some(NearToken::from_millinear(250)),
            ),
        )
        .transact()
        .await?
        .into_result()?;
    let fck = Account::from_secret_key(env.finance.id().clone(), sk, &env.worker);

    // Allowed: request a payout (held, new payee).
    let res = fck
        .call(env.vault.id(), "request_payout")
        .args_json(
            json!({ "claimed_principal": env.ceo.id(), "receiver_id": env.supplier.id(),
                           "amount": (100 * TUSD).to_string(), "memo": "", "evidence": null }),
        )
        .gas(Gas::from_tgas(100))
        .transact()
        .await?;
    assert!(res.is_success(), "{res:?}");
    let id: String = res.json()?;

    // Each attempt below is refused by the NEAR protocol before any contract
    // code runs; we assert the exact access-key error.
    let fck_call =
        |receiver: &near_workspaces::AccountId, method: &str, args: Value, deposit: u128| {
            fck.call(receiver, method)
                .args_json(args)
                .deposit(NearToken::from_yoctonear(deposit))
                .gas(Gas::from_tgas(50))
                .transact()
        };
    let cases = [
        // confirm with the 1 yocto it requires: function-call keys can't attach deposits.
        (
            "confirm_payout + 1 yocto",
            fck_call(env.vault.id(), "confirm_payout", json!({ "id": id }), 1).await,
            "DepositWithFunctionCall",
        ),
        // confirm without a deposit: method not in the key's allow-list.
        (
            "confirm_payout",
            fck_call(env.vault.id(), "confirm_payout", json!({ "id": id }), 0).await,
            "MethodNameMismatch",
        ),
        // ft_transfer on the token: the key only works for the vault contract.
        (
            "token ft_transfer",
            fck_call(
                env.token.id(),
                "ft_transfer",
                json!({ "receiver_id": env.stranger.id(), "amount": "1" }),
                0,
            )
            .await,
            "ReceiverMismatch",
        ),
        (
            "token ft_transfer + 1 yocto",
            fck_call(
                env.token.id(),
                "ft_transfer",
                json!({ "receiver_id": env.stranger.id(), "amount": "1" }),
                1,
            )
            .await,
            "DepositWithFunctionCall",
        ),
        // admin method on the vault.
        (
            "vault add_payee",
            fck_call(
                env.vault.id(),
                "add_payee",
                json!({ "account_id": env.stranger.id(), "label": "x" }),
                0,
            )
            .await,
            "MethodNameMismatch",
        ),
        // a plain NEAR transfer (1 yocto, so the allowance isn't the reason).
        (
            "NEAR transfer",
            fck.transfer_near(env.stranger.id(), NearToken::from_yoctonear(1))
                .await,
            "RequiresFullAccess",
        ),
    ];
    for (what, res, reason) in cases {
        let e = assert_fails(res, reason);
        assert!(e.contains("InvalidAccessKeyError"), "{what}: {e}");
        println!("T9 blocked as expected: {what} → {reason}");
    }
    assert_eq!(status(&env, id.parse()?).await?, "Pending");
    assert_eq!(ft_balance(&env, env.stranger.id().as_str()).await?, 0);
    check_invariants(&env).await
}

/// T10 — two holds can't reserve the same funds.
#[tokio::test]
async fn t10_reservations_cannot_exceed_available() -> anyhow::Result<()> {
    let env = setup(true).await?;
    request(&env, env.supplier.id().as_str(), 60_000 * TUSD, None).await?;
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.ceo.id().as_str(),
            env.supplier.id().as_str(),
            50_000 * TUSD,
            None,
        )
        .await,
        "ERR_INSUFFICIENT_AVAILABLE",
    );
    // instant payouts also respect reservations
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.ceo.id().as_str(),
            env.vendor.id().as_str(),
            40_001 * TUSD,
            None,
        )
        .await,
        "ERR_INSUFFICIENT_AVAILABLE",
    );
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.ceo.id().as_str(),
            env.supplier.id().as_str(),
            0,
            None,
        )
        .await,
        "ERR_INVALID_AMOUNT",
    );
    check_invariants(&env).await
}

/// T11 — a payout to an account not registered on the token fails safely.
#[tokio::test]
async fn t11_failed_transfer_restores_balance() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let unregistered = "nobody-registered.test.near";
    let id = request(&env, unregistered, 3_000 * TUSD, None).await?;
    let res = confirm(&env, &env.ceo, id, ONE_YOCTO).await?;
    assert!(
        res.logs().iter().any(|l| l.contains("\"payout_failed\"")),
        "{res:?}"
    );
    assert_eq!(status(&env, id).await?, "Failed");
    let (vb, reserved, available) = balances(&env).await?;
    assert_eq!((vb, reserved, available), (VAULT_FUNDING, 0, VAULT_FUNDING));
    // Terminal.
    assert_fails(
        confirm(&env, &env.ceo, id, ONE_YOCTO).await,
        "ERR_NOT_PENDING",
    );
    check_invariants(&env).await
}

/// T12 — membership rules: no self-approval, principal must be a principal, requester must be a requester.
#[tokio::test]
async fn t12_membership_rules() -> anyhow::Result<()> {
    let env = setup(true).await?;
    // A member with both roles still can't approve their own request.
    owner_call(
        &env,
        "add_member",
        json!({ "account_id": env.cfo.id(), "display_name": "Chidi Eze", "title": "CFO", "roles": ["Principal", "Requester"] }),
    )
    .await?;
    assert_fails(
        request_raw(
            &env,
            &env.cfo,
            env.cfo.id().as_str(),
            env.supplier.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_SELF_APPROVAL",
    );
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.stranger.id().as_str(),
            env.supplier.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_NOT_PRINCIPAL_MEMBER",
    );
    // finance is a member but not a principal
    assert_fails(
        request_raw(
            &env,
            &env.cfo,
            env.finance.id().as_str(),
            env.supplier.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_NOT_PRINCIPAL_MEMBER",
    );
    assert_fails(
        request_raw(
            &env,
            &env.stranger,
            env.ceo.id().as_str(),
            env.supplier.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_NOT_REQUESTER",
    );
    // ceo is a principal but not a requester
    assert_fails(
        request_raw(
            &env,
            &env.ceo,
            env.cfo.id().as_str(),
            env.supplier.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_NOT_REQUESTER",
    );
    // deactivated principal
    owner_call(
        &env,
        "set_member_active",
        json!({ "account_id": env.ceo.id(), "active": false }),
    )
    .await?;
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.ceo.id().as_str(),
            env.supplier.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_NOT_PRINCIPAL_MEMBER",
    );
    // the vault/token themselves are not valid receivers
    owner_call(
        &env,
        "set_member_active",
        json!({ "account_id": env.ceo.id(), "active": true }),
    )
    .await?;
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.ceo.id().as_str(),
            env.vault.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_INVALID_RECEIVER",
    );
    check_invariants(&env).await
}

/// T13 — owner-only methods: non-owner rejected, owner without 1 yocto rejected.
#[tokio::test]
async fn t13_owner_methods_are_protected() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let calls: Vec<(&str, Value)> = vec![
        (
            "add_member",
            json!({ "account_id": env.stranger.id(), "display_name": "x", "title": "x", "roles": ["Principal"] }),
        ),
        (
            "set_member_active",
            json!({ "account_id": env.ceo.id(), "active": false }),
        ),
        (
            "add_payee",
            json!({ "account_id": env.stranger.id(), "label": "x" }),
        ),
        ("remove_payee", json!({ "account_id": env.vendor.id() })),
        (
            "set_policy",
            json!({ "policy": { "instant_limit": "1", "hold_window_ns": "60000000000",
                                            "high_risk_hold_multiplier": 1, "max_pending_per_requester": 1 } }),
        ),
        ("clear_flag", json!({ "receiver_id": env.stranger.id() })),
    ];
    for (method, args) in &calls {
        for who in [&env.stranger, &env.finance, &env.ceo] {
            let res = who
                .call(env.vault.id(), method)
                .args_json(args.clone())
                .deposit(ONE_YOCTO)
                .transact()
                .await;
            assert_fails(res, "ERR_NOT_OWNER");
        }
        let res = env
            .owner
            .call(env.vault.id(), method)
            .args_json(args.clone())
            .transact()
            .await;
        assert_fails(res, YOCTO_ERR);
    }
    // Policy is validated even for the owner.
    let res = env
        .owner
        .call(env.vault.id(), "set_policy")
        .args_json(json!({ "policy": { "instant_limit": "1", "hold_window_ns": "1",
                                        "high_risk_hold_multiplier": 1, "max_pending_per_requester": 1 } }))
        .deposit(ONE_YOCTO)
        .transact()
        .await;
    assert_fails(res, "ERR_INVALID_POLICY");
    // Nothing changed.
    let is_payee: bool = env
        .vault
        .view("is_known_payee")
        .args_json(json!({ "account_id": env.vendor.id() }))
        .await?
        .json()?;
    assert!(is_payee);
    let cfg: Value = env.vault.view("get_config").await?.json()?;
    assert_eq!(cfg["policy"]["instant_limit"], INSTANT_LIMIT.to_string());
    check_invariants(&env).await
}

/// T14 — input bounds, and G7: requests carry no message text.
#[tokio::test]
async fn t14_input_bounds_and_no_message_text_on_chain() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let supplier = env.supplier.id().as_str();
    let ceo = env.ceo.id().as_str();
    let call = |memo: String, ev: Option<Value>| {
        let env = &env;
        async move {
            env.finance
                .call(env.vault.id(), "request_payout")
                .args_json(json!({ "claimed_principal": ceo, "receiver_id": supplier,
                                   "amount": TUSD.to_string(), "memo": memo, "evidence": ev }))
                .gas(Gas::from_tgas(100))
                .transact()
                .await
        }
    };
    assert_fails(call("x".repeat(281), None).await, "ERR_INPUT_BOUNDS");
    let eleven = [
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
    ];
    assert_fails(
        call(String::new(), Some(evidence("High", &eleven))).await,
        "ERR_INPUT_BOUNDS",
    );
    assert_fails(
        call(
            String::new(),
            Some(evidence("High", &["Ada said keep this quiet"])),
        )
        .await,
        "ERR_UNKNOWN_FLAG",
    );
    let mut bad_hash = evidence("High", &["urgency"]);
    bad_hash["evidence_hash"] = json!("not-a-hash");
    assert_fails(
        call(String::new(), Some(bad_hash)).await,
        "ERR_INPUT_BOUNDS",
    );
    let mut long_model = evidence("High", &["urgency"]);
    long_model["model"] = json!("m".repeat(97));
    assert_fails(
        call(String::new(), Some(long_model)).await,
        "ERR_INPUT_BOUNDS",
    );
    // Unknown JSON fields (e.g. a smuggled "quote") are rejected by deserialisation.
    let mut with_quote = evidence("High", &["urgency"]);
    with_quote["quote"] = json!("keep this between us");
    let res = call(String::new(), Some(with_quote)).await?;
    // serde ignores unknown fields by default; what matters is it is NOT stored:
    if res.is_success() {
        let id: String = res.json()?;
        let r = get_request(&env, id.parse()?).await?;
        assert!(
            r["evidence"].get("quote").is_none(),
            "unknown field must not be stored"
        );
    }

    // The boundary values are accepted.
    let res = call("x".repeat(280), Some(evidence("High", &eleven[..10]))).await?;
    assert!(res.is_success(), "{res:?}");
    let id: String = res.json()?;
    let r = get_request(&env, id.parse()?).await?;

    // G7 structure assertion: the full set of stored fields. The only free-text
    // fields are `memo` and `reason`; evidence is categorical.
    let keys = |v: &Value| {
        v.as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect::<BTreeSet<_>>()
    };
    let expected_request: BTreeSet<String> = [
        "id",
        "requester",
        "claimed_principal",
        "receiver_id",
        "amount",
        "memo",
        "evidence",
        "route",
        "status",
        "reported_as_scam",
        "created_at_ns",
        "expires_at_ns",
        "decided_by",
        "decided_at_ns",
        "reason",
        "effective_status",
        "needs_sweep",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    assert_eq!(keys(&r), expected_request);
    let expected_evidence: BTreeSet<String> = [
        "evidence_hash",
        "risk",
        "flags",
        "model",
        "chat_id",
        "signing_address",
        "signature_verified",
    ]
    .iter()
    .map(|s| s.to_string())
    .collect();
    assert_eq!(keys(&r["evidence"]), expected_evidence);
    let allowed: Vec<String> = env.vault.view("allowed_flags").await?.json()?;
    for f in r["evidence"]["flags"].as_array().unwrap() {
        assert!(allowed.contains(&f.as_str().unwrap().to_string()));
    }
    check_invariants(&env).await
}

/// T15 — storage-spam guard: max pending per requester.
#[tokio::test]
async fn t15_max_pending_per_requester() -> anyhow::Result<()> {
    let env = setup(true).await?;
    let mut ids = vec![];
    for _ in 0..5 {
        ids.push(request(&env, env.supplier.id().as_str(), TUSD, None).await?);
    }
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.ceo.id().as_str(),
            env.supplier.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_TOO_MANY_PENDING",
    );
    // The cap applies to every new request (rule 5 runs before routing), so a
    // requester with 5 open holds must resolve them before asking again.
    assert_fails(
        request_raw(
            &env,
            &env.finance,
            env.ceo.id().as_str(),
            env.vendor.id().as_str(),
            TUSD,
            None,
        )
        .await,
        "ERR_TOO_MANY_PENDING",
    );
    // Cancelling one frees a slot.
    env.finance
        .call(env.vault.id(), "cancel_payout")
        .args_json(json!({ "id": ids[0].to_string() }))
        .transact()
        .await?
        .into_result()?;
    assert_eq!(status(&env, ids[0]).await?, "Cancelled");
    request(&env, env.supplier.id().as_str(), TUSD, None).await?;
    check_invariants(&env).await
}

/// T16 — shared/flags.json == Rust ALLOWED_FLAGS == the deployed contract's list.
#[tokio::test]
async fn t16_flag_list_matches_shared_json() -> anyhow::Result<()> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../shared/flags.json");
    let shared: Vec<String> = serde_json::from_str(&std::fs::read_to_string(path)?)?;
    let rust: Vec<String> = callsign_vault::types::ALLOWED_FLAGS
        .iter()
        .map(|s| s.to_string())
        .collect();
    assert_eq!(shared, rust);
    let env = setup(false).await?;
    let on_chain: Vec<String> = env.vault.view("allowed_flags").await?.json()?;
    assert_eq!(shared, on_chain);
    Ok(())
}
