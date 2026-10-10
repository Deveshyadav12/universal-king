"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, Sparkles, X } from "lucide-react";

const navigation = [
  { href: "/product", label: "Product" },
  { href: "/solutions", label: "Solutions" },
  { href: "/platform", label: "Platform" },
  { href: "/pricing", label: "Pricing" },
  { href: "/developers", label: "Developers" },
  { href: "/docs", label: "Docs" },
];

export function PublicShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen overflow-hidden bg-[#05070b] text-white">
      <header className="relative z-40 border-b border-white/[0.07] bg-[#05070b]/80 backdrop-blur-2xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link
            href="/"
            className="flex items-center gap-3"
            aria-label="HexaWave home"
            onClick={() => setMenuOpen(false)}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-gradient-to-br from-cyan-300 to-blue-600 text-black shadow-[0_0_25px_rgba(34,211,238,0.18)]">
              <Sparkles size={17} />
            </span>
            <span className="text-[16px] font-bold tracking-tight">
              HEXA<span className="text-cyan-300">WAVE</span>
            </span>
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 text-[12px] text-white/55 lg:flex"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className="rounded-lg px-4 py-2.5 text-[12px] text-white/60 transition hover:bg-white/[0.05] hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-[12px] font-bold text-black transition hover:bg-cyan-100"
            >
              Get Started
              <ArrowUpRight size={14} />
            </Link>
          </div>

          <button
            type="button"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white/75 lg:hidden"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-navigation"
            aria-label="Mobile navigation"
            className="absolute inset-x-0 top-full border-b border-white/10 bg-[#080b11] px-5 py-4 shadow-2xl lg:hidden"
          >
            <div className="mx-auto flex max-w-7xl flex-col gap-1">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-3 text-sm text-white/70 hover:bg-white/[0.05] hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-2 border-t border-white/[0.07] pt-3">
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-3 text-center text-sm text-white/75"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMenuOpen(false)}
                  className="flex-1 rounded-lg bg-white px-4 py-3 text-center text-sm font-bold text-black"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </nav>
        )}
      </header>

      {children}

      <footer className="border-t border-white/[0.07] bg-[#07090e] px-5 py-12 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-blue-600 text-black">
                <Sparkles size={15} />
              </span>
              <span className="text-sm font-bold">
                HEXA<span className="text-cyan-300">WAVE</span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-xs leading-6 text-white/40">
              An AI-native software factory for turning ideas into tested,
              working software.
            </p>
          </div>

          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Explore
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-xs text-white/55">
              <Link href="/product" className="hover:text-white">Product</Link>
              <Link href="/solutions" className="hover:text-white">Solutions</Link>
              <Link href="/platform" className="hover:text-white">Platform</Link>
              <Link href="/pricing" className="hover:text-white">Pricing</Link>
            </div>
          </div>

          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Resources
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-xs text-white/55">
              <Link href="/developers" className="hover:text-white">Developers</Link>
              <Link href="/docs" className="hover:text-white">Documentation</Link>
              <Link href="/company" className="hover:text-white">Company</Link>
              <Link href="/contact" className="hover:text-white">Contact</Link>
            </div>
          </div>

          <div>
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
              Workspace
            </h2>
            <div className="mt-4 flex flex-col gap-3 text-xs text-white/55">
              <Link href="/login" className="hover:text-white">Log in</Link>
              <Link href="/register" className="hover:text-white">Get started</Link>
              <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
              <Link href="/ai-developer" className="hover:text-white">AI Developer</Link>
            </div>
          </div>
        </div>
        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/[0.07] pt-5 text-[10px] text-white/30 sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 HexaWave</span>
          <span>Build the future, one idea at a time.</span>
        </div>
      </footer>
    </div>
  );
}
