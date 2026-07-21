'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CallbackPage() {
  const router = useRouter();

  useEffect(() => {
    async function finish() {
      if (!supabase) {
        router.replace('/');
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (!error && data.session) {
        localStorage.removeItem('evidara_after_login');
        localStorage.removeItem('scholaros_after_login');
        router.replace('/');
        router.refresh();
        return;
      }

      window.setTimeout(() => router.replace('/'), 1200);
    }

    void finish();
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F9F7]">
      <div className="rounded-2xl border border-[#DCE9E7] bg-white px-8 py-7 text-center shadow-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#DCE9E7] border-t-[#0E5A5A]" />
        <h2 className="font-semibold text-[#14232B]">Completing sign-in…</h2>
        <p className="mt-1 text-sm text-[#6B7980]">Evidara is confirming your Supabase session.</p>
      </div>
    </main>
  );
}
