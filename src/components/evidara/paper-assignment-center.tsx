'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, Search, ShieldCheck, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useQuestionScope } from '@/components/questions/useQuestionScope';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type PaperOption = {
  id: string;
  title: string;
  status: string;
  exam_type: string;
  grade_level: string | null;
  settings: Record<string, unknown> | null;
};

type SectionOption = {
  id: string;
  academic_year: string;
  grade: number;
  name: string;
  code: string | null;
};

type StudentOption = {
  student_id: string;
  membership_id: string;
  name: string;
  grade: number;
  section_id: string | null;
  section: string;
  academic_year: string;
  tracks: string[];
  roll_number?: string;
};

type AssignmentPreview = {
  paper_id: string;
  organization_id: string;
  audience: {
    academic_year?: string | null;
    grades?: number[];
    section_ids?: string[];
    tracks?: string[];
    student_ids?: string[];
  };
  assigned_count: number;
  sample: StudentOption[];
  warnings?: Array<{ code: string; severity: 'warning' | 'blocking'; count?: number; message: string }>;
  materialized?: boolean;
  materialized_at?: string;
  licence?: {
    state?: string;
    licensed_students?: number;
    active_students?: number;
  };
};

const TRACKS = ['Foundation', 'Boards', 'Olympiad', 'NEET', 'JEE', 'KCET'];

function toggle<T>(items: T[], value: T) {
  return items.includes(value) ? items.filter((item) => item !== value) : [...items, value];
}

export function PaperAssignmentCenter({ paperId: fixedPaperId, embedded = false }: { paperId?: string; embedded?: boolean } = {}) {
  const { configured } = useAuth();
  const { organizationId, organizationName, loading: scopeLoading, error: scopeError } = useQuestionScope('school');
  const [papers, setPapers] = useState<PaperOption[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [paperId, setPaperId] = useState(fixedPaperId || '');
  const [mode, setMode] = useState<'filters' | 'students'>('filters');
  const [academicYear, setAcademicYear] = useState('all');
  const [grades, setGrades] = useState<number[]>([]);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [tracks, setTracks] = useState<string[]>([]);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentOptions, setStudentOptions] = useState<StudentOption[]>([]);
  const [preview, setPreview] = useState<AssignmentPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !configured || !organizationId) return;
    setLoading(true);
    setError('');
    const [paperResult, sectionResult] = await Promise.all([
      supabase
        .from('question_papers')
        .select('id,title,status,exam_type,grade_level,settings')
        .eq('organization_id', organizationId)
        .neq('status', 'archived')
        .order('updated_at', { ascending: false })
        .limit(200),
      supabase
        .from('academic_sections')
        .select('id,academic_year,grade,name,code')
        .eq('organization_id', organizationId)
        .eq('is_active', true)
        .order('academic_year', { ascending: false })
        .order('grade')
        .order('name'),
    ]);
    if (paperResult.error || sectionResult.error) {
      setError(paperResult.error?.message || sectionResult.error?.message || 'Unable to load assignment options.');
    } else {
      const loadedPapers = (paperResult.data || []) as PaperOption[];
      setPapers(loadedPapers);
      setSections((sectionResult.data || []) as SectionOption[]);
      setPaperId((current) => fixedPaperId || current || loadedPapers[0]?.id || '');
    }
    setLoading(false);
  }, [configured, fixedPaperId, organizationId]);

  useEffect(() => { if (fixedPaperId) setPaperId(fixedPaperId); }, [fixedPaperId]);
  useEffect(() => { void load(); }, [load]);

  const years = useMemo(() => [...new Set(sections.map((row) => row.academic_year))], [sections]);
  const gradeOptions = useMemo(() => [...new Set(sections.filter((row) => academicYear === 'all' || row.academic_year === academicYear).map((row) => row.grade))].sort((a, b) => a - b), [academicYear, sections]);
  const visibleSections = useMemo(() => sections.filter((row) =>
    (academicYear === 'all' || row.academic_year === academicYear)
    && (!grades.length || grades.includes(row.grade))
  ), [academicYear, grades, sections]);
  const selectedPaper = papers.find((paper) => paper.id === paperId) || null;

  useEffect(() => {
    setPreview(null);
    setMessage('');
  }, [paperId, mode, academicYear, grades, sectionIds, tracks, studentIds]);

  useEffect(() => {
    const client = supabase;
    if (mode !== 'students' || !client || !organizationId) return;
    const timer = window.setTimeout(async () => {
      const { data, error: searchError } = await client.rpc('search_assignment_students_v19', {
        p_organization_id: organizationId,
        p_search: studentSearch.trim() || null,
        p_limit: 40,
      });
      if (searchError) setError(searchError.message);
      else setStudentOptions((Array.isArray(data) ? data : []) as StudentOption[]);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [mode, organizationId, studentSearch]);

  function audience() {
    if (mode === 'students') {
      return {
        academic_year: null,
        grades: [],
        section_ids: [],
        tracks: [],
        student_ids: studentIds,
      };
    }
    return {
      academic_year: academicYear === 'all' ? null : academicYear,
      grades,
      section_ids: sectionIds,
      tracks,
      student_ids: [],
    };
  }

  async function previewAssignment() {
    if (!supabase || !paperId) return;
    setBusy('preview'); setError(''); setMessage('');
    const { data, error: previewError } = await supabase.rpc('preview_paper_assignment_v19', {
      p_paper_id: paperId,
      p_audience: audience(),
    });
    if (previewError) setError(previewError.message);
    else setPreview((data || null) as AssignmentPreview | null);
    setBusy('');
  }

  async function assign() {
    if (!supabase || !paperId) return;
    setBusy('assign'); setError(''); setMessage('');
    const { data, error: assignError } = await supabase.rpc('assign_paper_audience_v19', {
      p_paper_id: paperId,
      p_audience: audience(),
    });
    if (assignError) setError(assignError.message);
    else {
      const result = (data || null) as AssignmentPreview | null;
      setPreview(result);
      setMessage(`${Number(result?.assigned_count || 0).toLocaleString('en-IN')} students are now assigned to this test. The cohort will be frozen once the first attempt starts.`);
    }
    setBusy('');
  }

  if (scopeLoading || loading) return <Card className="border-[var(--line)] shadow-sm"><CardContent className="flex items-center gap-2 p-5 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="h-4 w-4 animate-spin" />Loading test assignment tools…</CardContent></Card>;
  if (!organizationId) return <Card className="border-[var(--line)] shadow-sm"><CardContent className="p-5 text-sm text-destructive">{scopeError || 'This account is not linked to an institution.'}</CardContent></Card>;

  return <Card className="border-[var(--line)] shadow-sm">
    <CardContent className="space-y-5 p-5 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--teal)]"><Users className="h-4 w-4" />Audience & Assignment</div>
          <h2 className="mt-1 text-xl font-bold text-[var(--foreground)]">{embedded ? 'Choose the audience for this paper' : 'Assign a test to the right students'}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">{embedded ? 'Define the audience, preview the exact eligible count, then materialize the cohort before publishing.' : 'Choose an institutional paper, define the audience, preview the exact eligible count, then materialize the cohort.'} {organizationName}</p>
        </div>
        <Badge variant="outline" className="w-fit border-[var(--line)]">₹199 licensed-student plan</Badge>
      </div>

      {error && <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>}
      {message && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />{message}</div>}

      {!papers.length ? <div className="rounded-xl border border-dashed border-[var(--line)] p-8 text-center text-sm text-[var(--muted-foreground)]">Create a school paper first. It will appear here for audience assignment.</div> : <>
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          {!fixedPaperId && <div>
            <Label htmlFor="assignment-paper">Paper / Test</Label>
            <select id="assignment-paper" className="mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={paperId} onChange={(event) => setPaperId(event.target.value)}>
              {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title} · {paper.status.replaceAll('_', ' ')}</option>)}
            </select>
          </div>}
          <div>
            <Label>Audience mode</Label>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <Button type="button" variant={mode === 'filters' ? 'default' : 'outline'} onClick={() => { setMode('filters'); setStudentIds([]); }}>Class filters</Button>
              <Button type="button" variant={mode === 'students' ? 'default' : 'outline'} onClick={() => { setMode('students'); setGrades([]); setSectionIds([]); setTracks([]); }}>Specific students</Button>
            </div>
          </div>
        </div>

        {selectedPaper && <div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-4 py-3 text-sm"><strong>{selectedPaper.exam_type}</strong>{selectedPaper.grade_level ? ` · ${selectedPaper.grade_level}` : ''} · <span className="capitalize">{selectedPaper.status.replaceAll('_', ' ')}</span></div>}

        {mode === 'filters' ? <div className="space-y-4 rounded-xl border border-[var(--line)] p-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Academic year</Label><select className="mt-1 min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={academicYear} onChange={(event) => { setAcademicYear(event.target.value); setGrades([]); setSectionIds([]); }}><option value="all">All active academic years</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></div>
            <div><Label>Grade</Label><div className="mt-2 flex flex-wrap gap-2">{gradeOptions.map((grade) => <label key={grade} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"><Checkbox checked={grades.includes(grade)} onCheckedChange={() => { setGrades((current) => toggle(current, grade)); setSectionIds([]); }} />Grade {grade}</label>)}{!gradeOptions.length && <span className="text-sm text-[var(--muted-foreground)]">No active sections configured.</span>}</div></div>
          </div>
          <div><Label>Sections</Label><div className="mt-2 flex flex-wrap gap-2">{visibleSections.map((section) => <label key={section.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"><Checkbox checked={sectionIds.includes(section.id)} onCheckedChange={() => setSectionIds((current) => toggle(current, section.id))} />{section.name}{section.code ? ` (${section.code})` : ''}</label>)}{!visibleSections.length && <span className="text-sm text-[var(--muted-foreground)]">All sections matching the academic-year/grade filters will be included.</span>}</div></div>
          <div><Label>Programme / Track</Label><div className="mt-2 flex flex-wrap gap-2">{TRACKS.map((track) => <label key={track} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-sm"><Checkbox checked={tracks.includes(track)} onCheckedChange={() => setTracks((current) => toggle(current, track))} />{track}</label>)}</div><p className="mt-2 text-xs text-[var(--muted-foreground)]">Leave a group blank to include all active students in that group. Multiple selections use OR within the group and AND across groups.</p></div>
        </div> : <div className="space-y-3 rounded-xl border border-[var(--line)] p-4">
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} placeholder="Search student name, roll number or section" /></div>
          <div className="max-h-72 divide-y divide-[var(--line)] overflow-auto rounded-lg border border-[var(--line)]">{studentOptions.map((student) => <label key={student.student_id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-[var(--canvas)]"><Checkbox checked={studentIds.includes(student.student_id)} onCheckedChange={() => setStudentIds((current) => toggle(current, student.student_id))} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{student.name}</strong><span className="text-xs text-[var(--muted-foreground)]">Grade {student.grade} · {student.section} · {student.academic_year}{student.roll_number ? ` · ${student.roll_number}` : ''}</span></div></label>)}{!studentOptions.length && <div className="p-5 text-center text-sm text-[var(--muted-foreground)]">No matching active students.</div>}</div>
          <p className="text-xs text-[var(--muted-foreground)]">{studentIds.length.toLocaleString('en-IN')} student{studentIds.length === 1 ? '' : 's'} selected.</p>
        </div>}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" disabled={busy !== '' || !paperId || (mode === 'students' && !studentIds.length)} onClick={() => void previewAssignment()}>{busy === 'preview' && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Preview audience</Button>
          <Button type="button" disabled={busy !== '' || !preview?.assigned_count || preview?.warnings?.some((warning) => warning.severity === 'blocking')} onClick={() => void assign()}>{busy === 'assign' && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Assign {preview?.assigned_count ? preview.assigned_count.toLocaleString('en-IN') : ''} students</Button>
        </div>

        {preview && <div className="grid gap-3 md:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-[var(--teal)]/20 bg-[var(--teal)]/5 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">Audience preview</p><p className="mt-1 text-3xl font-bold text-[var(--foreground)]">{preview.assigned_count.toLocaleString('en-IN')}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">active students match these filters.</p></div>
          <div className="rounded-xl border border-[var(--line)] p-4"><div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[var(--teal)]" /><strong className="text-sm">Institution licence</strong></div><p className="mt-2 text-sm capitalize">State: <strong>{preview.licence?.state || 'unknown'}</strong></p><p className="mt-1 text-sm">Licensed: <strong>{Number(preview.licence?.licensed_students || 0).toLocaleString('en-IN')}</strong> · Active: <strong>{Number(preview.licence?.active_students || 0).toLocaleString('en-IN')}</strong></p></div>
          {preview.warnings?.length ? <div className="md:col-span-2 rounded-xl border border-amber-300 bg-amber-50 p-4"><div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-700" /><strong className="text-sm text-amber-950">Eligibility warnings</strong></div><div className="mt-2 space-y-1">{preview.warnings.map((warning) => <p key={warning.code} className="text-sm text-amber-900"><strong>{warning.severity === 'blocking' ? 'Action required: ' : ''}</strong>{warning.message}</p>)}</div></div> : null}
          {preview.sample?.length ? <div className="md:col-span-2 rounded-xl border border-[var(--line)] p-4"><p className="text-sm font-semibold">Sample students</p><div className="mt-2 flex flex-wrap gap-2">{preview.sample.map((student) => <Badge key={student.student_id} variant="outline" className="border-[var(--line)]">{student.name} · G{student.grade} {student.section}</Badge>)}</div></div> : null}
        </div>}
      </>}
    </CardContent>
  </Card>;
}
