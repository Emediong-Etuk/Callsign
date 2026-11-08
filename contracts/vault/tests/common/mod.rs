//! Shared sandbox fixture for the vault integration tests.
//!
//! Every test gets its own fresh sandbox with the full demo cast:
//! owner, Ada (CEO, principal), Chidi (CFO, principal), Tolu (finance, requester),
//! a known payee (vendor), a storage-registered non-payee (supplier), a stranger,
//! the tUSD token and the vault.

#![allow(dead_code)]

use anyhow::Result;
use near_workspaces::network::Sandbox;
use near_workspaces::result::ExecutionFinalResult;
use near_workspaces::types::NearToken;
use near_workspaces::{Account, Contract, Worker};
use serde_json::{Value, json};
use tokio::sync::OnceCell;

pub const TUSD: u128 = 1_000_000; // 6 decimals
pub const SUPPLY: u128 = 1_000_000 * TUSD;
pub const VAULT_FUNDING: u128 = 100_000 * TUSD;
pub const INSTANT_LIMIT: u128 = 500 * TUSD;
pub const HOLD_SECS: u64 = 60;
pub const HOLD_NS: u64 = HOLD_SECS * 1_000_000_000;
pub const ONE_YOCTO: NearToken = NearToken::from_yoctonear(1);
pub const YOCTO_ERR: &str = "Requires attached deposit of exactly 1 yoctoNEAR";

static VAULT_WASM: OnceCell<Vec<u8>> = OnceCell::const_new();
static TOKEN_WASM: OnceCell<Vec<u8>> = OnceCell::const_new();

pub async fn vault_wasm() -> &'static [u8] {
    VAULT_WASM
        .get_or_init(|| async {
            near_workspaces::compile_project("./")
                .await
                .expect("compile vault")
        })
        .await
}

pub async fn token_wasm() -> &'static [u8] {
    TOKEN_WASM
        .get_or_init(|| async {
            near_workspaces::compile_project("../test-token")
                .await
                .expect("compile test-token")
        })
        .await
}

pub struct Env {
    pub worker: Worker<Sandbox>,
    pub owner: Account,
    pub ceo: Account,
    pub cfo: Account,
    pub finance: Account,
    pub vendor: Account,
    pub supplier: Account,
    pub stranger: Account,
    pub token: Contract,
    pub vault: Contract,
}

async fn sub(root: &Account, name: &str, near: u128) -> Result<Account> {
    Ok(root
        .create_subaccount(name)
        .initial_balance(NearToken::from_near(near))
        .transact()
        .await?
        .into_result()?)
}

pub async fn register(token: &Contract, who: &Account, account_id: &str) -> Result<()> {
    who.call(token.id(), "storage_deposit")
        .args_json(json!({ "account_id": account_id, "registration_only": true }))
        .deposit(NearToken::from_millinear(10))
        .transact()
        .await?
        .into_result()?;
    Ok(())
}

/// Builds the full cast. `fund` = deposit 100,000 tUSD into the vault.
pub async fn setup(fund: bool) -> Result<Env> {
    let worker = near_workspaces::sandbox().await?;
    let root = worker.root_account()?;
    let owner = sub(&root, "owner", 50).await?;
    let ceo = sub(&root, "ceo", 10).await?;
    let cfo = sub(&root, "cfo", 10).await?;
    let finance = sub(&root, "finance", 10).await?;
    let vendor = sub(&root, "vendor", 5).await?;
    let supplier = sub(&root, "supplier", 5).await?;
    let stranger = sub(&root, "stranger", 5).await?;

    let token_acc = sub(&root, "token", 20).await?;
    let token = token_acc.deploy(token_wasm().await).await?.into_result()?;
    token
        .call("new")
        .args_json(json!({ "owner_id": owner.id(), "total_supply": SUPPLY.to_string() }))
        .transact()
        .await?
        .into_result()?;

    let vault_acc = sub(&root, "vault", 20).await?;
    let vault = vault_acc.deploy(vault_wasm().await).await?.into_result()?;
    vault
        .call("new")
        .args_json(json!({
            "owner_id": owner.id(),
            "token_id": token.id(),
            "policy": {
                "instant_limit": INSTANT_LIMIT.to_string(),
                "hold_window_ns": HOLD_NS.to_string(),
                "high_risk_hold_multiplier": 2,
                "max_pending_per_requester": 5
            }
        }))
        .transact()
        .await?
        .into_result()?;

    for a in [
        vault.id().as_str(),
        vendor.id().as_str(),
        supplier.id().as_str(),
        finance.id().as_str(),
        ceo.id().as_str(),
        cfo.id().as_str(),
    ] {
        register(&token, &owner, a).await?;
    }

    let env = Env {
        worker,
        owner,
        ceo,
        cfo,
        finance,
        vendor,
        supplier,
        stranger,
        token,
        vault,
    };

    owner_call(
        &env,
        "add_member",
        json!({ "account_id": env.ceo.id(), "display_name": "Ada Okafor", "title": "CEO", "roles": ["Principal"] }),
    )
    .await?;
    owner_call(
        &env,
        "add_member",
        json!({ "account_id": env.cfo.id(), "display_name": "Chidi Eze", "title": "CFO", "roles": ["Principal"] }),
    )
    .await?;
    owner_call(
        &env,
        "add_member",
        json!({ "account_id": env.finance.id(), "display_name": "Tolu Bello", "title": "Finance Officer", "roles": ["Requester"] }),
    )
    .await?;
    owner_call(
        &env,
        "add_payee",
        json!({ "account_id": env.vendor.id(), "label": "Harbor Office Supplies" }),
    )
    .await?;

    if fund {
        deposit(&env, VAULT_FUNDING).await?;
    }
    Ok(env)
}

pub async fn owner_call(env: &Env, method: &str, args: Value) -> Result<()> {
    let res = env
        .owner
        .call(env.vault.id(), method)
        .args_json(args)
        .deposit(ONE_YOCTO)
        .transact()
        .await?;
    anyhow::ensure!(res.is_success(), "owner {method} failed: {:?}", res);
    Ok(())
}

pub async fn deposit(env: &Env, amount: u128) -> Result<()> {
    let res = env
        .owner
        .call(env.token.id(), "ft_transfer_call")
        .args_json(
            json!({ "receiver_id": env.vault.id(), "amount": amount.to_string(), "msg": "" }),
        )
        .deposit(ONE_YOCTO)
        .max_gas()
        .transact()
        .await?;
    anyhow::ensure!(res.is_success(), "deposit failed: {:?}", res);
    Ok(())
}

pub fn evidence(risk: &str, flags: &[&str]) -> Value {
    json!({
        "evidence_hash": "ab".repeat(32),
        "risk": risk,
        "flags": flags,
        "model": "test-model",
        "chat_id": "chatcmpl-test",
        "signing_address": "0x0000000000000000000000000000000000000001",
        "signature_verified": true
    })
}

/// `request_payout` as `who`, returning the raw result (may be a failure).
pub async fn request_raw(
    env: &Env,
    who: &Account,
    principal: &str,
    receiver: &str,
    amount: u128,
    evidence: Option<Value>,
) -> Result<ExecutionFinalResult> {
    Ok(who
        .call(env.vault.id(), "request_payout")
        .args_json(json!({
            "claimed_principal": principal,
            "receiver_id": receiver,
            "amount": amount.to_string(),
            "memo": "invoice",
            "evidence": evidence,
        }))
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?)
}

/// Successful `request_payout` by Tolu (finance) claiming Ada (CEO). Returns the id.
pub async fn request(
    env: &Env,
    receiver: &str,
    amount: u128,
    evidence: Option<Value>,
) -> Result<u64> {
    let res = request_raw(
        env,
        &env.finance,
        env.ceo.id().as_str(),
        receiver,
        amount,
        evidence,
    )
    .await?;
    anyhow::ensure!(res.is_success(), "request failed: {:?}", res);
    let id: String = res.json()?;
    Ok(id.parse()?)
}

pub async fn confirm(
    env: &Env,
    who: &Account,
    id: u64,
    deposit: NearToken,
) -> Result<ExecutionFinalResult> {
    Ok(who
        .call(env.vault.id(), "confirm_payout")
        .args_json(json!({ "id": id.to_string() }))
        .deposit(deposit)
        .gas(near_workspaces::types::Gas::from_tgas(100))
        .transact()
        .await?)
}

pub async fn get_request(env: &Env, id: u64) -> Result<Value> {
    Ok(env
        .vault
        .view("get_request")
        .args_json(json!({ "id": id.to_string() }))
        .await?
        .json()?)
}

pub async fn status(env: &Env, id: u64) -> Result<String> {
    Ok(get_request(env, id).await?["status"]
        .as_str()
        .unwrap_or_default()
        .to_string())
}

pub async fn balances(env: &Env) -> Result<(u128, u128, u128)> {
    let b: Value = env.vault.view("get_balances").await?.json()?;
    let p = |k: &str| b[k].as_str().unwrap().parse::<u128>().unwrap();
    Ok((p("vault_balance"), p("reserved"), p("available")))
}

pub async fn ft_balance(env: &Env, account: &str) -> Result<u128> {
    let v: String = env
        .token
        .view("ft_balance_of")
        .args_json(json!({ "account_id": account }))
        .await?
        .json()?;
    Ok(v.parse()?)
}

/// Asserts a call failed and that the failure mentions `needle`.
/// Covers both contract panics (failed outcome) and protocol-level rejections
/// (the RPC refuses the transaction, e.g. a function-call key misuse).
pub fn assert_fails<E: std::fmt::Debug>(
    res: std::result::Result<ExecutionFinalResult, E>,
    needle: &str,
) -> String {
    let msg = match res {
        Err(e) => format!("{e:?}"),
        Ok(o) => {
            assert!(
                o.is_failure(),
                "expected failure containing {needle:?}, got success"
            );
            format!("{:?}", o.into_result().unwrap_err())
        }
    };
    assert!(
        msg.contains(needle),
        "expected failure containing {needle:?}, got: {msg}"
    );
    msg
}

/// Vault accounting invariants, checked after every scenario:
/// - reserved <= vault_balance, available = vault_balance - reserved
/// - reserved == sum of amounts of Pending requests
/// - the vault really holds the tokens it accounts for
pub async fn check_invariants(env: &Env) -> Result<()> {
    let (vb, reserved, available) = balances(env).await?;
    assert!(reserved <= vb, "reserved {reserved} > vault_balance {vb}");
    assert_eq!(available, vb - reserved);
    let reqs: Vec<Value> = env
        .vault
        .view("list_requests")
        .args_json(json!({ "from_index": 0, "limit": 50 }))
        .await?
        .json()?;
    let pending_sum: u128 = reqs
        .iter()
        .filter(|r| r["status"] == "Pending")
        .map(|r| r["amount"].as_str().unwrap().parse::<u128>().unwrap())
        .sum();
    assert_eq!(reserved, pending_sum, "reserved != sum of pending");
    assert!(
        reqs.iter().all(|r| r["status"] != "Executing"),
        "no payout should be stuck in Executing"
    );
    let real = ft_balance(env, env.vault.id().as_str()).await?;
    assert_eq!(real, vb, "token balance {real} != vault_balance {vb}");
    Ok(())
}

/// Advances sandbox time until request `id` is past its hold window.
pub async fn forward_past_expiry(env: &Env, id: u64) -> Result<()> {
    for _ in 0..50 {
        if get_request(env, id).await?["effective_status"] == "Expired" {
            return Ok(());
        }
        env.worker.fast_forward(100).await?;
    }
    anyhow::bail!("request {id} never expired")
}
