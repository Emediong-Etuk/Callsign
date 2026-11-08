import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Callsign — a payment firewall against deepfake scams",
  description:
    "A deepfake can copy a face and a voice. It can't sign with a private key. Callsign holds risky payouts until the real person confirms from their own NEAR account.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1e3a5f" };

const REPO = "https://github.com/Emediong-Etuk/Callsign";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 bg-white px-3 py-2"
        >
          Skip to content
        </a>
        <header className="border-b border-line bg-paper">
          <nav
            className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
            aria-label="Main"
          >
            <Link href="/" className="flex items-center gap-2 font-semibold text-brand">
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 3l7 3v6c0 4.4-3 8-7 9-4-1-7-4.6-7-9V6l7-3z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              Callsign
            </Link>
            <Link href="/demo" className="text-sm text-muted hover:text-ink">
              Guided demo
            </Link>
            <Link href="/app" className="text-sm text-muted hover:text-ink">
              Wallet app
            </Link>
            <Link href="/admin" className="text-sm text-muted hover:text-ink">
              Vault settings
            </Link>
            <a href={REPO} className="ml-auto text-sm text-muted hover:text-ink">
              GitHub
            </a>
          </nav>
        </header>
        <main id="main" className="mx-auto max-w-5xl px-4 py-8">
          {children}
        </main>
        <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-xs text-muted">
          Built at NEAR HACKATHON 2026 · Testnet only · Demo company, people and the tUSD token are
          fictional ·{" "}
          <a className="underline" href={REPO}>
            Source (MIT)
          </a>
        </footer>
      </body>
    </html>
  );
}
