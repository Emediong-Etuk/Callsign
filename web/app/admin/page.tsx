"use client";
import { useVault } from "@/components/use-vault";
import { AccountId, Amount, Card, ErrorBox, Spinner } from "@/components/ui";

/** Read-only vault settings. Changes are made with the owner scripts (see README); a write UI was cut for time. */
export default function Admin() {
  const { state, loading } = useVault();
  if (loading) return <Spinner label="Loading vault settings…" />;
  if (!state?.configured || state.error)
    return <ErrorBox>{state?.error ?? "No vault configured on this server."}</ErrorBox>;
  const p = state.config!.policy;
  const holdS = Number(BigInt(p.hold_window_ns) / 1_000_000_000n);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Vault settings</h1>
      <p className="text-sm text-muted">
        Read-only view of the on-chain configuration. The owner (
        <span className="mono">{state.config!.owner_id}</span>) changes it with owner-only,
        wallet-signed calls; this demo does that from the scripts.
      </p>
      <Card>
        <h2 className="font-semibold">Policy</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            Instant limit: <Amount base={p.instant_limit} />
          </li>
          <li>
            Hold window: {Math.round(holdS / 60)} min ({holdS}s), × {p.high_risk_hold_multiplier}{" "}
            when risk is high
          </li>
          <li>Max held requests per requester: {p.max_pending_per_requester}</li>
          <li>
            Token: <AccountId id={state.config!.token_id} />
          </li>
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Members</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {state.members?.map((m) => (
            <li key={m.account_id}>
              <AccountId id={m.account_id} name={`${m.display_name} (${m.title})`} /> —{" "}
              {m.roles.join(" + ")}
              {m.active ? "" : " · inactive"}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="font-semibold">Known payees</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {state.payees?.map((p2) => (
            <li key={p2.account_id}>
              <AccountId id={p2.account_id} name={p2.label} />
            </li>
          ))}
        </ul>
      </Card>
      <Card tone={state.flags?.length ? "bad" : "neutral"}>
        <h2 className="font-semibold">Flagged receivers</h2>
        {state.flags?.length ? (
          <ul className="mt-2 space-y-1 text-sm">
            {state.flags.map((f) => (
              <li key={f.account_id}>
                <span className="mono">{f.account_id}</span> · {f.reports} report(s)
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">None.</p>
        )}
      </Card>
    </div>
  );
}
