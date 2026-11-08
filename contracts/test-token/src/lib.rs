//! Callsign Test USD (tUSD): a **demo-only** NEP-141 fungible token.
//!
//! It exists so the Callsign vault has something to hold on testnet. It is not a
//! stablecoin, has no backing and is not styled after any real token.
//! Standards: NEP-141 (fungible token), NEP-145 (storage management),
//! NEP-148 (metadata).

use near_contract_standards::fungible_token::metadata::{
    FT_METADATA_SPEC, FungibleTokenMetadata, FungibleTokenMetadataProvider,
};
use near_contract_standards::fungible_token::{
    FungibleToken, FungibleTokenCore, FungibleTokenResolver,
};
use near_contract_standards::storage_management::{
    StorageBalance, StorageBalanceBounds, StorageManagement,
};
use near_sdk::borsh::BorshSerialize;
use near_sdk::collections::LazyOption;
use near_sdk::json_types::U128;
use near_sdk::{
    AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue, assert_one_yocto, env,
    log, near, require,
};

/// Plain slate circle with a lowercase "t". Deliberately generic.
const ICON: &str = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%23334155'/%3E%3Cpath d='M30 16h6v10h8v6h-8v12c0 2 1 3 3 3h5v6h-6c-5 0-8-3-8-8V32h-5v-6h5z' fill='%23f8fafc'/%3E%3C/svg%3E";

pub const ERR_NOT_OWNER: &str = "ERR_NOT_OWNER";

#[derive(BorshSerialize, BorshStorageKey)]
#[borsh(crate = "near_sdk::borsh")]
enum StorageKey {
    FungibleToken,
    Metadata,
}

#[derive(PanicOnDefault)]
#[near(contract_state)]
pub struct Contract {
    owner_id: AccountId,
    token: FungibleToken,
    metadata: LazyOption<FungibleTokenMetadata>,
}

pub fn default_metadata() -> FungibleTokenMetadata {
    FungibleTokenMetadata {
        spec: FT_METADATA_SPEC.to_string(),
        name: "Callsign Test USD".to_string(),
        symbol: "tUSD".to_string(),
        icon: Some(ICON.to_string()),
        reference: None,
        reference_hash: None,
        decimals: 6,
    }
}

#[near]
impl Contract {
    /// Mints `total_supply` to `owner_id`, who also becomes the only account allowed to `mint`.
    #[init]
    pub fn new(owner_id: AccountId, total_supply: U128) -> Self {
        let metadata = default_metadata();
        metadata.assert_valid();
        let mut this = Self {
            owner_id: owner_id.clone(),
            token: FungibleToken::new(StorageKey::FungibleToken),
            metadata: LazyOption::new(StorageKey::Metadata, Some(&metadata)),
        };
        this.token.internal_register_account(&owner_id);
        this.token.internal_deposit(&owner_id, total_supply.into());
        near_contract_standards::fungible_token::events::FtMint {
            owner_id: &owner_id,
            amount: total_supply,
            memo: Some("initial supply"),
        }
        .emit();
        this
    }

    /// Demo top-ups. Owner-only, and 1 yocto forces a full-access-key (wallet) signature.
    #[payable]
    pub fn mint(&mut self, account_id: AccountId, amount: U128) {
        assert_one_yocto();
        require!(
            env::predecessor_account_id() == self.owner_id,
            ERR_NOT_OWNER
        );
        // internal_deposit panics if the account is not storage-registered (NEP-145).
        self.token.internal_deposit(&account_id, amount.into());
        near_contract_standards::fungible_token::events::FtMint {
            owner_id: &account_id,
            amount,
            memo: Some("demo top-up"),
        }
        .emit();
    }

    pub fn get_owner(&self) -> AccountId {
        self.owner_id.clone()
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        amount: U128,
    ) -> U128 {
        let (used_amount, burned_amount) =
            self.token
                .internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        if burned_amount > 0 {
            log!("Account @{} burned {}", sender_id, burned_amount);
        }
        used_amount.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(
        &mut self,
        account_id: Option<AccountId>,
        registration_only: Option<bool>,
    ) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.internal_storage_unregister(force).is_some()
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        self.metadata.get().expect("metadata set at init")
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::testing_env;

    fn ctx(predecessor: AccountId, deposit: u128) -> near_sdk::VMContext {
        VMContextBuilder::new()
            .current_account_id(accounts(0))
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .build()
    }

    #[test]
    fn metadata_is_tusd_six_decimals() {
        testing_env!(ctx(accounts(1), 0));
        let c = Contract::new(accounts(1), U128(1_000_000));
        let m = c.ft_metadata();
        assert_eq!(m.symbol, "tUSD");
        assert_eq!(m.name, "Callsign Test USD");
        assert_eq!(m.decimals, 6);
        assert_eq!(c.ft_balance_of(accounts(1)).0, 1_000_000);
    }

    #[test]
    fn owner_can_mint_with_one_yocto() {
        testing_env!(ctx(accounts(1), 0));
        let mut c = Contract::new(accounts(1), U128(10));
        testing_env!(ctx(accounts(1), 1));
        c.mint(accounts(1), U128(5));
        assert_eq!(c.ft_balance_of(accounts(1)).0, 15);
    }

    #[test]
    #[should_panic(expected = "ERR_NOT_OWNER")]
    fn stranger_cannot_mint() {
        testing_env!(ctx(accounts(1), 0));
        let mut c = Contract::new(accounts(1), U128(10));
        testing_env!(ctx(accounts(2), 1));
        c.mint(accounts(1), U128(5));
    }

    #[test]
    #[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
    fn mint_requires_one_yocto() {
        testing_env!(ctx(accounts(1), 0));
        let mut c = Contract::new(accounts(1), U128(10));
        testing_env!(ctx(accounts(1), 0));
        c.mint(accounts(1), U128(5));
    }
}
