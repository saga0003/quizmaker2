'use client';

import { useCallback, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  ArrowLeft,
  ArrowUpDown,
  BarChart3,
  BookOpenCheck,
  Check,
  ChevronRight,
  Download,
  FileDown,
  GraduationCap,
  LoaderCircle,
  Search,
  School,
  TrendingDown,
  Trophy,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import {
  exportInstitutionReportCards,
  exportInstitutionResultsCsv,
  exportInstitutionSchoolReportCards,
  exportInstitutionSchoolResultsCsv,
} from '@/lib/institutionReportPdf';
import { useAppStore } from '@/store/use-app-store';
import { AnalyticsV12Workspace } from '@/components/analytics-v12/student-analytics-v12';
import type {
  InstitutionAnalyticsActor,
  InstitutionAnalyticsLevel,
  InstitutionAnalyticsPayload,
  InstitutionChapterRow,
  InstitutionClassRow,
  InstitutionSchoolRow,
  InstitutionStudentRow,
  InstitutionSubjectRow,
  InstitutionTopicRow,
  ScoreBand,
} from '@/types/institution-analytics';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import './institution-analytics.css';

const TEAL = 'var(--teal)';
const AMBER = 'var(--amber)';
const BLUE = 'var(--info)';
const RED = 'var(--destructive)';
const GREEN = '#137A3A';

type SortDirection = 'asc' | 'desc';
type SortState = { key: string; direction: SortDirection };

type TrailItem = {
  level: InstitutionAnalyticsLevel;
  label: string;
  organizationId?: string | null;
  sectionId?: string | null;
  subjectId?: string | null;
  chapterId?: string | null;
  studentId?: string | null;
};

function percentage(value: number | null | undefined) {
  return value == null ? '—' : `${Math.round(value * 10) / 10}%`;
}

function number(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: 1 });
}

function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

function metricTone(value: number | null | undefined) {
  if (value == null) return 'var(--muted-foreground)';
  if (value >= 75) return GREEN;
  if (value >= 55) return AMBER;
  return RED;
}

function compare(a: unknown, b: unknown, direction: SortDirection) {
  const multiplier = direction === 'asc' ? 1 : -1;
  if (typeof a === 'number' || typeof b === 'number') return (Number(a ?? -Infinity) - Number(b ?? -Infinity)) * multiplier;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
}

function SortHeader({ label, sortKey, sort, onSort, className = '' }: { label: string; sortKey: string; sort: SortState; onSort: (key: string) => void; className?: string }) {
  return <TableHead className={className}><button type="button" onClick={() => onSort(sortKey)} className="institution-sort-button"><span>{label}</span><ArrowUpDown className={sort.key === sortKey ? 'active' : ''} /></button></TableHead>;
}

function StatCard({ icon: Icon, label, value, note, tone = TEAL }: { icon: typeof Users; label: string; value: ReactNode; note?: ReactNode; tone?: string }) {
  return <Card className="institution-stat-card"><CardContent>
    <div className="institution-stat-icon" style={{ color: tone, backgroundColor: `${tone}12` }}><Icon /></div>
    <div><span>{label}</span><strong style={{ color: tone }}>{value}</strong>{note && <small>{note}</small>}</div>
  </CardContent></Card>;
}

function ScoreDistribution({ rows, title = 'Student score distribution' }: { rows: ScoreBand[]; title?: string }) {
  return <Card className="institution-panel"><CardContent>
    <div className="institution-panel-heading"><div><h3>{title}</h3><p>Number of students in each percentage range.</p></div><Badge variant="outline">{rows.reduce((sum, row) => sum + row.students, 0)} students</Badge></div>
    <div className="institution-chart institution-chart-medium">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 12, right: 12, left: -12, bottom: 18 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" angle={-24} textAnchor="end" height={55} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
          <Tooltip formatter={(value) => [`${value} students`, 'Students']} />
          <Bar dataKey="students" radius={[6, 6, 0, 0]}>
            {rows.map((row, index) => <Cell key={row.label} fill={index <= 3 ? RED : index <= 6 ? AMBER : TEAL} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  </CardContent></Card>;
}

function SubjectDonut({ subject, onClick }: { subject: InstitutionSubjectRow; onClick: () => void }) {
  const score = Math.max(0, Math.min(100, subject.averagePercentage || 0));
  return <button type="button" className="institution-subject-card" onClick={onClick}>
    <div className="institution-subject-donut">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie data={[{ value: score }, { value: 100 - score }]} dataKey="value" innerRadius={34} outerRadius={47} startAngle={90} endAngle={-270} stroke="none"><Cell fill={metricTone(score)} /><Cell fill="var(--line)" /></Pie></PieChart>
      </ResponsiveContainer>
      <strong>{percentage(score)}</strong>
    </div>
    <div><h3>{subject.name}</h3><p>{subject.studentCount} students · {subject.responseCount} responses</p><span>Highest {percentage(subject.highestPercentage)} · Lowest {percentage(subject.lowestPercentage)}</span></div>
    <ChevronRight />
  </button>;
}

function blankPayload(mode: 'platform' | 'school', level: InstitutionAnalyticsLevel): InstitutionAnalyticsPayload {
  const actor: InstitutionAnalyticsActor = {
    id: '',
    role: mode === 'platform' ? 'super_admin' : 'school_admin',
    platformAdmin: mode === 'platform',
    organizationId: null,
    allowedSectionIds: null,
    allowedSubjectLabels: null,
  };
  return {
    mode: 'live',
    level,
    actor,
    generatedAt: new Date().toISOString(),
    schools: [],
    classes: [],
    students: [],
    subjects: [],
    chapters: [],
    topics: [],
    scoreBands: [],
    evidence: { submittedAttempts: 0, classifiedResponses: 0, hasLiveEvidence: false },
  };
}

function LiveEvidenceNotice({ note }: { note?: string }) {
  return <div className="institution-live-notice"><BarChart3 /><div><strong>Live Evidara data</strong><p>{note || 'The school structure is live. Performance metrics will populate after students submit assessments.'}</p></div></div>;
}

function InstitutionEmptyState({ title, copy }: { title: string; copy: string }) {
  return <div className="institution-empty-state"><BarChart3 /><strong>{title}</strong><p>{copy}</p></div>;
}

export function InstitutionAnalyticsWorkspace({ mode }: { mode: 'platform' | 'school' }) {
  const user = useAppStore((state) => state.user);
  const initialLevel: InstitutionAnalyticsLevel = mode === 'platform' ? 'schools' : 'school';
  const [level, setLevel] = useState<InstitutionAnalyticsLevel>(initialLevel);
  const [payload, setPayload] = useState<InstitutionAnalyticsPayload>(() => blankPayload(mode, initialLevel));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [chapterId, setChapterId] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [trail, setTrail] = useState<TrailItem[]>([{ level: initialLevel, label: mode === 'platform' ? 'All schools' : 'My school' }]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState<SortState>({ key: mode === 'platform' ? 'rank' : 'grade', direction: 'asc' });
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [bulkDownloading, setBulkDownloading] = useState<'pdf' | 'csv' | null>(null);

  const load = useCallback(async (nextLevel: InstitutionAnalyticsLevel, params?: Partial<TrailItem>) => {
    const nextOrganizationId = params?.organizationId ?? organizationId;
    const nextSectionId = params?.sectionId ?? sectionId;
    const nextSubjectId = params?.subjectId ?? subjectId;
    const nextChapterId = params?.chapterId ?? chapterId;
    const nextStudentId = params?.studentId ?? studentId;
    setLoading(true);
    setError('');
    try {
      if (!supabase) throw new Error('Supabase is not configured on this device.');
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Your Evidara session has expired. Sign in again.');
      const query = new URLSearchParams({ level: nextLevel });
      if (nextOrganizationId) query.set('organizationId', nextOrganizationId);
      if (nextSectionId) query.set('sectionId', nextSectionId);
      if (nextSubjectId) query.set('subjectId', nextSubjectId);
      if (nextChapterId) query.set('chapterId', nextChapterId);
      if (nextStudentId) query.set('studentId', nextStudentId);
      const response = await fetch(`/api/institution-analytics?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
      const result = await response.json() as InstitutionAnalyticsPayload & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Unable to load institution analytics.');
      setPayload(result);
      setLevel(nextLevel);
      setOrganizationId(result.school?.id || nextOrganizationId || null);
      setSectionId(result.class?.id || nextSectionId || null);
      setSubjectId(result.subject?.id || nextSubjectId || null);
      setChapterId(result.chapter?.id || nextChapterId || null);
      setStudentId(result.studentDetail?.student.id || nextStudentId || null);
      setSelectedStudents(new Set());
      setSearch('');
      setFilter('all');
    } catch (value) {
      const message = value instanceof Error ? value.message : 'Unable to load analytics.';
      setError(message);
      setPayload(blankPayload(mode, nextLevel));
      setLevel(nextLevel);
    } finally {
      setLoading(false);
    }
  }, [chapterId, mode, organizationId, sectionId, studentId, subjectId]);

  useEffect(() => { void load(initialLevel); }, [initialLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  function navigate(nextLevel: InstitutionAnalyticsLevel, label: string, params: Partial<TrailItem>) {
    const index = trail.findIndex((item) => item.level === nextLevel);
    const nextTrail = index >= 0 ? trail.slice(0, index) : trail;
    setTrail([...nextTrail, { level: nextLevel, label, ...params }]);
    void load(nextLevel, params);
  }

  function goTrail(item: TrailItem, index: number) {
    setTrail(trail.slice(0, index + 1));
    void load(item.level, item);
  }

  function goBack() {
    if (trail.length <= 1) return;
    const next = trail[trail.length - 2];
    setTrail(trail.slice(0, -1));
    void load(next.level, next);
  }

  function updateSort(key: string) {
    setSort((current) => current.key === key ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { key, direction: 'asc' });
  }

  const schools = useMemo(() => {
    const rows = (payload.schools || []).filter((row) => {
      const textMatch = !search || `${row.name} ${row.city || ''} ${row.state || ''} ${row.board || ''} ${row.status || ''}`.toLowerCase().includes(search.toLowerCase());
      const boardMatch = filter === 'all' || row.board === filter;
      return textMatch && boardMatch;
    });
    return [...rows].sort((a, b) => compare(a[sort.key as keyof InstitutionSchoolRow], b[sort.key as keyof InstitutionSchoolRow], sort.direction));
  }, [filter, payload.schools, search, sort]);

  const classes = useMemo(() => {
    const rows = (payload.classes || []).filter((row) => {
      const textMatch = !search || `${row.name} ${row.code || ''} ${row.academicYear}`.toLowerCase().includes(search.toLowerCase());
      const gradeMatch = filter === 'all' || String(row.grade) === filter;
      return textMatch && gradeMatch;
    });
    return [...rows].sort((a, b) => compare(a[sort.key as keyof InstitutionClassRow], b[sort.key as keyof InstitutionClassRow], sort.direction));
  }, [filter, payload.classes, search, sort]);

  const students = useMemo(() => {
    const rows = (payload.students || []).filter((row) => {
      const textMatch = !search || row.name.toLowerCase().includes(search.toLowerCase());
      const performance = row.averagePercentage == null ? 'no-data' : row.averagePercentage < 40 ? 'critical' : row.averagePercentage < 60 ? 'support' : row.averagePercentage < 75 ? 'developing' : 'strong';
      return textMatch && (filter === 'all' || performance === filter);
    });
    return [...rows].sort((a, b) => compare(a[sort.key as keyof InstitutionStudentRow], b[sort.key as keyof InstitutionStudentRow], sort.direction));
  }, [filter, payload.students, search, sort]);

  const allVisibleSelected = students.length > 0 && students.every((row) => selectedStudents.has(row.id));

  function toggleAllStudents(checked: boolean) {
    setSelectedStudents((current) => {
      const next = new Set(current);
      for (const row of students) checked ? next.add(row.id) : next.delete(row.id);
      return next;
    });
  }

  function downloadReportCards() {
    const chosen = (payload.students || []).filter((row) => selectedStudents.has(row.id));
    if (!chosen.length || !payload.class) return;
    exportInstitutionReportCards({ schoolName: payload.school?.name || 'Evidara School', classRow: payload.class, students: chosen, subjects: payload.subjects || [] });
  }

  function downloadCsv() {
    const chosen = selectedStudents.size ? (payload.students || []).filter((row) => selectedStudents.has(row.id)) : students;
    if (!chosen.length || !payload.class) return;
    exportInstitutionResultsCsv({ schoolName: payload.school?.name || 'Evidara School', classRow: payload.class, students: chosen });
  }

  async function downloadSchoolResults(kind: 'pdf' | 'csv') {
    if (!classes.length || bulkDownloading) return;
    setBulkDownloading(kind);
    setError('');
    try {
      const batches: Array<{ classRow: InstitutionClassRow; students: InstitutionStudentRow[]; subjects: InstitutionSubjectRow[] }> = [];
      const sessionResult = supabase ? await supabase.auth.getSession() : null;
      const token = sessionResult?.data.session?.access_token;

      for (const classRow of classes) {
        if (!token) throw new Error('Your Evidara session has expired. Sign in again.');
        const query = new URLSearchParams({ level: 'class', organizationId: payload.school?.id || '', sectionId: classRow.id });
        const response = await fetch(`/api/institution-analytics?${query.toString()}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        const classPayload = await response.json() as InstitutionAnalyticsPayload & { error?: string };
        if (!response.ok) throw new Error(classPayload.error || `Unable to load ${classRow.name}.`);
        if (classPayload.class && classPayload.students?.length) {
          batches.push({ classRow: classPayload.class, students: classPayload.students, subjects: classPayload.subjects || [] });
        }
      }

      if (!batches.length) throw new Error('No student results are available for the filtered classes.');
      const schoolName = payload.school?.name || 'Evidara School';
      if (kind === 'pdf') exportInstitutionSchoolReportCards({ schoolName, classes: batches });
      else exportInstitutionSchoolResultsCsv({ schoolName, classes: batches });
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to create the school report download.');
    } finally {
      setBulkDownloading(null);
    }
  }

  const title = level === 'schools' ? 'School performance analytics'
    : level === 'school' ? `${payload.school?.name || 'School'} analytics`
      : level === 'class' ? `${payload.class?.name || 'Class'} performance`
        : level === 'subject' ? `${payload.subject?.name || 'Subject'} chapter analysis`
          : level === 'chapter' ? `${payload.chapter?.name || 'Chapter'} topic analysis`
            : `${payload.studentDetail?.student.name || 'Student'} performance`;

  return <div className="institution-analytics">
    <header className="institution-page-header">
      <div className="institution-title-row">
        {trail.length > 1 && <Button variant="outline" size="icon" onClick={goBack} aria-label="Go back"><ArrowLeft /></Button>}
        <div><span className="institution-kicker">{mode === 'platform' ? 'Evidara intelligence' : user?.accessRole === 'school_teacher' ? 'Assigned class intelligence' : 'School intelligence'}</span><h1>{title}</h1><p>Drill down from institution to class, subject, chapter, topic and individual student evidence.</p></div>
      </div>
      <div className="institution-breadcrumbs">{trail.map((item, index) => <button type="button" key={`${item.level}-${index}`} onClick={() => goTrail(item, index)} className={index === trail.length - 1 ? 'active' : ''}>{item.label}{index < trail.length - 1 && <ChevronRight />}</button>)}</div>
    </header>

    {!loading && !error && !payload.evidence.hasLiveEvidence && <LiveEvidenceNotice note={payload.evidence.note} />}
    {error && <div className="institution-error"><strong>Live data could not be loaded.</strong><span>{error}</span><span>No demonstration records were substituted.</span></div>}
    {loading && <div className="institution-loading"><LoaderCircle /><span>Calculating analytics…</span></div>}

    {!loading && level === 'schools' && <SchoolsView rows={schools} allRows={payload.schools || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} onOpen={(school) => navigate('school', school.name, { organizationId: school.id })} />}
    {!loading && level === 'school' && <ClassesView rows={classes} allRows={payload.classes || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} onOpen={(row) => navigate('class', row.name, { organizationId: payload.school?.id, sectionId: row.id })} bulkDownloading={bulkDownloading} onDownloadPdf={() => void downloadSchoolResults('pdf')} onDownloadCsv={() => void downloadSchoolResults('csv')} />}
    {!loading && level === 'class' && payload.class && <ClassView classRow={payload.class} students={students} allStudents={payload.students || []} subjects={payload.subjects || []} bands={payload.scoreBands || []} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} sort={sort} onSort={updateSort} selected={selectedStudents} setSelected={setSelectedStudents} allVisibleSelected={allVisibleSelected} toggleAll={toggleAllStudents} onSubject={(row) => navigate('subject', row.name, { organizationId: payload.school?.id, sectionId: payload.class?.id, subjectId: row.id })} onStudent={(row) => navigate('student', row.name, { organizationId: payload.school?.id, sectionId: payload.class?.id, studentId: row.id })} onDownloadReports={downloadReportCards} onDownloadCsv={downloadCsv} />}
    {!loading && level === 'subject' && payload.subject && <SubjectView subject={payload.subject} chapters={payload.chapters || []} bands={payload.scoreBands || []} onChapter={(row) => navigate('chapter', row.name, { organizationId: payload.school?.id, sectionId: payload.class?.id, subjectId: payload.subject?.id, chapterId: row.id })} />}
    {!loading && level === 'chapter' && payload.chapter && <ChapterView chapter={payload.chapter} topics={payload.topics || []} bands={payload.scoreBands || []} />}
    {!loading && level === 'student' && payload.studentDetail && <StudentView detail={payload.studentDetail} />}
  </div>;
}

function SchoolsView({ rows, allRows, search, setSearch, filter, setFilter, sort, onSort, onOpen }: { rows: InstitutionSchoolRow[]; allRows: InstitutionSchoolRow[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; sort: SortState; onSort: (key: string) => void; onOpen: (row: InstitutionSchoolRow) => void }) {
  const best = allRows.find((row) => row.averagePercentage !== null) || null;
  const totalStudents = allRows.reduce((sum, row) => sum + row.totalStudents, 0);
  const totalTests = allRows.reduce((sum, row) => sum + row.completedTests, 0);
  const assessedStudents = allRows.filter((row) => row.averagePercentage !== null).reduce((sum, row) => sum + row.totalStudents, 0);
  const weightedAverage = assessedStudents ? allRows.reduce((sum, row) => sum + (row.averagePercentage || 0) * row.totalStudents, 0) / assessedStudents : null;
  const boards = [...new Set(allRows.map((row) => row.board).filter(Boolean))] as string[];
  return <>
    <div className="institution-stat-grid"><StatCard icon={School} label="Schools" value={allRows.length} note="Ranked by average performance" /><StatCard icon={Users} label="Total students" value={totalStudents.toLocaleString('en-IN')} note={`${allRows.reduce((sum, row) => sum + row.totalClasses, 0)} classes`} tone={BLUE} /><StatCard icon={BookOpenCheck} label="Submitted tests" value={totalTests.toLocaleString('en-IN')} note={`${number(totalStudents ? totalTests / totalStudents : 0)} per student`} tone={AMBER} /><StatCard icon={Trophy} label="Best performing school" value={best?.name || '—'} note={best ? `${percentage(best.averagePercentage)} average` : 'Awaiting evidence'} tone={GREEN} /><StatCard icon={BarChart3} label="Network average" value={percentage(weightedAverage)} note="Weighted by student strength" tone={TEAL} /></div>
    <DataToolbar search={search} setSearch={setSearch} placeholder="Search school, city, board or state" filter={filter} setFilter={setFilter} options={boards.map((board) => ({ value: board, label: board }))} filterLabel="All boards" count={rows.length} />
    <Card className="institution-table-card"><Table className="min-w-[1180px]"><TableHeader><TableRow><SortHeader label="Rank" sortKey="rank" sort={sort} onSort={onSort} /><SortHeader label="School" sortKey="name" sort={sort} onSort={onSort} /><SortHeader label="Status" sortKey="status" sort={sort} onSort={onSort} /><SortHeader label="Students" sortKey="totalStudents" sort={sort} onSort={onSort} /><SortHeader label="Classes" sortKey="totalClasses" sort={sort} onSort={onSort} /><SortHeader label="Tests" sortKey="completedTests" sort={sort} onSort={onSort} /><SortHeader label="Tests / student" sortKey="averageTestsPerStudent" sort={sort} onSort={onSort} /><SortHeader label="Average" sortKey="averagePercentage" sort={sort} onSort={onSort} /><SortHeader label="Accuracy" sortKey="accuracy" sort={sort} onSort={onSort} /><SortHeader label="Participation" sortKey="participation" sort={sort} onSort={onSort} /><SortHeader label="Last test" sortKey="lastTestAt" sort={sort} onSort={onSort} /><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={row.id} onClick={() => onOpen(row)} className="institution-clickable-row"><TableCell><span className={`institution-rank rank-${Math.min(row.rank, 3)}`}>{row.rank}</span></TableCell><TableCell><strong>{row.name}</strong><small>{row.city}, {row.state} · {row.board}</small></TableCell><TableCell><Badge variant={row.status === 'active' ? 'default' : 'outline'}>{row.status || 'pending'}</Badge></TableCell><TableCell>{row.totalStudents}</TableCell><TableCell>{row.totalClasses}</TableCell><TableCell>{row.completedTests}</TableCell><TableCell>{number(row.averageTestsPerStudent)}</TableCell><TableCell><strong style={{ color: metricTone(row.averagePercentage) }}>{percentage(row.averagePercentage)}</strong></TableCell><TableCell>{percentage(row.accuracy)}</TableCell><TableCell>{percentage(row.participation)}</TableCell><TableCell>{shortDate(row.lastTestAt)}</TableCell><TableCell><ChevronRight /></TableCell></TableRow>) : <TableRow><TableCell colSpan={12}><InstitutionEmptyState title="No live schools found" copy="Create or activate a school organization to begin platform analytics." /></TableCell></TableRow>}</TableBody></Table></Card>
  </>;
}

function ClassesView({ rows, allRows, search, setSearch, filter, setFilter, sort, onSort, onOpen, bulkDownloading, onDownloadPdf, onDownloadCsv }: { rows: InstitutionClassRow[]; allRows: InstitutionClassRow[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; sort: SortState; onSort: (key: string) => void; onOpen: (row: InstitutionClassRow) => void; bulkDownloading: 'pdf' | 'csv' | null; onDownloadPdf: () => void; onDownloadCsv: () => void }) {
  const grades = [...new Set(allRows.map((row) => row.grade))].sort((a, b) => a - b);
  return <>
    <div className="institution-stat-grid"><StatCard icon={GraduationCap} label="Classes" value={allRows.length} /><StatCard icon={Users} label="Students" value={allRows.reduce((sum, row) => sum + row.studentCount, 0)} tone={BLUE} /><StatCard icon={BookOpenCheck} label="Submitted tests" value={allRows.reduce((sum, row) => sum + row.completedTests, 0)} tone={AMBER} /><StatCard icon={Trophy} label="Best class" value={allRows.find((row) => row.averagePercentage !== null)?.name || 'Awaiting results'} note={percentage(allRows.find((row) => row.averagePercentage !== null)?.averagePercentage)} tone={GREEN} /></div>
    <DataToolbar search={search} setSearch={setSearch} placeholder="Search grade, section or code" filter={filter} setFilter={setFilter} options={grades.map((grade) => ({ value: String(grade), label: `Grade ${grade}` }))} filterLabel="All grades" count={rows.length} />
    <div className="institution-download-row"><span>Downloads use the current grade and search filters.</span><Button variant="outline" onClick={onDownloadCsv} disabled={!rows.length || Boolean(bulkDownloading)}>{bulkDownloading === 'csv' ? <LoaderCircle className="institution-button-spinner" /> : <FileDown />}Filtered school CSV</Button><Button onClick={onDownloadPdf} disabled={!rows.length || Boolean(bulkDownloading)}>{bulkDownloading === 'pdf' ? <LoaderCircle className="institution-button-spinner" /> : <Download />}Filtered report cards</Button></div>
    <Card className="institution-table-card"><Table className="min-w-[1120px]"><TableHeader><TableRow><SortHeader label="Rank" sortKey="rank" sort={sort} onSort={onSort} /><SortHeader label="Class" sortKey="name" sort={sort} onSort={onSort} /><SortHeader label="Students" sortKey="studentCount" sort={sort} onSort={onSort} /><SortHeader label="Tests" sortKey="completedTests" sort={sort} onSort={onSort} /><SortHeader label="Tests / student" sortKey="averageTestsPerStudent" sort={sort} onSort={onSort} /><SortHeader label="Average" sortKey="averagePercentage" sort={sort} onSort={onSort} /><SortHeader label="Accuracy" sortKey="accuracy" sort={sort} onSort={onSort} /><SortHeader label="Participation" sortKey="participation" sort={sort} onSort={onSort} /><SortHeader label="Highest" sortKey="highestPercentage" sort={sort} onSort={onSort} /><SortHeader label="Lowest" sortKey="lowestPercentage" sort={sort} onSort={onSort} /><SortHeader label="Last test" sortKey="lastTestAt" sort={sort} onSort={onSort} /><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{rows.length ? rows.map((row) => <TableRow key={row.id} onClick={() => onOpen(row)} className="institution-clickable-row"><TableCell><span className={`institution-rank rank-${Math.min(row.rank, 3)}`}>{row.rank}</span></TableCell><TableCell><strong>{row.name}</strong><small>{row.academicYear} · {row.code || 'No class code'}</small></TableCell><TableCell>{row.studentCount}</TableCell><TableCell>{row.completedTests}</TableCell><TableCell>{number(row.averageTestsPerStudent)}</TableCell><TableCell><strong style={{ color: metricTone(row.averagePercentage) }}>{percentage(row.averagePercentage)}</strong></TableCell><TableCell>{percentage(row.accuracy)}</TableCell><TableCell>{percentage(row.participation)}</TableCell><TableCell>{percentage(row.highestPercentage)}</TableCell><TableCell>{percentage(row.lowestPercentage)}</TableCell><TableCell>{shortDate(row.lastTestAt)}</TableCell><TableCell><ChevronRight /></TableCell></TableRow>) : <TableRow><TableCell colSpan={12}><InstitutionEmptyState title="No classes found" copy="Create an academic section and attach active students to it." /></TableCell></TableRow>}</TableBody></Table></Card>
  </>;
}

function ClassView(props: { classRow: InstitutionClassRow; students: InstitutionStudentRow[]; allStudents: InstitutionStudentRow[]; subjects: InstitutionSubjectRow[]; bands: ScoreBand[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; sort: SortState; onSort: (key: string) => void; selected: Set<string>; setSelected: Dispatch<SetStateAction<Set<string>>>; allVisibleSelected: boolean; toggleAll: (checked: boolean) => void; onSubject: (row: InstitutionSubjectRow) => void; onStudent: (row: InstitutionStudentRow) => void; onDownloadReports: () => void; onDownloadCsv: () => void }) {
  const { classRow, students, allStudents, subjects, bands, search, setSearch, filter, setFilter, sort, onSort, selected, setSelected, allVisibleSelected, toggleAll, onSubject, onStudent, onDownloadReports, onDownloadCsv } = props;
  return <>
    <div className="institution-stat-grid"><StatCard icon={Users} label="Students" value={classRow.studentCount} /><StatCard icon={BookOpenCheck} label="Average tests" value={number(classRow.averageTestsPerStudent)} tone={BLUE} /><StatCard icon={BarChart3} label="Class average" value={percentage(classRow.averagePercentage)} tone={metricTone(classRow.averagePercentage)} /><StatCard icon={Trophy} label="Highest / lowest" value={`${percentage(classRow.highestPercentage)} / ${percentage(classRow.lowestPercentage)}`} tone={AMBER} /><StatCard icon={Check} label="Participation" value={percentage(classRow.participation)} tone={GREEN} /></div>
    <section className="institution-section"><div className="institution-section-heading"><div><h2>Subject overview</h2><p>Click a subject to compare highest, class average and lowest performance across chapters.</p></div></div><div className="institution-subject-grid">{subjects.length ? subjects.map((subject) => <SubjectDonut key={subject.id} subject={subject} onClick={() => onSubject(subject)} />) : <InstitutionEmptyState title="No submitted subject evidence yet" copy="Subject, chapter and topic analysis will populate automatically after this class submits assessments containing taxonomy-linked questions." />}</div></section>
    <div className="institution-two-column"><ScoreDistribution rows={bands} /><Card className="institution-panel"><CardContent><div className="institution-panel-heading"><div><h3>Class performance range</h3><p>Quick evidence for intervention planning.</p></div></div><div className="institution-range-list"><div><span>Strong performers</span><strong>{allStudents.filter((row) => row.averagePercentage !== null && row.averagePercentage >= 75).length}</strong><small>75% and above</small></div><div><span>Developing</span><strong>{allStudents.filter((row) => row.averagePercentage !== null && row.averagePercentage >= 60 && row.averagePercentage < 75).length}</strong><small>60–74%</small></div><div><span>Needs support</span><strong>{allStudents.filter((row) => row.averagePercentage !== null && row.averagePercentage >= 40 && row.averagePercentage < 60).length}</strong><small>40–59%</small></div><div><span>Urgent intervention</span><strong>{allStudents.filter((row) => row.averagePercentage !== null && row.averagePercentage < 40).length}</strong><small>Below 40%</small></div><div><span>Awaiting evidence</span><strong>{allStudents.filter((row) => row.averagePercentage === null).length}</strong><small>No submitted test</small></div></div></CardContent></Card></div>
    <section className="institution-section"><div className="institution-section-heading report-heading"><div><h2>Student performance</h2><p>Filter, select specific students, then download report cards or the results sheet.</p></div><div><Button variant="outline" onClick={onDownloadCsv} disabled={!students.length}><FileDown />Download CSV</Button><Button onClick={onDownloadReports} disabled={!selected.size}><Download />Report cards ({selected.size})</Button></div></div>
      <DataToolbar search={search} setSearch={setSearch} placeholder="Search student" filter={filter} setFilter={setFilter} options={[{ value: 'strong', label: 'Strong · 75%+' }, { value: 'developing', label: 'Developing · 60–74%' }, { value: 'support', label: 'Needs support · 40–59%' }, { value: 'critical', label: 'Urgent · below 40%' }, { value: 'no-data', label: 'No evidence' }]} filterLabel="All performance" count={students.length} />
      <Card className="institution-table-card"><Table className="min-w-[1050px]"><TableHeader><TableRow><TableHead className="institution-check-column"><Checkbox checked={allVisibleSelected} onCheckedChange={(checked) => toggleAll(checked === true)} aria-label="Select all filtered students" /></TableHead><SortHeader label="Rank" sortKey="rank" sort={sort} onSort={onSort} /><SortHeader label="Student" sortKey="name" sort={sort} onSort={onSort} /><SortHeader label="Tests" sortKey="completedTests" sort={sort} onSort={onSort} /><SortHeader label="Average" sortKey="averagePercentage" sort={sort} onSort={onSort} /><SortHeader label="Accuracy" sortKey="accuracy" sort={sort} onSort={onSort} /><SortHeader label="Highest" sortKey="highestPercentage" sort={sort} onSort={onSort} /><SortHeader label="Lowest" sortKey="lowestPercentage" sort={sort} onSort={onSort} /><SortHeader label="Last test" sortKey="lastTestAt" sort={sort} onSort={onSort} /><TableHead className="w-12" /></TableRow></TableHeader><TableBody>{students.length ? students.map((row) => <TableRow key={row.id} className={selected.has(row.id) ? 'institution-selected-row' : ''}><TableCell className="institution-check-column" onClick={(event) => event.stopPropagation()}><Checkbox checked={selected.has(row.id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); checked ? next.add(row.id) : next.delete(row.id); return next; })} /></TableCell><TableCell>{row.rank}</TableCell><TableCell onClick={() => onStudent(row)} className="institution-student-link"><strong>{row.name}</strong><small>{row.sectionName}</small></TableCell><TableCell>{row.completedTests}</TableCell><TableCell><strong style={{ color: metricTone(row.averagePercentage) }}>{percentage(row.averagePercentage)}</strong></TableCell><TableCell>{percentage(row.accuracy)}</TableCell><TableCell>{percentage(row.highestPercentage)}</TableCell><TableCell>{percentage(row.lowestPercentage)}</TableCell><TableCell>{shortDate(row.lastTestAt)}</TableCell><TableCell><button type="button" onClick={() => onStudent(row)} className="institution-row-arrow"><ChevronRight /></button></TableCell></TableRow>) : <TableRow><TableCell colSpan={10}><InstitutionEmptyState title="No students in this class" copy="Add active student memberships to this academic section to begin class analytics." /></TableCell></TableRow>}</TableBody></Table></Card>
    </section>
  </>;
}

function SubjectView({ subject, chapters, bands, onChapter }: { subject: InstitutionSubjectRow; chapters: InstitutionChapterRow[]; bands: ScoreBand[]; onChapter: (row: InstitutionChapterRow) => void }) {
  const chartRows = chapters.map((row) => ({ name: row.name, highest: row.highestPercentage, average: row.averagePercentage, lowest: row.lowestPercentage }));
  return <><div className="institution-stat-grid"><StatCard icon={Users} label="Students assessed" value={subject.studentCount} /><StatCard icon={BarChart3} label="Subject average" value={percentage(subject.averagePercentage)} tone={metricTone(subject.averagePercentage)} /><StatCard icon={Trophy} label="Highest" value={percentage(subject.highestPercentage)} tone={GREEN} /><StatCard icon={TrendingDown} label="Lowest" value={percentage(subject.lowestPercentage)} tone={RED} /><StatCard icon={BookOpenCheck} label="Responses" value={subject.responseCount} tone={BLUE} /></div>
    <Card className="institution-panel"><CardContent><div className="institution-panel-heading"><div><h3>Chapter performance spread</h3><p>Highest mark, class average and lowest mark for every chapter.</p></div></div><div className="institution-chart institution-chart-large"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartRows} margin={{ top: 12, right: 12, left: -12, bottom: 55 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" /><XAxis dataKey="name" angle={-28} textAnchor="end" height={75} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} /><Tooltip formatter={(value) => percentage(Number(value))} /><Legend /><Bar dataKey="average" name="Class average" fill={TEAL} radius={[6, 6, 0, 0]} /><Line type="monotone" dataKey="highest" name="Highest" stroke={GREEN} strokeWidth={2.5} dot={{ r: 4 }} /><Line type="monotone" dataKey="lowest" name="Lowest" stroke={RED} strokeWidth={2.5} dot={{ r: 4 }} /></ComposedChart></ResponsiveContainer></div></CardContent></Card>
    <div className="institution-two-column"><ScoreDistribution rows={bands} title={`${subject.name} score distribution`} /><Card className="institution-panel"><CardContent><div className="institution-panel-heading"><div><h3>Chapter table</h3><p>Click a chapter for topic-level evidence.</p></div></div><div className="institution-compact-list">{chapters.map((row) => <button key={row.id} type="button" onClick={() => onChapter(row)}><span><strong>{row.name}</strong><small>{row.responseCount} responses · {row.studentCount} students</small></span><b style={{ color: metricTone(row.averagePercentage) }}>{percentage(row.averagePercentage)}</b><ChevronRight /></button>)}</div></CardContent></Card></div>
  </>;
}

function ChapterView({ chapter, topics, bands }: { chapter: InstitutionChapterRow; topics: InstitutionTopicRow[]; bands: ScoreBand[] }) {
  const chartRows = topics.map((row) => ({ name: row.name, highest: row.highestPercentage, average: row.averagePercentage, lowest: row.lowestPercentage, students: row.studentCount }));
  return <><div className="institution-stat-grid"><StatCard icon={Users} label="Students assessed" value={chapter.studentCount} /><StatCard icon={BarChart3} label="Chapter average" value={percentage(chapter.averagePercentage)} tone={metricTone(chapter.averagePercentage)} /><StatCard icon={Trophy} label="Highest" value={percentage(chapter.highestPercentage)} tone={GREEN} /><StatCard icon={TrendingDown} label="Lowest" value={percentage(chapter.lowestPercentage)} tone={RED} /><StatCard icon={BookOpenCheck} label="Responses" value={chapter.responseCount} tone={BLUE} /></div>
    <Card className="institution-panel"><CardContent><div className="institution-panel-heading"><div><h3>Topic performance</h3><p>Identify whether a weak result is isolated to a few students or affects the whole class.</p></div></div><div className="institution-chart institution-chart-large"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chartRows} margin={{ top: 12, right: 12, left: -12, bottom: 55 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line)" /><XAxis dataKey="name" angle={-24} textAnchor="end" height={75} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} /><YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} /><Tooltip formatter={(value) => percentage(Number(value))} /><Legend /><Bar dataKey="average" name="Class average" fill={TEAL} radius={[6, 6, 0, 0]} /><Line type="monotone" dataKey="highest" name="Highest" stroke={GREEN} strokeWidth={2.5} /><Line type="monotone" dataKey="lowest" name="Lowest" stroke={RED} strokeWidth={2.5} /></ComposedChart></ResponsiveContainer></div></CardContent></Card>
    <div className="institution-two-column"><ScoreDistribution rows={bands} title={`${chapter.name} score distribution`} /><Card className="institution-panel"><CardContent><div className="institution-panel-heading"><div><h3>Topic diagnosis</h3><p>Statistical view of class-level strengths and gaps.</p></div></div><div className="institution-topic-diagnosis">{topics.map((row) => <div key={row.id}><div><strong>{row.name}</strong><small>{row.studentCount} students · {row.responseCount} responses</small></div><div className="institution-topic-track"><i style={{ width: `${row.averagePercentage || 0}%`, backgroundColor: metricTone(row.averagePercentage) }} /></div><b>{percentage(row.averagePercentage)}</b><span>{row.scoreBands.filter((band) => band.max <= 40).reduce((sum, band) => sum + band.students, 0)} below 40%</span></div>)}</div></CardContent></Card></div>
  </>;
}

function StudentView({ detail }: { detail: NonNullable<InstitutionAnalyticsPayload['studentDetail']> }) {
  return <section className="institution-student-full-analytics">
    <div className="institution-student-context"><div><span>Live student drill-down</span><h2>{detail.student.name}</h2><p>{detail.student.sectionName || 'Assigned class'} · {detail.student.academicYear || 'Current academic year'}</p></div><Badge variant="outline">Full student analytics</Badge></div>
    <AnalyticsV12Workspace mode="school" selectedStudentId={detail.student.id} embedded hideStudentSelector />
  </section>;
}

function DataToolbar({ search, setSearch, placeholder, filter, setFilter, options, filterLabel, count }: { search: string; setSearch: (value: string) => void; placeholder: string; filter: string; setFilter: (value: string) => void; options: Array<{ value: string; label: string }>; filterLabel: string; count: number }) {
  return <div className="institution-toolbar"><div className="institution-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={placeholder} /></div><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{filterLabel}</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><span>{count} matching record{count === 1 ? '' : 's'}</span></div>;
}
