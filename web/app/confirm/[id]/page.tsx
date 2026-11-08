"use client";
import { use, useState } from "react";
import { ConfirmCard } from "@/components/request";
import { useRequest } from "@/components/request-loader";
import { WalletButton, useWallet } from "@/components/wallet";
import { ErrorBox, Spinner, TxLink } from "@/components/ui";
import { friendlyError } from "@/lib/errors";

/** Mobile-first page the principal opens: "Did you ask … ?" */
export default function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, reload } = useRequest(id);
  const { accountId, callVault } = useWallet();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);

  const act = async (method: "confirm_payout" | "reject_payout") => {
    setBusy(true);
    setActionError(null);
    try {
      const r =
        method === "confirm_payout"
          ? await callVault("confirm_payout", { id }, "1") // 1 yoctoNEAR → wallet approval (G2)
          : await callVault("reject_payout", {
              id,
              reason: "I did not send this request",
              report_scam: true,
            });
      setTx(r.hash);
      await reload();
    } catch (e) {
      setActionError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <WalletButton />
      </div>
      {error ? <ErrorBox>{error}</ErrorBox> : null}
      {!data && !error ? <Spinner label="Loading request…" /> : null}
      {data ? (
        <ConfirmCard
          request={data.request}
          members={data.members}
          viewerId={accountId}
          busy={busy}
          onConfirm={() => void act("confirm_payout")}
          onReject={() => void act("reject_payout")}
          confirmNote="Releasing opens your wallet to approve (it attaches 1 yoctoNEAR)."
        />
      ) : null}
      {actionError ? <ErrorBox>{actionError}</ErrorBox> : null}
      {tx ? (
        <p className="text-center">
          <TxLink hash={tx} />
        </p>
      ) : null}
    </div>
  );
}
