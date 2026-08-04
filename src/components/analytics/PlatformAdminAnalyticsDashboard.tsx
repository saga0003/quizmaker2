'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, Building2, CheckCircle2, Download, Gauge, Layers3, LoaderCircle, RefreshCw, School, Search, ShieldCheck, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '@/lib/supabase';
import type { AnalyticsScope } from '@/types/analytics';
import type { PlatformAnalyticsPayload, PlatformSchoolRow, PlatformTaxonomyRow } from '@/types/analytics-phase4';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function value(input?: number | null, suffix = '') { return input == null ? '—' : `${Number(input).toFixed(1)}${suffix}`; }
function count(input?: number | null) { return new Intl.NumberFormat('en-IN').format(input || 0); }
function dateText(input?: string | null) { return input ? new Date(input).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No activity'; }
function csv(filename: string, rows: Array<Array<string | number>>) {
  const text = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PlatformAdminAnalyticsDashboard({ scope, onOpenSchool }: { scope: AnalyticsScope; onOpenSchool: (organizationId: string) => void }) {
  const [data, setData] = useState<PlatformAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [board, setBoard] = useState('all');
  const [taxonomySubject, setTaxonomySubject] = useState('all');
  const [taxonomyLevel, setTaxonomyLevel] = useState<'chapter' | 'topic'>('chapter');

  const load = useCallback(async () => {
    if (!supabase) { setError('Connect Supabase and apply migrations 38 and 38a.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data: result, error: loadError } = await supabase.rpc('get_platform_analytics_overview_v12');
    if (loadError) setError(loadError.message); else setData(result as PlatformAnalyticsPayload);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const boards = useMemo(() => Array.from(new Set((data?.schools || []).map((school) => school.board).filter((item): item is string => !!item))).sort(), [data]);
  const schools = (data?.schools || []).filter((school) => {
    const query = search.trim().toLowerCase();
    return (board === 'all' || school.board === board) && (!query || `${school.name} ${school.city || ''} ${school.state || ''}`.toLowerCase().includes(query));
  });
  const taxonomySource = taxonomyLevel === 'chapter' ? data?.chapters || [] : data?.topics || [];
  const subjects = useMemo(() => Array.from(new Set([...(data?.chapters || []), ...(data?.topics || [])].map((item) => item.subject_name))).sort(), [data]);
  const taxonomy = taxonomySource.filter((item) => taxonomySubject === 'all' || item.subject_name === taxonomySubject);
  const adoptionChart = schools.slice(0, 14).map((school) => ({ name: school.name.length > 20 ? `${school.name.slice(0, 20)}…` : school.name, adoption: school.adoption_score, participation: school.participation }));
  const activityDistribution = [
    { name: 'Active in 30 days', value: data?.summary.active_students || 0, fill: '#237A57' },
    { name: 'Not active', value: Math.max(0, (data?.summary.students || 0) - (data?.summary.active_students || 0)), fill: '#DCE9E7' },
  ];

  const summaryCards = [
    { label: 'Active schools', value: count(data?.summary.schools), icon: Building2 },
    { label: 'Students', value: count(data?.summary.students), icon: Users },
    { label: 'Active students', value: count(data?.summary.active_students), icon: Activity },
    { label: 'Completed test results', value: count(data?.summary.completed_tests), icon: CheckCircle2 },
    { label: 'Average percentage', value: value(data?.summary.average_percentage, '%'), icon: BarChart3 },
    { label: 'Overall accuracy', value: value(data?.summary.accuracy, '%'), icon: ShieldCheck },
    { label: 'Time score', value: value(data?.summary.time_score, '/10'), icon: Gauge },
    { label: 'Data warnings', value: count(data?.summary.data_quality_warnings), icon: AlertTriangle },
  ];

  function exportSchools() {
    csv('evidara-platform-schools.csv', [
      ['School', 'Board', 'City', 'Students', 'Active students', 'Participation', 'Test results', 'Average percentage', 'Accuracy', 'Time score', 'Adoption score', 'Warnings', 'Last activity'],
      ...schools.map((school) => [school.name, school.board || '', school.city || '', school.total_students, school.active_students, school.participation, school.completed_tests, school.average_percentage || 0, school.accuracy || 0, school.time_score || 0, school.adoption_score, school.data_quality_warnings, school.last_activity || '']),
    ]);
  }

  function exportTaxonomy() {
    csv(`evidara-platform-${taxonomyLevel}-benchmarks.csv`, [
      ['Subject', 'Chapter', taxonomyLevel === 'topic' ? 'Topic' : 'Chapter name', 'Schools compared', 'Average', 'Lowest', 'Highest'],
      ...taxonomy.map((row) => [row.subject_name, row.chapter_name || row.name, row.name, row.schools_compared, row.average || 0, row.lowest || 0, row.highest || 0]),
    ]);
  }

  if (loading && !data) return <div className="grid min-h-[420px] place-items-center text-sm text-[#6B7980]"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading platform analytics…</div></div>;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Analytics Phase 4 · Final platform layer</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14232B]">Evidara analytics command centre</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-[#44545C]">Compare school adoption and evidence quality, then drill down through school, grade, section and student analytics.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button onClick={exportSchools} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]"><Download className="mr-2 h-4 w-4" />Export schools CSV</Button></div>
    </div>
    {error && <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4 text-sm text-[#B54747]">{error}</div>}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{summaryCards.map(({ label, value: cardValue, icon: Icon }) => <Card key={label} className="border-[#E7ECEB] shadow-none"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-semibold text-[#6B7980]">{label}</p><strong className="mt-2 block text-2xl text-[#14232B]">{cardValue}</strong></div><div className="rounded-xl bg-[#DCE9E7] p-3 text-[#0E5A5A]"><Icon className="h-5 w-5" /></div></CardContent></Card>)}</section>

    <Tabs defaultValue="overview">
      <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="schools">Schools</TabsTrigger><TabsTrigger value="taxonomy">Chapters & topics</TabsTrigger><TabsTrigger value="quality">Data quality</TabsTrigger><TabsTrigger value="governance">Governance</TabsTrigger></TabsList>

      <TabsContent value="overview" className="mt-5 space-y-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(300px,.5fr)]">
          <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">School adoption and participation</h2><p className="mt-1 text-xs text-[#6B7980]">Adoption combines active-student coverage and repeated test usage. It is an operational indicator, not an academic rank.</p><div className="mt-4 h-[420px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={adoptionChart} layout="vertical" margin={{ left: 20, right: 24 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis type="number" domain={[0,100]} /><YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="adoption" name="Adoption score" fill="#0E5A5A" radius={[0,4,4,0]} /><Bar dataKey="participation" name="Participation" fill="#9FBDBD" radius={[0,4,4,0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
          <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-5"><h2 className="font-semibold text-[#14232B]">Student activity</h2><p className="mt-1 text-xs text-[#6B7980]">Students with at least one result in the latest 30 days.</p><div className="h-[260px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={activityDistribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={86} paddingAngle={3}>{activityDistribution.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="space-y-2">{activityDistribution.map((item) => <div key={item.name} className="flex items-center justify-between rounded-xl border border-[#E7ECEB] p-3 text-sm"><span className="flex items-center gap-2 text-[#44545C]"><i className="h-2.5 w-2.5 rounded-full" style={{ background: item.fill }} />{item.name}</span><strong className="text-[#14232B]">{count(item.value)}</strong></div>)}</div></CardContent></Card>
        </div>
      </TabsContent>

      <TabsContent value="schools" className="mt-5 space-y-4">
        <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search school, city or state" className="pl-9" /></div><Select value={board} onValueChange={setBoard}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All boards</SelectItem>{boards.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>
        <div className="overflow-x-auto rounded-xl border border-[#E7ECEB] bg-white"><table className="w-full min-w-[1280px] text-sm"><thead className="bg-[#F7F9F7] text-left text-xs text-[#6B7980]"><tr><th className="p-3">School</th><th className="p-3">Board</th><th className="p-3 text-right">Students</th><th className="p-3 text-right">Active</th><th className="p-3 text-right">Participation</th><th className="p-3 text-right">Tests</th><th className="p-3 text-right">Average</th><th className="p-3 text-right">Accuracy</th><th className="p-3 text-right">Time</th><th className="p-3 text-right">Adoption</th><th className="p-3">Last activity</th><th className="p-3">Quality</th><th className="p-3"></th></tr></thead><tbody>{schools.map((school) => <tr key={school.id} className="border-t border-[#EEF2F1]"><td className="p-3"><strong className="text-[#14232B]">{school.name}</strong><p className="text-xs text-[#6B7980]">{school.city || '—'} · {school.state || '—'}</p></td><td className="p-3">{school.board || '—'}</td><td className="p-3 text-right">{school.total_students}</td><td className="p-3 text-right">{school.active_students}</td><td className="p-3 text-right">{value(school.participation, '%')}</td><td className="p-3 text-right">{count(school.completed_tests)}</td><td className="p-3 text-right font-semibold text-[#0E5A5A]">{value(school.average_percentage, '%')}</td><td className="p-3 text-right">{value(school.accuracy, '%')}</td><td className="p-3 text-right">{value(school.time_score, '/10')}</td><td className="p-3 text-right">{value(school.adoption_score, '%')}</td><td className="p-3 text-xs text-[#6B7980]">{dateText(school.last_activity)}</td><td className="p-3">{school.data_quality_warnings ? <Badge className="bg-[#FFF1E7] text-[#A65318]">{school.data_quality_warnings} warning{school.data_quality_warnings === 1 ? '' : 's'}</Badge> : <Badge className="bg-[#EAF4EF] text-[#237A57]">Ready</Badge>}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => onOpenSchool(school.id)}><School className="mr-2 h-4 w-4" />Open</Button></td></tr>)}</tbody></table></div>
      </TabsContent>

      <TabsContent value="taxonomy" className="mt-5 space-y-4">
        <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-[#14232B]">Anonymous chapter and topic benchmarks</h2><p className="mt-1 text-xs text-[#6B7980]">Only aggregate school evidence is shown. Student identities are not exposed.</p></div><div className="grid gap-2 sm:grid-cols-3"><Select value={taxonomyLevel} onValueChange={(item) => setTaxonomyLevel(item as 'chapter' | 'topic')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="chapter">Chapters</SelectItem><SelectItem value="topic">Topics</SelectItem></SelectContent></Select><Select value={taxonomySubject} onValueChange={setTaxonomySubject}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={exportTaxonomy}><Download className="mr-2 h-4 w-4" />Export CSV</Button></div></div></CardContent></Card>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{taxonomy.slice(0, 30).map((row) => <Card key={`${taxonomyLevel}-${row.id}`} className="border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{row.subject_name}</Badge><h3 className="mt-3 font-semibold text-[#14232B]">{row.name}</h3>{row.chapter_name && <p className="mt-1 text-xs text-[#6B7980]">{row.chapter_name}</p>}</div><Layers3 className="h-5 w-5 text-[#0E5A5A]" /></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-lg bg-[#F2F8F7] p-2"><strong className="text-[#0E5A5A]">{value(row.average, '%')}</strong><p className="text-[10px] text-[#6B7980]">Average</p></div><div className="rounded-lg bg-[#FAEEEE] p-2"><strong className="text-[#B54747]">{value(row.lowest, '%')}</strong><p className="text-[10px] text-[#6B7980]">Lowest</p></div><div className="rounded-lg bg-[#FFF9E9] p-2"><strong className="text-[#9A6508]">{value(row.highest, '%')}</strong><p className="text-[10px] text-[#6B7980]">Highest</p></div></div><p className="mt-3 text-xs text-[#6B7980]">{row.schools_compared} school{row.schools_compared === 1 ? '' : 's'} compared</p></CardContent></Card>)}</div>
      </TabsContent>

      <TabsContent value="quality" className="mt-5"><div className="grid gap-3">{(data?.data_quality || []).map((warning) => <Card key={warning.organization_id} className="border-[#E8D39B] bg-[#FFFDF7] shadow-none"><CardContent className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-[#B76E00]" /><strong className="text-[#14232B]">{warning.school_name}</strong></div><div className="mt-2 flex flex-wrap gap-2">{warning.missing_section_assignments > 0 && <Badge variant="outline">{warning.missing_section_assignments} students without sections</Badge>}{warning.no_recent_activity && <Badge variant="outline">No activity in 30 days</Badge>}{warning.no_completed_tests && <Badge variant="outline">No completed tests</Badge>}</div></div><Button variant="outline" onClick={() => onOpenSchool(warning.organization_id)}>Review school</Button></CardContent></Card>)}{!data?.data_quality?.length && <Card className="border-[#D5E7DD] bg-[#F4FAF7] shadow-none"><CardContent className="p-8 text-center text-sm text-[#237A57]">No platform data-quality warnings are currently detected.</CardContent></Card>}</div></TabsContent>

      <TabsContent value="governance" className="mt-5"><Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#0E5A5A]" /><h2 className="font-semibold text-[#14232B]">Analytics governance and audit activity</h2></div><p className="mt-1 text-xs text-[#6B7980]">Recent analytics configuration, generation, reset, follow-up and migration events.</p><div className="mt-5 overflow-x-auto rounded-xl border border-[#E7ECEB]"><table className="w-full min-w-[900px] text-sm"><thead className="bg-[#F7F9F7] text-left text-xs text-[#6B7980]"><tr><th className="p-3">Time</th><th className="p-3">Action</th><th className="p-3">Entity</th><th className="p-3">Reference</th></tr></thead><tbody>{(data?.recent_governance || []).map((event, index) => <tr key={`${event.created_at}-${index}`} className="border-t border-[#EEF2F1]"><td className="p-3 text-xs text-[#6B7980]">{dateText(event.created_at)}</td><td className="p-3 font-medium text-[#14232B]">{event.action}</td><td className="p-3">{event.entity_type}</td><td className="p-3 font-mono text-xs text-[#6B7980]">{event.entity_id}</td></tr>)}</tbody></table></div></CardContent></Card></TabsContent>
    </Tabs>
  </div>;
}
