'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  FolderOpen,
  Menu,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAppStore } from '@/store/use-app-store';

const launchFeatures = [
  { icon: Upload, title: 'Easy question upload', desc: 'Import teacher question banks from Excel, CSV or LaTeX, review issues and save them into the institution question bank.' },
  { icon: FileText, title: 'Unlimited tests', desc: 'Build chapter tests, weekly tests, mocks and internal assessments without counting each paper as a separate purchase.' },
  { icon: Users, title: 'Per-student annual access', desc: 'Add the institution roster at ₹199 per active student per year, with each student using their own login.' },
  { icon: BarChart3, title: 'Actionable analysis', desc: 'Review performance by student, test, subject, chapter, topic and question using actual attempt data.' },
  { icon: FolderOpen, title: 'Study resources', desc: 'Keep the existing Evidara resource library available for schools and students alongside assessments.' },
  { icon: ShieldCheck, title: 'Institution-scoped access', desc: 'Questions, students, papers and results stay scoped to the correct institution and role.' },
] as const;

const steps = [
  ['1', 'Create your institution', 'Register the college or school and set up its administrators and teachers.'],
  ['2', 'Upload questions', 'Use the guided import flow or add questions manually to build your private question bank.'],
  ['3', 'Create and conduct tests', 'Select questions, set duration and result rules, publish, and let students attempt online.'],
  ['4', 'Analyse and improve', 'Use student and question-level evidence to identify exactly where teaching or revision is needed.'],
] as const;

export default function LandingPage() {
  const setView = useAppStore((state) => state.setView);
  const [menuOpen, setMenuOpen] = useState(false);

  const register = () => setView('register-school');
  const signIn = () => setView('login');

  return (
    <div className="min-h-screen bg-[var(--canvas)] text-[var(--foreground)]">
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Image src="/brand/evidara-logo-dark.png" alt="Evidara" width={140} height={36} className="h-9 w-auto" />
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#institutions" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">For Institutions</a>
            <a href="#how" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">How it works</a>
            <a href="#pricing" className="text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]">Pricing</a>
            <Button variant="outline" onClick={signIn}>Sign in</Button>
            <Button onClick={register} className="bg-[var(--teal)] text-white hover:bg-[var(--teal)]/90">Start with Evidara</Button>
          </nav>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden" onClick={() => setMenuOpen((value) => !value)} aria-label="Toggle navigation">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-[var(--line)] bg-white px-4 py-5 md:hidden">
            <div className="flex flex-col gap-4">
              <a href="#institutions" className="text-sm text-[var(--muted-foreground)]" onClick={() => setMenuOpen(false)}>For Institutions</a>
              <a href="#how" className="text-sm text-[var(--muted-foreground)]" onClick={() => setMenuOpen(false)}>How it works</a>
              <a href="#pricing" className="text-sm text-[var(--muted-foreground)]" onClick={() => setMenuOpen(false)}>Pricing</a>
              <Button variant="outline" onClick={() => { setMenuOpen(false); signIn(); }}>Sign in</Button>
              <Button onClick={() => { setMenuOpen(false); register(); }} className="bg-[var(--teal)] text-white">Start with Evidara</Button>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="overflow-hidden border-b border-[var(--line)] bg-white">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-16 lg:px-8 lg:py-24">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal)]">Evidara · Institution Assessment Platform</p>
              <h1 className="mt-5 max-w-4xl text-4xl font-black leading-tight sm:text-5xl lg:text-6xl">Run every college test from one place.</h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[var(--muted-foreground)] sm:text-lg">
                Upload your own question bank, create online assessments, add every student and understand performance with evidence that teachers can actually use.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" onClick={register} className="bg-[var(--teal)] text-white hover:bg-[var(--teal)]/90">
                  Register your institution <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={signIn}>Sign in</Button>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[var(--muted-foreground)]">
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--success)]" />₹199 per active student / year</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--success)]" />Unlimited tests</span>
                <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[var(--success)]" />Private institution question bank</span>
              </div>
            </div>

            <Card className="overflow-hidden rounded-2xl border-[var(--line)] shadow-[var(--ev-shadow-sm)]">
              <CardContent className="p-0">
                <div className="bg-[var(--midnight)] p-6 text-white sm:p-8">
                  <div className="flex items-center gap-3"><Building2 className="h-7 w-7 text-[var(--amber)]" /><span className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60">Founding Institution Plan</span></div>
                  <div className="mt-6 flex items-end gap-2"><strong className="text-5xl font-black">₹199</strong><span className="pb-1 text-white/60">/ student / year</span></div>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/70">Platform access is billed at ₹199 per active student per year. No additional per-test fee.</p>
                </div>
                <div className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8">
                  {['₹199 per active student / year', 'Unlimited tests', 'Question-bank import', 'Test creation', 'Student results', 'Performance analytics', 'Study resources', 'Institution roles'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--teal)]" />{item}</div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="institutions" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--teal)]">Everything needed for Phase 1</p>
            <h2 className="mt-3 text-3xl font-bold sm:text-4xl">Simple enough for teachers. Powerful enough for the institution.</h2>
            <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">The first Evidara release is intentionally focused on assessment operations. Advanced marketplace and public practice engines remain parked while institutions use the core platform.</p>
          </div>
          <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {launchFeatures.map(({ icon: Icon, title, desc }) => (
              <Card key={title} className="rounded-xl border-[var(--line)] shadow-[var(--ev-shadow-xs)]">
                <CardContent className="p-6"><Icon className="h-6 w-6 text-[var(--teal)]" /><h3 className="mt-4 text-lg font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{desc}</p></CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="how" className="border-y border-[var(--line)] bg-white">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
            <div className="max-w-3xl"><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--teal)]">How it works</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">From question bank to analysis in four steps.</h2></div>
            <div className="mt-9 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {steps.map(([number, title, desc]) => (
                <Card key={number} className="rounded-xl border-[var(--line)] shadow-[var(--ev-shadow-xs)]"><CardContent className="p-6"><span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--teal)]/10 text-sm font-bold text-[var(--teal)]">{number}</span><h3 className="mt-4 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{desc}</p></CardContent></Card>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="grid gap-8 rounded-2xl border border-[var(--line)] bg-[var(--midnight)] p-7 text-white shadow-[var(--ev-shadow-sm)] sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
            <div><p className="text-sm font-bold uppercase tracking-[0.16em] text-[var(--amber)]">Launch pricing</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">₹199 per student, per year.</h2><p className="mt-4 max-w-2xl leading-7 text-white/70">Platform access for each active student. Teachers maintain and update the institution question bank, while Evidara provides paper creation, assessments, results, analytics and platform tools.</p></div>
            <Button size="lg" onClick={register} className="bg-white text-[var(--midnight)] hover:bg-white/90">Register institution <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--line)] bg-[var(--midnight)] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <Image src="/brand/evidara-logo-light.png" alt="Evidara" width={120} height={30} className="h-8 w-auto" />
          <div className="flex flex-wrap gap-5 text-white/65"><Link href="/privacy/" className="hover:text-white/90">Privacy</Link><Link href="/terms/" className="hover:text-white/90">Terms</Link><Link href="/refund-policy/" className="hover:text-white/90">Refunds</Link><Link href="/contact/" className="hover:text-white/90">Contact</Link></div>
        </div>
      </footer>
    </div>
  );
}
