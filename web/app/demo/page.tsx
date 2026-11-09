import type { Metadata } from "next";
import { DemoConsole } from "@/components/demo-console";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Guided demo — Callsign" };

export default function DemoPage() {
  return (
    <>
      <PageHeader
        eyebrow="Guided demo · live on NEAR testnet"
        title="Stop a deepfake payment — in 60 seconds"
      >
        Acme Ltd (fictional) keeps its money in a Callsign vault. Play Tolu in finance, then switch
        to Ada, the CEO. Start with the deepfake wire.
      </PageHeader>
      <Container>
        <DemoConsole />
      </Container>
    </>
  );
}
