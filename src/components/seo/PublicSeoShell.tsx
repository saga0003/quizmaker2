import Link from 'next/link';

export function PublicSeoShell({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-[var(--canvas)] text-[var(--foreground)]">
    <header className="border-b border-[#DCE5E2] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-[var(--teal)] sm:text-xl">Evidara</Link>
        <nav className="flex items-center gap-3 text-sm font-medium sm:gap-5">
          <Link href="/question-papers/" className="hidden sm:inline">Question Papers</Link>
          <Link href="/test-series/" className="hidden sm:inline">Test Series</Link>
          <Link href="/products/" className="rounded-lg bg-[var(--teal)] px-3 py-2 text-white text-xs sm:px-4 sm:text-sm">Start Practising</Link>
        </nav>
      </div>
    </header>
    <main className="px-4 sm:px-5">{children}</main>
    <footer className="mt-16 border-t border-[#DCE5E2] bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-[#65757C] sm:px-5 sm:py-8">Evidara · Assessment intelligence, solved questions and test series.</div>
    </footer>
  </div>;
}
