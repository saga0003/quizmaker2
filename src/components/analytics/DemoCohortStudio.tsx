'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileQuestion,
  LoaderCircle,
  RefreshCw,
  Search,
  Target,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type {
  DemoCohortStudioPayload,
  DemoCohortStudent,
  DemoStudentDrilldownPayload,
} from '@/types/demo-cohorts';
import { DemoAnalyticsDataLab } from './DemoAnalyticsDataLab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEFAULT_EMAIL = 'sales.student@demo.evidara.app';
const PIE_COLORS = ['#237A57', '#B54747', '#F2B84B'];

function metric(value?: number | null, suffix = '') {
  return value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(1)}${suffix}`;
}

function label(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function DemoCohortStudio() {
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [payload, setPayload] = useState<DemoCohortStudioPayload | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [drilldown, setDrilldown] = useState<DemoStudentDrilldownPayload | null>(null);
  const [productId, setProductId] = useState('all');
  const [track, setTrack] = useState('all');
  const [subject, setSubject] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [studentLoading, setStudentLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Connect Supabase and apply migration 40 to use the Demo Cohort Studio.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('get_analytics_demo_cohort_studio_v14', {
      p_email: email.trim().toLowerCase(),
    });
    if (loadError) {
      setError(loadError.message);
      setPayload(null);
    } else {
      const next = data as DemoCohortStudioPayload;
      setPayload(next);
      setSelectedStudentId((current) => current && next.students.some((student) => student.id === current)
        ? current
        : next.students[0]?.id || '');
    }
    setLoading(false);
  }, [email]);

  useEffect(() => { void load(); }, [load]);

  const loadStudent = useCallback(async () => {
    if (!supabase || !selectedStudentId) {
      setDrilldown(null);
      return;
    }
    setStudentLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('get_analytics_demo_student_drilldown_v14', {
      p_demo_student_id: selectedStudentId,
      p_product_id: productId === 'all' ? null : productId,
    });
    if (loadError) {
      setError(loadError.message);
      setDrilldown(null);
    } else {
      setDrilldown(data as DemoStudentDrilldownPayload);
    }
    setStudentLoading(false);
  }, [productId, selectedStudentId]);

  useEffect(() => { void loadStudent(); }, [loadStudent]);

  const filteredStudents = useMemo(() => (payload?.students || []).filter((student) =>
    (track === 'all' || student.track === track)
    && (!search || `${student.full_name} ${student.roll_number} ${student.strongest_subject || ''} ${student.weakest_subject || ''}`.toLowerCase().includes(search.toLowerCase())),
  ), [payload?.students, search, track]);

  const subjects = drilldown?.subjects || [];
  const subjectOptions = useMemo(() => subjects.map((row) => row.subject_name), [subjects]);
  const chapterRows = (drilldown?.chapters || []).filter((row) => subject === 'all' || row.subject_name === subject);
  const topicRows = (drilldown?.topics || []).filter((row) => subject === 'all' || row.subject_name === subject);
  const weakestTopics = [...topicRows].sort((a, b) => a.percentage - b.percentage).slice(0, 16);
  const testRows = drilldown?.tests || [];
  const answerMix = drilldown ? [
    { name: 'Correct', value: drilldown.summary.correct },
    { name: 'Incorrect', value: drilldown.summary.incorrect },
    { name: 'Unanswered', value: drilldown.summary.unanswered },
  ] : [];

  const batch = payload?.batch;
  const selectedStudent = payload?.students.find((student) => student.id === selectedStudentId);

  return (
    <div className="space-y-6">
      <DemoAnalyticsDataLab
        email={email}
        onEmailChange={setEmail}
        showResultsTable={false}
        onChanged={() => void load()}
      />

      {error && <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4 text-sm text-[#B54747]">{error}</div>}

      {loading ? (
        <Card className="border-[#E7ECEB] shadow-none"><CardContent className="grid min-h-[280px] place-items-center text-sm text-[#6B7980]"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading generated cohort evidence…</div></CardContent></Card>
      ) : !payload?.ready || !batch ? (
        <Card className="border-[#E7ECEB] shadow-none"><CardContent className="grid min-h-[240px] place-items-center text-center"><div><Users className="mx-auto mb-3 h-8 w-8 text-[#0E5A5A]" /><h3 className="font-semibold text-[#14232B]">No generated cohort yet</h3><p className="mt-2 max-w-xl text-sm leading-6 text-[#6B7980]">Use <strong>Create cohort + questions</strong> above. After generation, all 100 students and their subject, chapter and topic patterns will appear here.</p></div></CardContent></Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            {[
              ['Students', batch.students, Users],
              ['Series', batch.products, BookOpenCheck],
              ['Papers', batch.papers, BarChart3],
              ['Questions', batch.questions, FileQuestion],
              ['Chapters', batch.chapters, BrainCircuit],
              ['Topics', batch.topics, Target],
              ['Test results', batch.test_results, CheckCircle2],
              ['Subject rows', batch.subject_results, Clock3],
            ].map(([name, value, Icon]) => {
              const MetricIcon = Icon as typeof Users;
              return <Card key={String(name)} className="border-[#E7ECEB] shadow-none"><CardContent className="p-4"><MetricIcon className="h-4 w-4 text-[#0E5A5A]" /><p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-[#6B7980]">{String(name)}</p><strong className="mt-1 block text-xl text-[#14232B]">{Number(value || 0).toLocaleString('en-IN')}</strong></CardContent></Card>;
            })}
          </div>

          <Card className="border-[#D5E2E0] shadow-none">
            <CardContent className="p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0E5A5A]"><Users className="h-4 w-4" />Cohort explorer</div>
                  <h2 className="mt-2 text-xl font-bold text-[#14232B]">Open any generated student</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-[#6B7980]">Choose different students to trial the charts. Each row shows the generated profile’s overall position and its strongest and weakest subjects.</p>
                </div>
                <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Refresh cohort</Button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Select value={track} onValueChange={setTrack}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">PCM and PCB</SelectItem><SelectItem value="PCM">PCM only</SelectItem><SelectItem value="PCB">PCB only</SelectItem></SelectContent></Select>
                <Select value={productId} onValueChange={setProductId}><SelectTrigger><SelectValue placeholder="Series" /></SelectTrigger><SelectContent><SelectItem value="all">All generated series</SelectItem>{(payload.products || []).map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select>
                <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9AA7AD]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student or subject pattern" className="pl-9" /></div>
              </div>

              <div className="mt-5 max-h-[460px] overflow-auto rounded-xl border border-[#E7ECEB]">
                <table className="w-full min-w-[1050px] text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[#F7F9F7] text-xs uppercase tracking-wide text-[#6B7980]"><tr><th className="px-4 py-3">Student</th><th className="px-3 py-3">Track</th><th className="px-3 py-3">Tests</th><th className="px-3 py-3">Percentage</th><th className="px-3 py-3">Accuracy</th><th className="px-3 py-3">Time score</th><th className="px-3 py-3">Strongest</th><th className="px-3 py-3">Needs attention</th><th className="px-3 py-3"></th></tr></thead>
                  <tbody>{filteredStudents.map((student) => <StudentRow key={student.id} student={student} selected={student.id === selectedStudentId} onOpen={() => setSelectedStudentId(student.id)} />)}{!filteredStudents.length && <tr><td colSpan={9} className="px-4 py-12 text-center text-[#6B7980]">No generated students match the filters.</td></tr>}</tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-[#6B7980]">Showing {filteredStudents.length} of {payload.students.length} generated students.</p>
            </CardContent>
          </Card>

          {studentLoading ? (
            <Card className="border-[#E7ECEB] shadow-none"><CardContent className="grid min-h-[300px] place-items-center text-sm text-[#6B7980]"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Building student topic drill-down…</div></CardContent></Card>
          ) : drilldown && selectedStudent ? (
            <div className="space-y-5">
              <Card className="border-[#B7CECB] bg-gradient-to-br from-white to-[#F1F8F7] shadow-none">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div><div className="flex items-center gap-2"><Badge className="bg-[#0E5A5A] text-white">{drilldown.student.track}</Badge><span className="text-xs text-[#6B7980]">{drilldown.student.roll_number} · {drilldown.student.section_label}</span></div><h2 className="mt-2 text-2xl font-bold text-[#14232B]">{drilldown.student.full_name}</h2><p className="mt-1 text-sm text-[#6B7980]">Generated student analytics across {productId === 'all' ? 'all series' : payload.products.find((product) => product.id === productId)?.name || 'the selected series'}.</p></div>
                    <Select value={subject} onValueChange={setSubject}><SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem>{subjectOptions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                    {[
                      ['Tests', drilldown.summary.completed_tests],
                      ['Percentage', metric(drilldown.summary.average_percentage, '%')],
                      ['Accuracy', metric(drilldown.summary.average_accuracy, '%')],
                      ['Time score', metric(drilldown.summary.average_time_score, '/10')],
                      ['Correct', drilldown.summary.correct],
                      ['Wrong', drilldown.summary.incorrect],
                      ['Unanswered', drilldown.summary.unanswered],
                    ].map(([name, value]) => <div key={String(name)} className="rounded-xl border border-[#D5E2E0] bg-white p-3"><p className="text-[11px] uppercase tracking-wide text-[#6B7980]">{name}</p><strong className="mt-1 block text-lg text-[#14232B]">{value}</strong></div>)}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-5 xl:grid-cols-2">
                <ChartCard title="Subject performance" description="Percentage and accuracy for this generated student.">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={subjects}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis dataKey="subject_name" tick={{ fontSize: 11 }} /><YAxis domain={[0,100]} tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Bar dataKey="percentage" name="Percentage" fill="#0E5A5A" radius={[5,5,0,0]} /><Bar dataKey="accuracy" name="Accuracy" fill="#8EB3AF" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Correct, wrong and unanswered" description="Complete response distribution for the selected scope.">
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={answerMix} dataKey="value" nameKey="name" innerRadius={62} outerRadius={105} paddingAngle={3}>{answerMix.map((_row, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
                </ChartCard>
              </div>

              <div className="grid gap-5 xl:grid-cols-2">
                <ChartCard title="Weakest topics" description="Lowest topic percentages reveal exactly where this student is going wrong.">
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={weakestTopics} layout="vertical" margin={{ left: 30, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis type="number" domain={[0,100]} tick={{ fontSize: 10 }} /><YAxis type="category" dataKey="topic_name" width={145} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="percentage" name="Percentage" fill="#0E5A5A" radius={[0,5,5,0]} /></BarChart></ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Test trend" description="Performance and accuracy across the generated tests.">
                  <ResponsiveContainer width="100%" height="100%"><LineChart data={testRows}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis dataKey="paper_title" tick={{ fontSize: 9 }} interval="preserveStartEnd" /><YAxis domain={[0,100]} tick={{ fontSize: 10 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="percentage" name="Percentage" stroke="#0E5A5A" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#F2B84B" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>
                </ChartCard>
              </div>

              <Card className="border-[#E7ECEB] shadow-none">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-[#0E5A5A]" /><h3 className="font-semibold text-[#14232B]">Chapter and topic evidence</h3></div>
                  <p className="mt-1 text-sm text-[#6B7980]">Use this table to inspect question coverage, correct answers, wrong answers and unanswered questions for every generated topic.</p>
                  <div className="mt-4 overflow-auto rounded-xl border border-[#E7ECEB]"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-[#F7F9F7] text-left text-xs uppercase tracking-wide text-[#6B7980]"><tr><th className="p-3">Subject</th><th className="p-3">Chapter</th><th className="p-3">Topic</th><th className="p-3 text-right">Questions</th><th className="p-3 text-right">Correct</th><th className="p-3 text-right">Wrong</th><th className="p-3 text-right">Unanswered</th><th className="p-3 text-right">Marks</th><th className="p-3 text-right">Percentage</th><th className="p-3 text-right">Accuracy</th></tr></thead><tbody>{topicRows.map((row) => <tr key={row.topic_id} className="border-t border-[#EEF2F1]"><td className="p-3 font-semibold text-[#14232B]">{row.subject_name}</td><td className="p-3 text-[#44545C]">{row.chapter_name}</td><td className="p-3 text-[#44545C]">{row.topic_name}</td><td className="p-3 text-right">{row.questions}</td><td className="p-3 text-right text-[#237A57]">{row.correct}</td><td className="p-3 text-right text-[#B54747]">{row.incorrect}</td><td className="p-3 text-right text-[#9A6508]">{row.unanswered}</td><td className="p-3 text-right">{row.marks.toFixed(1)} / {row.maximum_marks.toFixed(1)}</td><td className="p-3 text-right font-bold text-[#0E5A5A]">{row.percentage.toFixed(1)}%</td><td className="p-3 text-right">{row.accuracy.toFixed(1)}%</td></tr>)}{!topicRows.length && <tr><td colSpan={10} className="p-10 text-center text-[#6B7980]">No topic evidence for this subject and series combination.</td></tr>}</tbody></table></div>
                </CardContent>
              </Card>

              <div className="grid gap-5 xl:grid-cols-2">
                <BlueprintCard title="Generated question difficulty" icon={Target} rows={payload.difficulty_blueprint} />
                <BlueprintCard title="Generated question formats" icon={FileQuestion} rows={payload.type_blueprint} />
              </div>

              {!!chapterRows.length && <p className="text-xs text-[#6B7980]">The selected subject contains {chapterRows.length} generated chapter records and {topicRows.length} generated topic records for this student.</p>}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function StudentRow({ student, selected, onOpen }: { student: DemoCohortStudent; selected: boolean; onOpen: () => void }) {
  return <tr className={`border-t border-[#EEF2F1] ${selected ? 'bg-[#EDF6F5]' : 'hover:bg-[#FAFCFB]'}`}><td className="px-4 py-3"><strong className="block text-[#14232B]">{student.full_name}</strong><span className="text-xs text-[#6B7980]">{student.roll_number} · {student.section_label}</span></td><td className="px-3 py-3"><Badge variant="outline">{student.track}</Badge></td><td className="px-3 py-3">{student.completed_tests}</td><td className="px-3 py-3 font-bold text-[#0E5A5A]">{metric(student.average_percentage, '%')}</td><td className="px-3 py-3">{metric(student.average_accuracy, '%')}</td><td className="px-3 py-3">{metric(student.average_time_score, '/10')}</td><td className="px-3 py-3 text-[#237A57]">{student.strongest_subject || '—'}</td><td className="px-3 py-3 text-[#B54747]">{student.weakest_subject || '—'}</td><td className="px-3 py-3"><Button size="sm" variant={selected ? 'default' : 'outline'} onClick={onOpen} className={selected ? 'bg-[#0E5A5A] hover:bg-[#0A4747]' : ''}>Open charts</Button></td></tr>;
}

function ChartCard({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-5"><h3 className="font-semibold text-[#14232B]">{title}</h3><p className="mt-1 text-sm text-[#6B7980]">{description}</p><div className="mt-4 h-[340px]">{children}</div></CardContent></Card>;
}

function BlueprintCard({ title, icon: Icon, rows }: { title: string; icon: typeof FileQuestion; rows: Array<{ name: string; questions: number }> }) {
  const total = rows.reduce((sum, row) => sum + Number(row.questions || 0), 0);
  return <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-5"><div className="flex items-center gap-2"><Icon className="h-5 w-5 text-[#0E5A5A]" /><h3 className="font-semibold text-[#14232B]">{title}</h3></div><div className="mt-4 space-y-3">{rows.map((row) => <div key={row.name}><div className="flex justify-between text-sm"><span className="text-[#44545C]">{label(row.name)}</span><strong className="text-[#14232B]">{row.questions.toLocaleString('en-IN')}</strong></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#E7ECEB]"><div className="h-full rounded-full bg-[#0E5A5A]" style={{ width: `${total ? Math.max(3, 100 * row.questions / total) : 0}%` }} /></div></div>)}{!rows.length && <p className="text-sm text-[#6B7980]">No generated question blueprint is available.</p>}</div></CardContent></Card>;
}
