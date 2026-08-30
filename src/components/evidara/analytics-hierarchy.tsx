'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  ChevronRight,
  GraduationCap,
  Search,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '@/context/AuthProvider';
import { useSalesDemoMode, useSalesDemoData } from '@/components/evidara/sales-demo-workspace';
import { InstitutionAnalyticsWorkspace } from '@/components/institution-analytics/institution-analytics-workspace';
import type { InstitutionSchoolRow } from '@/types/institution-analytics';
import { Badge } from '@/components/ui/badge';
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

type GroupRow = {
  name: string;
  tests: number;
  attempts: number;
  average: number;
  accuracy: number;
  top: number;
  lastTestAt: string | null;
};

function pct(value: number | null | undefined) {
  return value == null || !Number.isFinite(value) ? '—' : `${Math.round(value * 10) / 10}%`;
}

function avg(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function fmtDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function MetricCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p>{note && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{note}</p>}</CardContent></Card>;
}

function computeGroup(name: string, tests: DemoTest[], results: DemoResult[]): GroupRow {
  const ids = new Set(tests.map((row) => row.id));
  const rows = results.filter((row) => ids.has(row.testId));
  return {
    name,
    tests: tests.length,
    attempts: rows.length,
    average: avg(rows.map((row) => row.percentage)),
    accuracy: avg(rows.map((row) => row.accuracy)),
    top: rows.length ? Math.max(...rows.map((row) => row.percentage)) : 0,
    lastTestAt: rows.map((row) => row.submittedAt).sort().at(-1) || null,
  };
}

function DemoStudentReport({ data, student, onBack }: { data: DemoPayload; student: DemoStudent; onBack: () => void }) {
  const results = data.results || [];
  const testsById = new Map(data.tests.map((test) => [test.id, test]));
  const studentResults = results.filter((row) => row.studentId === student.id).map((row) => ({ ...row, test: testsById.get(row.testId) })).filter((row) => row.test);
  const subjectNames = [...new Set(studentResults.map((row) => row.test?.subject).filter((v): v is string => Boolean(v)))];
  const subjects = subjectNames.map((name) => {
    const rows = studentResults.filter((row) => row.test?.subject === name);
    return { name, average: avg(rows.map((row) => row.percentage)), accuracy: avg(rows.map((row) => row.accuracy)), tests: rows.length };
  }).sort((a, b) => b.average - a.average);
  const topicNames = [...new Set(studentResults.map((row) => row.test?.topic).filter((v): v is string => Boolean(v)))];
  const topics = topicNames.map((name) => {
    const rows = studentResults.filter((row) => row.test?.topic === name);
    return { name, average: avg(rows.map((row) => row.percentage)), tests: rows.length, subject: rows[0]?.test?.subject || '—', chapter: rows[0]?.test?.chapter || '—' };
  }).sort((a, b) => b.average - a.average);
  const trend = [...studentResults].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()).map((row, index) => ({ test: index + 1, score: Math.round(row.percentage * 10) / 10, title: row.test?.title || `Test ${index + 1}` }));

  return <div className="space-y-5">
    <div className="flex items-center gap-3"><Button variant="outline" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--teal)]">Student intelligence</p><h2 className="text-2xl font-bold">{student.name}</h2><p className="text-sm text-[var(--muted-foreground)]">{student.track} · Grade {student.grade} · {student.section}</p></div></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><MetricCard label="Tests taken" value={student.completedTests} /><MetricCard label="Average" value={pct(student.averagePercentage)} /><MetricCard label="Accuracy" value={pct(student.accuracy)} /><MetricCard label="Top score" value={pct(student.highestPercentage)} /><MetricCard label="Lowest score" value={pct(student.lowestPercentage)} /><MetricCard label="Last test" value={fmtDate(student.lastTestAt)} /></div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-xl shadow-sm"><CardContent className="p-5"><h3 className="font-bold">Performance trend</h3><p className="mb-4 text-xs text-[var(--muted-foreground)]">Score movement across completed assessments.</p><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="test" /><YAxis domain={[0, 100]} /><Tooltip formatter={(value) => [`${value}%`, 'Score']} labelFormatter={(label) => trend[Number(label) - 1]?.title || `Test ${label}`} /><Line type="monotone" dataKey="score" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 3 }} /></LineChart></ResponsiveContainer></div></CardContent></Card>
      <Card className="rounded-xl shadow-sm"><CardContent className="p-5"><h3 className="font-bold">Subject performance</h3><p className="mb-4 text-xs text-[var(--muted-foreground)]">Average from subject-tagged assessments.</p><div className="h-[280px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={subjects}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis domain={[0, 100]} /><Tooltip formatter={(value) => [`${value}%`, 'Average']} /><Bar dataKey="average" fill="var(--teal)" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="rounded-xl shadow-sm"><CardContent className="p-5"><h3 className="font-bold">Strengths</h3><div className="mt-3 space-y-2">{topics.slice(0, 5).map((row) => <div key={row.name} className="flex items-center justify-between rounded-lg border border-[var(--line)] p-3"><div><strong>{row.name}</strong><p className="text-xs text-[var(--muted-foreground)]">{row.subject} · {row.chapter}</p></div><Badge>{pct(row.average)}</Badge></div>)}{!topics.length && <p className="text-sm text-[var(--muted-foreground)]">Topic-tagged tests will populate this section.</p>}</div></CardContent></Card>
      <Card className="rounded-xl shadow-sm"><CardContent className="p-5"><h3 className="font-bold">Focus areas</h3><div className="mt-3 space-y-2">{[...topics].reverse().slice(0, 5).map((row) => <div key={row.name} className="flex items-center justify-between rounded-lg border border-[var(--line)] p-3"><div><strong>{row.name}</strong><p className="text-xs text-[var(--muted-foreground)]">{row.subject} · {row.chapter}</p></div><Badge variant="outline">{pct(row.average)}</Badge></div>)}{!topics.length && <p className="text-sm text-[var(--muted-foreground)]">Topic-tagged tests will populate this section.</p>}</div></CardContent></Card>
    </div>

    <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h3 className="font-bold">Complete test history</h3><p className="text-xs text-[var(--muted-foreground)]">Every submitted demo assessment for this student.</p></div><Table><TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Type</TableHead><TableHead>Subject / Scope</TableHead><TableHead>Score</TableHead><TableHead>Accuracy</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{studentResults.sort((a,b) => new Date(b.submittedAt).getTime()-new Date(a.submittedAt).getTime()).map((row) => <TableRow key={`${row.testId}-${row.submittedAt}`}><TableCell className="font-medium">{row.test?.title}</TableCell><TableCell>{row.test?.testType}</TableCell><TableCell>{row.test?.topic || row.test?.chapter || row.test?.subject || 'Full syllabus'}</TableCell><TableCell className="font-semibold">{pct(row.percentage)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell>{fmtDate(row.submittedAt)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}

function DemoSchoolAnalytics({ onBack }: { onBack?: () => void }) {
  const { session } = useAuth();
  const [data, setData] = useState<DemoPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [track, setTrack] = useState<string | null>(null);
  const [subject, setSubject] = useState<string | null>(null);
  const [chapter, setChapter] = useState<string | null>(null);
  const [student, setStudent] = useState<DemoStudent | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    setLoading(true);
    void fetch('/api/sales-demo/?includeResults=1', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Unable to load analytics.'); setData(payload); setError(''); })
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load analytics.'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  const results = data?.results || [];
  const trackTests = useMemo(() => data?.tests.filter((row) => !track || row.examType === track) || [], [data?.tests, track]);
  const trackStudents = useMemo(() => data?.students.filter((row) => (!track || row.track === track) && (!search || `${row.name} ${row.section}`.toLowerCase().includes(search.toLowerCase()))) || [], [data?.students, search, track]);
  const trackResults = useMemo(() => {
    if (!data || !track) return results;
    const ids = new Set(data.students.filter((row) => row.track === track).map((row) => row.id));
    return results.filter((row) => ids.has(row.studentId));
  }, [data, results, track]);

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Calculating Evidara analytics…</div>;
  if (error || !data) return <div className="p-6 text-sm text-destructive">{error || 'Analytics unavailable.'}</div>;
  if (student) return <DemoStudentReport data={data} student={student} onBack={() => setStudent(null)} />;

  const selectedTrackStudents = data.students.filter((row) => !track || row.track === track);
  const topScore = trackResults.length ? Math.max(...trackResults.map((row) => row.percentage)) : 0;
  const subjectNames = [...new Set(trackTests.map((row) => row.subject).filter((v): v is string => Boolean(v)))];
  const subjectRows = subjectNames.map((name) => computeGroup(name, trackTests.filter((row) => row.subject === name), trackResults));
  const selectedSubjectTests = subject ? trackTests.filter((row) => row.subject === subject) : [];
  const chapterNames = [...new Set(selectedSubjectTests.map((row) => row.chapter).filter((v): v is string => Boolean(v)))];
  const chapterRows = chapterNames.map((name) => computeGroup(name, selectedSubjectTests.filter((row) => row.chapter === name), trackResults));
  const selectedChapterTests = chapter ? selectedSubjectTests.filter((row) => row.chapter === chapter) : [];
  const topicNames = [...new Set(selectedChapterTests.map((row) => row.topic).filter((v): v is string => Boolean(v)))];
  const topicRows = topicNames.map((name) => computeGroup(name, selectedChapterTests.filter((row) => row.topic === name), trackResults));

  function back() {
    if (chapter) setChapter(null);
    else if (subject) setSubject(null);
    else if (track) setTrack(null);
    else onBack?.();
  }

  const crumb = [data.school.name, track, subject, chapter].filter(Boolean).join(' › ');

  return <div className="space-y-5 p-4 md:p-6">
    <div className="flex items-center gap-3">{(track || subject || chapter || onBack) && <Button variant="outline" size="icon" onClick={back}><ArrowLeft className="h-4 w-4" /></Button>}<div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">School performance intelligence</p><h1 className="text-2xl font-bold">{track ? `${track} Analytics` : `${data.school.name} Analytics`}</h1><p className="text-sm text-[var(--muted-foreground)]">{crumb}</p></div></div>

    {!track && <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><MetricCard label="Students" value={data.stats.students} note={`${data.stats.neetStudents} NEET + ${data.stats.jeeStudents} JEE`} /><MetricCard label="Tests" value={data.stats.tests} /><MetricCard label="Submitted attempts" value={data.stats.attempts} /><MetricCard label="School average" value={pct(data.stats.averagePercentage)} /><MetricCard label="Accuracy" value={pct(data.stats.accuracy)} /></div>
      <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">Programs</h2><p className="text-sm text-[var(--muted-foreground)]">Open NEET or JEE to see tests, subjects, chapters, topics and students.</p></div><Table><TableHeader><TableRow><TableHead>Program</TableHead><TableHead>Students</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{data.tracks.map((row) => { const rows = results.filter((result) => data.students.find((s) => s.id === result.studentId)?.track === row.name); return <TableRow key={row.name} className="cursor-pointer" onClick={() => setTrack(row.name)}><TableCell><button className="font-bold text-[var(--teal)]">{row.name}</button></TableCell><TableCell>{row.students}</TableCell><TableCell>{data.tests.filter((test) => test.examType === row.name).length}</TableCell><TableCell>{row.attempts.toLocaleString('en-IN')}</TableCell><TableCell className="font-semibold">{pct(row.averagePercentage)}</TableCell><TableCell>{pct(rows.length ? Math.max(...rows.map((r) => r.percentage)) : 0)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>
    </>}

    {track && !subject && <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"><MetricCard label="Students" value={selectedTrackStudents.length} /><MetricCard label="Tests" value={trackTests.length} /><MetricCard label="Attempts" value={trackResults.length} /><MetricCard label="Average" value={pct(avg(trackResults.map((row) => row.percentage)))} /><MetricCard label="Top score" value={pct(topScore)} /><MetricCard label="Accuracy" value={pct(avg(trackResults.map((row) => row.accuracy)))} /></div>
      <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">Subject performance</h2><p className="text-sm text-[var(--muted-foreground)]">Click a subject to drill into chapters and topics.</p></div><Table><TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{subjectRows.map((row) => <TableRow key={row.name} className="cursor-pointer" onClick={() => setSubject(row.name)}><TableCell><button className="font-semibold text-[var(--teal)]">{row.name}</button></TableCell><TableCell>{row.tests}</TableCell><TableCell>{row.attempts}</TableCell><TableCell>{pct(row.average)}</TableCell><TableCell>{pct(row.top)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">Tests conducted</h2><p className="text-sm text-[var(--muted-foreground)]">Chapter tests, mock tests, full-length tests, diagnostics and PYQs for {track}.</p></div><Table><TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Type</TableHead><TableHead>Scope</TableHead><TableHead>Questions</TableHead><TableHead>Participants</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Date</TableHead></TableRow></TableHeader><TableBody>{trackTests.map((test) => { const rows = trackResults.filter((r) => r.testId === test.id); return <TableRow key={test.id}><TableCell className="font-medium">{test.title}</TableCell><TableCell>{test.testType}</TableCell><TableCell>{test.topic || test.chapter || test.subject || 'Full syllabus'}</TableCell><TableCell>{test.questionCount}</TableCell><TableCell>{test.participants}</TableCell><TableCell>{pct(test.averagePercentage)}</TableCell><TableCell>{pct(rows.length ? Math.max(...rows.map((r) => r.percentage)) : 0)}</TableCell><TableCell>{fmtDate(test.conductedAt)}</TableCell></TableRow>; })}</TableBody></Table></CardContent></Card>
    </>}

    {track && subject && !chapter && <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">{subject} chapter performance</h2><p className="text-sm text-[var(--muted-foreground)]">Click a chapter for topic-level intelligence.</p></div><Table><TableHeader><TableRow><TableHead>Chapter</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{chapterRows.map((row) => <TableRow key={row.name} className="cursor-pointer" onClick={() => setChapter(row.name)}><TableCell><button className="font-semibold text-[var(--teal)]">{row.name}</button></TableCell><TableCell>{row.tests}</TableCell><TableCell>{row.attempts}</TableCell><TableCell>{pct(row.average)}</TableCell><TableCell>{pct(row.top)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>}

    {track && subject && chapter && <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><div className="border-b border-[var(--line)] p-4"><h2 className="font-bold">{chapter} topic performance</h2><p className="text-sm text-[var(--muted-foreground)]">Topic-wise evidence from the demo assessments.</p></div><Table><TableHeader><TableRow><TableHead>Topic</TableHead><TableHead>Tests</TableHead><TableHead>Attempts</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead></TableRow></TableHeader><TableBody>{topicRows.length ? topicRows.map((row) => <TableRow key={row.name}><TableCell className="font-semibold">{row.name}</TableCell><TableCell>{row.tests}</TableCell><TableCell>{row.attempts}</TableCell><TableCell>{pct(row.average)}</TableCell><TableCell>{pct(row.top)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-8 text-center text-[var(--muted-foreground)]">No topic-specific tests are tagged under this chapter yet.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>}

    {track && <Card className="rounded-xl shadow-sm"><CardContent className="p-0"><div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-bold">Student performance</h2><p className="text-sm text-[var(--muted-foreground)]">Open any student for the same detailed analytics view a learner receives.</p></div><div className="relative w-full sm:w-[320px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search student or section" value={search} onChange={(event) => setSearch(event.target.value)} /></div></div><div className="max-h-[560px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Grade / Section</TableHead><TableHead>Tests</TableHead><TableHead>Average</TableHead><TableHead>Top score</TableHead><TableHead>Accuracy</TableHead><TableHead>Last test</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{trackStudents.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => setStudent(row)}><TableCell><button className="font-semibold text-[var(--teal)]">{row.name}</button></TableCell><TableCell>Grade {row.grade} · {row.section}</TableCell><TableCell>{row.completedTests}</TableCell><TableCell>{pct(row.averagePercentage)}</TableCell><TableCell>{pct(row.highestPercentage)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell>{fmtDate(row.lastTestAt)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>}
  </div>;
}

function PlatformSchoolAnalyticsHub() {
  const { session } = useAuth();
  const { data: demo, loading: demoLoading } = useSalesDemoData(true);
  const [schools, setSchools] = useState<InstitutionSchoolRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openDemo, setOpenDemo] = useState(false);
  const [showLiveExplorer, setShowLiveExplorer] = useState(false);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;
    setLoading(true);
    void fetch('/api/institution-analytics?level=schools', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Unable to load school analytics.'); setSchools(payload.schools || []); setError(''); })
      .catch((value) => setError(value instanceof Error ? value.message : 'Unable to load school analytics.'))
      .finally(() => setLoading(false));
  }, [session?.access_token]);

  if (openDemo) return <DemoSchoolAnalytics onBack={() => setOpenDemo(false)} />;
  if (showLiveExplorer) return <div className="space-y-4"><Button variant="outline" onClick={() => setShowLiveExplorer(false)}><ArrowLeft className="mr-2 h-4 w-4" />Back to school list</Button><InstitutionAnalyticsWorkspace mode="platform" /></div>;
  if (loading || demoLoading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading Evidara network analytics…</div>;
  if (error) return <div className="p-6 text-sm text-destructive">{error}</div>;

  const merged = schools.map((row) => {
    if (!demo || row.id !== demo.school.id) return row;
    const high = demo.students.length ? Math.max(...demo.students.map((student) => student.highestPercentage)) : 0;
    return { ...row, totalStudents: demo.stats.students, completedTests: demo.stats.attempts, averageTestsPerStudent: demo.stats.students ? demo.stats.attempts / demo.stats.students : 0, averagePercentage: demo.stats.averagePercentage, accuracy: demo.stats.accuracy, participation: 100, highestPercentage: high, lastTestAt: demo.students.map((student) => student.lastTestAt).filter(Boolean).sort().at(-1) || null };
  }).filter((row) => !search || `${row.name} ${row.city || ''} ${row.state || ''} ${row.board || ''}`.toLowerCase().includes(search.toLowerCase()));
  const totalStudents = merged.reduce((sum, row) => sum + row.totalStudents, 0);
  const totalAttempts = merged.reduce((sum, row) => sum + row.completedTests, 0);
  const assessed = merged.filter((row) => row.averagePercentage != null);
  const networkAverage = assessed.length ? avg(assessed.map((row) => row.averagePercentage || 0)) : 0;

  return <div className="space-y-5 p-4 md:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">Evidara intelligence</p><h1 className="text-2xl font-bold">School performance analytics</h1><p className="text-sm text-[var(--muted-foreground)]">Start at the institution level, then drill into programs, tests, subjects, chapters, topics and individual students.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><MetricCard label="Schools" value={merged.length} /><MetricCard label="Students" value={totalStudents} /><MetricCard label="Submitted attempts" value={totalAttempts} /><MetricCard label="Network average" value={pct(networkAverage)} /></div>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search school, city, state or board" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>School</TableHead><TableHead>Students</TableHead><TableHead>Submitted attempts</TableHead><TableHead>Average</TableHead><TableHead>Accuracy</TableHead><TableHead>Participation</TableHead><TableHead>Last test</TableHead><TableHead></TableHead></TableRow></TableHeader><TableBody>{merged.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => demo && row.id === demo.school.id ? setOpenDemo(true) : setShowLiveExplorer(true)}><TableCell><button className="font-semibold text-[var(--teal)]">{row.name}</button><p className="text-xs text-[var(--muted-foreground)]">{row.city}, {row.state} · {row.board}</p></TableCell><TableCell>{row.totalStudents}</TableCell><TableCell>{row.completedTests.toLocaleString('en-IN')}</TableCell><TableCell className="font-semibold">{pct(row.averagePercentage)}</TableCell><TableCell>{pct(row.accuracy)}</TableCell><TableCell>{pct(row.participation)}</TableCell><TableCell>{fmtDate(row.lastTestAt)}</TableCell><TableCell><ChevronRight className="h-4 w-4" /></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
  </div>;
}

export function EvidaraAnalyticsWorkspace({ mode }: { mode: 'platform' | 'school' }) {
  const salesDemo = useSalesDemoMode();
  if (mode === 'platform') return <PlatformSchoolAnalyticsHub />;
  if (salesDemo) return <DemoSchoolAnalytics />;
  return <InstitutionAnalyticsWorkspace mode="school" />;
}
