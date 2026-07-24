'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpenCheck,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
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
import { supabase } from '@/lib/supabase';
import type { AnalyticsScope, TeacherAnalyticsPayload } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const statusLabel: Record<string, string> = {
  needs_attention: 'Needs attention',
  improving: 'Improving',
  strong: 'Strong',
  steady: 'Steady',
  not_started: 'Not started',
};

const statusClass: Record<string, string> = {
  needs_attention: 'border-[#B54747]/20 bg-[#FAEEEE] text-[#B54747]',
  improving: 'border-[#237A57]/20 bg-[#EAF4EF] text-[#237A57]',
  strong: 'border-[#0E5A5A]/20 bg-[#DCE9E7] text-[#0E5A5A]',
  steady: 'border-[#2E6D8B]/20 bg-[#E9F1F5] text-[#2E6D8B]',
  not_started: 'border-[#AEB8BC]/30 bg-[#F7F9F7] text-[#6B7980]',
};

function metric(value?: number | null, suffix = '') {
  return value === null || value === undefined ? '—' : `${Number(value).toFixed(1)}${suffix}`;
}

export function TeacherAnalyticsDashboard({
  scope,
  onOpenStudent,
  onRefreshScope,
}: {
  scope: AnalyticsScope;
  onOpenStudent: (studentId: string) => void;
  onRefreshScope: () => void;
}) {
  const [payload, setPayload] = useState<TeacherAnalyticsPayload | null>(null);
  const [sectionId, setSectionId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Connect Supabase and apply migration 36 to load the teacher dashboard.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('get_teacher_analytics_overview_v10', {
      p_section_id: sectionId === 'all' ? null : sectionId,
      p_from: from || null,
      p_to: to || null,
    });
    if (loadError) setError(loadError.message);
    else setPayload(data as TeacherAnalyticsPayload);
    setLoading(false);
  }, [from, sectionId, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const students = useMemo(() => (payload?.students || []).filter((student) =>
    !search || student.full_name.toLowerCase().includes(search.toLowerCase()),
  ), [payload?.students, search]);

  if (loading && !payload) {
    return <div className="grid min-h-[520px] place-items-center rounded-2xl border border-[#E7ECEB] bg-white"><div className="text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Calculating assigned-section analytics…</div></div>;
  }

  const summary = payload?.summary;
  const cards = [
    { label: 'Assigned students', value: summary?.total_students ?? 0, icon: Users },
    { label: 'Tests completed', value: summary?.completed_tests ?? 0, icon: BookOpenCheck },
    { label: 'Average performance', value: metric(summary?.average_percentage, '%'), icon: Target },
    { label: 'Participation', value: metric(summary?.participation, '%'), icon: TrendingUp },
    { label: 'Improving', value: summary?.improving ?? 0, icon: Sparkles },
    { label: 'Need attention', value: summary?.needs_attention ?? 0, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Analytics Phase 2 · Teacher overview</div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14232B]">How your students are performing</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#44545C]">Live evidence from only the sections assigned to you. Open any student to continue into the detailed product and subject dashboard.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onRefreshScope}><Users className="mr-2 h-4 w-4" />Refresh students</Button>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Recalculate</Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] px-4 py-3 text-sm text-[#B54747]">{error}</div>}

      <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="grid gap-3 md:grid-cols-3 xl:grid-cols-[minmax(220px,1fr)_180px_180px_auto]">
        <Select value={sectionId} onValueChange={setSectionId}><SelectTrigger><SelectValue placeholder="Assigned section" /></SelectTrigger><SelectContent><SelectItem value="all">All assigned sections</SelectItem>{scope.sections.map((section) => <SelectItem key={section.id} value={section.id}>Grade {section.grade} · {section.name} · {section.academic_year}</SelectItem>)}</SelectContent></Select>
        <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} aria-label="From date" />
        <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} aria-label="To date" />
        <Button variant="outline" onClick={() => { setSectionId('all'); setFrom(''); setTo(''); }}>Reset filters</Button>
      </div></CardContent></Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {cards.map(({ label, value, icon: Icon }) => <Card key={label} className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-[#6B7980]">{label}</p><p className="mt-2 text-2xl font-extrabold text-[#14232B]">{value}</p></div><div className="rounded-xl bg-[#DCE9E7] p-2.5 text-[#0E5A5A]"><Icon className="h-5 w-5" /></div></div></CardContent></Card>)}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardHeader><CardTitle className="text-base text-[#14232B]">Subject performance</CardTitle></CardHeader><CardContent><div className="h-[310px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={payload?.subjects || []} layout="vertical" margin={{ left: 30, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="subject_name" width={110} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="average_percentage" fill="#0E5A5A" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
        <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardHeader><CardTitle className="text-base text-[#14232B]">Performance trend</CardTitle></CardHeader><CardContent><div className="h-[310px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={payload?.trends || []} margin={{ left: 0, right: 20 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis dataKey="date" tick={{ fontSize: 10 }} minTickGap={28} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="average_percentage" stroke="#0E5A5A" strokeWidth={3} dot={false} /><Line type="monotone" dataKey="accuracy" stroke="#F2B84B" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div></CardContent></Card>
      </div>

      <Tabs defaultValue="attention">
        <TabsList><TabsTrigger value="attention">Needs attention</TabsTrigger><TabsTrigger value="improving">Improving</TabsTrigger><TabsTrigger value="all">All students</TabsTrigger><TabsTrigger value="sections">Section comparison</TabsTrigger></TabsList>
        {(['attention','improving','all'] as const).map((tab) => <TabsContent key={tab} value={tab}><Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="font-semibold text-[#14232B]">Student evidence</h2><p className="text-xs text-[#6B7980]">Use the status as a review queue, not as a permanent student label.</p></div><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student" className="max-w-xs" /></div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {students.filter((student) => tab === 'all' || (tab === 'attention' ? student.performance_status === 'needs_attention' : student.performance_status === 'improving')).map((student) => <button type="button" key={student.student_id} onClick={() => onOpenStudent(student.student_id)} className="rounded-xl border border-[#E7ECEB] bg-white p-4 text-left transition hover:border-[#0E5A5A]/40 hover:shadow-sm"><div className="flex items-start justify-between gap-3"><div><strong className="text-sm text-[#14232B]">{student.full_name}</strong><p className="mt-1 text-xs text-[#6B7980]">Grade {student.grade} · {student.section_name} · {student.completed_tests} tests</p></div><Badge variant="outline" className={statusClass[student.performance_status]}>{statusLabel[student.performance_status]}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><span className="text-[#6B7980]">Average</span><strong className="mt-1 block text-[#14232B]">{metric(student.average_percentage,'%')}</strong></div><div><span className="text-[#6B7980]">Accuracy</span><strong className="mt-1 block text-[#14232B]">{metric(student.accuracy,'%')}</strong></div><div><span className="text-[#6B7980]">Change</span><strong className="mt-1 block text-[#14232B]">{student.improvement > 0 ? '+' : ''}{metric(student.improvement,' pts')}</strong></div></div><div className="mt-4 flex items-center justify-end text-xs font-semibold text-[#0E5A5A]">Open profile <ArrowRight className="ml-1 h-3.5 w-3.5" /></div></button>)}
          </div>
        </CardContent></Card></TabsContent>)}
        <TabsContent value="sections"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(payload?.sections || []).map((section) => <Card key={section.id} className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="flex items-start justify-between"><div><strong className="text-sm text-[#14232B]">Grade {section.grade} · {section.name}</strong><p className="mt-1 text-xs text-[#6B7980]">{section.organization_name} · {section.academic_year}</p></div><Badge variant="outline">{section.students} students</Badge></div><div className="mt-4 grid grid-cols-3 gap-2 text-xs"><div><span className="text-[#6B7980]">Tests</span><strong className="mt-1 block text-[#14232B]">{section.completed_tests}</strong></div><div><span className="text-[#6B7980]">Average</span><strong className="mt-1 block text-[#14232B]">{metric(section.average_percentage,'%')}</strong></div><div><span className="text-[#6B7980]">Accuracy</span><strong className="mt-1 block text-[#14232B]">{metric(section.accuracy,'%')}</strong></div></div></CardContent></Card>)}</div></TabsContent>
      </Tabs>
    </div>
  );
}
