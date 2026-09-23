import Link from 'next/link';

import { siteConfig } from '@/config/site';
import { PublicShell } from '@/components/evidara/public-shell';

/**
 * Layout for the public legal pages (terms, privacy, refund policy, contact).
 * Built on the current design system; never displays internal setup state.
 */
export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">{siteConfig.brandName}</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--foreground)] sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">Effective date: {siteConfig.effectiveDate}</p>
        <article className="legal-copy mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 leading-7 text-[var(--foreground)] shadow-[var(--ev-shadow-sm)] sm:p-10">
          {children}
        </article>
        <nav aria-label="Legal pages" className="mt-8 flex flex-wrap gap-5 text-sm font-semibold text-[var(--teal)]">
          <Link href="/terms/" className="hover:underline">Terms</Link>
          <Link href="/privacy/" className="hover:underline">Privacy</Link>
          <Link href="/refund-policy/" className="hover:underline">Refund Policy</Link>
          <Link href="/contact/" className="hover:underline">Contact</Link>
        </nav>
      </div>
      <style>{`.legal-copy h2{font-size:1.15rem;font-weight:700;margin-top:28px;margin-bottom:8px}.legal-copy p{margin:10px 0}.legal-copy li{margin:7px 0}.legal-copy a{text-decoration:underline}.legal-copy code{background:var(--muted);padding:2px 6px;border-radius:6px;font-size:0.85em}`}</style>
    </PublicShell>
  );
}
