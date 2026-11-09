"use client";
/**
 * Wallet connection via NEAR Connect (docs.near.org/web3-apps/tutorials/wallet-login).
 * Sign-in also creates a limited function-call key for the vault, scoped to
 * request_payout / cancel_payout / reject_payout. confirm_payout attaches
 * 1 yoctoNEAR, so the plugin can't sign it and the wallet always asks.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { NearConnector } from "@hot-labs/near-connect";

type Wallet = Awaited<ReturnType<NearConnector["wallet"]>>;

interface WalletCtx {
  accountId: string | null;
  ready: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  callVault: (
    methodName: string,
    args: Record<string, unknown>,
    deposit?: string,
  ) => Promise<{ hash: string | null; value: unknown }>;
}

const Ctx = createContext<WalletCtx | null>(null);
const VAULT = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ID || "";
const RPC = process.env.NEXT_PUBLIC_NEAR_RPC_URL || "https://test.rpc.fastnear.com";

export function WalletProvider({ children }: { children: ReactNode }) {
  const connectorRef = useRef<NearConnector | null>(null);
  const [wallet, setWallet] = useState<Wallet | undefined>();
  const [accountId, setAccountId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ NearConnector }, { createAccessKeyPlugin }] = await Promise.all([
        import("@hot-labs/near-connect"),
        import("function-call-key-plugin"),
      ]);
      const connector = new NearConnector({ network: "testnet", providers: { testnet: [RPC] } });
      if (VAULT) {
        await connector.use(
          createAccessKeyPlugin({
            network: "testnet",
            providers: { testnet: [RPC] },
            signIn: {
              contractId: VAULT,
              methodNames: ["request_payout", "cancel_payout", "reject_payout"],
              allowance: "250000000000000000000000",
            },
          }),
        );
      }
      connectorRef.current = connector;
      connector.on("wallet:signIn", (p) => {
        if (cancelled) return;
        setWallet(p.wallet);
        setAccountId(p.accounts[0]?.accountId ?? null);
      });
      connector.on("wallet:signOut", () => {
        if (cancelled) return;
        setWallet(undefined);
        setAccountId(null);
      });
      try {
        const w = await connector.wallet();
        const accounts = await w.getAccounts();
        if (!cancelled && accounts[0]) {
          setWallet(w);
          setAccountId(accounts[0].accountId);
        }
      } catch {
        // not signed in yet
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    const c = connectorRef.current;
    if (!c) return;
    const w = await c.connect();
    const accounts = await w.getAccounts();
    setWallet(w);
    setAccountId(accounts[0]?.accountId ?? null);
  }, []);

  const signOut = useCallback(async () => {
    if (connectorRef.current && wallet) await connectorRef.current.disconnect(wallet);
    setWallet(undefined);
    setAccountId(null);
  }, [wallet]);

  const callVault = useCallback(
    async (methodName: string, args: Record<string, unknown>, deposit = "0") => {
      if (!wallet) throw new Error("Connect a wallet first");
      const outcome = (await wallet.signAndSendTransaction({
        receiverId: VAULT,
        actions: [
          { type: "FunctionCall", params: { methodName, args, gas: "100000000000000", deposit } },
        ],
      })) as {
        transaction?: { hash?: string };
        status?: { SuccessValue?: string; Failure?: unknown };
      };
      if (
        outcome?.status &&
        typeof outcome.status === "object" &&
        "Failure" in outcome.status &&
        outcome.status.Failure
      ) {
        throw new Error(JSON.stringify(outcome.status.Failure));
      }
      let value: unknown = null;
      const sv = outcome?.status?.SuccessValue;
      if (sv) {
        try {
          value = JSON.parse(atob(sv));
        } catch {
          value = null;
        }
      }
      return { hash: outcome?.transaction?.hash ?? null, value };
    },
    [wallet],
  );

  const value = useMemo(
    () => ({ accountId, ready, signIn, signOut, callVault }),
    [accountId, ready, signIn, signOut, callVault],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWallet(): WalletCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWallet outside WalletProvider");
  return v;
}

export function WalletButton() {
  const { accountId, ready, signIn, signOut } = useWallet();
  if (!ready) return <span className="text-sm text-muted">Loading wallet…</span>;
  if (!accountId)
    return (
      <button
        onClick={() => void signIn()}
        className="min-h-11 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-4 text-sm font-semibold text-white shadow-md shadow-brand/25 transition hover:brightness-110"
      >
        Connect testnet wallet
      </button>
    );
  return (
    <span className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-paper px-3 py-1.5 text-sm">
      <span className="h-2 w-2 rounded-full bg-ok-line" aria-hidden="true" />
      <span className="mono">{accountId}</span>
      <button
        onClick={() => void signOut()}
        className="rounded-lg border border-line px-2 py-1 text-xs hover:bg-wash"
      >
        Sign out
      </button>
    </span>
  );
}
