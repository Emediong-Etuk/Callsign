import { WalletProvider } from "@/components/wallet";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="bg-dots min-h-[70vh]">
        <div className="mx-auto max-w-6xl px-4 py-10">{children}</div>
      </div>
    </WalletProvider>
  );
}
