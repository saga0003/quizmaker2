import type { Metadata } from 'next';

import { TrialTest } from '@/components/TrialTest';
import { PublicShell } from '@/components/evidara/public-shell';

export const metadata: Metadata = {
  title: 'Free trial test · Evidara',
  description:
    'Try an eight-question Evidara trial test with MCQs, LaTeX equations and image-based questions — no account needed.',
};

// The trial test is fully client-side (bundled sample questions), so unlike the
// database-backed public library routes it does not depend on the Phase 1
// public-feature flags and is safe to keep live for every visitor.
export default function TrialPage() {
  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <TrialTest />
      </div>
    </PublicShell>
  );
}
