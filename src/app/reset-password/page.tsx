'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CheckCircle2, KeyRound, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';

type RecoveryStatus = 'checking' | 'ready' | 'invalid' | 'unavailable' | 'updated';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<RecoveryStatus>('checking');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setStatus('unavailable');
      setMessage('Password recovery is unavailable because Evidara cloud is not configured.');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const recoveryError = params.get('error_description') || params.get('error');
    if (recoveryError) {
      setStatus('invalid');
      setMessage('This recovery link is invalid or has expired. Request a new link to continue.');
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || session) {
        setStatus('ready');
        setMessage('');
      }
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.session) {
        setStatus('invalid');
        setMessage('This recovery link is invalid or has expired. Request a new link to continue.');
        return;
      }
      setStatus('ready');
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (password.length < 8) {
      setMessage('Use at least 8 characters for your new password.');
      return;
    }
    if (password !== confirm) {
      setMessage('Passwords do not match.');
      return;
    }
    if (!supabase || status !== 'ready') {
      setMessage('Your recovery session is not available. Request a new recovery link.');
      return;
    }

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);

    if (error) {
      setMessage(
        'Evidara could not update your password. The recovery link may have expired; request a new one and try again.',
      );
      return;
    }

    setPassword('');
    setConfirm('');
    setStatus('updated');
    setMessage('Your password has been updated successfully.');
  }

  const canEdit = status === 'ready';
  const showFailure = status === 'invalid' || status === 'unavailable';

  return (
    <main className="grid min-h-screen place-items-center bg-[#F7F9F7] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[#DCE9E7] bg-white p-6 shadow-sm sm:p-8">
        <Link href="/" className="inline-block">
          <Logo variant="dark" />
        </Link>

        {status === 'checking' ? (
          <div className="py-12 text-center" aria-live="polite">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-[#0E5A5A]" />
            <h1 className="mt-4 text-xl font-semibold text-[#14232B]">Checking your recovery link</h1>
            <p className="mt-2 text-sm text-[#6B7980]">
              Evidara is confirming your secure recovery session.
            </p>
          </div>
        ) : status === 'updated' ? (
          <div className="py-8 text-center" aria-live="polite">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 text-2xl font-semibold text-[#14232B]">Password updated</h1>
            <p className="mt-2 text-sm text-[#6B7980]">{message}</p>
            <Button asChild className="mt-6 w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
              <Link href="/">Continue to Evidara</Link>
            </Button>
          </div>
        ) : showFailure ? (
          <div className="py-8 text-center" aria-live="polite">
            <TriangleAlert className="mx-auto h-10 w-10 text-[#B54747]" />
            <h1 className="mt-4 text-2xl font-semibold text-[#14232B]">
              Recovery link unavailable
            </h1>
            <p className="mt-2 text-sm leading-6 text-[#6B7980]">{message}</p>
            <Button asChild className="mt-6 w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
              <Link href="/login/">Request another link</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DCE9E7] text-[#0E5A5A]">
                <KeyRound className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-2xl font-semibold text-[#14232B]">
                Choose a new password
              </h1>
              <p className="mt-2 text-sm leading-6 text-[#6B7980]">
                Use at least 8 characters and keep this password private.
              </p>
            </div>

            <form onSubmit={save} className="mt-6 grid gap-4">
              <label className="grid gap-1.5 text-sm font-medium text-[#14232B]">
                New password
                <Input
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={!canEdit || busy}
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium text-[#14232B]">
                Confirm password
                <Input
                  type="password"
                  minLength={8}
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  disabled={!canEdit || busy}
                  required
                />
              </label>
              <Button
                disabled={!canEdit || busy}
                className="mt-1 bg-[#0E5A5A] text-white hover:bg-[#0A4747]"
              >
                {busy ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                {busy ? 'Updating password…' : 'Update password'}
              </Button>
            </form>

            {message && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]"
              >
                {message}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
