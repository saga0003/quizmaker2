'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Eraser,
  LoaderCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { AnalyticsDemoStatus } from '@/types/analytics';
import { DemoStudentResultsTable } from './DemoStudentResultsTable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const DEFAULT_EMAIL = 'sales.student@demo.evidara.app';

export function DemoAnalyticsDataLab({ onChanged }: { onChanged?: () => void }) {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [status, setStatus] = useState<AnalyticsDemoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [firstConfirmOpen, setFirstConfirmOpen] = useState(false);
  const [secondConfirmOpen, setSecondConfirmOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Connect Supabase and apply analytics migrations through 36e to use the demo-data laboratory.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('get_analytics_demo_status_v10', {
      p_email: email.trim().toLowerCase(),
    });
    if (loadError) setError(loadError.message);
    else setStatus(data as AnalyticsDemoStatus);
    setLoading(false);
  }, [email]);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    if (!supabase) return;
    setBusy('generate');
    setError('');
    setMessage('');
    const { data, error: generateError } = await supabase.rpc('generate_analytics_demo_data_v10', {
      p_email: email.trim().toLowerCase(),
      p_evidence_rows: 10000,
    });
    setBusy('');
    if (generateError) {
      setError(generateError.message);
      return;
    }
    const result = data as {
      students?: number;
      test_results?: number;
      subject_results?: number;
      attempts?: number;
      responses?: number;
      papers?: number;
      products?: number;
    };
    setMessage(`Generated ${result.students || 0} students, ${result.products || 0} series, ${result.papers || 0} papers, ${result.test_results?.toLocaleString('en-IN') || 0} student-test results and ${result.subject_results?.toLocaleString('en-IN') || 0} subject-result rows.`);
    await load();
    onChanged?.();
  }

  function continueToSecondConfirmation() {
    setFirstConfirmOpen(false);
    setConfirmEmail('');
    setConfirmPhrase('');
    window.setTimeout(() => setSecondConfirmOpen(true), 120);
  }

  async function reset() {
    if (!supabase) return;
    setBusy('reset');
    setError('');
    setMessage('');
    const { data, error: resetError } = await supabase.rpc('reset_analytics_demo_data_v10', {
      p_email: email.trim().toLowerCase(),
      p_confirm_email: confirmEmail.trim().toLowerCase(),
      p_confirmation: confirmPhrase,
    });
    setBusy('');
    if (resetError) {
      setError(resetError.message);
      return;
    }
    const result = data as {
      students_deleted?: number;
      test_results_deleted?: number;
      subject_results_deleted?: number;
      attempts_deleted?: number;
      responses_deleted?: number;
      products_deleted?: number;
      papers_deleted?: number;
    };
    setSecondConfirmOpen(false);
    setMessage(`Reset completed. Removed ${result.students_deleted || 0} generated students, ${result.test_results_deleted?.toLocaleString('en-IN') || 0} test results, ${result.subject_results_deleted?.toLocaleString('en-IN') || 0} subject results, ${result.responses_deleted?.toLocaleString('en-IN') || 0} question responses and all generated series and papers.`);
    setConfirmEmail('');
    setConfirmPhrase('');
    await load();
    onChanged?.();
  }

  const batch = status?.active_batch;
  const ready = batch?.status === 'ready';
  const secondConfirmationValid =
    confirmEmail.trim().toLowerCase() === email.trim().toLowerCase()
    && confirmPhrase === 'RESET DEMO ANALYTICS';

  return (
    <>
      <Card className="gap-0 border-[#F2B84B]/35 bg-[#FFF9EA] shadow-none">
        <CardContent className="p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5F00]"><Database className="h-4 w-4" />Super Admin demo-data laboratory</div>
              <h2 className="mt-2 text-xl font-bold text-[#14232B]">Generate the complete PCM and PCB comparison cohort</h2>
              <p className="mt-2 text-sm leading-6 text-[#44545C]">Creates 100 students: 50 PCM and 50 PCB. It builds three JEE series and three NEET series, ten papers per series and one hundred questions per paper. The real demo login receives detailed attempts and responses; the other students provide efficient comparison evidence.</p>
            </div>
            <Badge variant="outline" className={ready ? 'border-[#237A57]/25 bg-[#EAF4EF] text-[#237A57]' : 'border-[#AEB8BC]/40 bg-white text-[#6B7980]'}>
              {loading ? 'Checking…' : ready ? '100-student dataset ready' : status?.account_found ? 'Ready to generate' : 'Account not found'}
            </Badge>
          </div>

          {(error || message) && <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#FAEEEE] text-[#B54747]' : 'border-[#237A57]/20 bg-[#EAF4EF] text-[#237A57]'}`}>{error || message}</div>}

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(300px,1fr)_auto_auto] lg:items-end">
            <div className="space-y-2"><Label>Real demo student login</Label><Input value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Check account</Button>
            <Button onClick={() => void generate()} disabled={busy === 'generate' || ready || !status?.account_found} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{busy === 'generate' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Generate 100-student cohort</Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {[
              ['Students', batch?.students || 100],
              ['PCM', 50],
              ['PCB', 50],
              ['Series', batch?.products || 6],
              ['Papers', batch?.papers || 60],
              ['Test results', batch?.test_results?.toLocaleString('en-IN') || '—'],
              ['Subject results', batch?.subject_results?.toLocaleString('en-IN') || '—'],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#E7D8A8] bg-white p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-[#8A7450]">{label}</p><strong className="mt-1 block text-sm text-[#14232B]">{value}</strong></div>)}
          </div>

          <div className="mt-4 rounded-xl border border-[#E7D8A8] bg-white p-4 text-xs leading-5 text-[#6B7980]">
            Every student receives three track-specific series. Some series are deliberately incomplete at 7–9 tests, so the percentile remains locked until all ten tests are completed. The real demo login is PCM with two complete JEE series and one 7/10 JEE series.
          </div>

          {ready && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#B54747]/20 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#B54747]" /><div><strong className="text-sm text-[#14232B]">Reset the complete generated cohort</strong><p className="mt-1 text-xs leading-5 text-[#6B7980]">You will be asked twice. The second confirmation requires the exact email and phrase. Genuine Evidara data remains outside the deletion scope.</p></div></div><Button variant="destructive" onClick={() => setFirstConfirmOpen(true)}><Eraser className="mr-2 h-4 w-4" />Reset generated data</Button></div>}
        </CardContent>
      </Card>

      {ready && <DemoStudentResultsTable email={email} />}

      <AlertDialog open={firstConfirmOpen} onOpenChange={setFirstConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#B54747]" />First confirmation</AlertDialogTitle><AlertDialogDescription>This will delete the complete 100-student analytics cohort for <strong>{email}</strong>, including generated students, six series, sixty papers, attempts, responses and comparison results. Genuine Evidara records will not be touched. Continue to the second confirmation?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={continueToSecondConfirmation} className="bg-[#B54747] hover:bg-[#8F3737]">Continue</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={secondConfirmOpen} onOpenChange={setSecondConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Second and final confirmation</AlertDialogTitle><AlertDialogDescription>Enter the target email and type <strong>RESET DEMO ANALYTICS</strong> exactly. This is the final safeguard before the generated cohort is erased.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-4 py-2"><div className="space-y-2"><Label>Confirm target email</Label><Input value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} placeholder={email} /></div><div className="space-y-2"><Label>Confirmation phrase</Label><Input value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} placeholder="RESET DEMO ANALYTICS" /></div></div>
          <AlertDialogFooter><AlertDialogCancel disabled={busy === 'reset'}>Cancel</AlertDialogCancel><Button variant="destructive" disabled={!secondConfirmationValid || busy === 'reset'} onClick={() => void reset()}>{busy === 'reset' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}Erase generated cohort</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
