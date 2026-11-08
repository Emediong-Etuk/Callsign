"use client";
import { useCallback, useEffect, useState } from "react";
import type {
  Balances,
  FlagView,
  MemberView,
  PayeeView,
  RequestView,
  VaultConfig,
} from "@/lib/near/types";

export interface VaultState {
  configured: boolean;
  error?: string;
  ids?: { vault: string; token: string; ceo: string; finance: string };
  config?: VaultConfig;
  balances?: Balances;
  members?: MemberView[];
  payees?: PayeeView[];
  flags?: FlagView[];
  requests?: RequestView[];
}

const fetchVault = (): Promise<VaultState> =>
  fetch("/api/vault", { cache: "no-store" })
    .then((r) => r.json() as Promise<VaultState>)
    .catch(() => ({ configured: true, error: "Couldn't reach the server." }));

export function useVault(pollMs = 0) {
  const [state, setState] = useState<VaultState | null>(null);
  const refresh = useCallback(() => fetchVault().then(setState), []);
  useEffect(() => {
    let alive = true;
    const tick = () => fetchVault().then((s) => alive && setState(s));
    tick();
    const t = pollMs ? setInterval(tick, pollMs) : undefined;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [pollMs]);
  return { state, loading: state === null, refresh };
}
