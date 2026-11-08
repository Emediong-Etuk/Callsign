/** Network + contract configuration shared by the web app, API routes and scripts. */

export const NETWORK = (process.env.NEXT_PUBLIC_NEAR_NETWORK ||
  process.env.NEAR_NETWORK ||
  "testnet") as "testnet" | "mainnet";

/** Public testnet RPCs from docs.near.org/api/rpc/providers; override with NEAR_RPC_URL. */
export const DEFAULT_RPC = "https://test.rpc.fastnear.com";
export const DEFAULT_RPC_FALLBACK = "https://rpc.testnet.near.org";

export function rpcUrls(): string[] {
  const primary = process.env.NEAR_RPC_URL || process.env.NEXT_PUBLIC_NEAR_RPC_URL || DEFAULT_RPC;
  const fallback = process.env.NEAR_RPC_FALLBACK_URL || DEFAULT_RPC_FALLBACK;
  return Array.from(new Set([primary, fallback]));
}

export const VAULT_ID = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID || "";
export const TOKEN_ID = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ID || "";

export const EXPLORER = "https://testnet.nearblocks.io";
export const txUrl = (hash: string) => `${EXPLORER}/txns/${hash}`;
export const accountUrl = (id: string) => `${EXPLORER}/address/${id}`;

export const TGAS = 1_000_000_000_000n;
/** Clients attach 100 Tgas to request and confirm (brief §5.5). */
export const CALL_GAS = 100n * TGAS;
export const ONE_YOCTO = 1n;
