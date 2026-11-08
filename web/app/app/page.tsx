"use client";
import Link from "next/link";
import { useVault } from "@/components/use-vault";
import { WalletButton, useWallet } from "@/components/wallet";
import { memberName } from "@/components/request";
import { AccountId, Amount, Card, ErrorBox, NearNote, Spinner, StatusChip } from "@/components/ui";
import type { RequestView } from "@/lib/near/types";

function Row({ r, names }: { r: RequestView; names: (id: string) => string | null }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0">
      <div className="text-sm">
        <Link href={`/app/requests/${r.id}`} className="font-semibold text-brand underline">
          #{r.id}
        </Link>{" "}
        <Amount base={r.amount} /> → <AccountId id={r.receiver_id} name={names(r.receiver_id)} />
      </div>
      <StatusChip status={r.effective_status} scam={r.reported_as_scam} />
    </li>
  );
}

export default function Dashboard() {
  const { state, loading } = useVault(10_000);
  const { accountId } = useWallet();
  if (loading) return <Spinner label="Reading the vault from NEAR testnet…" />;
  if (!state?.configured)
    return (
      <Card>
        <p className="text-sm text-muted">
          This server has no vault configured. Set NEXT_PUBLIC_VAULT_CONTRACT_ID (see README).
        </p>
      </Card>
    );
  if (state.error) return <ErrorBox>{state.error}</ErrorBox>;
  const members = state.members ?? [];
  const names = (id: string) =>
    memberName(members, id) ?? state.payees?.find((p) => p.account_id === id)?.label ?? null;
  const me = members.find((m) => m.account_id === accountId);
  const waiting = (state.requests ?? []).filter(
    (r) => r.claimed_principal === accountId && r.effective_status === "Pending",
  );
  const mine = (state.requests ?? []).filter((r) => r.requester === accountId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Vault dashboard</h1>
        <WalletButton />
      </div>
      {accountId && !me ? (
        <p className="rounded-lg bg-wash px-3 py-2 text-sm text-muted">
          {accountId} isn’t a member of this vault, so you can look but not request or confirm.
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-3">
        {(["vault_balance", "reserved", "available"] as const).map((k) => (
          <Card key={k}>
            <div className="text-sm text-muted">
              {k === "vault_balance"
                ? "In the vault"
                : k === "reserved"
                  ? "Reserved by held requests"
                  : "Available"}
            </div>
            <div className="mt-1">
              <Amount base={state.balances?.[k] ?? "0"} big />
            </div>
          </Card>
        ))}
      </div>
      {me?.roles.includes("Requester") ? (
        <Link
          href="/app/request"
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-white"
        >
          New payment request
        </Link>
      ) : null}
      {me?.roles.includes("Principal") ? (
        <Card tone={waiting.length ? "held" : "neutral"}>
          <h2 className="text-lg font-semibold">Waiting for you</h2>
          {waiting.length ? (
            <ul>
              {waiting.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 last:border-0 text-sm"
                >
                  <span>
                    #{r.id} · {names(r.requester) ?? r.requester} asks to pay{" "}
                    <Amount base={r.amount} /> to <span className="mono">{r.receiver_id}</span>
                  </span>
                  <Link className="font-semibold text-brand underline" href={`/confirm/${r.id}`}>
                    Review
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing needs your confirmation.</p>
          )}
        </Card>
      ) : null}
      {me?.roles.includes("Requester") ? (
        <Card>
          <h2 className="text-lg font-semibold">My requests</h2>
          {mine.length ? (
            <ul>
              {mine.map((r) => (
                <Row key={r.id} r={r} names={names} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">You haven’t made any requests yet.</p>
          )}
        </Card>
      ) : null}
      <Card>
        <h2 className="text-lg font-semibold">Recent activity</h2>
        {state.requests?.length ? (
          <ul>
            {state.requests.map((r) => (
              <Row key={r.id} r={r} names={names} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No requests yet.</p>
        )}
      </Card>
      <Card tone={state.flags?.length ? "bad" : "neutral"}>
        <h2 className="text-lg font-semibold">Flagged receivers</h2>
        {state.flags?.length ? (
          <ul className="space-y-1 text-sm">
            {state.flags.map((f) => (
              <li key={f.account_id}>
                <span className="mono">{f.account_id}</span> — reported {f.reports}× (first by{" "}
                {names(f.first_reported_by) ?? f.first_reported_by}, request #{f.first_request_id})
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No receivers have been reported.</p>
        )}
      </Card>
      <NearNote title="named accounts">
        Every person is a readable NEAR account (<span className="mono">ceo.…testnet</span>), and
        the vault checks the account itself — not a display name an attacker could copy.
      </NearNote>
    </div>
  );
}
