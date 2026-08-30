'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, LoaderCircle, RefreshCw, Sparkles, Target, WalletCards } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DIFFICULTIES = ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'];

type Wallet = { user_id: string; source_type: 'school' | 'direct'; organization_id: string | null; credits_balance: number; lifetime_granted: number; lifetime_used: number };
type Generated = { testId: string; paperId: string; accessCode: string; questionCount: number; creditsRemaining: number; cap?: Record<string, unknown> };
type Taxonomy = { subjects:Array<{id:string;name:string}>; chapters:Array<{id:string;name:string;subject_id:string}>; topics:Array<{id:string;name:string;chapter_id:string}> };
type Priority = {subject_name?:string;chapter_id?:string|null;chapter_name?:string|null;topic_id?:string|null;topic_name?:string|null;accuracy?:number;action?:string};

function toggle(current: string[], value: string) {
  return current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
}

function ChoiceGroup({ title, allLabel, options, selected, onChange, maxHeight = 'max-h-44' }: {
  title: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onChange: (values: string[]) => void;
  maxHeight?: string;
}) {
  return <div className="space-y-2">
    <Label>{title}</Label>
    <div className={`overflow-y-auto rounded-xl border border-[var(--line)] bg-white p-2 ${maxHeight}`}>
      <button type="button" onClick={() => onChange([])} className={`mr-2 mb-2 rounded-lg border px-3 py-2 text-xs font-semibold ${selected.length === 0 ? 'border-[var(--teal)] bg-[var(--secondary)] text-[var(--teal)]' : 'border-[var(--line)] text-[var(--muted-foreground)]'}`}>{allLabel}</button>
      {options.map((option) => <button key={option.value} type="button" onClick={() => onChange(toggle(selected, option.value))} className={`mr-2 mb-2 rounded-lg border px-3 py-2 text-xs font-semibold ${selected.includes(option.value) ? 'border-[var(--teal)] bg-[var(--secondary)] text-[var(--teal)]' : 'border-[var(--line)] text-[var(--muted-foreground)]'}`}>{option.label}</button>)}
    </div>
    <p className="text-[11px] text-[var(--muted-foreground)]">Choose one, several, or All.</p>
  </div>;
}

export function SelfAssessmentCenter({ adminMode = false }: { adminMode?: boolean }) {
  const setView = useAppStore((s) => s.setView);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [examType, setExamType] = useState('NEET');
  const [testType, setTestType] = useState('chapter');
  const [subjectNames, setSubjectNames] = useState<string[]>([]);
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [taxonomy, setTaxonomy] = useState<Taxonomy>({subjects:[],chapters:[],topics:[]});
  const [difficulties, setDifficulties] = useState<string[]>(['moderate']);
  const [count, setCount] = useState(20);

  async function load() {
    setLoading(true); setError('');
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    const { data: authUser } = await supabase.auth.getUser();
    const [{ data, error: rpcError }, subjectsResult, chaptersResult, topicsResult, analyticsResult] = await Promise.all([
      supabase.rpc('ensure_self_assessment_wallet_v14'),
      supabase.from('subjects').select('id,name').eq('is_active', true).is('organization_id', null).order('name'),
      supabase.from('chapters').select('id,name,subject_id').eq('is_active', true).is('organization_id', null).order('name'),
      supabase.from('topics').select('id,name,chapter_id').eq('is_active', true).is('organization_id', null).order('name'),
      authUser.user?.id ? supabase.rpc('get_student_analytics_v12', { p_student_id: authUser.user.id, p_product_id: null, p_date_from: null, p_date_to: null }) : Promise.resolve({data:null,error:null}),
    ]);
    const analytics = analyticsResult.data as {priorities?:Priority[]}|null;
    setPriority(analytics?.priorities?.[0] || null);
    if (rpcError) setError(rpcError.message); else setWallet((Array.isArray(data) ? data[0] : data) as Wallet);
    setTaxonomy({ subjects:(subjectsResult.data||[]) as Taxonomy['subjects'], chapters:(chaptersResult.data||[]) as Taxonomy['chapters'], topics:(topicsResult.data||[]) as Taxonomy['topics'] });
    setLoading(false);
  }
  useEffect(() => { if (!adminMode) void load(); else setLoading(false); }, [adminMode]);

  const subjectIds = useMemo(() => new Set(taxonomy.subjects.filter((s) => subjectNames.length === 0 || subjectNames.includes(s.name)).map((s) => s.id)), [subjectNames, taxonomy.subjects]);
  const visibleChapters = useMemo(() => taxonomy.chapters.filter((chapter) => subjectNames.length === 0 || subjectIds.has(chapter.subject_id)), [subjectIds, subjectNames.length, taxonomy.chapters]);
  const visibleChapterIds = useMemo(() => new Set(visibleChapters.map((chapter) => chapter.id)), [visibleChapters]);
  const visibleTopics = useMemo(() => taxonomy.topics.filter((topic) => (chapterIds.length ? chapterIds.includes(topic.chapter_id) : visibleChapterIds.has(topic.chapter_id))), [chapterIds, taxonomy.topics, visibleChapterIds]);

  useEffect(() => { setChapterIds((current) => current.filter((id) => visibleChapterIds.has(id))); }, [visibleChapterIds]);
  useEffect(() => { const allowed = new Set(visibleTopics.map((topic) => topic.id)); setTopicIds((current) => current.filter((id) => allowed.has(id))); }, [visibleTopics]);

  const max = useMemo(() => {
    if (testType === 'full_length_mock') return examType === 'NEET' ? 180 : examType === 'JEE Main' ? 75 : 100;
    if (testType === 'subject') return 45;
    if (testType === 'chapter') return 30;
    if (testType === 'topic') return 20;
    if (testType === 'weak_area') return 25;
    return 60;
  }, [examType, testType]);

  useEffect(() => { if (count > max) setCount(max); }, [count, max]);

  async function generate() {
    if (!supabase) return;
    setBusy(true); setError(''); setMessage(''); setGenerated(null);
    const { data, error: rpcError } = await supabase.rpc('generate_self_assessment_test_v14', {
      p_exam_type: examType,
      p_test_type: testType,
      p_subject_names: subjectNames,
      p_chapter_ids: chapterIds,
      p_topic_ids: topicIds,
      p_difficulties: difficulties,
      p_requested_count: Math.min(max, Math.max(1, count)),
    });
    if (rpcError) setError(rpcError.message);
    else { const value = data as Generated; setGenerated(value); setMessage(`Private self-assessment created with ${value.questionCount} questions.`); await load(); }
    setBusy(false);
  }

  if (adminMode) return <div className="space-y-6 p-4 md:p-6">
    <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">Self Assessment Governance</p><h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Automated student test credits</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]">School students receive 100 included self-assessment credits. Direct students receive credits from configured referral rewards or paid top-ups. Evidara selects approved questions server-side and adjusts generated test size to the chosen test type and available question evidence.</p></div>
    <div className="grid gap-4 md:grid-cols-3"><Card className="min-w-0 shadow-sm rounded-xl"><CardContent className="p-5"><Target className="h-5 w-5 text-[var(--teal)]"/><p className="mt-3 text-xs text-[var(--muted-foreground)]">School allowance</p><strong className="text-2xl">100 tests</strong></CardContent></Card><Card className="min-w-0 shadow-sm rounded-xl"><CardContent className="p-5"><Sparkles className="h-5 w-5 text-[var(--teal)]"/><p className="mt-3 text-xs text-[var(--muted-foreground)]">Referral bonus</p><strong className="text-2xl">Configurable</strong></CardContent></Card><Card className="min-w-0 shadow-sm rounded-xl"><CardContent className="p-5"><WalletCards className="h-5 w-5 text-[var(--teal)]"/><p className="mt-3 text-xs text-[var(--muted-foreground)]">Top-up product</p><strong className="text-2xl">₹50 / test</strong></CardContent></Card></div>
  </div>;

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin"/>Loading self-assessment wallet…</div>;
  return <div className="space-y-6 p-4 md:p-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--teal)]">Personal practice engine</p><h1 className="mt-2 text-2xl font-bold text-[var(--foreground)]">Self Assessment</h1><p className="mt-1 max-w-2xl text-sm text-[var(--muted-foreground)]">Choose one, several, or all subjects, chapters and topics. Evidara builds a private practice paper from approved questions.</p></div><Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4"/>Refresh</Button></div>
    {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}{message && <div className="rounded-xl border border-[var(--secondary)] bg-[var(--canvas)] p-3 text-sm text-[var(--teal)]">{message}</div>}
    <div className="grid gap-4 sm:grid-cols-3"><Card className="min-w-0 shadow-sm rounded-xl"><CardContent className="p-5"><WalletCards className="h-5 w-5 text-[var(--teal)]"/><p className="mt-3 text-xs text-[var(--muted-foreground)]">Credits remaining</p><strong className="text-3xl text-[var(--foreground)]">{wallet?.credits_balance ?? 0}</strong></CardContent></Card><Card className="min-w-0 shadow-sm rounded-xl"><CardContent className="p-5"><Sparkles className="h-5 w-5 text-[var(--teal)]"/><p className="mt-3 text-xs text-[var(--muted-foreground)]">Tests generated</p><strong className="text-3xl text-[var(--foreground)]">{wallet?.lifetime_used ?? 0}</strong></CardContent></Card><Card className="min-w-0 shadow-sm rounded-xl"><CardContent className="p-5"><BookOpen className="h-5 w-5 text-[var(--teal)]"/><p className="mt-3 text-xs text-[var(--muted-foreground)]">Access source</p><strong className="text-xl capitalize text-[var(--foreground)]">{wallet?.source_type ?? 'direct'}</strong></CardContent></Card></div>
    {(wallet?.credits_balance ?? 0) <= 5 && <Card className="shadow-sm rounded-xl border-[var(--amber)]/50 bg-[#FFFDF7]"><CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-[#8A5F00]">Running low on practice credits</strong><p className="mt-1 text-sm text-[var(--muted-foreground)]">Buy another self-assessment credit for ₹50 from the Store and keep practising.</p></div><Button onClick={() => setView('student-store')} className="bg-[var(--teal)] text-white">Buy credits</Button></CardContent></Card>}
    {priority && <Card className="shadow-sm rounded-xl border-[var(--teal)]/25 bg-[#F7FBFA]"><CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-wide text-[var(--teal)]">Personalized suggestion</p><strong className="mt-1 block text-[var(--foreground)]">Turn a weak area into a strength</strong><p className="mt-1 text-sm text-[var(--muted-foreground)]">{priority.topic_name || priority.chapter_name || priority.subject_name}{typeof priority.accuracy==='number'?` · ${Math.round(priority.accuracy)}% accuracy`:''}. {priority.action || 'Generate a focused practice test from your current evidence.'}</p></div><Button variant="outline" onClick={()=>{if(priority.subject_name)setSubjectNames([priority.subject_name]); if(priority.chapter_id)setChapterIds([priority.chapter_id]); if(priority.topic_id)setTopicIds([priority.topic_id]); setTestType(priority.topic_id?'topic':priority.chapter_id?'chapter':'weak_area'); setCount(15);}}>Use suggestion</Button></CardContent></Card>}
    <Card className="shadow-sm rounded-xl"><CardContent className="grid gap-5 p-5 md:grid-cols-2">
      <div className="min-w-0"><Label>Exam</Label><Select value={examType} onValueChange={setExamType}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="NEET">NEET</SelectItem><SelectItem value="JEE Main">JEE Main</SelectItem><SelectItem value="Custom">Custom</SelectItem></SelectContent></Select></div>
      <div className="min-w-0"><Label>Test type</Label><Select value={testType} onValueChange={setTestType}><SelectTrigger className="mt-1"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="full_length_mock">Full mock</SelectItem><SelectItem value="subject">Subject test</SelectItem><SelectItem value="chapter">Chapter test</SelectItem><SelectItem value="topic">Topic test</SelectItem><SelectItem value="weak_area">Weak-area practice</SelectItem><SelectItem value="mixed">Mixed practice</SelectItem></SelectContent></Select></div>
      <ChoiceGroup title="Subjects" allLabel="All subjects" selected={subjectNames} onChange={setSubjectNames} options={taxonomy.subjects.map((subject)=>({value:subject.name,label:subject.name}))}/>
      <ChoiceGroup title="Chapters" allLabel="All selected-subject chapters" selected={chapterIds} onChange={setChapterIds} options={visibleChapters.map((chapter)=>({value:chapter.id,label:chapter.name}))}/>
      <ChoiceGroup title="Topics" allLabel="All selected-chapter topics" selected={topicIds} onChange={setTopicIds} options={visibleTopics.map((topic)=>({value:topic.id,label:topic.name}))}/>
      <ChoiceGroup title="Difficulty" allLabel="All difficulties" selected={difficulties} onChange={setDifficulties} options={DIFFICULTIES.map((difficulty)=>({value:difficulty,label:difficulty.replaceAll('_',' ')}))}/>
      <div className="min-w-0"><Label>Number of questions</Label><Input type="number" min={1} max={max} className="mt-1" value={count} onChange={(e)=>setCount(Number(e.target.value)||1)}/><p className="mt-1 text-xs text-[var(--muted-foreground)]">Evidara may generate fewer questions when the selected scope has less approved material.</p></div>
      <div className="md:col-span-2"><Button disabled={busy || (wallet?.credits_balance ?? 0) < 1} onClick={() => void generate()} className="bg-[var(--teal)] text-white">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin"/> : <Sparkles className="mr-2 h-4 w-4"/>}Generate test · 1 credit</Button></div>
    </CardContent></Card>
    {generated && <Card className="shadow-sm rounded-xl border-[var(--teal)]/20"><CardContent className="p-5"><strong className="text-[var(--foreground)]">Your private test is ready</strong><p className="mt-1 text-sm text-[var(--muted-foreground)]">{generated.questionCount} questions · access code {generated.accessCode}</p><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => setView('student-tests')} className="bg-[var(--teal)] text-white">Open My Tests</Button><Button variant="outline" onClick={() => navigator.clipboard.writeText(generated.accessCode)}>Copy access code</Button></div></CardContent></Card>}
  </div>;
}
