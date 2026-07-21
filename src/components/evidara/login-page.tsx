'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Check, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';

const leftBullets = [
  'Secure proctored exams',
  'Real-time analytics',
  'Achievement certificates',
];

const demoAccounts = [
  {
    role: 'admin' as const,
    label: 'Super Admin',
    description: 'Platform management',
    className: 'bg-[#14232B] text-white hover:bg-[#14232B]/90',
  },
  {
    role: 'school' as const,
    label: 'School Admin',
    description: 'School dashboard',
    className: 'bg-[#0E5A5A] text-white hover:bg-[#0a4a4a]',
  },
  {
    role: 'student' as const,
    label: 'Student',
    description: 'Student portal',
    className: 'bg-transparent text-[#0E5A5A] border-2 border-[#0E5A5A] hover:bg-[#DCE9E7]',
  },
];

export default function LoginPage() {
  const { login, setView } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  async function handlePasswordSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setIsError(false);

    if (!supabase) {
      login('student');
      return;
    }

    if (!email.trim() || !password) {
      setIsError(true);
      setMessage('Enter your email address and password.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      setMessage('Sign-in successful. Opening your Evidara workspace…');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleSignIn() {
    setMessage('');
    setIsError(false);

    if (!supabase) {
      login('student');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback/`,
          queryParams: { prompt: 'select_account' },
        },
      });
      if (error) throw error;
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Unable to start Google sign-in.');
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    setMessage('');
    setIsError(false);

    if (!supabase) {
      setMessage('Password recovery is available when Supabase is configured.');
      return;
    }
    if (!email.trim()) {
      setIsError(true);
      setMessage('Enter your email address first.');
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setMessage('Password recovery instructions have been sent to your email.');
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : 'Unable to send password recovery email.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-[40%] lg:w-[42%] bg-[#14232B] relative overflow-hidden flex-col justify-between p-8 lg:p-12">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0E5A5A]/10 rounded-full blur-3xl translate-x-1/3 -translate-y-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-[#2E6D8B]/10 rounded-full blur-3xl -translate-x-1/3 translate-y-1/3 pointer-events-none" />

        <div className="relative z-10">
          <Image
            src="/brand/evidara-logo-light.png"
            alt="Evidara"
            width={140}
            height={36}
            className="h-9 w-auto"
            priority
          />

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-16 lg:mt-24"
          >
            <h1 className="text-3xl lg:text-4xl font-bold text-white leading-tight">Welcome Back</h1>
            <p className="mt-4 text-lg text-white/60 leading-relaxed max-w-sm">
              Evidence-driven learning starts here. Sign in to access your dashboard, assessments, and analytics.
            </p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="relative z-10 space-y-4 mt-12"
        >
          {leftBullets.map((bullet) => (
            <div key={bullet} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[#0E5A5A] flex items-center justify-center shrink-0">
                <Check className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm text-white/70">{bullet}</span>
            </div>
          ))}
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-12 bg-white">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="md:hidden mb-8">
            <Image
              src="/brand/evidara-logo-dark.png"
              alt="Evidara"
              width={140}
              height={36}
              className="h-9 w-auto"
              priority
            />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#14232B]">Sign in to Evidara</h2>
            <p className="mt-2 text-[#6B7980]">
              {isSupabaseConfigured ? 'Use your Evidara cloud account.' : 'Interactive demo mode is active.'}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handlePasswordSignIn}>
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-[#14232B]">Email</label>
              <Input
                id="email"
                type="email"
                placeholder="you@school.edu"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className="h-11 border-[#E7ECEB] focus-visible:ring-[#0E5A5A] focus-visible:border-[#0E5A5A] bg-[#F7F9F7]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-[#14232B]">Password</label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="h-11 pr-10 border-[#E7ECEB] focus-visible:ring-[#0E5A5A] focus-visible:border-[#0E5A5A] bg-[#F7F9F7]"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7980] hover:text-[#14232B] transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded border-[#E7ECEB] text-[#0E5A5A] focus:ring-[#0E5A5A]" />
                <span className="text-[#6B7980]">Remember me</span>
              </label>
              <button
                type="button"
                onClick={() => void handlePasswordReset()}
                className="text-[#0E5A5A] font-medium hover:text-[#0a4a4a] transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={busy}
              className="w-full h-11 bg-[#0E5A5A] hover:bg-[#0a4a4a] text-white font-semibold text-sm"
            >
              {busy ? 'Please wait…' : 'Sign In'}
              {!busy && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <div className="relative my-8">
            <Separator className="bg-[#E7ECEB]" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-[#6B7980]">or continue with</span>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => void handleGoogleSignIn()}
            className="w-full h-11 border-[#E7ECEB] text-[#14232B] hover:bg-[#F7F9F7] font-medium text-sm"
          >
            <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Continue with Google
          </Button>

          {message && (
            <div className={`mt-4 rounded-lg border px-4 py-3 text-sm ${isError ? 'border-[#E5B5B5] bg-[#FFF4F4] text-[#A33A3A]' : 'border-[#BFD9D5] bg-[#F1F8F7] text-[#0E5A5A]'}`}>
              {message}
            </div>
          )}

          {!isSupabaseConfigured && (
            <div className="mt-10">
              <p className="text-xs font-semibold text-[#6B7980] uppercase tracking-wider mb-4 text-center">Demo Accounts</p>
              <div className="grid grid-cols-3 gap-3">
                {demoAccounts.map((account) => (
                  <Button
                    key={account.role}
                    type="button"
                    className={`h-auto py-3 px-3 flex flex-col items-center gap-1.5 text-xs font-semibold ${account.className}`}
                    onClick={() => login(account.role)}
                  >
                    <span>{account.label}</span>
                    <span className={`text-[10px] font-normal ${account.role === 'student' ? 'text-[#0E5A5A]/70' : 'text-white/70'}`}>
                      {account.description}
                    </span>
                  </Button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-8 text-center text-sm text-[#6B7980]">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => setView('register-school')}
              className="text-[#0E5A5A] font-semibold hover:text-[#0a4a4a] transition-colors inline-flex items-center gap-1"
            >
              Register your school
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}
