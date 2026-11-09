import { WalletProvider } from "@/components/wallet";

export default function ConfirmLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <div className="min-h-[80vh] bg-gradient-to-b from-wash via-paper to-wash">
        <div className="mx-auto max-w-xl px-4 py-8">{children}</div>
      </div>
    </WalletProvider>
  );
}
