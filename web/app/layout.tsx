import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { LogoMark, REPO } from "@/components/brand";
import { Nav } from "@/components/nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Callsign — a payment firewall against deepfake scams",
  description:
    "A deepfake can copy a face and a voice. It can't sign with a private key. Callsign holds risky payouts until the real person confirms from their own NEAR account.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#070b17" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only z-[60] rounded-lg bg-white px-3 py-2 focus:not-sr-only focus:fixed focus:left-2 focus:top-2"
        >
          Skip to content
        </a>
        <Nav />
        <main id="main">{children}</main>
        <footer className="border-t border-line bg-paper">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <div className="flex items-center gap-2 font-semibold">
                <LogoMark size={24} /> Callsign
              </div>
              <p className="mt-3 max-w-sm text-sm text-muted">
                A deepfake can copy a face and a voice. It can’t sign with a private key. Built at
                NEAR HACKATHON 2026.
              </p>
              <p className="mt-3 text-xs text-subtle">
                Testnet only · Acme Ltd, its people and the tUSD token are fictional · MIT licensed
              </p>
            </div>
            <div className="text-sm">
              <div className="font-semibold">Product</div>
              <ul className="mt-3 space-y-2 text-muted">
                <li>
                  <Link className="hover:text-ink" href="/demo">
                    Guided demo
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-ink" href="/app">
                    Wallet app
                  </Link>
                </li>
                <li>
                  <Link className="hover:text-ink" href="/admin">
                    Vault settings
                  </Link>
                </li>
              </ul>
            </div>
            <div className="text-sm">
              <div className="font-semibold">Verify it</div>
              <ul className="mt-3 space-y-2 text-muted">
                <li>
                  <a className="hover:text-ink" href={REPO}>
                    Source on GitHub
                  </a>
                </li>
                <li>
                  <a
                    className="hover:text-ink"
                    href="https://testnet.nearblocks.io/address/vault.callsign-fdym.testnet"
                  >
                    Vault on nearblocks
                  </a>
                </li>
                <li>
                  <a className="hover:text-ink" href="https://cloud.near.ai/verify">
                    NEAR AI Verification Center
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
