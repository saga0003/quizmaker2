'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpDown, ChevronRight, Search, School, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { AnalyticsV12Workspace } from '@/components/analytics-v12/student-analytics-v12';
import { QuestionResponseAudit } from '@/components/analytics-v12/question-response-audit';
import { InstitutionAnalyticsWorkspace } from '@/components/institution-analytics/institution-analytics-workspace';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DemoResult = {
  studentId: string;
  testId: string;
  percentage: number;
  accuracy: number;
  submittedAt: string;
};

type DemoTest = {
  id: string;
  title: string;
  testType: string;
  examType: string;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  questionCount: number;
  maximumMarks: number;
  durationMinutes: number;
  conductedAt: string;
  attempts: number;
  participants: number;
  averagePercentage: number;
  accuracy: number;
};

type DemoStudent = {
  id: string;
  name: string;
  email: string | null;
  grade: number;
  section: string;
  academicYear: string;
  track: string;
  board: string;
  status: string;
  completedTests: number;
  averagePercentage: number;
  accuracy: number;
  highestPercentage: number;
  lowestPercentage: number;
  lastTestAt: string | null;
};

type DemoPayload = {
  generatedAt: string;
  school: { id: string; name: string; city: string; state: string; board: string; status: string };
  stats: { students: number; neetStudents: number; jeeStudents: number; tests: number; attempts: number; questionInstances: number; averagePercentage: number; accuracy: number };
  tracks: Array<{ name: string; students: number; tests: number; attempts: number; averagePercentage: number; accuracy: number }>;
  students: DemoStudent[];
  tests: DemoTest[];
  results?: DemoResult[];
};

type StudentSortKey = 'name' | 'grade' | 'section' | 'completedTests' | 'averagePercentage' | 'highestPercentage' | 'accuracy' | 'lastTestAt';
type SortDirection = 'asc' | 'desc';

function pct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${Math.round(value * 10) / 10}%`;
}

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function fmtDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function Metric({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>{note && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{note}</p>}</CardContent></Card>;
}

function SortHead({ label, field, active, direction, onSort }: { label: string; field: StudentSortKey; active: StudentSortKey; direction: SortDirection; onSort: (field: StudentSortKey) => void }) {
  return <TableHead><button type="button" onClick={() => onSort(field)} className="inline-flex items-center gap-1.5 font-medium hover:text-[var(--teal)]">{label}<ArrowUpDown className={`h-3.5 w-3.5 ${active === field ? 'text-[var(--teal)]' : 'opacity-40'}`} />{active === field && <span className="sr-only">Sorted {direction}</span>}</button></TableHead>;
}

function compareStudent(a: DemoStudent, b: DemoStudent, key: StudentSortKey) {
  if (key === 'lastTestAt') return new Date(a.lastTestAt || 0).getTime() - new Date(b.lastTestAt || 0).getTime();
  const av = a[key];
  const bv = b[key];
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  return String(av || '').localeCompare(String(bv || ''), 'en', { sensitivity: 'base' });
}

function DemoHierarchy({ data, onOpenStudent, onBackToSchools }: { data: DemoPayload; onOpenStudent: (student: DemoStudent) => void; onBackToSchools?: () => void }) {
  const [track, setTrack] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<StudentSortKey>('averagePercentage');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const results = data.results || [];

  const trackTests = useMemo(() => data.tests.filter((row) => !track || row.examType === track), [data.tests, track]);
  const trackStudentIds = useMemo(() => new Set(data.students.filter((row) => !track || row.track === track).map((row) => row.id)), [data.students, track]);
  const trackResults = useMemo(() => results.filter((row) => trackStudentIds.has(row.studentId)), [results, trackStudentIds]);
  const subjectNames = useMemo(() => [...new Set(trackTests.map((row) => row.subject).filter((value): value is string => Boolean(value)))], [trackTests]);
  const subjectTests = useMemo(() => subject ? trackTests.filter((row) => row.subject === subject) : [], [trackTests, subject]);
  const chapterNames = useMemo(() => [...new Set(subjectTests.map((row) => row.chapter).filter((value): value is string => Boolean(value)))], [subjectTests]);
  const chapterTests = useMemo(() => chapter ? subjectTests.filter((row) => row.chapter === chapter) : [], [subjectTests, chapter]);
  const topicNames = useMemo(() => [...new Set(chapterTests.map((row) => row.topic).filter((value): value is string => Boolean(value)))], [chapterTests]);

  const studentRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = data.students.filter((row) => (!track || row.track === track) && (!query || `${row.name} ${row.email || ''} ${row.section} ${row.grade}`.toLowerCase().includes(query)));
    return [...rows].sort((a, b) => {
      const result = compareStudent(a, b, sortKey);
      return sortDirection === 'asc' ? result : -result;
    });
  }, [data.students, search, sortDirection, sortKey, track]);

  function onSort(field: StudentSortKey) {
    if (sortKey === field) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(field);
      setSortDirection(field === 'name' || field === 'section' ? 'asc' : 'desc');
    }
  }

  function scopeStats(tests: DemoTest[]) {
    const ids = new Set(tests.map((row) => row.id));
    const rows = trackResults.filter((row) => ids.has(row.testId));
    return { tests: tests.length, attempts: rows.length, average: avg(rows.map((row) => row.percentage)), accuracy: avg(rows.map((row) => row.accuracy)), top: rows.length ? Math.max(...rows.map((row) => row.percentage)) : 0 };
  }

  function back() {
    if (chapter) setChapter(null);
    else if (subject) setSubject(null);
    else if (track) setTrack(null);
    else onBackToSchools?.();
  }

  const title = chapter ? `${chapter} topic analysis` : subject ? `${subject} chapter analysis` : track ? `${track} analytics` : `${data.school.name} analytics`;

  return <div className="space-y-5 p-1 md:p-2">
    <div className="flex items-center gap-3">
      {(track || subject || chapter || onBackToSchools) && <Button variant="outline" size="icon" onClick={back}><ArrowLeft className="h-4 w-4" /></Button>}
      <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">School performance intelligence</p><h1 className="text-2xl font-bold">{title}</h1><p className="text-sm text-[var(--muted-foreground)]">{[data.school.name, track, subject, chapter].filter(Boolean).join(' › ')}</p></div>
    </div>

    {!track && <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><Metric label="Students" value={data.stats.students} note={`${data.stats.neetStudents} NEET + ${data.stats.jeeStudents} JEE`} /><Metric label="Tests" value={data.stats.tests} /><Metric label="Submitted attempts" value={data.stats.attempts} /><Metric label="School average" value={pct(data.stats.averagePercentage)} /><Metric label="Accuracy" value={pct(data.stats.accuracy)} /></div>
      <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">Programs</h2><p className="text-sm text-[var(--muted-foreground)]">Open a program to inspect subjects, chapters, topics and individual learners.</p></div><Table><TableHeader><TableRow><TableHead>Program</TableHead><TableHead>Students</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Accuracy</TableHead><TableHead /></TableRow></TableHeader><TableBody>{data.tracks.map((row) => <TableRow key={row.name} className="cursor-pointer" onClick={() => setTrack(row.name)}><TableCell className="font-bold text-[var(--teal)]">{row.name}</TableCell><TableCell>{row.students}</TableCell><TableCell>{row.tests}</TableCell><TableCell>{row.attempts.toLocaleString('en-IN')}</TableCell><TableCell>{pct(row.averagePercentage)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
    </>}

    {track && !subject && <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">Subject performance</h2><p className="text-sm text-[var(--muted-foreground)]">Click a subject to drill into chapter-level evidence.</p></div><Table><TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead><TableHead /></TableRow></TableHeader><TableBody>{subjectNames.map((name) => { const stats = scopeStats(trackTests.filter((row) => row.subject === name)); return <TableRow key={name} className="cursor-pointer" onClick={() => setSubject(name)}><TableCell className="font-semibold text-[var(--teal)]">{name}</TableCell><TableCell>{stats.tests}</TableCell><TableCell>{stats.attempts}</TableCell><TableCell>{pct(stats.average)}</TableCell><TableCell>{pct(stats.top)}</TableCell><TableCell>{pct(stats.accuracy)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>}

    {track && subject && !chapter && <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">Chapter performance</h2><p className="text-sm text-[var(--muted-foreground)]">Open a chapter for topic-level evidence.</p></div><Table><TableHeader><TableRow><TableHead>Chapter</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead><TableHead /></TableRow></TableHeader><TableBody>{chapterNames.map((name) => { const stats = scopeStats(subjectTests.filter((row) => row.chapter === name)); return <TableRow key={name} className="cursor-pointer" onClick={() => setChapter(name)}><TableCell className="font-semibold text-[var(--teal)]">{name}</TableCell><TableCell>{stats.tests}</TableCell><TableCell>{stats.attempts}</TableCell><TableCell>{pct(stats.average)}</TableCell><TableCell>{pct(stats.top)}</TableCell><TableCell>{pct(stats.accuracy)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>}

    {track && subject && chapter && <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">Topic performance</h2><p className="text-sm text-[var(--muted-foreground)]">Topic-level outcomes for the selected chapter.</p></div><Table><TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead></TableRow></TableHeader><TableBody>{topicNames.length ? topicNames.map((name) => { const stats = scopeStats(chapterTests.filter((row) => row.topic === name)); return <TableRow key={name}><TableCell className="font-semibold">{name}</TableCell><TableCell>{stats.tests}</TableCell><TableCell>{stats.attempts}</TableCell><TableCell>{pct(stats.average)}</TableCell><TableCell>{pct(stats.top)}</TableCell><TableCell>{pct(stats.accuracy)}</TableCell></TableRow>; }) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-[var(--muted-foreground)]">No topic-tagged tests found for this chapter.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>}

    {track && <Card className="rounded-xl shadow-sm"><CardContent className="p-0">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Students</h2><p className="text-sm text-[var(--muted-foreground)]">Click a student to open the exact detailed analytics workspace the learner receives.</p></div><div className="relative w-full sm:w-[340px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search name, email, grade or section" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div>
      <div className="max-h-[600px] overflow-auto"><Table><TableHeader className="sticky top-0 z-10 bg-white"><TableRow><SortHead label="Student" field="name" active={sortKey} direction={sortDirection} onSort={onSort} /><SortHead label="Grade" field="grade" active={sortKey} direction={sortDirection} onSort={onSort} /><SortHead label="Section" field="section" active={sortKey} direction={sortDirection} onSort={onSort} /><SortHead label="Tests" field="completedTests" active={sortKey} direction={sortDirection} onSort={onSort} /><SortHead label="Average" field="averagePercentage" active={sortKey} direction={sortDirection} onSort={onSort} /><SortHead label="Top score" field="highestPercentage" active={sortKey} direction={sortDirection} onSort={onSort} /><SortHead label="Accuracy" field="accuracy" active={sortKey} direction={sortDirection} onSort={onSort} /><SortHead label="Last test" field="lastTestAt" active={sortKey} direction={sortDirection} onSort={onSort} /><TableHead /></TableRow></TableHeader><TableBody>{studentRows.map((row) => <TableRow key={row.id} className="cursor-pointer hover:bg-[var(--teal)]/[0.04]" onClick={() => onOpenStudent(row)}><TableCell><div className="font-semibold text-[var(--teal)]">{row.name}</div><div className="text-xs text-[var(--muted-foreground)]">{row.email || 'Demo student'}</div></TableCell><TableCell>{row.grade}</TableCell><TableCell>{row.section}</TableCell><TableCell>{row.completedTests}</TableCell><TableCell className="font-semibold">{pct(row.averagePercentage)}</TableCell><TableCell>{pct(row.highestPercentage)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell>{fmtDate(row.lastTestAt)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>)}</TableBody></Table></div>
    </CardContent></Card>}
  </div>;
}

export function LaunchAnalyticsWorkspace({ mode }: { mode: 'platform' | 'school' }) {
  const { session } = useAuth();
  const [data, setData] = useState<DemoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDemo, setOpenDemo] = useState(mode === 'school');
  const [selectedStudent, setSelectedStudent] = useState<DemoStudent | null>(null);
  const [liveExplorer, setLiveExplorer] = useState(false);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    setLoading(true);
    void fetch('/api/sales-demo/?includeResults=1', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Unable to load demo analytics.'); setData(payload); setError(''); })
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load demo analytics.'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (selectedStudent) return <div className="space-y-4"><Button variant="outline" onClick={() => setSelectedStudent(null)}><ArrowLeft className="mr-2 h-4 w-4" />Back to student list</Button><div className="rounded-xl border border-[var(--line)] bg-white p-2 shadow-sm"><AnalyticsV12Workspace mode="school" selectedStudentId={selectedStudent.id} embedded hideStudentSelector /></div><QuestionResponseAudit studentId={selectedStudent.id} /></div>;
  if (liveExplorer) return <div className="space-y-4"><Button variant="outline" onClick={() => setLiveExplorer(false)}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><InstitutionAnalyticsWorkspace mode={mode} /></div>;
  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading Supabase analytics evidence…</div>;

  if (error || !data) {
    return <div className="space-y-4"><div className="rounded-xl border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-900">The Sales Demo School is not available to this account. Showing live-school analytics instead.</div><InstitutionAnalyticsWorkspace mode={mode} /></div>;
  }

  if (openDemo) return <DemoHierarchy data={data} onOpenStudent={setSelectedStudent} onBackToSchools={mode === 'platform' ? () => setOpenDemo(false) : undefined} />;

  return <div className="space-y-5 p-1 md:p-2">
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">Evidara intelligence</p><h1 className="text-2xl font-bold">School analytics</h1><p className="text-sm text-[var(--muted-foreground)]">Open a school, then drill into programs, subjects, chapters, topics and individual student intelligence.</p></div>
    <div className="grid gap-3 sm:grid-cols-3"><Metric label="Demo students" value={data.stats.students} /><Metric label="Submitted attempts" value={data.stats.attempts} /><Metric label="Demo average" value={pct(data.stats.averagePercentage)} /></div>
    <Card className="rounded-xl shadow-sm"><CardContent className="p-0"><button type="button" onClick={() => setOpenDemo(true)} className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-[var(--teal)]/[0.04]"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--teal)]/10 text-[var(--teal)]"><School className="h-6 w-6" /></div><div><h2 className="font-bold">{data.school.name}</h2><p className="text-sm text-[var(--muted-foreground)]">{data.school.city}, {data.school.state} · {data.school.board}</p><div className="mt-1 flex items-center gap-3 text-xs text-[var(--muted-foreground)]"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{data.stats.students} students</span><span>{data.stats.attempts.toLocaleString('en-IN')} attempts</span><span>{pct(data.stats.averagePercentage)} average</span></div></div></div><ChevronRight className="h-5 w-5" /></button></CardContent></Card>
    <Button variant="outline" onClick={() => setLiveExplorer(true)}>Open live-school analytics</Button>
  </div>;
}
