'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function CallbackPage() {
  const [message, setMessage] = useState('Evidara is confirming your Supabase session.');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function finish() {
      if (!supabase) {
        window.location.replace('/');
        return;
      }

      try {
        const params = new URLSearchParams(window.location.search);
        const oauthError = params.get('error_description') || params.get('error');
        if (oauthError) throw new Error(oauthError);

        let { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        const code = params.get('code');
        if (!data.session && code) {
          setMessage('Google sign-in succeeded. Evidara is creating your secure session.');
          const exchange = await supabase.auth.exchangeCodeForSession(code);
          if (exchange.error) throw exchange.error;
          data = { session: exchange.data.session };
        }

        if (!data.session) {
          throw new Error('Google sign-in completed, but no Evidara session was created. Please start the login again.');
        }
        if (!active) return;

        localStorage.removeItem('evidara_after_login');
        localStorage.removeItem('scholaros_after_login');

        // Use one full-page navigation after PKCE completion. Do not refresh or
        // rewrite the callback URL first; on Vercel that can reload this route
        // before Next.js finishes the client-side redirect.
        window.location.replace('/');
      } catch (caught) {
        if (!active) return;
        setFailed(true);
        setMessage(caught instanceof Error ? caught.message : 'Unable to complete Google sign-in.');
      }
    }

    void finish();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F9F7] px-4">
      <div className={`max-w-md rounded-2xl border bg-white px-8 py-7 text-center shadow-sm ${failed ? 'border-[#E5B5B5]' : 'border-[#DCE9E7]'}`}>
        {!failed && <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#DCE9E7] border-t-[#0E5A5A]" />}
        <h2 className={`font-semibold ${failed ? 'text-[#A33A3A]' : 'text-[#14232B]'}`}>{failed ? 'Sign-in could not be completed' : 'Completing sign-in…'}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#6B7980]">{message}</p>
        {failed && <button type="button" onClick={() => window.location.replace('/')} className="mt-5 rounded-lg bg-[#0E5A5A] px-4 py-2 text-sm font-semibold text-white">Return to Evidara</button>}
      </div>
    </main>
  );
}
