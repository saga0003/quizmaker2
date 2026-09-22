'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, Smartphone } from 'lucide-react';
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

type TotpEnrollment = {
  factorId: string;
  qrCode: string;
  secret: string;
};

class SecurityRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SecurityRequestError';
    this.status = status;
  }
}

function isAuthFailure(value: unknown) {
  if (value instanceof SecurityRequestError && value.status === 401) return true;
  const message = value instanceof Error ? value.message : String(value ?? '');
  return /auth session missing|jwt|token.*(expired|invalid)|invalid.*token|session.*expired|unauthorized/i.test(message);
}

export function CredentialSecurityGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const userId = session?.user.id ?? null;
  const accessToken = session?.access_token ?? null;
  const [security, setSecurity] = useState<SecurityState | null>(null);
  const [securityUserId, setSecurityUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [mfaChecking, setMfaChecking] = useState(false);
  const [mfaReady, setMfaReady] = useState(false);
  const [mfaDismissed, setMfaDismissed] = useState(false);
  const [existingTotpFactorId, setExistingTotpFactorId] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaWorking, setMfaWorking] = useState(false);
  const [mfaError, setMfaError] = useState('');

  const requestSecurity = useCallback(async (token: string) => {
    const response = await fetch('/api/account/security/', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new SecurityRequestError(
        payload.error || `Security check failed (${response.status}).`,
        response.status,
      );
    }
    return payload as SecurityState;
  }, []);

  const returnToLogin = useCallback(async () => {
    try {
      if (supabase) {
        const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
        if (signOutError && !/auth session missing/i.test(signOutError.message)) {
          console.warn('Unable to clear local auth session before login redirect:', signOutError.message);
        }
      }
    } finally {
      window.location.replace('/?view=login');
    }
  }, []);

  const refreshSecurity = useCallback(async (token: string, targetUserId: string, blocking: boolean) => {
    if (blocking) setLoading(true);
    setError('');

    const acceptState = (state: SecurityState) => {
      setSecurity(state);
      setSecurityUserId(targetUserId);
      return state;
    };

    try {
      return acceptState(await requestSecurity(token));
    } catch (value) {
      let failure: unknown = value;

      if (isAuthFailure(failure) && supabase) {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        const refreshedToken = refreshData.session?.access_token ?? null;

        if (!refreshError && refreshedToken) {
          try {
            return acceptState(await requestSecurity(refreshedToken));
          } catch (retryFailure) {
            failure = retryFailure;
          }
        } else if (refreshError) {
          failure = refreshError;
        }

        if (isAuthFailure(failure) || !refreshedToken) {
          await returnToLogin();
          return null;
        }
      }

      setError(failure instanceof Error ? failure.message : 'Unable to verify account security.');
      return null;
    } finally {
      if (blocking) setLoading(false);
    }
  }, [requestSecurity, returnToLogin]);

  useEffect(() => {
    if (!userId || !accessToken) {
      setSecurity(null);
      setSecurityUserId(null);
      setLoading(false);
      return;
    }

    // Supabase may rotate the access token when a background/mobile tab becomes
    // active again. A token refresh is not a new login, so never tear down the
    // current workspace just to repeat the same security check. Re-check only
    // when the signed-in user actually changes.
    if (securityUserId === userId) return;
    setMfaReady(false);
    setMfaDismissed(false);
    setExistingTotpFactorId(null);
    setEnrollment(null);
    setMfaCode('');
    void refreshSecurity(accessToken, userId, true);
  }, [accessToken, refreshSecurity, securityUserId, userId]);

  useEffect(() => {
    if (!userId || !accessToken || typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const params = new URLSearchParams(hash);
    if (!params.has('error') && !params.has('error_code')) return;

    const url = new URL(window.location.href);
    url.hash = '';
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}`);
  }, [accessToken, userId]);

  useEffect(() => {
    if (!security?.privileged || security.mustChangePassword || !supabase || mfaReady || mfaChecking) return;
    let cancelled = false;
    setMfaChecking(true);
    setMfaError('');
    void (async () => {
      try {
        const [{ data: aalData, error: aalError }, { data: factorData, error: factorError }] = await Promise.all([
          supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
          supabase.auth.mfa.listFactors(),
        ]);
        if (aalError) throw aalError;
        if (factorError) throw factorError;
        if (cancelled) return;
        if (aalData.currentLevel === 'aal2') {
          setMfaReady(true);
          return;
        }
        const verifiedTotp = (factorData.totp || []).find((factor) => factor.status === 'verified');
        setExistingTotpFactorId(verifiedTotp?.id || null);
      } catch (value) {
        if (!cancelled) setMfaError(value instanceof Error ? value.message : 'Unable to inspect multi-factor authentication.');
      } finally {
        if (!cancelled) setMfaChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mfaChecking, mfaReady, security]);

  const passwordProblems = useMemo(() => {
    const problems: string[] = [];
    if (password.length < 12) problems.push('Use at least 12 characters.');
    if (!/[A-Z]/.test(password)) problems.push('Add an uppercase letter.');
    if (!/[a-z]/.test(password)) problems.push('Add a lowercase letter.');
    if (!/\d/.test(password)) problems.push('Add a number.');
    if (!/[^A-Za-z0-9]/.test(password)) problems.push('Add a symbol.');
    if (confirmPassword && password !== confirmPassword) problems.push('The passwords do not match.');
    return problems;
  }, [confirmPassword, password]);
  const canAttemptPasswordChange = Boolean(accessToken && userId && password && confirmPassword) && !savingPassword;

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !userId) {
      setError('Your secure session is not ready. Sign in again and retry.');
      return;
    }
    if (!password || !confirmPassword) {
      setError('Enter the new password in both fields.');
      return;
    }
    if (passwordProblems.length) {
      setError(passwordProblems.join(' '));
      return;
    }
    setSavingPassword(true);
    setError('');
    try {
      const response = await fetch('/api/account/security/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'change_password', password }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Password could not be changed.');
      setPassword('');
      setConfirmPassword('');

      // Supabase terminates the current auth session when a password changes.
      // Do not immediately re-check security with the now-stale access token;
      // clear the browser session and require a clean login with the new password.
      await returnToLogin();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Password could not be changed.');
    } finally {
      setSavingPassword(false);
    }
  }

  async function beginTotpEnrollment() {
    if (!supabase) return;
    setMfaWorking(true);
    setMfaError('');
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Evidara authenticator',
      });
      if (enrollError) throw enrollError;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setExistingTotpFactorId(null);
      setMfaCode('');
    } catch (value) {
      setMfaError(value instanceof Error ? value.message : 'Unable to start authenticator setup.');
    } finally {
      setMfaWorking(false);
    }
  }

  async function verifyTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || mfaCode.trim().length < 6) return;
    const factorId = enrollment?.factorId || existingTotpFactorId;
    if (!factorId) return;
    setMfaWorking(true);
    setMfaError('');
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: mfaCode.trim() });
      if (verifyError) throw verifyError;
      const { data: aalData, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aalData.currentLevel !== 'aal2') throw new Error('Authenticator verification completed but the session did not reach AAL2. Please sign in again and retry.');
      setMfaReady(true);
      setMfaDismissed(true);
      setEnrollment(null);
      setMfaCode('');
    } catch (value) {
      setMfaError(value instanceof Error ? value.message : 'The authenticator code could not be verified.');
    } finally {
      setMfaWorking(false);
    }
  }

  if (!loading && error && (!security || securityUserId !== userId)) {
    return (
      <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-10">
        <div className="w-full rounded-2xl border border-[#DDE5E8] bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-bold text-[#14232B]">We couldn’t verify this session</h1>
          <p className="mt-2 text-sm leading-6 text-[#6B7980]">Your secure session could not be confirmed. Retry once, or sign in again.</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={() => {
                if (accessToken && userId) void refreshSecurity(accessToken, userId, true);
              }}
              disabled={!accessToken || !userId}
            >
              Retry
            </Button>
            <Button type="button" variant="outline" onClick={() => void returnToLogin()}>
              Sign in again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !security || securityUserId !== userId) {
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
            <div className="rounded-xl bg-[#F7F9F7] p-4 text-xs leading-5 text-[#5E6E74]">
              <p>Use at least 12 characters with uppercase, lowercase, a number and a symbol. Do not use your name, email or common passwords.</p>
              {(password || confirmPassword) && passwordProblems.length > 0 && <p className="mt-2 font-medium text-[#8A5F00]">Still needed: {passwordProblems.join(' ')}</p>}
            </div>
            {error && <div className="rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]">{error}</div>}
            <Button type="submit" disabled={!canAttemptPasswordChange} className="w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{savingPassword ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}Set password and continue</Button>
          </form>
          <button type="button" onClick={() => void signOut()} className="mt-4 w-full text-center text-xs font-medium text-[#6B7980] hover:text-[#14232B]">Sign out</button>
        </div>
      </div>
    );
  }

  const showMfaSetup = security.privileged && !mfaReady && !mfaDismissed;

  return (
    <>
      {showMfaSetup && (
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <div className="rounded-2xl border border-[#CFE0EB] bg-[#F7FAFF] p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#E8F0FF] text-[#315BC7]"><ShieldCheck className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold text-[#14232B]">Protect this administrator account with an authenticator</h2>
                <p className="mt-1 text-sm leading-6 text-[#5E7380]">Evidara supports TOTP/AAL2 for privileged accounts. Phase 1 mandatory enforcement remains off until the administrator lockout check is completed, so you may set it up now or continue this pilot session.</p>

                {mfaChecking ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-[#5E7380]"><LoaderCircle className="h-4 w-4 animate-spin" />Checking authenticator status…</p>
                ) : enrollment ? (
                  <div className="mt-4 grid gap-5 sm:grid-cols-[180px_1fr] sm:items-start">
                    <div className="rounded-xl border border-[#DCE5E9] bg-white p-3">
                      {/* Supabase returns a self-contained data URI for the TOTP QR code. */}
                      <img src={enrollment.qrCode} alt="Authenticator QR code" className="mx-auto h-36 w-36" />
                    </div>
                    <div>
                      <p className="text-sm text-[#5E7380]">Scan the QR code in Google Authenticator, Microsoft Authenticator, 1Password or another TOTP app. If scanning is unavailable, enter this secret manually:</p>
                      <code className="mt-2 block break-all rounded-lg bg-white px-3 py-2 text-xs text-[#274B68]">{enrollment.secret}</code>
                      <form className="mt-3 flex max-w-sm gap-2" onSubmit={verifyTotp}>
                        <Input inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 8))} />
                        <Button type="submit" disabled={mfaWorking || mfaCode.length < 6}>{mfaWorking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Verify'}</Button>
                      </form>
                    </div>
                  </div>
                ) : existingTotpFactorId ? (
                  <form className="mt-4 flex max-w-md flex-col gap-2 sm:flex-row" onSubmit={verifyTotp}>
                    <Input inputMode="numeric" autoComplete="one-time-code" placeholder="Enter authenticator code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 8))} />
                    <Button type="submit" disabled={mfaWorking || mfaCode.length < 6}>{mfaWorking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : 'Verify authenticator'}</Button>
                  </form>
                ) : (
                  <Button type="button" onClick={() => void beginTotpEnrollment()} disabled={mfaWorking} className="mt-4 bg-[#315BC7] text-white hover:bg-[#284EAB]">
                    {mfaWorking ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Smartphone className="mr-2 h-4 w-4" />}Set up authenticator
                  </Button>
                )}

                {mfaError && <div className="mt-3 rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]">{mfaError}</div>}
                <button type="button" onClick={() => setMfaDismissed(true)} className="mt-3 text-xs font-semibold text-[#607078] hover:text-[#14232B]">Continue pilot session without enforcing MFA</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
