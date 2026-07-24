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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEFAULT_EMAIL = 'sales.student@demo.evidara.app';

export function DemoAnalyticsDataLab({ onChanged }: { onChanged?: () => void }) {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [evidenceRows, setEvidenceRows] = useState('25000');
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
      setError('Connect Supabase and apply migration 36 to use the demo-data laboratory.');
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

  useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    if (!supabase) return;
    setBusy('generate');
    setError('');
    setMessage('');
    const { data, error: generateError } = await supabase.rpc('generate_analytics_demo_data_v10', {
      p_email: email.trim().toLowerCase(),
      p_evidence_rows: Number(evidenceRows),
    });
    setBusy('');
    if (generateError) {
      setError(generateError.message);
      return;
    }
    const result = data as { attempts?: number; responses?: number; papers?: number; products?: number };
    setMessage(`Generated ${result.responses?.toLocaleString('en-IN') || 0} response rows across ${result.attempts || 0} attempts, ${result.papers || 0} papers and ${result.products || 0} products.`);
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
    const result = data as { attempts_deleted?: number; responses_deleted?: number; products_deleted?: number; papers_deleted?: number };
    setSecondConfirmOpen(false);
    setMessage(`Reset completed. Removed ${result.responses_deleted?.toLocaleString('en-IN') || 0} generated responses, ${result.attempts_deleted || 0} attempts, ${result.papers_deleted || 0} papers and ${result.products_deleted || 0} products.`);
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
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#8A5F00]"><Database className="h-4 w-4" />Super Admin demo-data laboratory</div>
              <h2 className="mt-2 text-xl font-bold text-[#14232B]">Generate calculation-testing evidence</h2>
              <p className="mt-2 text-sm leading-6 text-[#44545C]">Creates isolated products, papers, attempts and response rows for one demo student. The generated batch is tagged end to end, so reset removes only generated evidence and never genuine school or student records.</p>
            </div>
            <Badge variant="outline" className={ready ? 'border-[#237A57]/25 bg-[#EAF4EF] text-[#237A57]' : 'border-[#AEB8BC]/40 bg-white text-[#6B7980]'}>
              {loading ? 'Checking…' : ready ? 'Dataset ready' : status?.account_found ? 'Ready to generate' : 'Account not found'}
            </Badge>
          </div>

          {(error || message) && <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#FAEEEE] text-[#B54747]' : 'border-[#237A57]/20 bg-[#EAF4EF] text-[#237A57]'}`}>{error || message}</div>}

          <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(260px,1fr)_220px_auto_auto] lg:items-end">
            <div className="space-y-2"><Label>Demo student email</Label><Input value={email} onChange={(event) => setEmail(event.target.value)} /></div>
            <div className="space-y-2"><Label>Generated response evidence</Label><Select value={evidenceRows} onValueChange={setEvidenceRows}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="10000">10,000 rows</SelectItem><SelectItem value="25000">25,000 rows</SelectItem><SelectItem value="50000">50,000 rows</SelectItem></SelectContent></Select></div>
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Check account</Button>
            <Button onClick={() => void generate()} disabled={busy === 'generate' || ready || !status?.account_found} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{busy === 'generate' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}Generate data</Button>
          </div>

          {batch && <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ['Status', batch.status],
              ['Requested rows', batch.requested_evidence_rows.toLocaleString('en-IN')],
              ['Responses', batch.responses.toLocaleString('en-IN')],
              ['Attempts', batch.attempts.toLocaleString('en-IN')],
              ['Papers', batch.papers.toLocaleString('en-IN')],
              ['Products', batch.products.toLocaleString('en-IN')],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#E7D8A8] bg-white p-3"><p className="text-[11px] font-medium uppercase tracking-wide text-[#8A7450]">{label}</p><strong className="mt-1 block text-sm text-[#14232B]">{value}</strong></div>)}
          </div>}

          {ready && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#B54747]/20 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-3"><ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#B54747]" /><div><strong className="text-sm text-[#14232B]">Reset the complete generated batch</strong><p className="mt-1 text-xs leading-5 text-[#6B7980]">You will be asked twice. The second confirmation requires the exact email and phrase. Genuine data is outside the deletion scope.</p></div></div><Button variant="destructive" onClick={() => setFirstConfirmOpen(true)}><Eraser className="mr-2 h-4 w-4" />Reset generated data</Button></div>}
        </CardContent>
      </Card>

      <AlertDialog open={firstConfirmOpen} onOpenChange={setFirstConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#B54747]" />First confirmation</AlertDialogTitle><AlertDialogDescription>This will delete the complete generated analytics batch for <strong>{email}</strong>, including generated products, papers, attempts and responses. Real Evidara records will not be touched. Continue to the second confirmation?</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={continueToSecondConfirmation} className="bg-[#B54747] hover:bg-[#8F3737]">Continue</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={secondConfirmOpen} onOpenChange={setSecondConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Second and final confirmation</AlertDialogTitle><AlertDialogDescription>Enter the target email and type <strong>RESET DEMO ANALYTICS</strong> exactly. This is the final safeguard before the generated batch is erased.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-4 py-2"><div className="space-y-2"><Label>Confirm target email</Label><Input value={confirmEmail} onChange={(event) => setConfirmEmail(event.target.value)} placeholder={email} /></div><div className="space-y-2"><Label>Confirmation phrase</Label><Input value={confirmPhrase} onChange={(event) => setConfirmPhrase(event.target.value)} placeholder="RESET DEMO ANALYTICS" /></div></div>
          <AlertDialogFooter><AlertDialogCancel disabled={busy === 'reset'}>Cancel</AlertDialogCancel><Button variant="destructive" disabled={!secondConfirmationValid || busy === 'reset'} onClick={() => void reset()}>{busy === 'reset' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Eraser className="mr-2 h-4 w-4" />}Erase generated batch</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
