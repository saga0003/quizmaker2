'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  Download,
  FileDown,
  Gauge,
  GraduationCap,
  LoaderCircle,
  RefreshCw,
  Search,
  Settings2,
  Target,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { exportSchoolAnalyticsPdf } from '@/lib/analytics-pdf';
import type { AnalyticsScope, AnalyticsViewerRole } from '@/types/analytics';
import type { SchoolAnalyticsPayload, SchoolAnalyticsStudentRow } from '@/types/analytics-phase3';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from './analytics.module.css';

type Props = {
  scope: AnalyticsScope;
  viewerRole: AnalyticsViewerRole;
  onOpenStudent: (studentId: string) => void;
  onManage: () => void;
};

const distributionColors: Record<string, string> = {
  'Not started': '#AEB8BC',
  'Below 40%': '#B54747',
  '40–59%': '#D8844E',
  '60–74%': '#F2B84B',
  '75–89%': '#2E6D8B',
  '90% and above': '#237A57',
};

function value(value?: number | null, suffix = '') { return value == null ? '—' : `${Number(value).toFixed(1)}${suffix}`; }
function count(value?: number | null) { return new Intl.NumberFormat('en-IN').format(value || 0); }
function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function statusBadge(status: SchoolAnalyticsStudentRow['status']) {
  if (status === 'strong') return <Badge className="bg-[#EAF4EF] text-[#237A57]">Strong</Badge>;
  if (status === 'needs_attention') return <Badge className="bg-[#FAEEEE] text-[#B54747]">Needs attention</Badge>;
  if (status === 'improving') return <Badge className="bg-[#E7F1F6] text-[#2E6D8B]">Improving</Badge>;
  if (status === 'not_started') return <Badge className="bg-[#F1F3F3] text-[#6B7980]">Not started</Badge>;
  return <Badge variant="outline">Steady</Badge>;
}

export function SchoolAdminAnalyticsDashboard({ scope, viewerRole, onOpenStudent, onManage }: Props) {
  const organizations = scope.organizations || [];
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id || '');
  const [academicYear, setAcademicYear] = useState('all');
  const [grade, setGrade] = useState('all');
  const [sectionId, setSectionId] = useState('all');
  const [productId, setProductId] = useState('all');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatus, setStudentStatus] = useState('all');
  const [data, setData] = useState<SchoolAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [interventionStudent, setInterventionStudent] = useState<SchoolAnalyticsStudentRow | null>(null);
  const [interventionTitle, setInterventionTitle] = useState('Academic follow-up');
  const [interventionNote, setInterventionNote] = useState('');
  const [interventionPriority, setInterventionPriority] = useState('medium');
  const [interventionDue, setInterventionDue] = useState('');
  const [savingIntervention, setSavingIntervention] = useState(false);

  useEffect(() => {
    if (!organizationId && organizations[0]?.id) setOrganizationId(organizations[0].id);
  }, [organizationId, organizations]);

  const load = useCallback(async () => {
    if (!supabase || !organizationId) { setLoading(false); return; }
    setLoading(true); setError('');
    const { data: result, error: loadError } = await supabase.rpc('get_school_analytics_overview_v12', {
      p_organization_id: organizationId,
      p_academic_year: academicYear === 'all' ? null : academicYear,
      p_grade: grade === 'all' ? null : Number(grade),
      p_section_id: sectionId === 'all' ? null : sectionId,
      p_product_id: productId === 'all' ? null : productId,
    });
    if (loadError) setError(loadError.message); else setData(result as SchoolAnalyticsPayload);
    setLoading(false);
  }, [academicYear, grade, organizationId, productId, sectionId]);

  useEffect(() => { void load(); }, [load]);

  const visibleSections = (scope.sections || []).filter((section) => section.organization_id === organizationId && (academicYear === 'all' || section.academic_year === academicYear) && (grade === 'all' || String(section.grade) === grade));
  const filteredStudents = useMemo(() => (data?.students || []).filter((student) => {
    const searchMatch = !studentSearch || `${student.full_name} ${student.section_name} ${(student.tracks || []).join(' ')}`.toLowerCase().includes(studentSearch.toLowerCase());
    return searchMatch && (studentStatus === 'all' || student.status === studentStatus);
  }), [data?.students, studentSearch, studentStatus]);
  const subjectNames = useMemo(() => Array.from(new Set((data?.subjects || []).map((row) => row.subject_name))), [data?.subjects]);
  const summary = data?.summary;

  const metrics = [
    { label: 'Students', value: count(summary?.total_students), note: `${count(summary?.active_students)} active`, icon: Users },
    { label: 'Average percentage', value: value(summary?.average_percentage, '%'), note: `${count(summary?.completed_tests)} completed tests`, icon: Activity },
    { label: 'Overall accuracy', value: value(summary?.accuracy, '%'), note: 'Correct out of all questions', icon: Target },
    { label: 'Participation', value: value(summary?.participation, '%'), note: `${count(summary?.needs_attention)} need attention`, icon: CheckCircle2 },
    { label: 'Time management', value: value(summary?.time_score, '/10'), note: 'Average pacing score', icon: Gauge },
    { label: 'Improving students', value: count(summary?.improving_students), note: `${count(summary?.strong_students)} strong`, icon: BarChart3 },
  ];

  async function saveIntervention() {
    if (!supabase || !interventionStudent || !organizationId) return;
    setSavingIntervention(true); setError('');
    const { error: saveError } = await supabase.rpc('upsert_analytics_intervention_v12', {
      p_intervention_id: null,
      p_organization_id: organizationId,
      p_student_id: interventionStudent.student_id || null,
      p_demo_student_id: interventionStudent.demo_student_id || null,
      p_title: interventionTitle,
      p_note: interventionNote || null,
      p_priority: interventionPriority,
      p_status: 'open',
      p_due_date: interventionDue || null,
      p_assigned_to: null,
    });
    setSavingIntervention(false);
    if (saveError) { setError(saveError.message); return; }
    setInterventionStudent(null); setInterventionTitle('Academic follow-up'); setInterventionNote(''); setInterventionPriority('medium'); setInterventionDue('');
    await load();
  }

  function exportCsv() {
    const headers = ['Student','Academic year','Grade','Section','Tracks','Completed tests','Marks','Maximum marks','Percentage','Accuracy','Time score','Correct','Wrong','Unanswered','Improvement','Status',...subjectNames];
    const rows = filteredStudents.map((student) => [student.full_name,student.academic_year,String(student.grade),student.section_name,(student.tracks || []).join(' / '),String(student.completed_tests),String(student.total_marks || 0),String(student.maximum_marks || 0),String(student.percentage ?? ''),String(student.accuracy ?? ''),String(student.time_score ?? ''),String(student.correct_count),String(student.incorrect_count),String(student.unanswered_count),String(student.improvement),student.status,...subjectNames.map((subject) => String(student.subjects?.[subject]?.percentage ?? ''))]);
    downloadCsv(`${(data?.organization?.name || 'school').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}-analytics.csv`, [headers, ...rows]);
  }

  if (loading && !data) return <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Building school analytics…</div></div>;

  return <div className={`${styles.workspace} space-y-5`}>
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Analytics Phase 3 · School command centre</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14232B]">{data?.organization?.name || 'School analytics'}</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[#44545C]">Whole-school performance across grades, sections, subjects, teachers, tests and individual students.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onManage}><Settings2 className="mr-2 h-4 w-4" />Students, sections & demo data</Button><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button variant="outline" onClick={exportCsv} disabled={!data}><FileDown className="mr-2 h-4 w-4" />Export CSV</Button><Button onClick={() => data && exportSchoolAnalyticsPdf(data)} disabled={!data} className="bg-[#0E5A5A] hover:bg-[#0A4747]"><Download className="mr-2 h-4 w-4" />Download school PDF</Button></div></div>
    {error && <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] px-4 py-3 text-sm text-[#B54747]">{error}</div>}

    <Card className={`${styles.controlPanel} gap-0`}><CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-5"><Select value={organizationId} onValueChange={(next) => { setOrganizationId(next); setAcademicYear('all'); setGrade('all'); setSectionId('all'); setProductId('all'); }}><SelectTrigger><SelectValue placeholder="School" /></SelectTrigger><SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent></Select><Select value={academicYear} onValueChange={(next) => { setAcademicYear(next); setGrade('all'); setSectionId('all'); }}><SelectTrigger><SelectValue placeholder="Academic year" /></SelectTrigger><SelectContent><SelectItem value="all">All academic years</SelectItem>{(data?.academic_years || []).map((year) => <SelectItem key={year} value={year}>{year}</SelectItem>)}</SelectContent></Select><Select value={grade} onValueChange={(next) => { setGrade(next); setSectionId('all'); }}><SelectTrigger><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All grades</SelectItem>{Array.from(new Set((scope.students || []).filter((student) => student.organization_id === organizationId).map((student) => student.grade))).sort((a,b) => a-b).map((item) => <SelectItem key={item} value={String(item)}>Grade {item}</SelectItem>)}</SelectContent></Select><Select value={sectionId} onValueChange={setSectionId}><SelectTrigger><SelectValue placeholder="Section" /></SelectTrigger><SelectContent><SelectItem value="all">All sections</SelectItem>{visibleSections.map((section) => <SelectItem key={section.id} value={section.id}>Grade {section.grade} · {section.name}</SelectItem>)}</SelectContent></Select><Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Product / series" /></SelectTrigger><SelectContent><SelectItem value="all">All products</SelectItem>{(data?.products || []).map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></CardContent></Card>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{metrics.map(({ label, value: metricValue, note, icon: Icon }) => <Card key={label} className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-[#6B7980]">{label}</p><strong className="mt-2 block text-2xl text-[#14232B]">{metricValue}</strong><span className="mt-1 block text-[11px] text-[#6B7980]">{note}</span></div><div className="rounded-xl bg-[#DCE9E7] p-2.5 text-[#0E5A5A]"><Icon className="h-5 w-5" /></div></div></CardContent></Card>)}</section>

    <Tabs defaultValue="overview" className="space-y-4"><TabsList className="h-auto flex-wrap"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="students">Students</TabsTrigger><TabsTrigger value="tests">Tests</TabsTrigger><TabsTrigger value="teachers">Teachers & follow-ups</TabsTrigger></TabsList>
      <TabsContent value="overview" className="space-y-4"><section className="grid gap-4 xl:grid-cols-2"><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Grade comparison</h2><p className="mt-1 text-xs text-[#6B7980]">Average percentage and participation by grade.</p><div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.grades || []} margin={{ top: 20, right: 10, left: -15, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis dataKey="grade" tickFormatter={(item) => `Grade ${item}`} /><YAxis domain={[0,100]} /><ChartTooltip /><Legend /><Bar name="Average percentage" dataKey="average_percentage" fill="#0E5A5A" radius={[5,5,0,0]} /><Bar name="Participation" dataKey="participation" fill="#9FBDBD" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></CardContent></Card><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Performance distribution</h2><p className="mt-1 text-xs text-[#6B7980]">How students are distributed across performance bands.</p><div className="h-[330px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data?.distribution || []} dataKey="students" nameKey="bucket" innerRadius={72} outerRadius={112} paddingAngle={3}>{(data?.distribution || []).map((item) => <Cell key={item.bucket} fill={distributionColors[item.bucket] || '#6B7980'} />)}</Pie><ChartTooltip /><Legend /></PieChart></ResponsiveContainer></div></CardContent></Card></section>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]"><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Section comparison</h2><p className="mt-1 text-xs text-[#6B7980]">Average percentage and accuracy across sections.</p><div className="h-[360px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data?.sections || []} layout="vertical" margin={{ left: 40, right: 16 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" horizontal={false} /><XAxis type="number" domain={[0,100]} /><YAxis type="category" dataKey="section_name" width={110} /><ChartTooltip /><Legend /><Bar name="Average percentage" dataKey="average_percentage" fill="#0E5A5A" radius={[0,5,5,0]} /><Bar name="Accuracy" dataKey="accuracy" fill="#9FBDBD" radius={[0,5,5,0]} /></BarChart></ResponsiveContainer></div></CardContent></Card><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Answer distribution</h2><p className="mt-1 text-xs text-[#6B7980]">All right, wrong and unanswered questions in this filter.</p><div className="mt-5 space-y-4">{[
        { label: 'Correct', value: summary?.correct_count || 0, color: '#237A57' },{ label: 'Wrong', value: summary?.incorrect_count || 0, color: '#B54747' },{ label: 'Unanswered', value: summary?.unanswered_count || 0, color: '#F2B84B' },
      ].map((item) => { const total = Math.max(1,(summary?.correct_count || 0)+(summary?.incorrect_count || 0)+(summary?.unanswered_count || 0)); const percent = item.value/total*100; return <div key={item.label}><div className="mb-2 flex justify-between text-xs"><span className="font-semibold text-[#44545C]">{item.label}</span><strong className="text-[#14232B]">{count(item.value)} · {percent.toFixed(1)}%</strong></div><div className="h-3 overflow-hidden rounded-full bg-[#E7ECEB]"><div className="h-full rounded-full" style={{ width: `${percent}%`, background: item.color }} /></div></div>; })}</div></CardContent></Card></section>
      <Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Subject heatmap</h2><p className="mt-1 text-xs text-[#6B7980]">Percentage, accuracy, pacing and question distribution by subject.</p><div className="mt-5 overflow-x-auto rounded-xl border border-[#E7ECEB]"><table className="w-full min-w-[850px] text-left text-xs"><thead className="bg-[#F2F8F7]"><tr><th className="p-3">Subject</th><th className="p-3">Students</th><th className="p-3">Percentage</th><th className="p-3">Accuracy</th><th className="p-3">Time score</th><th className="p-3">Correct</th><th className="p-3">Wrong</th><th className="p-3">Unanswered</th></tr></thead><tbody>{(data?.subjects || []).map((subject) => <tr key={subject.subject_name} className="border-t border-[#E7ECEB]"><td className="p-3 font-semibold text-[#14232B]">{subject.subject_name}</td><td className="p-3">{subject.students}</td><td className="p-3"><span className="rounded-lg px-2 py-1 font-semibold" style={{ background: `rgba(14,90,90,${Math.max(.08,Number(subject.average_percentage || 0)/150)})` }}>{value(subject.average_percentage,'%')}</span></td><td className="p-3">{value(subject.accuracy,'%')}</td><td className="p-3">{value(subject.time_score,'/10')}</td><td className="p-3 text-[#237A57]">{count(subject.correct_count)}</td><td className="p-3 text-[#B54747]">{count(subject.incorrect_count)}</td><td className="p-3 text-[#8A5F00]">{count(subject.unanswered_count)}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>

      <TabsContent value="students"><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="font-semibold text-[#14232B]">Student performance table</h2><p className="mt-1 text-xs text-[#6B7980]">Surface marks, percentage, subjects and follow-up status.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} className="pl-9 sm:w-[260px]" placeholder="Search student" /></div><Select value={studentStatus} onValueChange={setStudentStatus}><SelectTrigger className="sm:w-[180px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="needs_attention">Needs attention</SelectItem><SelectItem value="improving">Improving</SelectItem><SelectItem value="strong">Strong</SelectItem><SelectItem value="steady">Steady</SelectItem><SelectItem value="not_started">Not started</SelectItem></SelectContent></Select></div></div><div className="mt-5 overflow-x-auto rounded-xl border border-[#E7ECEB]"><table className="w-full min-w-[1250px] text-left text-xs"><thead className="bg-[#F2F8F7]"><tr><th className="p-3">Student</th><th className="p-3">Grade / section</th><th className="p-3">Tests</th><th className="p-3">Marks</th><th className="p-3">Percentage</th><th className="p-3">Accuracy</th>{subjectNames.map((subject) => <th key={subject} className="p-3">{subject}</th>)}<th className="p-3">Status</th><th className="p-3">Actions</th></tr></thead><tbody>{filteredStudents.map((student) => <tr key={student.participant_key} className="border-t border-[#E7ECEB] align-top"><td className="p-3"><strong className="text-[#14232B]">{student.full_name}</strong><p className="mt-1 text-[11px] text-[#6B7980]">{(student.tracks || []).join(' / ')}</p></td><td className="p-3">Grade {student.grade}<br /><span className="text-[#6B7980]">{student.section_name}</span></td><td className="p-3">{student.completed_tests}</td><td className="p-3">{Number(student.total_marks || 0).toFixed(1)}/{Number(student.maximum_marks || 0).toFixed(1)}</td><td className="p-3 font-semibold text-[#0E5A5A]">{value(student.percentage,'%')}</td><td className="p-3">{value(student.accuracy,'%')}</td>{subjectNames.map((subject) => <td key={subject} className="p-3">{student.subjects?.[subject] ? value(student.subjects[subject].percentage,'%') : '—'}</td>)}<td className="p-3">{statusBadge(student.status)}</td><td className="p-3"><div className="flex gap-2">{student.student_id && <Button size="sm" variant="outline" onClick={() => onOpenStudent(student.student_id!)}>Open</Button>}<Button size="sm" variant="ghost" onClick={() => setInterventionStudent(student)}>Follow-up</Button></div></td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>

      <TabsContent value="tests"><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Test completion and benchmark monitoring</h2><p className="mt-1 text-xs text-[#6B7980]">Every test with takers, average, highest, lowest, Top 10% and Top 5% thresholds.</p><div className="mt-5 overflow-x-auto rounded-xl border border-[#E7ECEB]"><table className="w-full min-w-[1050px] text-left text-xs"><thead className="bg-[#F2F8F7]"><tr><th className="p-3">Test</th><th className="p-3">Product</th><th className="p-3">Students</th><th className="p-3">Average</th><th className="p-3">Lowest</th><th className="p-3">Highest</th><th className="p-3">Top 10%</th><th className="p-3">Top 5%</th><th className="p-3">Accuracy</th><th className="p-3">Time</th></tr></thead><tbody>{(data?.tests || []).map((test) => <tr key={test.paper_id} className="border-t border-[#E7ECEB]"><td className="p-3 font-semibold text-[#14232B]">{test.paper_title}</td><td className="p-3 text-[#6B7980]">{test.product_name || '—'}</td><td className="p-3">{test.test_takers}</td><td className="p-3">{value(test.average_percentage,'%')}</td><td className="p-3">{value(test.lowest_percentage,'%')}</td><td className="p-3 font-semibold text-[#237A57]">{value(test.highest_percentage,'%')}</td><td className="p-3">{value(test.top10_threshold,'%')}</td><td className="p-3">{value(test.top5_threshold,'%')}</td><td className="p-3">{value(test.accuracy,'%')}</td><td className="p-3">{value(test.time_score,'/10')}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>

      <TabsContent value="teachers" className="space-y-4"><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Teacher and class comparison</h2><p className="mt-1 text-xs text-[#6B7980]">Assigned teaching context and current section outcomes. This is a class view, not a permanent teacher rating.</p><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data?.teachers || []).map((teacher) => <div key={`${teacher.teacher_id}-${teacher.section_id}-${teacher.subject_label}`} className="rounded-xl border border-[#E7ECEB] p-4"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#14232B]">{teacher.teacher_name}</strong><p className="mt-1 text-xs text-[#6B7980]">Grade {teacher.grade} · {teacher.section_name} · {teacher.subject_label}</p></div><UserRoundCheck className="h-5 w-5 text-[#0E5A5A]" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><strong className="block text-lg">{teacher.students}</strong><span className="text-[10px] text-[#6B7980]">Students</span></div><div><strong className="block text-lg">{value(teacher.average_percentage,'%')}</strong><span className="text-[10px] text-[#6B7980]">Average</span></div><div><strong className="block text-lg">{value(teacher.accuracy,'%')}</strong><span className="text-[10px] text-[#6B7980]">Accuracy</span></div></div></div>)}{!(data?.teachers || []).length && <div className="col-span-full py-10 text-center text-sm text-[#6B7980]">No teacher-section assignments match this filter.</div>}</div></CardContent></Card><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-[#14232B]">Academic follow-up tracker</h2><p className="mt-1 text-xs text-[#6B7980]">Open and in-progress interventions created from the student table.</p></div><AlertTriangle className="h-5 w-5 text-[#F2B84B]" /></div><div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{(data?.interventions || []).map((item) => <div key={item.id} className="rounded-xl border border-[#E7ECEB] p-4"><div className="flex justify-between gap-3"><strong className="text-sm text-[#14232B]">{item.title}</strong><Badge variant="outline">{item.priority}</Badge></div><p className="mt-2 text-xs leading-5 text-[#6B7980]">{item.note || 'No note added.'}</p><p className="mt-3 text-[11px] text-[#6B7980]">Due: {item.due_date || 'Not set'} · {item.status.replace('_',' ')}</p></div>)}{!(data?.interventions || []).length && <div className="col-span-full py-10 text-center text-sm text-[#6B7980]">No open academic follow-ups.</div>}</div></CardContent></Card></TabsContent>
    </Tabs>

    <Dialog open={!!interventionStudent} onOpenChange={(open) => { if (!open) setInterventionStudent(null); }}><DialogContent><DialogHeader><DialogTitle>Create academic follow-up</DialogTitle><DialogDescription>{interventionStudent?.full_name} · Grade {interventionStudent?.grade} · {interventionStudent?.section_name}</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Title</Label><Input value={interventionTitle} onChange={(event) => setInterventionTitle(event.target.value)} /></div><div className="space-y-2"><Label>Note</Label><Input value={interventionNote} onChange={(event) => setInterventionNote(event.target.value)} placeholder="What should the teacher or counsellor review?" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Priority</Label><Select value={interventionPriority} onValueChange={setInterventionPriority}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Due date</Label><Input type="date" value={interventionDue} onChange={(event) => setInterventionDue(event.target.value)} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setInterventionStudent(null)}>Cancel</Button><Button onClick={() => void saveIntervention()} disabled={savingIntervention} className="bg-[#0E5A5A] hover:bg-[#0A4747]">{savingIntervention && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Save follow-up</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
