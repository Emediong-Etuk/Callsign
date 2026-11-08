import type { Metadata } from "next";
import { DemoConsole } from "@/components/demo-console";

export const metadata: Metadata = { title: "Guided demo — Callsign" };

export default function DemoPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Guided demo</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Acme Ltd (fictional) keeps its money in a Callsign vault on NEAR testnet. Play Tolu in
          finance, then switch to Ada, the CEO. Start with the deepfake wire.
        </p>
      </header>
      <DemoConsole />
    </div>
  );
}
