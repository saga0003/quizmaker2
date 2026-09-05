'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, Clock3, Search, XCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnalyticsQuestionEvidenceRow } from '@/types/analytics-v12';

type OutcomeFilter = 'all' | 'correct' | 'incorrect' | 'unanswered';

function markLabel(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function outcomeBadge(outcome: AnalyticsQuestionEvidenceRow['outcome']) {
  if (outcome === 'correct') return <Badge className="border-green-200 bg-green-50 text-green-700 hover:bg-green-50">Correct</Badge>;
  if (outcome === 'incorrect') return <Badge className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">Incorrect</Badge>;
  return <Badge variant="outline" className="text-slate-600">Unanswered</Badge>;
}

export function QuestionResponseAudit({ studentId, defaultOpen = false }: { studentId: string; defaultOpen?: boolean }) {
  const [rows, setRows] = useState<AnalyticsQuestionEvidenceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [paper, setPaper] = useState('all');
  const [subject, setSubject] = useState('all');

  useEffect(() => {
    if (!studentId || !supabase) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_student_own_question_evidence_v12');
        if (cancelled) return;
        if (rpcError) {
          setError(rpcError.message);
          setRows([]);
          return;
        }
        const evidence = Array.isArray(data) ? data as AnalyticsQuestionEvidenceRow[] : [];
        setRows(evidence);
        setError('');
        if (evidence.length) document.documentElement.classList.add('demo-question-evidence-ready');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      document.documentElement.classList.remove('demo-question-evidence-ready');
    };
  }, [studentId]);

  const papers = useMemo(() => [...new Set(rows.map((row) => row.paper_title))].sort(), [rows]);
  const subjects = useMemo(() => [...new Set(rows.map((row) => row.subject_name))].sort(), [rows]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (outcome !== 'all' && row.outcome !== outcome) return false;
      if (paper !== 'all' && row.paper_title !== paper) return false;
      if (subject !== 'all' && row.subject_name !== subject) return false;
      if (!needle) return true;
      return `${row.paper_title} ${row.question_no} ${row.question_text} ${row.subject_name} ${row.chapter_name} ${row.topic_name}`.toLowerCase().includes(needle);
    });
  }, [outcome, paper, query, rows, subject]);

  const totals = useMemo(() => ({
    correct: rows.filter((row) => row.outcome === 'correct').length,
    incorrect: rows.filter((row) => row.outcome === 'incorrect').length,
    unanswered: rows.filter((row) => row.outcome === 'unanswered').length,
    marks: rows.reduce((sum, row) => sum + Number(row.marks_awarded || 0), 0),
  }), [rows]);

  if (loading) return <Card className="mt-4 rounded-xl"><CardContent className="p-5 text-sm text-[var(--muted-foreground)]">Loading question-level response evidence…</CardContent></Card>;
  if (error) return <Card className="mt-4 rounded-xl"><CardContent className="p-5 text-sm text-destructive">Question evidence could not be loaded: {error}</CardContent></Card>;
  if (!rows.length) return null;

  return <Card className="mt-4 rounded-xl shadow-sm">
    <CardContent className="p-0">
      <button type="button" className="flex w-full items-start justify-between gap-4 p-5 text-left" onClick={() => setOpen((value) => !value)}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]">Manual verification</p>
          <h2 className="mt-1 text-lg font-bold">Question Response Audit</h2>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{rows.length.toLocaleString('en-IN')} question responses · correct = +4 · incorrect = −1 · unanswered = 0. These rows are the evidence used by the demo analytics.</p>
        </div>
        <span className="mt-1 rounded-lg border border-[var(--line)] p-2">{open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}</span>
      </button>

      {open && <>
        <div className="grid gap-3 border-y border-[var(--line)] bg-slate-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-white p-3"><div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><CheckCircle2 className="h-4 w-4 text-green-600" />Correct</div><strong className="mt-1 block text-xl">{totals.correct}</strong></div>
          <div className="rounded-lg bg-white p-3"><div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><XCircle className="h-4 w-4 text-amber-600" />Incorrect</div><strong className="mt-1 block text-xl">{totals.incorrect}</strong></div>
          <div className="rounded-lg bg-white p-3"><div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><Clock3 className="h-4 w-4 text-blue-600" />Unanswered</div><strong className="mt-1 block text-xl">{totals.unanswered}</strong></div>
          <div className="rounded-lg bg-white p-3"><div className="text-xs text-[var(--muted-foreground)]">Net marks from response rows</div><strong className="mt-1 block text-xl text-[var(--teal)]">{totals.marks.toLocaleString('en-IN')}</strong></div>
        </div>

        <div className="grid gap-3 border-b border-[var(--line)] p-4 md:grid-cols-4">
          <div className="relative md:col-span-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search responses" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <select className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={paper} onChange={(event) => setPaper(event.target.value)}><option value="all">All tests</option>{papers.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={subject} onChange={(event) => setSubject(event.target.value)}><option value="all">All subjects</option>{subjects.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          <select className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={outcome} onChange={(event) => setOutcome(event.target.value as OutcomeFilter)}><option value="all">All outcomes</option><option value="correct">Correct</option><option value="incorrect">Incorrect</option><option value="unanswered">Unanswered</option></select>
        </div>

        <div className="max-h-[620px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-white"><TableRow><TableHead>Q</TableHead><TableHead>Test</TableHead><TableHead>Taxonomy</TableHead><TableHead>Outcome</TableHead><TableHead>Marks</TableHead><TableHead>Time</TableHead></TableRow></TableHeader>
            <TableBody>{filtered.slice(0, 150).map((row) => <TableRow key={row.response_id}><TableCell className="font-semibold">{row.question_no}</TableCell><TableCell><div className="max-w-[280px] font-medium">{row.paper_title}</div><div className="mt-1 max-w-[300px] truncate text-xs text-[var(--muted-foreground)]" title={row.question_text}>{row.question_text}</div></TableCell><TableCell><div className="font-medium">{row.subject_name}</div><div className="text-xs text-[var(--muted-foreground)]">{row.chapter_name} · {row.topic_name}</div></TableCell><TableCell>{outcomeBadge(row.outcome)}</TableCell><TableCell><strong className={row.marks_awarded < 0 ? 'text-amber-700' : row.marks_awarded > 0 ? 'text-green-700' : 'text-slate-500'}>{markLabel(Number(row.marks_awarded || 0))}</strong></TableCell><TableCell>{row.time_spent_seconds == null ? '—' : `${row.time_spent_seconds}s`}</TableCell></TableRow>)}</TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)] p-3 text-xs text-[var(--muted-foreground)]"><span>{filtered.length.toLocaleString('en-IN')} matching responses</span><span>{filtered.length > 150 ? 'Showing first 150; narrow the filters to inspect a specific test/topic.' : 'All matching responses shown.'}</span></div>
      </>}
    </CardContent>
  </Card>;
}
