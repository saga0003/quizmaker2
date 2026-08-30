'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';


type SecurityState = {
  mustChangePassword: boolean;
  temporaryIssuedAt: string | null;
  passwordChangedAt: string | null;
  privileged: boolean;
  role: string;
};

type MfaMode = 'checking' | 'enroll' | 'challenge' | 'ready';

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

export function CredentialSecurityGate({ children }: { children: ReactNode }) {
  const { session, profile, signOut } = useAuth();
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [mfaMode, setMfaMode] = useState<MfaMode>('checking');
  const [factorId, setFactorId] = useState('');
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  const requestSecurity = useCallback(async () => {
    if (!session?.access_token) return null;
    const response = await fetch('/api/account/security/', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Security check failed (${response.status}).`);
    return payload as SecurityState;
  }, [session?.access_token]);

  const checkMfa = useCallback(async (state: SecurityState) => {
    if (!state.privileged || !supabase) {
      setMfaMode('ready');
      return;
    }
    setMfaMode('checking');
    const assurance = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw assurance.error;
    if (assurance.data.currentLevel === 'aal2') {
      setMfaMode('ready');
      return;
    }

    const factors = await supabase.auth.mfa.listFactors();
    if (factors.error) throw factors.error;
    const verified = factors.data.totp.find((factor) => factor.status === 'verified');
    if (verified) {
      setFactorId(verified.id);
      setMfaMode('challenge');
      return;
    }

    const enroll = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Evidara privileged access' });
    if (enroll.error) throw enroll.error;
    setEnrollment({
      factorId: enroll.data.id,
      qrCode: enroll.data.totp.qr_code,
      secret: enroll.data.totp.secret,
    });
    setFactorId(enroll.data.id);
    setMfaMode('enroll');
  }, []);

  const refresh = useCallback(async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const state = await requestSecurity();
      if (!state) return;
      setSecurity(state);
      if (state.mustChangePassword) {
        setMfaMode('checking');
      } else {
        await checkMfa(state);
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to verify account security.');
    } finally {
      setLoading(false);
    }
  }, [checkMfa, requestSecurity, session?.access_token]);

  useEffect(() => { void refresh(); }, [refresh]);

  const passwordReady = useMemo(() => (
    password.length >= 12
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password)
    && password === confirmPassword
  ), [confirmPassword, password]);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.access_token || !passwordReady) return;
    setSavingPassword(true);
    setError('');
    try {
      const response = await fetch('/api/account/security/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'change_password', password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Password could not be changed.');
      setPassword('');
      setConfirmPassword('');
      await refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Password could not be changed.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function verifyMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !factorId || mfaCode.trim().length !== 6) return;
    setMfaBusy(true);
    setError('');
    try {
      const result = await supabase.auth.mfa.challengeAndVerify({ factorId, code: mfaCode.trim() });
      if (result.error) throw result.error;
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      setMfaCode('');
      setMfaMode('ready');
      window.location.reload();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'MFA verification failed.');
    } finally {
      setMfaBusy(false);
    }
  }

  if (loading || !security) {
    return (
      <div className="grid min-h-[65vh] place-items-center">
        <div className="text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin text-[#0E5A5A]" />Verifying account security…</div>
      </div>
    );
  }

  if (security.mustChangePassword) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-[#DDE5E8] bg-white p-6 shadow-sm sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#EAF6F4] text-[#0E5A5A]"><KeyRound className="h-6 w-6" /></div>
          <h1 className="mt-5 text-2xl font-bold text-[#14232B]">Create your private password</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B7980]">Your school issued a temporary password. You must replace it before any Evidara workspace or student data can be opened.</p>
          <form className="mt-6 space-y-4" onSubmit={changePassword}>
            <div><label htmlFor="new-password" className="text-sm font-medium text-[#14232B]">New password</label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2" /></div>
            <div><label htmlFor="confirm-password" className="text-sm font-medium text-[#14232B]">Confirm password</label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2" /></div>
            <div className="rounded-xl bg-[#F7F9F7] p-4 text-xs leading-5 text-[#5E6E74]">Use at least 12 characters with uppercase, lowercase, a number and a symbol. Do not use your name, email or common passwords.</div>
            {error && <div className="rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]">{error}</div>}
            <Button type="submit" disabled={!passwordReady || savingPassword} className="w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{savingPassword ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Set password and continue</Button>
          </form>
          <button type="button" onClick={() => void signOut()} className="mt-4 w-full text-center text-xs font-medium text-[#6B7980] hover:text-[#14232B]">Sign out</button>
        </div>
      </div>
    );
  }

  if (security.privileged && mfaMode !== 'ready') {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-[#DDE5E8] bg-white p-6 shadow-sm sm:p-8">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[#EAF6F4] text-[#0E5A5A]"><ShieldCheck className="h-6 w-6" /></div>
          <h1 className="mt-5 text-2xl font-bold text-[#14232B]">Multi-factor verification required</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B7980]">{profile?.full_name || 'This privileged account'} can manage institution or platform data, so Evidara requires an authenticator code before the workspace is unlocked.</p>

          {mfaMode === 'checking' && <div className="mt-6 flex items-center gap-2 rounded-xl bg-[#F7F9F7] p-4 text-sm text-[#6B7980]"><LoaderCircle className="h-4 w-4 animate-spin" />Checking your authenticator…</div>}

          {mfaMode === 'enroll' && enrollment && (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-[#E7ECEB] bg-white p-4 text-center"><img src={enrollment.qrCode} alt="Authenticator QR code" className="mx-auto h-48 w-48" /></div>
              <div className="rounded-xl bg-[#F7F9F7] p-4 text-xs leading-5 text-[#5E6E74]">Scan the QR code in Google Authenticator, Microsoft Authenticator, 1Password or another TOTP app. If scanning is unavailable, enter this setup key: <strong className="break-all text-[#14232B]">{enrollment.secret}</strong></div>
            </div>
          )}

          {(mfaMode === 'enroll' || mfaMode === 'challenge') && (
            <form className="mt-5 space-y-4" onSubmit={verifyMfa}>
              <div><label htmlFor="mfa-code" className="text-sm font-medium text-[#14232B]">6-digit authenticator code</label><Input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="mt-2 text-center text-lg tracking-[0.35em]" /></div>
              {error && <div className="rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]">{error}</div>}
              <Button type="submit" disabled={mfaCode.length !== 6 || mfaBusy} className="w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{mfaBusy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}Verify and unlock Evidara</Button>
            </form>
          )}

          {error && mfaMode === 'checking' && <div className="mt-5 rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]">{error}</div>}
          <button type="button" onClick={() => void signOut()} className="mt-4 w-full text-center text-xs font-medium text-[#6B7980] hover:text-[#14232B]">Sign out</button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
