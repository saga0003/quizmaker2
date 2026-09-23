'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Building2, CheckCircle2, LoaderCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PublicShell } from '@/components/evidara/public-shell';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';

const DRAFT_KEY = 'evidara_school_register_draft';

const institutionTypes = ['Coaching School', 'School', 'College', 'Independent Educator'] as const;
const studentBands = ['1-100', '101-500', '501-2000', '2000+'] as const;

type RegisterForm = {
  name: string;
  type: (typeof institutionTypes)[number];
  studentCount: (typeof studentBands)[number];
  city: string;
  state: string;
  phone: string;
};

const emptyForm: RegisterForm = {
  name: '',
  type: 'Coaching School',
  studentCount: '1-100',
  city: '',
  state: 'Karnataka',
  phone: '',
};

type SubmitOutcome =
  | { kind: 'idle' }
  | { kind: 'demo-preview' }
  | { kind: 'needs-sign-in' }
  | { kind: 'submitted' };

function readDraft(): RegisterForm {
  if (typeof window === 'undefined') return emptyForm;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return emptyForm;
    const parsed = JSON.parse(raw) as Partial<RegisterForm>;
    return {
      ...emptyForm,
      ...parsed,
      type: parsed.type && (institutionTypes as readonly string[]).includes(parsed.type)
        ? (parsed.type as RegisterForm['type'])
        : emptyForm.type,
      studentCount: parsed.studentCount && (studentBands as readonly string[]).includes(parsed.studentCount)
        ? (parsed.studentCount as RegisterForm['studentCount'])
        : emptyForm.studentCount,
    };
  } catch {
    return emptyForm;
  }
}

function saveDraft(form: RegisterForm) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
  } catch {
    // Storage may be unavailable (private mode); the draft is a convenience only.
  }
}

const fieldClass =
  'h-11 border-[#E7ECEB] bg-[#F7F9F7] focus-visible:ring-[#0E5A5A] focus-visible:border-[#0E5A5A]';

export function InstitutionRegisterPage() {
  const setView = useAppStore((state) => state.setView);
  const [form, setForm] = useState<RegisterForm>(emptyForm);
  const [outcome, setOutcome] = useState<SubmitOutcome>({ kind: 'idle' });
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(readDraft());
  }, []);

  const change = (key: keyof RegisterForm, value: string) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    saveDraft(form);

    if (!isSupabaseConfigured || !supabase) {
      // Demo build: be honest about what happened. The details stay in this
      // browser only; there is no server write to confirm.
      setOutcome({ kind: 'demo-preview' });
      return;
    }

    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setOutcome({ kind: 'needs-sign-in' });
        return;
      }
      const { error } = await supabase.rpc('create_school', {
        p_name: form.name,
        p_type: form.type,
        p_city: form.city,
        p_state: form.state,
        p_phone: form.phone,
        p_student_count: form.studentCount,
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setOutcome({ kind: 'submitted' });
    } catch (value) {
      setMessage(value instanceof Error ? value.message : 'Unable to submit the registration right now.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputLabel = 'text-sm font-medium text-[#14232B]';

  return (
    <PublicShell>
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        {outcome.kind === 'demo-preview' ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center shadow-[var(--ev-shadow-sm)] sm:p-10">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF6F4] text-[#0E5A5A]">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-2xl font-bold text-[#14232B]">Demo preview captured</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B7980]">
              This is the Evidara demo build, so your institution details were saved in this browser only and
              were not sent anywhere. Connect the production backend to activate live institution sign-up.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => setView('login')} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
                Explore the demo workspace
              </Button>
              <Button variant="outline" onClick={() => setView('landing')} className="border-[#E7ECEB]">
                Back to home
              </Button>
            </div>
          </div>
        ) : outcome.kind === 'submitted' ? (
          <div className="rounded-2xl border border-[var(--line)] bg-white p-6 text-center shadow-[var(--ev-shadow-sm)] sm:p-10">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#16A34A]" />
            <h1 className="mt-5 text-2xl font-bold text-[#14232B]">Institution registration submitted</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6B7980]">
              Your institution details were saved for approval. Workspace permissions stay unchanged until a
              Super Admin approves the institution and assigns its owner.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={() => setView('school-dashboard')} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
                Open your dashboard
              </Button>
              <Button variant="outline" onClick={() => setView('landing')} className="border-[#E7ECEB]">
                Back to home
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--teal)]">Institution onboarding</p>
            <h1 className="mt-2 text-3xl font-black text-[var(--foreground)] sm:text-4xl">Register your institution</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted-foreground)]">
              Create your school, college or coaching workspace. After a Super Admin approves the registration
              you can import questions, build papers, conduct exams and analyse every student.
            </p>

            {outcome.kind === 'needs-sign-in' && (
              <div className="mt-6 rounded-xl border border-[#CFE0EB] bg-[#F7FAFF] p-5">
                <p className="text-sm font-semibold text-[#14232B]">Sign in first, then submit</p>
                <p className="mt-1 text-sm leading-6 text-[#5E7380]">
                  Institution sign-up is tied to an owner account, so your details are submitted under a signed-in
                  identity. Your draft is saved in this browser and will be restored when you return.
                </p>
                <Button onClick={() => setView('login')} className="mt-4 bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
                  Sign in to continue
                </Button>
              </div>
            )}

            <form onSubmit={submit} className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-[var(--ev-shadow-sm)] sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAF6F4] text-[#0E5A5A]">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-bold text-[#14232B]">Institution details</h2>
                  <p className="text-sm text-[#6B7980]">All fields help the approval team verify your institution.</p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className={inputLabel}>Institution name</span>
                  <Input required value={form.name} onChange={(event) => change('name', event.target.value)} placeholder="Green Valley High" className={`mt-2 ${fieldClass}`} />
                </label>
                <label>
                  <span className={inputLabel}>Institution type</span>
                  <select value={form.type} onChange={(event) => change('type', event.target.value)} className={`mt-2 h-11 w-full rounded-md border border-[#E7ECEB] bg-[#F7F9F7] px-3 text-sm text-[#14232B] focus-visible:outline-2 focus-visible:outline-[#0E5A5A]`}>
                    {institutionTypes.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  <span className={inputLabel}>Approx. students</span>
                  <select value={form.studentCount} onChange={(event) => change('studentCount', event.target.value)} className={`mt-2 h-11 w-full rounded-md border border-[#E7ECEB] bg-[#F7F9F7] px-3 text-sm text-[#14232B] focus-visible:outline-2 focus-visible:outline-[#0E5A5A]`}>
                    {studentBands.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
                <label>
                  <span className={inputLabel}>City</span>
                  <Input required value={form.city} onChange={(event) => change('city', event.target.value)} placeholder="Bengaluru" className={`mt-2 ${fieldClass}`} />
                </label>
                <label>
                  <span className={inputLabel}>State</span>
                  <Input required value={form.state} onChange={(event) => change('state', event.target.value)} placeholder="Karnataka" className={`mt-2 ${fieldClass}`} />
                </label>
                <label className="sm:col-span-2">
                  <span className={inputLabel}>Contact phone</span>
                  <Input required type="tel" value={form.phone} onChange={(event) => change('phone', event.target.value)} placeholder="+91 98765 43210" className={`mt-2 ${fieldClass}`} />
                </label>
              </div>

              {message && (
                <div className="mt-5 rounded-xl border border-[#E5B5B5] bg-[#FFF4F4] px-4 py-3 text-sm text-[#A33A3A]">{message}</div>
              )}

              <Button type="submit" disabled={submitting} className="mt-6 h-11 w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
                {submitting && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                Submit registration
              </Button>
              <p className="mt-3 text-center text-xs leading-5 text-[#6B7980]">
                By submitting you confirm you are authorised to register this institution under the Evidara Terms of Service.
              </p>
            </form>
          </>
        )}
      </div>
    </PublicShell>
  );
}
