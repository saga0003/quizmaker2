'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, FileCheck2, LoaderCircle, RefreshCw, ShieldAlert } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type SourceReadiness = {
  id: string;
  exam_type: string;
  source_year: number;
  variant: string;
  paper_code: string | null;
  paper_key: string;
  display_name: string;
  source_key: string | null;
  expected_question_count: number;
  duration_minutes: number;
  maximum_marks: number;
  staged_count: number;
  promoted_count: number;
  approved_count: number;
  review_count: number;
  taxonomy_review_count: number;
  ready_to_build: boolean;
  built_paper?: { id: string; title: string; status: string; total_questions: number; updated_at: string } | null;
};

async function token() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error(error?.message || 'Sign in again.');
  return data.session.access_token;
}
async function api(init?: RequestInit) {
  const accessToken = await token();
  const response = await fetch('/api/admin/pyq-paper-sources/', {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'PYQ paper operation failed.');
  return payload;
}

export function PyqPaperManager({ open, onOpenChange, onBuilt }: { open: boolean; onOpenChange: (value: boolean) => void; onBuilt?: () => void }) {
  const [sources, setSources] = useState<SourceReadiness[]>([]);
  const [loading, setLoading] = useState(false);
  const [building, setBuilding] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!open) return;
    setLoading(true); setError('');
    try {
      const payload = await api();
      setSources(Array.isArray(payload.sources) ? payload.sources : []);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load PYQ sources.'); }
    finally { setLoading(false); }
  }, [open]);
  useEffect(() => { if (open) void load(); }, [open, load]);

  async function build(source: SourceReadiness) {
    setBuilding(source.id); setError(''); setMessage('');
    try {
      const payload = await api({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'build', sourcePaperId: source.id }),
      });
      setMessage(`${source.display_name} was recreated as a draft Evidara paper from ${source.expected_question_count} approved PYQs.`);
      await load();
      onBuilt?.();
      return payload.paperId as string;
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to build PYQ paper.'); }
    finally { setBuilding(''); }
  }

  const totals = useMemo(() => ({
    sources: sources.length,
    ready: sources.filter((item) => item.ready_to_build).length,
    approved: sources.reduce((sum, item) => sum + Number(item.approved_count || 0), 0),
  }), [sources]);

  return <Dialog open={open} onOpenChange={(value)=>!building && onOpenChange(value)}>
    <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Archive className="h-5 w-5 text-[var(--teal)]" />Build Exact Previous-Year Papers</DialogTitle>
        <DialogDescription>Each source paper keeps its year, variant, code and original question order. Evidara only builds an exact paper after every source question has reached Approved status.</DialogDescription>
      </DialogHeader>
      {error && <div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">{error}</div>}
      {message && <div className="rounded-xl border border-[var(--teal)]/20 bg-[var(--secondary)]/60 px-4 py-3 text-sm text-[var(--teal)]">{message}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-none"><CardContent className="p-4"><strong className="text-2xl">{totals.sources}</strong><p className="text-xs text-[var(--muted-foreground)]">Official paper sources</p></CardContent></Card>
        <Card className="shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[var(--teal)]">{totals.ready}</strong><p className="text-xs text-[var(--muted-foreground)]">Ready to recreate</p></CardContent></Card>
        <Card className="shadow-none"><CardContent className="p-4"><strong className="text-2xl">{totals.approved.toLocaleString('en-IN')}</strong><p className="text-xs text-[var(--muted-foreground)]">Approved PYQ occurrences</p></CardContent></Card>
      </div>
      <div className="flex justify-end"><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?'animate-spin':''}`} />Refresh</Button></div>
      <div className="space-y-3">
        {sources.map((source)=><Card key={source.id} className="border-[var(--line)] shadow-none"><CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--foreground)]">{source.display_name}</h3><Badge className="bg-[var(--secondary)] text-[var(--teal)]">PYQ</Badge>{source.paper_code && <Badge variant="outline">Code {source.paper_code}</Badge>}{source.variant && source.variant!=='Main' && <Badge variant="outline">{source.variant}</Badge>}</div>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">{source.exam_type} · {source.source_year} · {source.expected_question_count} expected questions · {source.duration_minutes} min</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-[var(--muted)] px-2.5 py-1">Staged {source.staged_count}/{source.expected_question_count}</span>
                <span className="rounded-full bg-[var(--muted)] px-2.5 py-1">Question Bank {source.promoted_count}/{source.expected_question_count}</span>
                <span className="rounded-full bg-[var(--muted)] px-2.5 py-1">Approved {source.approved_count}/{source.expected_question_count}</span>
                {source.review_count>0 && <span className="rounded-full bg-[var(--amber)]/15 px-2.5 py-1 text-[#7A5800]">In review {source.review_count}</span>}
                {source.taxonomy_review_count>0 && <span className="rounded-full bg-[var(--amber)]/15 px-2.5 py-1 text-[#7A5800]">Taxonomy review {source.taxonomy_review_count}</span>}
              </div>
              {source.built_paper && <p className="mt-2 text-xs text-[var(--teal)]"><FileCheck2 className="mr-1 inline h-3.5 w-3.5" />Paper exists: {source.built_paper.title} · {source.built_paper.status}</p>}
            </div>
            <div className="shrink-0">
              <Button onClick={()=>void build(source)} disabled={!source.ready_to_build || building===source.id} className="bg-[var(--teal)] text-white">
                {building===source.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : source.ready_to_build ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                {source.built_paper ? 'Rebuild Draft' : 'Build Exact Paper'}
              </Button>
              {!source.ready_to_build && <p className="mt-1 max-w-[210px] text-right text-[10px] text-[var(--muted-foreground)]">Approve all {source.expected_question_count} source questions first.</p>}
            </div>
          </div>
        </CardContent></Card>)}
        {!sources.length && !loading && <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted-foreground)]">No PYQ source papers are registered yet. Import a prepared PYQ archive or add a PYQ occurrence to a question.</div>}
      </div>
    </DialogContent>
  </Dialog>;
}
