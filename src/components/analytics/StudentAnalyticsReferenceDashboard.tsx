'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Crosshair,
  FileQuestion,
  Gauge,
  History,
  Home,
  Layers3,
  LoaderCircle,
  Plus,
  RefreshCw,
  Tag,
  Target,
  Trash2,
  Trophy,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import type {
  AnalyticsTrendRow,
  StudentAnalyticsPayload,
  SubjectAnalyticsRow,
} from '@/types/analytics';
import type { StudentTaxonomyAnalyticsPayload, TaxonomyComparisonRow } from '@/types/analytics-phase4';
import type { StudentTestReview } from '@/types/analytics-phase3';
import type {
  ReferenceDifficultyRow,
  ReferenceQuestionTypeRow,
  ReferenceTaxonomyDetailPayload,
  ReferenceTaxonomyDetailRow,
  StudentAnalyticsGoal,
  StudentReferenceBreakdowns,
} from '@/types/question-collections';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

type View = 'overview' | 'subject' | 'chapter' | 'topic' | 'practice' | 'history' | 'goals';
type Mode = 'marks' | 'percentage' | 'percentile';
type SeriesKey = 'student' | 'average' | 'top10' | 'top5' | 'highest';
type ScopedDifficultyRow = ReferenceDifficultyRow & { chapter_id?: string | null; chapter_name?: string | null; topic_id?: string | null; topic_name?: string | null };
type ScopedTypeRow = ReferenceQuestionTypeRow & { chapter_id?: string | null; chapter_name?: string | null; topic_id?: string | null; topic_name?: string | null };
type ScopedPayload = { difficulty: ScopedDifficultyRow[]; question_types: ScopedTypeRow[]; generated_at: string };

type TaxonomyRow = ReferenceTaxonomyDetailRow & {
  average?: number | null;
  top10?: number | null;
  top5?: number | null;
  highest?: number | null;
  students_compared?: number | null;
};

const seriesStyle: Record<SeriesKey, { label: string; color: string; dash?: string }> = {
  student: { label: 'Your result', color: '#006B70' },
  average: { label: 'Average', color: '#8998A8', dash: '6 5' },
  top10: { label: 'Top 10%', color: '#2E87C8', dash: '4 4' },
  top5: { label: 'Top 5%', color: '#7B61A8', dash: '3 4' },
  highest: { label: 'Highest', color: '#F3A600' },
};

const navItems: Array<{ key: View; label: string; icon: typeof Home }> = [
  { key: 'overview', label: 'Overview', icon: Home },
  { key: 'subject', label: 'Subjects', icon: BookOpen },
  { key: 'chapter', label: 'Chapters', icon: Layers3 },
  { key: 'topic', label: 'Topics', icon: Tag },
  { key: 'practice', label: 'Practice', icon: Crosshair },
  { key: 'history', label: 'Test History', icon: History },
  { key: 'goals', label: 'Goals', icon: Target },
];

const difficultyOrder = ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'];
const difficultyLabel: Record<string, string> = {
  very_easy: 'Very easy', easy: 'Easy', moderate: 'Moderate', difficult: 'Difficult', very_difficult: 'Very difficult',
};
const questionTypeLabel: Record<string, string> = {
  single_correct: 'Single-correct MCQ', multiple_correct: 'Multiple-correct MCQ', numerical: 'Numerical value', integer: 'Integer answer',
  assertion_reason: 'Assertion and reason', match_following: 'Match the following', passage: 'Passage based', image_based: 'Image based',
};

function n(value?: number | null) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function one(value?: number | null) { return value == null ? '—' : Number(value).toFixed(1); }
function shortDate(value?: string | null) { return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }
function timeText(seconds?: number | null) { const total = Math.max(0, Number(seconds || 0)); return total >= 60 ? `${(total / 60).toFixed(1)} min` : `${Math.round(total)} sec`; }
function percentWidth(value?: number | null, max = 100) { return `${Math.max(0, Math.min(100, n(value) / max * 100))}%`; }
function heatClass(value: number) { return value >= 75 ? 'reference-heat-good' : value >= 55 ? 'reference-heat-mid' : 'reference-heat-low'; }

function mergeTaxonomy(detail: ReferenceTaxonomyDetailRow[], comparison: TaxonomyComparisonRow[]) {
  return detail.map((row) => {
    const match = comparison.find((item) =>
      (row.topic_id && item.id === row.topic_id)
      || (row.chapter_id && item.id === row.chapter_id)
      || (item.subject_name === row.subject_name && item.chapter_name === row.chapter_name && (!row.topic_name || item.topic_name === row.topic_name)));
    return { ...row, average: match?.average, top10: match?.top10, top5: match?.top5, highest: match?.highest, students_compared: match?.students_compared } as TaxonomyRow;
  });
}

function aggregateBreakdown<T extends ScopedDifficultyRow | ScopedTypeRow>(rows: T[], key: 'difficulty' | 'question_type') {
  const map = new Map<string, T>();
  rows.forEach((row) => {
    const label = String(row[key]);
    const existing = map.get(label);
    if (!existing) { map.set(label, { ...row }); return; }
    const questions = existing.questions + row.questions;
    const correct = existing.correct + row.correct;
    const incorrect = existing.incorrect + row.incorrect;
    const unanswered = existing.unanswered + row.unanswered;
    map.set(label, {
      ...existing,
      questions,
      correct,
      incorrect,
      unanswered,
      percentage: questions ? correct / questions * 100 : 0,
      average_time_seconds: questions ? (existing.average_time_seconds * existing.questions + row.average_time_seconds * row.questions) / questions : 0,
    });
  });
  return [...map.values()];
}

function SeriesButtons({ visible, setVisible }: { visible: Record<SeriesKey, boolean>; setVisible: React.Dispatch<React.SetStateAction<Record<SeriesKey, boolean>>> }) {
  return <div className="reference-series-toggle">{(Object.keys(seriesStyle) as SeriesKey[]).map((key) => <button key={key} type="button" className={visible[key] ? 'active' : ''} onClick={() => setVisible((current) => {
    if (current[key] && Object.values(current).filter(Boolean).length === 1) return current;
    return { ...current, [key]: !current[key] };
  })}>{seriesStyle[key].label}</button>)}</div>;
}

function MetricCard({ icon: Icon, tone = '', label, value, copy, delta }: { icon: typeof Activity; tone?: string; label: string; value: React.ReactNode; copy: string; delta?: string }) {
  return <article className="reference-card reference-metric"><div className={`reference-metric-icon ${tone}`}><Icon /></div><div className="min-w-0"><div className="reference-metric-label">{label}</div><div className="reference-metric-value">{value}</div><div className="reference-metric-copy">{copy}</div>{delta && <div className="reference-metric-delta">{delta}</div>}</div></article>;
}

export function StudentAnalyticsReferenceDashboard({ studentId, onBack }: { studentId: string; onBack?: () => void }) {
  const setAppView = useAppStore((state) => state.setView);
  const [view, setView] = useState<View>('overview');
  const [mode, setMode] = useState<Mode>('percentage');
  const [productId, setProductId] = useState('all');
  const [core, setCore] = useState<StudentAnalyticsPayload | null>(null);
  const [taxonomy, setTaxonomy] = useState<StudentTaxonomyAnalyticsPayload | null>(null);
  const [detail, setDetail] = useState<ReferenceTaxonomyDetailPayload | null>(null);
  const [breakdowns, setBreakdowns] = useState<StudentReferenceBreakdowns | null>(null);
  const [scoped, setScoped] = useState<ScopedPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [topicId, setTopicId] = useState('');
  const [seriesVisible, setSeriesVisible] = useState<Record<SeriesKey, boolean>>({ student: true, average: true, top10: true, top5: true, highest: true });
  const [review, setReview] = useState<StudentTestReview | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalForm, setGoalForm] = useState({ id: '', title: '', metric: 'percentage', target: '75', dueDate: '', notes: '', status: 'active' });

  const load = useCallback(async () => {
    if (!supabase) { setError('Connect Supabase and apply migrations through 39c.'); setLoading(false); return; }
    setLoading(true); setError('');
    const product = productId === 'all' ? null : productId;
    const [coreResult, taxonomyResult, detailResult, breakdownResult, scopedResult] = await Promise.all([
      supabase.rpc('get_student_analytics_overview_v11', { p_student_id: studentId, p_product_id: product, p_from: null, p_to: null }),
      supabase.rpc('get_student_taxonomy_analytics_v12', { p_student_id: studentId, p_product_id: product }),
      supabase.rpc('get_student_reference_taxonomy_detail_v13', { p_student_id: studentId, p_product_id: product }),
      supabase.rpc('get_student_reference_breakdowns_v13', { p_student_id: studentId, p_product_id: product }),
      supabase.rpc('get_student_reference_scoped_breakdowns_v13', { p_student_id: studentId, p_product_id: product }),
    ]);
    const loadError = coreResult.error || taxonomyResult.error || detailResult.error || breakdownResult.error || scopedResult.error;
    if (loadError) setError(loadError.message.includes('get_student_reference') ? 'Apply migrations 39, 39a, 39b and 39c, then refresh.' : loadError.message);
    else {
      setCore(coreResult.data as StudentAnalyticsPayload);
      setTaxonomy(taxonomyResult.data as StudentTaxonomyAnalyticsPayload);
      setDetail(detailResult.data as ReferenceTaxonomyDetailPayload);
      setBreakdowns(breakdownResult.data as StudentReferenceBreakdowns);
      setScoped(scopedResult.data as ScopedPayload);
    }
    setLoading(false);
  }, [productId, studentId]);

  useEffect(() => { void load(); }, [load]);

  const chapterRows = useMemo(() => mergeTaxonomy(detail?.chapters || [], taxonomy?.chapters || []), [detail, taxonomy]);
  const topicRows = useMemo(() => mergeTaxonomy(detail?.topics || [], taxonomy?.topics || []), [detail, taxonomy]);
  const subjects = useMemo(() => Array.from(new Set([...(core?.subjects || []).map((row) => row.subject_name), ...chapterRows.map((row) => row.subject_name)])).sort(), [chapterRows, core]);

  useEffect(() => {
    if (!subjects.length) return;
    if (!subject || !subjects.includes(subject)) setSubject(subjects[0]);
  }, [subject, subjects]);

  const subjectChapters = chapterRows.filter((row) => row.subject_name === subject);
  useEffect(() => {
    if (!subjectChapters.length) { setChapterId(''); return; }
    if (!subjectChapters.some((row) => row.chapter_id === chapterId)) setChapterId(subjectChapters[0].chapter_id || subjectChapters[0].id);
  }, [chapterId, subjectChapters]);

  const chapterTopics = topicRows.filter((row) => row.subject_name === subject && (!chapterId || row.chapter_id === chapterId));
  useEffect(() => {
    if (!chapterTopics.length) { setTopicId(''); return; }
    if (!chapterTopics.some((row) => row.topic_id === topicId)) setTopicId(chapterTopics[0].topic_id || chapterTopics[0].id);
  }, [chapterTopics, topicId]);

  const summary = core?.summary;
  const selectedProduct = core?.products?.find((product) => product.id === productId) || null;
  const subjectRow = core?.subjects?.find((row) => row.subject_name === subject) || null;
  const chapterRow = subjectChapters.find((row) => (row.chapter_id || row.id) === chapterId) || subjectChapters[0] || null;
  const topicRow = chapterTopics.find((row) => (row.topic_id || row.id) === topicId) || chapterTopics[0] || null;
  const totalMarks = (core?.subjects || []).reduce((sum, row) => sum + n(row.student_marks), 0);
  const maximumMarks = (core?.subjects || []).reduce((sum, row) => sum + n(row.maximum_marks), 0);

  const filterScoped = <T extends ScopedDifficultyRow | ScopedTypeRow>(rows: T[], level: View) => rows.filter((row) => {
    if (row.subject_name !== subject) return false;
    if (level === 'chapter') return !chapterId || row.chapter_id === chapterId;
    if (level === 'topic') return !topicId || row.topic_id === topicId;
    return true;
  });
  const subjectDifficulty = aggregateBreakdown(filterScoped(scoped?.difficulty || [], 'subject'), 'difficulty').sort((a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty));
  const chapterDifficulty = aggregateBreakdown(filterScoped(scoped?.difficulty || [], 'chapter'), 'difficulty').sort((a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty));
  const topicDifficulty = aggregateBreakdown(filterScoped(scoped?.difficulty || [], 'topic'), 'difficulty').sort((a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty));
  const subjectTypes = aggregateBreakdown(filterScoped(scoped?.question_types || [], 'subject'), 'question_type');
  const topicTypes = aggregateBreakdown(filterScoped(scoped?.question_types || [], 'topic'), 'question_type');
  const topicTags = (breakdowns?.tags || []).filter((row) => row.subject_name === subject && (!chapterRow?.chapter_name || row.chapter_name === chapterRow.chapter_name) && (!topicRow?.topic_name || row.topic_name === topicRow.topic_name));
  const topicWrong = (breakdowns?.incorrect_questions || []).filter((row) => row.subject_name === subject && (!chapterRow?.chapter_name || row.chapter_name === chapterRow.chapter_name) && (!topicRow?.topic_name || row.topic_name === topicRow.topic_name));

  const subjectChart = (core?.subjects || []).map((row) => ({
    name: row.subject_name,
    student: mode === 'marks' ? row.student_marks : mode === 'percentage' ? row.student_percentage : null,
    average: mode === 'marks' ? n(row.average_percentage) * row.maximum_marks / 100 : mode === 'percentage' ? row.average_percentage : 50,
    top10: mode === 'marks' ? n(row.top10_threshold) * row.maximum_marks / 100 : mode === 'percentage' ? row.top10_threshold : 90,
    top5: mode === 'marks' ? n(row.top5_threshold) * row.maximum_marks / 100 : mode === 'percentage' ? row.top5_threshold : 95,
    highest: mode === 'marks' ? n(row.highest_percentage) * row.maximum_marks / 100 : mode === 'percentage' ? row.highest_percentage : 100,
  }));

  const trendChart = (core?.trends || []).map((row) => {
    const max = n(row.maximum_marks);
    if (mode === 'marks') return { label: shortDate(row.submitted_at), student: row.score, average: n(row.percentage_average) * max / 100, top10: n(row.percentage_top10) * max / 100, top5: n(row.percentage_top5) * max / 100, highest: n(row.percentage_highest) * max / 100 };
    if (mode === 'percentile') return { label: shortDate(row.submitted_at), student: row.student_percentile, average: 50, top10: 90, top5: 95, highest: 100 };
    return { label: shortDate(row.submitted_at), student: row.percentage, average: row.percentage_average, top10: row.percentage_top10, top5: row.percentage_top5, highest: row.percentage_highest };
  });

  const overviewScore = mode === 'marks' ? `${one(totalMarks)} / ${one(maximumMarks)}` : mode === 'percentile' ? (summary?.percentile_available ? one(summary.average_percentile) : 'Locked') : `${one(summary?.average_percentage)}%`;
  const chapterMetricValue = (row: TaxonomyRow | null) => mode === 'marks' ? row ? `${one(row.marks_awarded)} / ${one(row.maximum_marks)}` : '—' : mode === 'percentage' ? `${one(row?.percentage)}%` : 'Available at completed-series level';

  async function openReview(row: AnalyticsTrendRow) {
    if (!supabase) return;
    setReviewLoading(true); setReviewOpen(true); setReview(null);
    const { data, error: reviewError } = await supabase.rpc('get_student_test_review_v12', { p_student_id: studentId, p_paper_id: row.paper_id });
    setReviewLoading(false);
    if (reviewError) setError(reviewError.message); else setReview(data as StudentTestReview);
  }

  function startPractice(paperId?: string | null, published?: string | null) {
    if (!paperId || published !== 'published') { setMessage('This collection is available for review, but its linked practice paper is not published yet.'); return; }
    window.history.replaceState({}, '', `${window.location.pathname}?id=${encodeURIComponent(paperId)}`);
    setAppView('student-tests');
  }

  function openGoal(goal?: StudentAnalyticsGoal) {
    setGoalForm(goal ? { id: goal.id, title: goal.title, metric: goal.metric, target: String(goal.target_value), dueDate: goal.due_date || '', notes: goal.notes || '', status: goal.status } : { id: '', title: '', metric: 'percentage', target: '75', dueDate: '', notes: '', status: 'active' });
    setGoalOpen(true);
  }

  async function saveGoal() {
    if (!supabase) return;
    if (goalForm.title.trim().length < 3) { setError('Enter a complete goal title.'); return; }
    setGoalSaving(true);
    const current = goalForm.metric === 'percentage' ? summary?.average_percentage : goalForm.metric === 'accuracy' ? summary?.accuracy : goalForm.metric === 'time_score' ? summary?.time_score : summary?.completed_tests;
    const { error: goalError } = await supabase.rpc('upsert_student_analytics_goal_v13', {
      p_goal_id: goalForm.id || null,
      p_student_id: studentId,
      p_payload: { title: goalForm.title.trim(), metric: goalForm.metric, target_value: Number(goalForm.target), current_value: current, due_date: goalForm.dueDate, status: goalForm.status, notes: goalForm.notes, product_id: productId === 'all' ? '' : productId, subject_name: subject },
    });
    setGoalSaving(false);
    if (goalError) setError(goalError.message); else { setGoalOpen(false); setMessage('Goal saved.'); await load(); }
  }

  async function deleteGoal(goal: StudentAnalyticsGoal) {
    if (!supabase) return;
    const { error: goalError } = await supabase.rpc('delete_student_analytics_goal_v13', { p_goal_id: goal.id, p_student_id: studentId });
    if (goalError) setError(goalError.message); else { setMessage('Goal deleted.'); await load(); }
  }

  const heading: Record<View, [string, string]> = {
    overview: ['How you performed', `Your performance summary across ${subjects.length || 0} subjects.`],
    subject: ['Subject analysis', 'Deep dive into your performance using live chapter, difficulty and question-format evidence.'],
    chapter: ['Chapter analysis', 'See how you performed in this chapter and each mapped topic.'],
    topic: ['Topic analysis', 'Inspect question formats, difficulty, tags and incorrect responses for this topic.'],
    practice: ['Practice centre', 'Open reusable Question Collections that have been converted into published practice papers.'],
    history: ['Test history', 'Review every latest submitted result and open the complete answer evidence.'],
    goals: ['Goals', 'Set measurable targets using the current live analytics value as the starting point.'],
  };

  if (loading && !core) return <div className="reference-analytics reference-empty"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Building the complete analytics workspace…</div></div>;

  return <div className="reference-analytics">
    <div className="reference-shell">
      <aside className="reference-nav"><div className="reference-nav-title">Student analytics</div>{navItems.map(({ key, label, icon: Icon }) => <button type="button" key={key} onClick={() => setView(key)} className={`reference-nav-button ${view === key ? 'active' : ''}`}><Icon />{label}</button>)}</aside>
      <main className="reference-content">
        <section className="reference-topbar"><div className="reference-title"><h1>{heading[view][0]}</h1><p>{heading[view][1]}</p>{onBack && <Button className="mt-3" size="sm" variant="outline" onClick={onBack}>Back to students</Button>}</div><div className="reference-filters"><Select value={productId} onValueChange={setProductId}><SelectTrigger className="min-w-[280px] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All assessments</SelectItem>{(core?.products || []).map((product) => <SelectItem key={product.id} value={product.id}>{product.name} · {product.completed_tests}/{product.total_tests}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button></div></section>
        {['overview','subject','chapter','topic'].includes(view) && <div className="reference-mode">{(['marks','percentage','percentile'] as Mode[]).map((item) => <button type="button" key={item} onClick={() => setMode(item)} className={mode === item ? 'active' : ''}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>}
        {error && <div className="mb-4 rounded-xl border border-[#DC4545]/20 bg-[#FFF0EF] p-4 text-sm text-[#B54747]">{error}</div>}
        {message && <div className="mb-4 rounded-xl border border-[#178353]/20 bg-[#EAF7EF] p-4 text-sm text-[#176C48]">{message}</div>}

        {view === 'overview' && <>
          <section className="reference-metrics">
            <MetricCard icon={Target} label="Overall score" value={overviewScore} copy={mode === 'marks' ? 'Total marks from the latest result in every selected test.' : mode === 'percentile' ? 'Average test percentile unlocks after the selected compulsory series is complete.' : `Average of ${summary?.completed_tests || 0} distinct latest test results.`} />
            <MetricCard icon={Trophy} tone="amber" label="Percentile" value={summary?.percentile_available ? one(summary.average_percentile) : 'Locked'} copy={summary?.percentile_available ? `Compared with up to ${summary.cohort_size || 0} students per test.` : selectedProduct ? `${selectedProduct.completed_tests}/${selectedProduct.total_tests} compulsory tests completed.` : 'Select one complete series to unlock.'} />
            <MetricCard icon={CheckCircle2} label="Accuracy" value={`${one(summary?.accuracy)}%`} copy={`${summary?.correct || 0} right · ${summary?.incorrect || 0} wrong · ${summary?.unanswered || 0} unanswered.`} />
            <MetricCard icon={Gauge} tone="amber" label="Time management" value={<>{one(summary?.time_score)} <small>/ 10</small></>} copy="Simple completion, accuracy-control and timeout indicator. No per-question target time is used." />
          </section>
          <SeriesButtons visible={seriesVisible} setVisible={setSeriesVisible} />
          <section className="reference-grid-3">
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Performance profile</h3><p>Subject result against live comparison thresholds.</p></div></div><div className="reference-chart"><ResponsiveContainer width="100%" height="100%"><RadarChart data={subjectChart}><PolarGrid stroke="#DFE6EC" /><PolarAngleAxis dataKey="name" tick={{ fontSize: 10, fill: '#536579' }} /><PolarRadiusAxis domain={[0, mode === 'marks' ? Math.max(1, ...subjectChart.map((row) => n(row.highest))) : 100]} tick={{ fontSize: 9 }} />{(Object.keys(seriesStyle) as SeriesKey[]).map((key) => seriesVisible[key] && <Radar key={key} dataKey={key} name={seriesStyle[key].label} stroke={seriesStyle[key].color} fill={key === 'student' ? seriesStyle[key].color : 'transparent'} fillOpacity={key === 'student' ? .12 : 0} strokeWidth={key === 'student' ? 3 : 2} strokeDasharray={seriesStyle[key].dash} />)}<Legend /><ChartTooltip /></RadarChart></ResponsiveContainer></div></article>
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Subject comparison</h3><p>Select a bar or use Subjects for detailed analysis.</p></div></div><div className="reference-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={subjectChart} layout="vertical" margin={{ left: 8, right: 18 }}><CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" /><XAxis type="number" /><YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} /><ChartTooltip /><Legend />{seriesVisible.student && <Bar dataKey="student" name="Your result" fill="#006B70" radius={[0,4,4,0]} />}{seriesVisible.average && <Bar dataKey="average" name="Average" fill="#B7C3CC" radius={[0,4,4,0]} />}</BarChart></ResponsiveContainer></div></article>
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Performance trend</h3><p>Latest result from each completed test.</p></div></div><div className="reference-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendChart}><CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" /><XAxis dataKey="label" tick={{ fontSize: 9 }} /><YAxis domain={[0, mode === 'marks' ? 'auto' : 100]} /><ChartTooltip /><Legend />{(Object.keys(seriesStyle) as SeriesKey[]).map((key) => seriesVisible[key] && <Line key={key} type="monotone" dataKey={key} name={seriesStyle[key].label} stroke={seriesStyle[key].color} strokeWidth={key === 'student' ? 3 : 1.8} strokeDasharray={seriesStyle[key].dash} dot={key === 'student'} connectNulls />)}</LineChart></ResponsiveContainer></div></article>
          </section>
          <div className="reference-note">Every number on this screen comes from the latest submitted result per test. Repeated attempts do not inflate completed-test counts, answer totals or comparison lines.</div>
        </>}

        {view === 'subject' && <>
          <section className="reference-card reference-selector-strip"><span className="reference-selector-label">Select a subject</span>{subjects.map((item) => <button type="button" key={item} className={`reference-subject-tab ${subject === item ? 'active' : ''}`} onClick={() => setSubject(item)}><BookOpen className="h-4 w-4" />{item}</button>)}</section>
          <section className="reference-metrics">
            <MetricCard icon={Target} label="Subject score" value={mode === 'marks' ? `${one(subjectRow?.student_marks)} / ${one(subjectRow?.maximum_marks)}` : mode === 'percentage' ? `${one(subjectRow?.student_percentage)}%` : 'Series percentile only'} copy={`${subjectRow?.questions || 0} questions in the selected evidence.`} />
            <MetricCard icon={CheckCircle2} label="Accuracy" value={`${one(subjectRow?.student_accuracy)}%`} copy={`${subjectRow?.correct || 0} correct of ${subjectRow?.questions || 0} total questions.`} />
            <MetricCard icon={Gauge} tone="amber" label="Time score" value={<>{one(subjectRow?.student_time_score)} <small>/ 10</small></>} copy="Shown only when the selected product has enough completed evidence." />
            <MetricCard icon={BarChart3} tone="blue" label="Students compared" value={subjectRow?.cohort_size || 0} copy={`Average ${one(subjectRow?.average_percentage)}% · Top 10% ${one(subjectRow?.top10_threshold)}%.`} />
          </section>
          <section className="reference-grid-2">
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Chapter mastery</h3><p>Your result and the average marker for every mapped chapter.</p></div></div><div className="reference-mastery-list">{subjectChapters.map((row) => <button key={row.id} type="button" className="reference-mastery-row" onClick={() => { setChapterId(row.chapter_id || row.id); setView('chapter'); }}><span className="reference-mastery-label">{row.chapter_name}</span><span className="reference-track"><span className={`reference-fill ${row.percentage < 70 ? 'attention' : ''}`} style={{ width: percentWidth(row.percentage) }} />{row.average != null && <span className="reference-marker" style={{ left: percentWidth(row.average), background: '#8998A8' }} />}</span><strong className="reference-score">{mode === 'marks' ? `${one(row.marks_awarded)}/${one(row.maximum_marks)}` : `${one(row.percentage)}%`}</strong><span className={`reference-gap ${n(row.percentage) - n(row.average) < 0 ? 'down' : ''}`}>{n(row.percentage) - n(row.average) >= 0 ? '▲' : '▼'} {Math.abs(n(row.percentage) - n(row.average)).toFixed(1)}</span></button>)}</div></article>
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Question format performance</h3><p>Live results by the question formats actually attempted.</p></div></div><table className="reference-heat"><thead><tr><th>Question format</th><th>Questions</th><th>Correct</th><th>Accuracy</th><th>Avg time</th></tr></thead><tbody>{subjectTypes.map((row) => <tr key={row.question_type}><td>{questionTypeLabel[row.question_type] || row.question_type}</td><td>{row.questions}</td><td>{row.correct}</td><td className={heatClass(row.percentage)}>{one(row.percentage)}%</td><td>{timeText(row.average_time_seconds)}</td></tr>)}</tbody></table></article>
          </section>
          <section className="reference-grid-2"><article className="reference-card reference-panel compact"><div className="reference-panel-head"><div><h3>Question difficulty</h3><p>Correct answers divided by all questions at each difficulty.</p></div></div><div className="reference-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={subjectDifficulty.map((row) => ({ ...row, name: difficultyLabel[row.difficulty] || row.difficulty }))}><CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0,100]} /><ChartTooltip /><Bar dataKey="percentage" name="Accuracy" fill="#006B70" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></article><article className="reference-card reference-panel compact"><div className="reference-panel-head"><div><h3>Evidence summary</h3><p>Factual observations only; no automated recommendation is generated.</p></div></div>{subjectChapters.length ? <div className="space-y-4 text-sm text-[#536579]"><p><strong className="text-[#071D34]">Highest chapter:</strong> {[...subjectChapters].sort((a,b) => b.percentage-a.percentage)[0]?.chapter_name} ({one([...subjectChapters].sort((a,b) => b.percentage-a.percentage)[0]?.percentage)}%)</p><p><strong className="text-[#071D34]">Lowest chapter:</strong> {[...subjectChapters].sort((a,b) => a.percentage-b.percentage)[0]?.chapter_name} ({one([...subjectChapters].sort((a,b) => a.percentage-b.percentage)[0]?.percentage)}%)</p><p><strong className="text-[#071D34]">Mapped evidence:</strong> {subjectChapters.reduce((sum,row)=>sum+row.questions,0)} responses across {subjectChapters.length} chapters.</p></div> : <div className="reference-empty">No mapped chapter evidence is available.</div>}</article></section>
        </>}

        {view === 'chapter' && <>
          <div className="reference-crumbs"><div className="reference-crumb"><BookOpen className="h-5 w-5 text-[#2E87C8]" /><div className="w-full"><small>Subject</small><Select value={subject} onValueChange={setSubject}><SelectTrigger className="h-7 border-0 p-0 shadow-none"><SelectValue /></SelectTrigger><SelectContent>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div><div className="reference-crumb"><Layers3 className="h-5 w-5 text-[#178353]" /><div className="w-full"><small>Chapter</small><Select value={chapterId} onValueChange={setChapterId}><SelectTrigger className="h-7 border-0 p-0 shadow-none"><SelectValue /></SelectTrigger><SelectContent>{subjectChapters.map((row) => <SelectItem key={row.id} value={row.chapter_id || row.id}>{row.chapter_name}</SelectItem>)}</SelectContent></Select></div></div></div>
          <section className="reference-card reference-chapter-tabs">{subjectChapters.map((row) => <button key={row.id} type="button" className={`reference-chapter-tab ${(row.chapter_id || row.id) === chapterId ? 'active' : ''}`} onClick={() => setChapterId(row.chapter_id || row.id)}>{row.chapter_name}</button>)}</section>
          <section className="reference-metrics"><MetricCard icon={Target} label="Chapter score" value={chapterMetricValue(chapterRow)} copy={`${chapterRow?.questions || 0} mapped questions.`} /><MetricCard icon={CheckCircle2} label="Accuracy" value={`${one(chapterRow?.accuracy)}%`} copy={`${chapterRow?.correct || 0} correct · ${chapterRow?.incorrect || 0} wrong.`} /><MetricCard icon={Activity} tone="blue" label="Attempt rate" value={`${one(chapterRow?.attempt_rate)}%`} copy={`${(chapterRow?.correct || 0)+(chapterRow?.incorrect || 0)} attempted of ${chapterRow?.questions || 0}.`} /><MetricCard icon={Clock3} tone="amber" label="Average response time" value={timeText(chapterRow?.average_time_seconds)} copy="Observed response time; no target time is assigned." /></section>
          <section className="reference-grid-chapter">
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Topic mastery within {chapterRow?.chapter_name || 'chapter'}</h3><p>Select a topic for the full detail page.</p></div></div><div className="reference-mastery-list">{chapterTopics.map((row) => <button key={row.id} type="button" className="reference-mastery-row" onClick={() => { setTopicId(row.topic_id || row.id); setView('topic'); }}><span className="reference-mastery-label">{row.topic_name}</span><span className="reference-track"><span className={`reference-fill ${row.percentage < 70 ? 'attention' : ''}`} style={{ width: percentWidth(row.percentage) }} />{row.average != null && <span className="reference-marker" style={{ left: percentWidth(row.average), background: '#8998A8' }} />}</span><strong className="reference-score">{mode === 'marks' ? `${one(row.marks_awarded)}/${one(row.maximum_marks)}` : `${one(row.percentage)}%`}</strong><span className={`reference-gap ${n(row.percentage)-n(row.average)<0?'down':''}`}>{n(row.percentage)-n(row.average)>=0?'▲':'▼'} {Math.abs(n(row.percentage)-n(row.average)).toFixed(1)}</span></button>)}</div></article>
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Accuracy vs response time</h3><p>Observed values by topic.</p></div></div><div className="reference-chart"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={chapterTopics.map((row) => ({ name: row.topic_name, accuracy: row.accuracy, time: row.average_time_seconds / 60 }))}><CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" /><XAxis dataKey="name" tick={{ fontSize: 9 }} /><YAxis yAxisId="left" domain={[0,100]} /><YAxis yAxisId="right" orientation="right" /><ChartTooltip /><Legend /><Bar yAxisId="left" dataKey="accuracy" name="Accuracy %" fill="#178353" radius={[4,4,0,0]} /><Line yAxisId="right" type="monotone" dataKey="time" name="Avg minutes" stroke="#F3A600" strokeWidth={2.5} /></ComposedChart></ResponsiveContainer></div></article>
            <article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Answer breakdown</h3><p>Correct, wrong and unanswered evidence by topic.</p></div></div><div className="space-y-4">{chapterTopics.map((row) => { const total=Math.max(1,row.questions); return <div key={row.id}><div className="mb-2 flex justify-between text-[11px]"><span>{row.topic_name}</span><strong>{row.questions} questions</strong></div><div className="reference-answer-stack"><span className="correct" style={{ width: `${row.correct/total*100}%` }}>{row.correct}</span><span className="wrong" style={{ width: `${row.incorrect/total*100}%` }}>{row.incorrect}</span><span className="unanswered" style={{ width: `${row.unanswered/total*100}%` }}>{row.unanswered}</span></div></div>; })}</div></article>
          </section>
          <div className="reference-note">Error labels such as “concept,” “calculation” or “careless” are not displayed because the current response table does not record those causes. The dashboard shows only correct, wrong and unanswered evidence.</div>
        </>}

        {view === 'topic' && <>
          <div className="reference-crumbs"><div className="reference-crumb"><BookOpen className="h-5 w-5 text-[#2E87C8]" /><div className="w-full"><small>Subject</small><Select value={subject} onValueChange={setSubject}><SelectTrigger className="h-7 border-0 p-0 shadow-none"><SelectValue /></SelectTrigger><SelectContent>{subjects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div></div><div className="reference-crumb"><Layers3 className="h-5 w-5 text-[#178353]" /><div className="w-full"><small>Chapter</small><Select value={chapterId} onValueChange={setChapterId}><SelectTrigger className="h-7 border-0 p-0 shadow-none"><SelectValue /></SelectTrigger><SelectContent>{subjectChapters.map((row) => <SelectItem key={row.id} value={row.chapter_id || row.id}>{row.chapter_name}</SelectItem>)}</SelectContent></Select></div></div><div className="reference-crumb"><Tag className="h-5 w-5 text-[#F3A600]" /><div className="w-full"><small>Topic</small><Select value={topicId} onValueChange={setTopicId}><SelectTrigger className="h-7 border-0 p-0 shadow-none"><SelectValue /></SelectTrigger><SelectContent>{chapterTopics.map((row) => <SelectItem key={row.id} value={row.topic_id || row.id}>{row.topic_name}</SelectItem>)}</SelectContent></Select></div></div></div>
          <section className="reference-metrics"><MetricCard icon={Target} label="Topic score" value={chapterMetricValue(topicRow)} copy={`${topicRow?.questions || 0} mapped questions.`} /><MetricCard icon={CheckCircle2} label="Accuracy" value={`${one(topicRow?.accuracy)}%`} copy={`${topicRow?.correct || 0} correct · ${topicRow?.incorrect || 0} wrong · ${topicRow?.unanswered || 0} unanswered.`} /><MetricCard icon={Clock3} tone="amber" label="Average response time" value={timeText(topicRow?.average_time_seconds)} copy="Observed time only; it is not compared with a question target." /><MetricCard icon={FileQuestion} tone="blue" label="Evidence coverage" value={topicRow?.questions || 0} copy="Questions included in the latest selected-test evidence." /></section>
          <section className="reference-grid-2"><article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Question-tag mastery</h3><p>Question tags are used as live sub-concept labels where available.</p></div></div><div className="reference-mastery-list">{topicTags.length ? topicTags.map((row) => <div key={row.name} className="reference-mastery-row"><span className="reference-mastery-label">{row.name}</span><span className="reference-track"><span className={`reference-fill ${row.percentage < 65 ? 'attention' : ''}`} style={{ width: percentWidth(row.percentage) }} /></span><strong className="reference-score">{one(row.percentage)}%</strong><span className="reference-gap">{row.questions} Q</span></div>) : <div className="reference-empty">No question tags are available for this topic.</div>}</div></article><article className="reference-card reference-panel"><div className="reference-panel-head"><div><h3>Difficulty analysis</h3><p>Performance at each recorded difficulty level.</p></div></div><div className="reference-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={topicDifficulty.map((row) => ({ ...row, name: difficultyLabel[row.difficulty] || row.difficulty }))}><CartesianGrid strokeDasharray="3 3" stroke="#E8EDF1" /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis domain={[0,100]} /><ChartTooltip /><Bar dataKey="percentage" name="Accuracy" fill="#006B70" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div></article></section>
          <section className="reference-grid-chapter"><article className="reference-card reference-panel compact"><div className="reference-panel-head"><div><h3>Question type performance</h3><p>Accuracy by the formats attempted in this topic.</p></div></div><div className="reference-rings">{topicTypes.slice(0,4).map((row) => <div key={row.question_type} className="reference-ring-item"><div className="reference-ring" style={{ '--p': row.percentage } as React.CSSProperties}><strong>{one(row.percentage)}%</strong></div><p className="text-[10px]">{questionTypeLabel[row.question_type] || row.question_type}</p><small className="text-[#536579]">{row.questions} questions</small></div>)}</div></article><article className="reference-card reference-panel compact"><div className="reference-panel-head"><div><h3>Incorrect questions</h3><p>Recent wrong responses mapped to this topic.</p></div></div><div className="space-y-2">{topicWrong.slice(0,8).map((row,index) => <div key={`${row.paper_id}-${row.question_id}-${index}`} className="rounded-xl border border-[#E8EDF1] p-3"><div className="flex gap-2"><span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#FFF5DF] text-[10px] font-bold text-[#C47600]">!</span><p className="line-clamp-3 text-[11px] leading-5 text-[#354A5E]">{row.question_text}</p></div><div className="mt-2 flex gap-2 text-[9px] text-[#8998A8]"><span>{difficultyLabel[row.difficulty] || row.difficulty}</span><span>{questionTypeLabel[row.question_type] || row.question_type}</span><span>{timeText(row.time_spent_seconds)}</span></div></div>)}{!topicWrong.length && <div className="reference-empty">No incorrect question evidence is available.</div>}</div></article><article className="reference-card reference-panel compact"><div className="reference-panel-head"><div><h3>Available practice</h3><p>Published papers created from matching Question Collections.</p></div></div><div className="space-y-3">{(breakdowns?.practice_collections || []).filter((collection) => !collection.subjects?.length || collection.subjects.includes(subject)).slice(0,5).map((collection) => <button key={collection.id} type="button" onClick={() => startPractice(collection.linked_paper_id, collection.paper_status)} className="w-full rounded-xl border border-[#E2E8EC] bg-white p-3 text-left hover:bg-[#F5FBFA]"><div className="flex justify-between gap-3"><div><strong className="text-xs text-[#071D34]">{collection.name}</strong><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#536579]">{collection.description || 'Reusable practice collection'}</p></div><span className="text-lg text-[#006B70]">›</span></div><div className="mt-2 flex gap-2"><Badge variant="outline">{collection.question_count} questions</Badge><Badge variant="outline">{collection.paper_status || 'Not linked'}</Badge></div></button>)}{!(breakdowns?.practice_collections || []).length && <div className="reference-empty">No active Question Collections are available.</div>}</div></article></section>
        </>}

        {view === 'practice' && <section className="reference-practice-grid">{(breakdowns?.practice_collections || []).map((collection) => <article key={collection.id} className="reference-card reference-practice-card"><div className="flex items-start justify-between"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#EAF6F4] text-[#006B70]"><Crosshair className="h-5 w-5" /></div><Badge variant="outline">{collection.visibility}</Badge></div><h2 className="mt-4 font-semibold text-[#071D34]">{collection.name}</h2><p className="mt-2 min-h-12 text-xs leading-5 text-[#536579]">{collection.description || 'Reusable practice group created from the approved Question Bank.'}</p><div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline">{collection.question_count} questions</Badge>{collection.subjects?.map((item) => <Badge key={item} className="bg-[#EAF6F4] text-[#006B70]">{item}</Badge>)}</div><Button className="mt-5 w-full bg-[#006B70] text-white hover:bg-[#00575C]" onClick={() => startPractice(collection.linked_paper_id, collection.paper_status)} disabled={!collection.linked_paper_id || collection.paper_status !== 'published'}>{collection.paper_status === 'published' ? 'Start practice' : 'Paper not published'}</Button></article>)}{!(breakdowns?.practice_collections || []).length && <div className="reference-card reference-empty col-span-full">No active Question Collections are available for this student.</div>}</section>}

        {view === 'history' && <section className="reference-card p-5"><div className="reference-panel-head"><div><h3>Latest result from every test</h3><p>Select a row to inspect benchmarks, selected answers, correct answers, marks and solutions.</p></div></div><div className="reference-table-wrap"><table className="reference-table"><thead><tr><th>Test</th><th>Date</th><th>Score</th><th>Percentage</th><th>Accuracy</th><th>Time score</th><th>Position</th><th></th></tr></thead><tbody>{(core?.trends || []).map((row) => <tr key={row.paper_id}><td className="font-semibold text-[#071D34]">{row.paper_title}</td><td>{shortDate(row.submitted_at)}</td><td>{one(row.score)} / {one(row.maximum_marks)}</td><td>{one(row.percentage)}%</td><td>{one(row.accuracy)}%</td><td>{one(row.time_score)}/10</td><td>{row.rank_position ? `${row.rank_position} of ${row.test_takers || row.cohort_size || '—'}` : '—'}</td><td><Button size="sm" variant="outline" onClick={() => void openReview(row)}>Review</Button></td></tr>)}</tbody></table></div></section>}

        {view === 'goals' && <><div className="mb-4 flex justify-end"><Button onClick={() => openGoal()} className="bg-[#006B70] text-white hover:bg-[#00575C]"><Plus className="mr-2 h-4 w-4" />Create goal</Button></div><section className="reference-goal-grid">{(breakdowns?.goals || []).map((goal) => { const current=n(goal.current_value); const progress=goal.target_value ? Math.min(100,current/goal.target_value*100) : 0; return <article key={goal.id} className="reference-card p-5"><div className="flex items-start justify-between gap-3"><div><Badge variant="outline">{goal.status}</Badge><h2 className="mt-3 font-semibold text-[#071D34]">{goal.title}</h2><p className="mt-1 text-xs text-[#536579]">{goal.metric.replaceAll('_',' ')} · target {goal.target_value}</p></div><Button size="icon" variant="ghost" className="text-[#B54747]" onClick={() => void deleteGoal(goal)}><Trash2 className="h-4 w-4" /></Button></div><div className="mt-5 flex justify-between text-xs"><span>Current {one(goal.current_value)}</span><strong>{progress.toFixed(0)}%</strong></div><div className="reference-progress mt-2"><span style={{ width: `${progress}%` }} /></div><p className="mt-3 text-xs leading-5 text-[#536579]">{goal.notes || 'No note added.'}</p><div className="mt-4 flex items-center justify-between"><span className="text-[10px] text-[#8998A8]">Due {shortDate(goal.due_date)}</span><Button size="sm" variant="outline" onClick={() => openGoal(goal)}>Edit</Button></div></article>; })}{!(breakdowns?.goals || []).length && <div className="reference-card reference-empty col-span-full"><div><Target className="mx-auto mb-3 h-9 w-9 text-[#89AAAA]" />No measurable goals have been created.</div></div>}</section></>}
      </main>
    </div>

    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="max-h-[92vh] max-w-[1100px] overflow-y-auto"><DialogHeader><DialogTitle>{review?.paper_title || 'Test review'}</DialogTitle><DialogDescription>Comparison summary and question-by-question evidence.</DialogDescription></DialogHeader>{reviewLoading ? <div className="reference-empty"><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading answer review…</div> : review ? <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[['Your %',review.student?.percentage],['Average',review.percentage?.average],['Lowest',review.percentage?.lowest],['Highest',review.percentage?.highest],['Top 10%',review.percentage?.top10],['Top 5%',review.percentage?.top5]].map(([label,value]) => <div key={String(label)} className="rounded-xl border border-[#E8EDF1] p-3 text-center"><span className="text-[10px] uppercase text-[#8998A8]">{label}</span><strong className="mt-1 block text-lg text-[#071D34]">{one(value as number)}%</strong></div>)}</div><div className="reference-table-wrap"><table className="reference-table"><thead><tr><th>#</th><th>Question</th><th>Selected answer</th><th>Correct answer</th><th>Status</th><th>Marks</th><th>Time</th></tr></thead><tbody>{review.questions?.map((question) => <tr key={question.paper_question_id}><td>{question.question_number}</td><td className="max-w-[340px]"><strong className="block text-[#071D34]">{question.subject_name}</strong><span className="line-clamp-4 text-[#536579]">{question.question_text}</span>{question.solution_text && <details className="mt-2"><summary className="cursor-pointer text-[#006B70]">View solution</summary><p className="mt-2 whitespace-pre-wrap text-xs">{question.solution_text}</p></details>}</td><td>{question.selected_answer}</td><td>{question.correct_answer}</td><td>{question.status === 'correct' ? <Badge className="bg-[#EAF7EF] text-[#178353]">Correct</Badge> : question.status === 'incorrect' ? <Badge className="bg-[#FFF0EF] text-[#DC4545]">Wrong</Badge> : <Badge className="bg-[#FFF5DF] text-[#A36700]">Unanswered</Badge>}</td><td>{question.marks_awarded}/{question.maximum_marks}</td><td>{timeText(question.time_spent_seconds)}</td></tr>)}</tbody></table></div></div> : <div className="reference-empty">No review evidence is available.</div>}</DialogContent></Dialog>

    <Dialog open={goalOpen} onOpenChange={setGoalOpen}><DialogContent><DialogHeader><DialogTitle>{goalForm.id ? 'Edit goal' : 'Create measurable goal'}</DialogTitle><DialogDescription>The current analytics value is saved as the starting point. Evidara does not generate the target automatically.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label>Goal title</Label><Input className="mt-2" value={goalForm.title} onChange={(event) => setGoalForm((current) => ({ ...current, title: event.target.value }))} placeholder="Reach 80% in Chemistry" /></div><div className="grid grid-cols-2 gap-3"><div><Label>Metric</Label><Select value={goalForm.metric} onValueChange={(value) => setGoalForm((current) => ({ ...current, metric: value }))}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="accuracy">Accuracy</SelectItem><SelectItem value="time_score">Time score</SelectItem><SelectItem value="tests_completed">Tests completed</SelectItem></SelectContent></Select></div><div><Label>Target</Label><Input className="mt-2" type="number" value={goalForm.target} onChange={(event) => setGoalForm((current) => ({ ...current, target: event.target.value }))} /></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Due date</Label><Input className="mt-2" type="date" value={goalForm.dueDate} onChange={(event) => setGoalForm((current) => ({ ...current, dueDate: event.target.value }))} /></div><div><Label>Status</Label><Select value={goalForm.status} onValueChange={(value) => setGoalForm((current) => ({ ...current, status: value }))}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem></SelectContent></Select></div></div><div><Label>Notes</Label><Textarea className="mt-2" value={goalForm.notes} onChange={(event) => setGoalForm((current) => ({ ...current, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setGoalOpen(false)}>Cancel</Button><Button onClick={() => void saveGoal()} disabled={goalSaving} className="bg-[#006B70] text-white hover:bg-[#00575C]">{goalSaving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Save goal</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
