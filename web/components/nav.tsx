"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { GithubMark, LogoMark, REPO } from "./brand";

const LINKS = [
  { href: "/demo", label: "Guided demo" },
  { href: "/app", label: "Wallet app" },
  { href: "/admin", label: "Vault settings" },
];

export function Nav() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const dark = path === "/" && !scrolled;
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-colors duration-300 ${
        dark ? "bg-transparent text-white" : "glass border-b border-line/80 text-ink"
      } ${path === "/" ? "-mb-[65px]" : ""}`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4" aria-label="Main">
        <Link
          href="/"
          className="flex items-center gap-2 text-[15px] font-semibold tracking-tight"
          onClick={() => setOpen(false)}
        >
          <LogoMark />
          Callsign
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                path.startsWith(l.href)
                  ? dark
                    ? "bg-white/10 text-white"
                    : "bg-ink/5 font-medium text-ink"
                  : dark
                    ? "text-white/70 hover:bg-white/10 hover:text-white"
                    : "text-muted hover:bg-ink/5 hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="ml-auto hidden items-center gap-3 md:flex">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${
              dark ? "bg-white/10 text-white/80" : "bg-ok-bg text-ok"
            }`}
          >
            <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-ok-line" />
            Live on NEAR testnet
          </span>
          <a
            href={REPO}
            className={`rounded-lg p-2 transition ${dark ? "hover:bg-white/10" : "hover:bg-ink/5"}`}
            aria-label="Source on GitHub"
          >
            <GithubMark size={18} />
          </a>
          <Link
            href="/demo"
            className="rounded-lg bg-gradient-to-r from-brand to-brand-2 px-3.5 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition hover:brightness-110"
          >
            Try the demo
          </Link>
        </div>
        <button
          className={`ml-auto rounded-lg p-2 md:hidden ${dark ? "hover:bg-white/10" : "hover:bg-ink/5"}`}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>
      {open ? (
        <div className="glass border-t border-line px-4 pb-4 text-ink md:hidden">
          {[...LINKS, { href: REPO, label: "GitHub" }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-3 text-sm font-medium hover:bg-ink/5"
            >
              {l.label}
            </Link>
          ))}
        </div>
      ) : null}
    </header>
  );
}
