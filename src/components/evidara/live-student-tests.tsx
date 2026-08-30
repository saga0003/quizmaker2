'use client';

import { useEffect, useState } from 'react';
import {
  CalendarClock,
  Clock3,
  FileQuestion,
  KeyRound,
  LoaderCircle,
  PlayCircle,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { StudentPaperSummary } from '@/types/papers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

function accessClass(label: string) {
  if (label === 'free') return 'bg-[var(--secondary)] text-[var(--teal)]';
  if (label === 'complimentary') return 'bg-[var(--amber)]/20 text-[#8A5F00]';
  if (label === 'paid') return 'bg-[var(--info)]/10 text-[var(--info)]';
  return 'bg-[var(--line)] text-[var(--muted-foreground)]';
}

export function LiveStudentTests() {
  const [papers, setPapers] = useState<StudentPaperSummary[]>([]);
  const [found, setFound] = useState<StudentPaperSummary | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!supabase) {
      setPapers([]);
      setLoading(false);
      setError('Supabase is not configured. Live assessments are unavailable.');
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('list_available_papers');
    if (loadError) setError(loadError.message);
    else setPapers((data || []) as StudentPaperSummary[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function findByCode() {
    if (!supabase) return;
    if (code.trim().length < 4) {
      setError('Enter a valid private test access code.');
      return;
    }
    setBusy('code');
    setError('');
    const { data, error: findError } = await supabase.rpc('find_paper_by_code', {
      p_code: code.trim(),
    });
    if (findError) setError(findError.message);
    else if (!data) setError('No open test was found for this code.');
    else setFound(data as StudentPaperSummary);
    setBusy('');
  }

  async function start(paper: StudentPaperSummary, accessCode?: string) {
    if (!supabase) return;
    setBusy(paper.id);
    setError('');
    const { data, error: startError } = await supabase.rpc('start_exam_attempt', {
      p_paper_id: paper.id,
      p_access_code: accessCode || null,
    });
    if (startError) {
      setError(startError.message);
      setBusy('');
      return;
    }
    window.location.assign(`/student/tests/take/?attempt=${String(data)}`);
  }

  function paperCard(paper: StudentPaperSummary, accessCode?: string) {
    const label = paper.access_label || 'included';
    const exhausted = paper.attempts_used >= paper.attempt_limit;
    return (
      <Card key={`${paper.id}-${accessCode || 'catalogue'}`} className="min-w-0 gap-0 border-[var(--line)] shadow-sm rounded-xl transition-shadow hover:shadow-md">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="border-[var(--line)] text-[var(--foreground)]">{paper.exam_type}</Badge>
              <Badge className={accessClass(label)}>{label.toUpperCase()}</Badge>
            </div>
            <Badge variant="outline" className="border-[var(--line)] capitalize text-[var(--muted-foreground)]">{paper.access_mode}</Badge>
          </div>
          <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">{paper.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">{paper.description || 'Timed online assessment'}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[var(--canvas)] p-3 text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-[var(--teal)]" />{paper.duration_minutes} min</span>
            <span className="flex items-center gap-1.5"><FileQuestion className="h-3.5 w-3.5 text-[var(--teal)]" />{paper.total_questions}</span>
            <span className="font-medium text-[var(--foreground)]">{paper.total_marks} marks</span>
          </div>
          {paper.available_until && <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><CalendarClock className="h-3.5 w-3.5" />Closes {new Date(paper.available_until).toLocaleString('en-IN')}</p>}
          <div className="mt-5 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
            <span className="text-xs text-[var(--muted-foreground)]">Attempts {paper.attempts_used}/{paper.attempt_limit}</span>
            <Button disabled={busy === paper.id || exhausted} onClick={() => void start(paper, accessCode)} className="bg-[var(--teal)] text-white hover:bg-[#0A4747]">
              {busy === paper.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
              {exhausted ? 'Attempts Used' : 'Start / Resume'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]"><ShieldCheck className="h-4 w-4" />Eligible live assessments</div>
          <h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Available Tests</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">School-created tests, Evidara shared assessments and complimentary resources appear here from Supabase.</p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-[var(--line)]"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      {error && <div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">{error}</div>}

      <Card className="gap-0 border-[var(--line)] shadow-sm rounded-xl"><CardContent className="p-4"><div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter private test access code" className="border-[var(--line)] pl-9" /></div><Button onClick={() => void findByCode()} disabled={busy === 'code'} className="bg-[var(--foreground)] text-white hover:bg-[var(--teal)]">{busy === 'code' ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}Find Test</Button></div>{found && <div className="mt-4">{paperCard(found, code)}</div>}</CardContent></Card>

      {loading ? <div className="grid min-h-[280px] place-items-center rounded-xl border border-[var(--line)] bg-white text-sm text-[var(--muted-foreground)]"><div className="text-center"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading live assessments…</div></div> : papers.length ? <div className="grid gap-4 md:grid-cols-2">{papers.map((paper) => paperCard(paper))}</div> : <div className="rounded-xl border border-[var(--line)] bg-white py-16 text-center"><FileQuestion className="mx-auto h-10 w-10 text-[var(--secondary)]" /><h3 className="mt-3 font-semibold text-[var(--foreground)]">No open tests right now</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">Published papers will appear when their opening time and eligibility rules are satisfied.</p></div>}
    </div>
  );
}
