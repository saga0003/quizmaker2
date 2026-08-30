'use client';

import { useEffect, useMemo, useState, type ElementType } from 'react';
import { BarChart3, BookOpen, GraduationCap, Search, Target, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { useAppStore } from '@/store/use-app-store';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type SalesDemoPayload = {
  generatedAt: string;
  school: { id: string; name: string; city: string; state: string; board: string; status: string };
  subscription: { plan_name: string; status: string; seat_limit: number; starts_at: string; ends_at: string } | null;
  stats: { students: number; neetStudents: number; jeeStudents: number; tests: number; attempts: number; questionInstances: number; averagePercentage: number; accuracy: number };
  tracks: Array<{ name: string; students: number; tests: number; attempts: number; averagePercentage: number; accuracy: number }>;
  subjects: Array<{ name: string; tests: number; attempts: number; averagePercentage: number; accuracy: number; chapters: Array<{ name: string; tests: number; attempts: number; averagePercentage: number }> }>;
  students: Array<{ id: string; name: string; email: string | null; grade: number; section: string; academicYear: string; track: string; board: string; status: string; completedTests: number; averagePercentage: number; accuracy: number; highestPercentage: number; lowestPercentage: number; lastTestAt: string | null }>;
  tests: Array<{ id: string; title: string; testType: string; examType: string; subject: string | null; chapter: string | null; topic: string | null; questionCount: number; maximumMarks: number; durationMinutes: number; conductedAt: string; attempts: number; participants: number; averagePercentage: number; accuracy: number }>;
};

const DEMO_EMAILS = new Set([
  'sales.schooladmin@demo.evidara.app',
  'sales.teacher@demo.evidara.app',
  'sales.student@demo.evidara.app',
]);

export function useSalesDemoMode() {
  const user = useAppStore((state) => state.user);
  const baseUser = useAppStore((state) => state.baseUser);
  const impersonatingAs = useAppStore((state) => state.impersonatingAs);
  const superAdminPreview = baseUser?.accessRole === 'super_admin' && (impersonatingAs === 'school_admin' || impersonatingAs === 'school_teacher' || impersonatingAs === 'student');
  return Boolean(superAdminPreview || (user?.email && DEMO_EMAILS.has(user.email.toLowerCase())));
}

export function useSalesDemoData(enabled = true) {
  const { session } = useAuth();
  const [data, setData] = useState<SalesDemoPayload | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void fetch('/api/sales-demo/', { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to load sales demo data.');
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
      })
      .catch((value) => {
        if (!cancelled) setError(value instanceof Error ? value.message : 'Unable to load sales demo data.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [enabled, session?.access_token]);

  return { data, loading, error };
}

function metric(value: number) {
  return Number.isFinite(value) ? value.toLocaleString('en-IN', { maximumFractionDigits: 1 }) : '0';
}

function percent(value: number) {
  return `${Math.round(value * 10) / 10}%`;
}

export function SalesDemoAnalyticsWorkspace() {
  const { data, loading, error } = useSalesDemoData(true);
  const [track, setTrack] = useState('all');
  const [search, setSearch] = useState('');

  const students = useMemo(() => (data?.students || []).filter((row) => {
    const trackMatch = track === 'all' || row.track === track;
    const searchMatch = !search || `${row.name} ${row.section} ${row.track}`.toLowerCase().includes(search.toLowerCase());
    return trackMatch && searchMatch;
  }), [data?.students, search, track]);

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading Evidara Sales Demo analytics…</div>;
  if (error || !data) return <div className="p-6 text-sm text-destructive">{error || 'Sales Demo analytics are unavailable.'}</div>;

  const summaryCards: Array<[string, number | string, ElementType]> = [
    ['Students', data.stats.students, Users],
    ['NEET', data.stats.neetStudents, Target],
    ['JEE', data.stats.jeeStudents, Target],
    ['Tests', data.stats.tests, BookOpen],
    ['Attempts', data.stats.attempts, BarChart3],
    ['Avg score', percent(data.stats.averagePercentage), BarChart3],
    ['Accuracy', percent(data.stats.accuracy), BarChart3],
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="rounded-2xl border border-[var(--line)] bg-gradient-to-r from-[#14232B] to-[#117C78] p-5 text-white md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2"><GraduationCap className="h-5 w-5" /><span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/75">Sales demonstration dataset</span></div>
            <h1 className="text-2xl font-bold !text-white">{data.school.name} Analytics</h1>
            <p className="mt-1 text-sm !text-white/80">500 synthetic roster students · real Evidara analytics presentation flow</p>
          </div>
          <Badge className="border-white/25 bg-white/15 !text-white">Demo school only</Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {summaryCards.map(([label, value, Icon]) => (
          <Card key={label} className="rounded-xl shadow-sm"><CardContent className="p-4"><Icon className="mb-3 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-xl font-bold text-[var(--foreground)]">{typeof value === 'number' ? metric(value) : value}</p></CardContent></Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {data.tracks.map((row) => (
          <Card key={row.name} className="rounded-xl shadow-sm"><CardContent className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">{row.name}</p><p className="mt-1 text-2xl font-bold">{row.students} students</p></div><Badge variant="outline">{row.tests} test formats</Badge></div><div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><span className="text-[var(--muted-foreground)]">Attempts</span><strong className="mt-1 block">{metric(row.attempts)}</strong></div><div><span className="text-[var(--muted-foreground)]">Average</span><strong className="mt-1 block">{percent(row.averagePercentage)}</strong></div><div><span className="text-[var(--muted-foreground)]">Accuracy</span><strong className="mt-1 block">{percent(row.accuracy)}</strong></div></div></CardContent></Card>
        ))}
      </div>

      <Card className="rounded-xl shadow-sm"><CardContent className="p-5"><div className="mb-4"><h2 className="text-lg font-bold">Subject & chapter intelligence</h2><p className="text-sm text-[var(--muted-foreground)]">Performance derived from the seeded NEET/JEE chapter, topic, subject, mock and full-length tests.</p></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{data.subjects.map((subject) => <div key={subject.name} className="rounded-xl border border-[var(--line)] p-4"><div className="flex items-center justify-between"><strong>{subject.name}</strong><Badge variant="outline">{subject.tests} tests</Badge></div><p className="mt-3 text-2xl font-bold text-[var(--teal)]">{percent(subject.averagePercentage)}</p><p className="text-xs text-[var(--muted-foreground)]">{metric(subject.attempts)} attempts · {percent(subject.accuracy)} accuracy</p><div className="mt-3 space-y-1">{subject.chapters.slice(0, 4).map((chapter) => <div key={chapter.name} className="flex justify-between gap-3 text-xs"><span className="truncate text-[var(--muted-foreground)]">{chapter.name}</span><strong>{percent(chapter.averagePercentage)}</strong></div>)}</div></div>)}</div></CardContent></Card>

      <Card className="rounded-xl shadow-sm"><CardContent className="p-0"><div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search student or section" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">All tracks</option><option value="NEET">NEET</option><option value="JEE">JEE</option></select></div><div className="max-h-[560px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Track</TableHead><TableHead>Class</TableHead><TableHead>Tests</TableHead><TableHead>Average</TableHead><TableHead>Accuracy</TableHead></TableRow></TableHeader><TableBody>{students.map((student) => <TableRow key={student.id}><TableCell><div className="font-medium">{student.name}</div><div className="text-xs text-[var(--muted-foreground)]">{student.email}</div></TableCell><TableCell><Badge variant="outline">{student.track}</Badge></TableCell><TableCell>Grade {student.grade} · {student.section}</TableCell><TableCell>{student.completedTests}</TableCell><TableCell className="font-semibold">{percent(student.averagePercentage)}</TableCell><TableCell>{percent(student.accuracy)}</TableCell></TableRow>)}</TableBody></Table></div><div className="border-t border-[var(--line)] p-3 text-xs text-[var(--muted-foreground)]">Showing {students.length} of {data.stats.students} demo students.</div></CardContent></Card>

      <Card className="rounded-xl shadow-sm"><CardContent className="p-5"><h2 className="text-lg font-bold">Recent demo tests</h2><div className="mt-4 overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Test</TableHead><TableHead>Type</TableHead><TableHead>Exam</TableHead><TableHead>Scope</TableHead><TableHead>Participants</TableHead><TableHead>Average</TableHead></TableRow></TableHeader><TableBody>{data.tests.slice(0, 16).map((test) => <TableRow key={test.id}><TableCell className="font-medium">{test.title}</TableCell><TableCell>{test.testType}</TableCell><TableCell>{test.examType}</TableCell><TableCell>{test.topic || test.chapter || test.subject || 'Full syllabus'}</TableCell><TableCell>{test.participants}</TableCell><TableCell className="font-semibold">{percent(test.averagePercentage)}</TableCell></TableRow>)}</TableBody></Table></div></CardContent></Card>
    </div>
  );
}

export function SalesDemoStudentRoster() {
  const { data, loading, error } = useSalesDemoData(true);
  const [search, setSearch] = useState('');
  const [track, setTrack] = useState('all');
  const [grade, setGrade] = useState('all');
  const rows = useMemo(() => (data?.students || []).filter((row) => (track === 'all' || row.track === track) && (grade === 'all' || String(row.grade) === grade) && (!search || `${row.name} ${row.email || ''} ${row.section}`.toLowerCase().includes(search.toLowerCase()))), [data?.students, grade, search, track]);
  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading 500 demo students…</div>;
  if (error || !data) return <div className="p-6 text-sm text-destructive">{error || 'Demo roster unavailable.'}</div>;
  return <div className="space-y-4"><div className="flex flex-col gap-3 rounded-xl border border-[var(--line)] bg-white p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search 500 demo students" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">All tracks</option><option value="NEET">NEET · 250</option><option value="JEE">JEE · 250</option></select><select className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={grade} onChange={(event) => setGrade(event.target.value)}><option value="all">All grades</option><option value="11">Grade 11</option><option value="12">Grade 12</option></select></div><Card className="rounded-xl shadow-sm"><CardContent className="p-0"><div className="max-h-[650px] overflow-auto"><Table><TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Track</TableHead><TableHead>Grade / Section</TableHead><TableHead>Academic year</TableHead><TableHead>Tests</TableHead><TableHead>Average</TableHead></TableRow></TableHeader><TableBody>{rows.map((student) => <TableRow key={student.id}><TableCell><div className="font-medium">{student.name}</div><div className="text-xs text-[var(--muted-foreground)]">{student.email}</div></TableCell><TableCell><Badge variant="outline">{student.track}</Badge></TableCell><TableCell>Grade {student.grade} · {student.section}</TableCell><TableCell>{student.academicYear}</TableCell><TableCell>{student.completedTests}</TableCell><TableCell className="font-semibold">{percent(student.averagePercentage)}</TableCell></TableRow>)}</TableBody></Table></div><div className="border-t border-[var(--line)] p-3 text-xs text-[var(--muted-foreground)]">{rows.length} matching students · 250 NEET + 250 JEE seeded records.</div></CardContent></Card></div>;
}
