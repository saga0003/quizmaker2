import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { siteConfig } from '@/config/site';

/**
 * Shared header/footer for the public marketing and legal pages, built on the
 * current Evidara design system (teal-on-white, var-based tokens).
 */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)]">
      <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" aria-label="Evidara home">
            <Image src="/brand/evidara-logo-dark.png" alt="Evidara" width={140} height={36} className="h-9 w-auto" priority />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/trial/"
              className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] sm:block"
            >
              Free demo test
            </Link>
            <Link
              href="/?view=login"
              className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]"
            >
              Sign in
            </Link>
            <Link
              href="/?view=register-school"
              className="rounded-lg bg-[var(--teal)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[var(--teal)]/90"
            >
              Start with Evidara
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[var(--line)] bg-[var(--midnight)] text-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Image src="/brand/evidara-logo-light.png" alt="Evidara" width={120} height={30} className="h-8 w-auto" />
          <div className="flex flex-wrap gap-5 text-white/65">
            <Link href="/privacy/" className="transition-colors hover:text-white/90">Privacy</Link>
            <Link href="/terms/" className="transition-colors hover:text-white/90">Terms</Link>
            <Link href="/refund-policy/" className="transition-colors hover:text-white/90">Refunds</Link>
            <Link href="/contact/" className="transition-colors hover:text-white/90">Contact</Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-7xl px-4 pb-6 text-xs text-white/40 sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {siteConfig.brandName}
        </div>
      </footer>
    </div>
  );
}
