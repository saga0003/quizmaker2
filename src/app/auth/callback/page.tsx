'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function CallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('Evidara is confirming your Supabase session.');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      if (!supabase) {
        router.replace('/');
        return;
      }

      try {
        const code = new URLSearchParams(window.location.search).get('code');
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error('Google sign-in completed, but no Evidara session was created.');
        if (cancelled) return;

        localStorage.removeItem('evidara_after_login');
        localStorage.removeItem('scholaros_after_login');
        window.history.replaceState({}, document.title, '/auth/callback/');
        router.replace('/');
        router.refresh();
      } catch (caught) {
        if (cancelled) return;
        setFailed(true);
        setMessage(caught instanceof Error ? caught.message : 'Unable to complete Google sign-in.');
      }
    }

    void finish();
    return () => { cancelled = true; };
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F9F7] px-4">
      <div className={`max-w-md rounded-2xl border bg-white px-8 py-7 text-center shadow-sm ${failed ? 'border-[#E5B5B5]' : 'border-[#DCE9E7]'}`}>
        {!failed && <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#DCE9E7] border-t-[#0E5A5A]" />}
        <h2 className={`font-semibold ${failed ? 'text-[#A33A3A]' : 'text-[#14232B]'}`}>{failed ? 'Sign-in could not be completed' : 'Completing sign-in…'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7980]">{message}</p>
        {failed && <button type="button" onClick={() => router.replace('/')} className="mt-5 rounded-lg bg-[#0E5A5A] px-4 py-2 text-sm font-semibold text-white">Return to Evidara</button>}
      </div>
    </main>
  );
}
