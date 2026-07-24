'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Gauge,
  Info,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  Target,
  Trophy,
  Users,
  XCircle,
  CircleHelp,
} from 'lucide-react';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { exportStudentAnalyticsPdf } from '@/lib/analytics-pdf';
import type { AnalyticsTimelineRow, AnalyticsTrendRow, StudentAnalyticsPayload, SubjectAnalyticsRow } from '@/types/analytics';
import type { AnalyticsQuestionReviewRow, StudentTestReview } from '@/types/analytics-phase3';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import styles from './analytics.module.css';

type Props = { studentId: string; onBack?: () => void };
type TrendMetric = 'percentage' | 'percentile' | 'accuracy' | 'time_score';
type TrendView = 'tests' | 'rolling';
type SubjectMetric = 'percentage' | 'accuracy' | 'time_score';
type AccuracyMode = 'overall' | 'attempted';
type SeriesKey = 'student' | 'average' | 'top10' | 'top5' | 'highest';

type SeriesDefinition = { key: SeriesKey; label: string; stroke: string; dash?: string };
const seriesDefinitions: SeriesDefinition[] = [
  { key: 'student', label: 'Your result', stroke: '#0E5A5A' },
  { key: 'average', label: 'Average', stroke: '#2E6D8B', dash: '6 5' },
  { key: 'top10', label: 'Top 10%', stroke: '#6D8F8F', dash: '4 4' },
  { key: 'top5', label: 'Top 5%', stroke: '#7B61A8', dash: '3 4' },
  { key: 'highest', label: 'Highest', stroke: '#F2B84B' },
];

const allSeriesOn: Record<SeriesKey, boolean> = { student: true, average: true, top10: true, top5: true, highest: true };

const trendConfigs: Record<TrendMetric, {
  label: string;
  studentKey: keyof AnalyticsTrendRow;
  averageKey: keyof AnalyticsTrendRow;
  top10Key: keyof AnalyticsTrendRow;
  top5Key: keyof AnalyticsTrendRow;
  highestKey: keyof AnalyticsTrendRow;
  domain: [number, number];
}> = {
  percentage: { label: 'Percentage', studentKey: 'percentage', averageKey: 'percentage_average', top10Key: 'percentage_top10', top5Key: 'percentage_top5', highestKey: 'percentage_highest', domain: [0, 100] },
  percentile: { label: 'Percentile', studentKey: 'student_percentile', averageKey: 'percentile_average', top10Key: 'percentile_top10', top5Key: 'percentile_top5', highestKey: 'percentile_highest', domain: [0, 100] },
  accuracy: { label: 'Overall accuracy', studentKey: 'accuracy', averageKey: 'accuracy_average', top10Key: 'accuracy_top10', top5Key: 'accuracy_top5', highestKey: 'accuracy_highest', domain: [0, 100] },
  time_score: { label: 'Time score', studentKey: 'time_score', averageKey: 'time_average', top10Key: 'time_top10', top5Key: 'time_top5', highestKey: 'time_highest', domain: [0, 10] },
};

function dateText(value?: string | null) {
  if (!value) return 'Pending';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function number(value?: number | null) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
function formatted(value?: number | null, suffix = '') { return value == null ? '—' : `${Number(value).toFixed(1)}${suffix}`; }
function countText(value?: number | null) { return new Intl.NumberFormat('en-IN').format(value || 0); }
function changeFor(rows: AnalyticsTrendRow[], key: keyof AnalyticsTrendRow) {
  if (rows.length < 2) return null;
  const latest = rows.at(-1)?.[key];
  const previous = rows.at(-2)?.[key];
  return typeof latest === 'number' && typeof previous === 'number' ? latest - previous : null;
}
function averageWindow(rows: AnalyticsTrendRow[], index: number, key: keyof AnalyticsTrendRow) {
  const values = rows.slice(Math.max(0, index - 2), index + 1).map((row) => row[key]).filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}
function buildTrendData(rows: AnalyticsTrendRow[], metric: TrendMetric, view: TrendView) {
  const config = trendConfigs[metric];
  return rows.map((row, index) => {
    const get = (key: keyof AnalyticsTrendRow) => view === 'rolling' ? averageWindow(rows, index, key) : row[key];
    return { ...row, label: new Date(row.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), student: get(config.studentKey), average: get(config.averageKey), top10: get(config.top10Key), top5: get(config.top5Key), highest: get(config.highestKey) };
  });
}

function subjectConfig(row: SubjectAnalyticsRow, metric: SubjectMetric) {
  if (metric === 'accuracy') return { student: row.student_accuracy, average: row.average_accuracy, top10: row.top10_accuracy, top5: row.top5_accuracy, highest: row.highest_accuracy, suffix: '%', max: 100 };
  if (metric === 'time_score') return { student: row.student_time_score, average: row.average_time_score, top10: row.top10_time_score, top5: row.top5_time_score, highest: row.highest_time_score, suffix: '/10', max: 10 };
  return { student: row.student_percentage, average: row.average_percentage, top10: row.top10_threshold, top5: row.top5_threshold, highest: row.highest_percentage, suffix: '%', max: 100 };
}

function MetricInfo({ text }: { text: string }) {
  return <Tooltip><TooltipTrigger asChild><button type="button" className={styles.infoButton} aria-label="How this is calculated"><Info className="h-4 w-4" /></button></TooltipTrigger><TooltipContent side="top" className="max-w-[360px] text-xs leading-5">{text}</TooltipContent></Tooltip>;
}

function SeriesToggles({ visible, onToggle }: { visible: Record<SeriesKey, boolean>; onToggle: (key: SeriesKey) => void }) {
  return <div className={styles.seriesToggleGroup}>{seriesDefinitions.map((series) => <button key={series.key} type="button" onClick={() => onToggle(series.key)} className={`${styles.seriesToggle} ${visible[series.key] ? styles.seriesToggleActive : ''}`}><span style={{ background: series.stroke }} />{series.label}</button>)}</div>;
}

function toggleSeries(setter: React.Dispatch<React.SetStateAction<Record<SeriesKey, boolean>>>, key: SeriesKey) {
  setter((current) => {
    const active = Object.values(current).filter(Boolean).length;
    if (current[key] && active === 1) return current;
    return { ...current, [key]: !current[key] };
  });
}

function QuestionStatus({ status }: { status: AnalyticsQuestionReviewRow['status'] }) {
  if (status === 'correct') return <Badge className="bg-[#EAF4EF] text-[#237A57]">Correct</Badge>;
  if (status === 'incorrect') return <Badge className="bg-[#FAEEEE] text-[#B54747]">Wrong</Badge>;
  return <Badge className="bg-[#FCF1DB] text-[#8A5F00]">Unanswered</Badge>;
}

export function StudentAnalyticsDashboardV3({ studentId, onBack }: Props) {
  const [data, setData] = useState<StudentAnalyticsPayload | null>(null);
  const [productId, setProductId] = useState('all');
  const [accuracyMode, setAccuracyMode] = useState<AccuracyMode>('overall');
  const [profileMetric, setProfileMetric] = useState<SubjectMetric>('percentage');
  const [subjectMetric, setSubjectMetric] = useState<SubjectMetric>('percentage');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('percentage');
  const [trendView, setTrendView] = useState<TrendView>('tests');
  const [profileSeries, setProfileSeries] = useState<Record<SeriesKey, boolean>>(allSeriesOn);
  const [subjectSeries, setSubjectSeries] = useState<Record<SeriesKey, boolean>>(allSeriesOn);
  const [trendSeries, setTrendSeries] = useState<Record<SeriesKey, boolean>>(allSeriesOn);
  const [reviewPaperId, setReviewPaperId] = useState('');
  const [review, setReview] = useState<StudentTestReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const reviewRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setError('Connect Supabase and apply the analytics migrations.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data: result, error: loadError } = await supabase.rpc('get_student_analytics_overview_v11', { p_student_id: studentId, p_product_id: productId === 'all' ? null : productId, p_from: null, p_to: null });
    if (loadError) setError(loadError.message); else setData(result as StudentAnalyticsPayload);
    setLoading(false);
  }, [productId, studentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const completed = (data?.timeline || []).filter((item) => item.completed);
    if (!completed.length) { setReviewPaperId(''); setReview(null); return; }
    if (!completed.some((item) => item.paper_id === reviewPaperId)) setReviewPaperId(completed[0].paper_id);
  }, [data?.timeline, reviewPaperId]);

  const loadReview = useCallback(async (paperId: string) => {
    if (!supabase || !paperId) return null;
    setReviewLoading(true); setReviewError('');
    const { data: result, error: loadError } = await supabase.rpc('get_student_test_review_v12', { p_student_id: studentId, p_paper_id: paperId });
    setReviewLoading(false);
    if (loadError) { setReviewError(loadError.message); return null; }
    const payload = result as StudentTestReview;
    setReview(payload);
    return payload;
  }, [studentId]);

  useEffect(() => { if (reviewPaperId) void loadReview(reviewPaperId); }, [loadReview, reviewPaperId]);

  const summary = data?.summary;
  const selectedProduct = (data?.products || []).find((product) => product.id === productId) || null;
  const trendConfig = trendConfigs[trendMetric];
  const trendData = useMemo(() => buildTrendData(data?.trends || [], trendMetric, trendView), [data?.trends, trendMetric, trendView]);
  const profileData = useMemo(() => (data?.subjects || []).map((row) => ({ subject_name: row.subject_name, ...subjectConfig(row, profileMetric) })), [data?.subjects, profileMetric]);
  const answerDistribution = [
    { name: 'Correct', value: summary?.correct || 0, fill: '#237A57' },
    { name: 'Wrong', value: summary?.incorrect || 0, fill: '#B54747' },
    { name: 'Unanswered', value: summary?.unanswered || 0, fill: '#F2B84B' },
  ];

  const accuracyValue = accuracyMode === 'overall' ? summary?.accuracy : summary?.attempted_accuracy;
  const accuracyCaption = accuracyMode === 'overall'
    ? `${countText(summary?.correct)} correct of ${countText(summary?.total_questions)} total · ${countText(summary?.incorrect)} wrong · ${countText(summary?.unanswered)} unanswered`
    : `${countText(summary?.correct)} correct of ${countText((summary?.correct || 0) + (summary?.incorrect || 0))} answered · unanswered excluded`;

  const metricCards = [
    { label: 'Average percentage', value: summary?.average_percentage == null ? '—' : `${summary.average_percentage}%`, caption: `Latest result from ${summary?.completed_tests || 0} distinct tests`, explanation: 'Latest percentage from every completed test is added and divided by the number of distinct tests.', change: changeFor(data?.trends || [], 'percentage'), icon: Activity },
    { label: 'Average percentile', value: summary?.percentile_available && summary.average_percentile != null ? String(summary.average_percentile) : 'Locked', caption: summary?.percentile_available ? `Compared with up to ${summary.cohort_size || 0} students per test` : selectedProduct ? `${selectedProduct.completed_tests}/${selectedProduct.total_tests} tests completed` : 'Select and complete one series', explanation: 'Each test is compared with students who wrote the same test. Series percentile unlocks only after every paper in the selected product is completed.', change: summary?.percentile_available ? changeFor(data?.trends || [], 'student_percentile') : null, icon: Target, locked: !summary?.percentile_available },
    { label: accuracyMode === 'overall' ? 'Accuracy · all questions' : 'Accuracy · answered only', value: accuracyValue == null ? '—' : `${accuracyValue}%`, caption: accuracyCaption, explanation: accuracyMode === 'overall' ? 'Correct answers divided by all questions, including unanswered questions in the denominator.' : 'Correct answers divided only by correct plus wrong answers. Unanswered questions are excluded.', change: changeFor(data?.trends || [], accuracyMode === 'overall' ? 'accuracy' : 'attempted_accuracy'), icon: CheckCircle2, action: <button type="button" className={styles.metricSwapButton} onClick={() => setAccuracyMode((current) => current === 'overall' ? 'attempted' : 'overall')}><RefreshCw className="h-3.5 w-3.5" />{accuracyMode === 'overall' ? 'Show answered-only' : 'Show all questions'}</button> },
    { label: 'Time management', value: summary?.time_score == null ? '—' : `${summary.time_score} / 10`, caption: number(summary?.time_score) >= 8 ? 'Well-controlled pacing' : number(summary?.time_score) >= 6.5 ? 'Improving pacing' : 'Pacing needs attention', explanation: '35% completion, 25% controlled time per question, 20% avoiding rushed answers and 20% finishing within the duration.', change: changeFor(data?.trends || [], 'time_score'), icon: Gauge },
  ];

  function scrollTimeline(direction: 'left' | 'right') { timelineRef.current?.scrollBy({ left: direction === 'left' ? -440 : 440, behavior: 'smooth' }); }
  async function openTimeline(item: AnalyticsTimelineRow) {
    setReviewPaperId(item.paper_id);
    setDialogOpen(true);
    if (item.completed) await loadReview(item.paper_id);
  }
  async function downloadPdf() {
    if (!data) return;
    setExporting(true);
    let selectedReview = review;
    if (!selectedReview && reviewPaperId) selectedReview = await loadReview(reviewPaperId);
    exportStudentAnalyticsPdf(data, selectedProduct?.name || 'All assessments', selectedReview);
    setExporting(false);
  }

  if (loading && !data) return <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Calculating student analytics…</div></div>;

  return <TooltipProvider delayDuration={120}>
    <div className={`${styles.workspace} space-y-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Analytics · Student profile</div><h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14232B]">{data?.student?.full_name || 'Student analytics'}</h1><p className="mt-1 text-sm text-[#44545C]">{data?.student?.organization_name || 'Evidara'} · Grade {data?.student?.grade || '—'} · Section {data?.student?.section_name || 'Unassigned'}</p><div className="mt-3 flex flex-wrap gap-2">{data?.student?.academic_year && <Badge variant="outline">{data.student.academic_year}</Badge>}{data?.student?.board && <Badge variant="outline">{data.student.board}</Badge>}{(data?.student?.tracks || []).map((track) => <Badge key={track} variant="outline">{track}</Badge>)}</div></div>
        <div className="flex flex-wrap gap-2">{onBack && <Button variant="outline" onClick={onBack}>Back to students</Button>}<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button><Button onClick={() => void downloadPdf()} disabled={exporting || !data} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{exporting ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}Download analytics PDF</Button></div>
      </div>
      {error && <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] px-4 py-3 text-sm text-[#B54747]">{error}</div>}

      <Card className={`${styles.controlPanel} gap-0`}><CardContent className="p-4 sm:p-5"><div className={styles.productSelectorRow}><div className="min-w-0 flex-1"><label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#6B7980]">Analytics product</label><Select value={productId} onValueChange={setProductId}><SelectTrigger className="w-full max-w-[620px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All assessments · latest result from each test</SelectItem>{(data?.products || []).map((product) => <SelectItem key={product.id} value={product.id}>{product.name} · {product.completed_tests}/{product.total_tests} tests</SelectItem>)}</SelectContent></Select></div><div className={styles.selectionSummary}><strong className="text-sm text-[#14232B]">{selectedProduct?.name || 'All assessments'}</strong><span className="text-xs text-[#6B7980]">{selectedProduct ? `${selectedProduct.exam_type || 'Multiple exams'} · ${selectedProduct.completed_tests}/${selectedProduct.total_tests} tests` : `${summary?.completed_tests || 0} distinct completed tests`}</span></div></div>
      {!!data?.timeline?.length && <div className="mt-5 border-t border-[#E7ECEB] pt-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-sm font-semibold text-[#14232B]">Test timeline</h2><p className="mt-0.5 text-xs text-[#6B7980]">Select any test for its benchmark and question review.</p></div><div className="flex gap-2"><Button size="icon" variant="outline" onClick={() => scrollTimeline('left')}><ChevronLeft className="h-4 w-4" /></Button><Button size="icon" variant="outline" onClick={() => scrollTimeline('right')}><ChevronRight className="h-4 w-4" /></Button></div></div><div ref={timelineRef} className={styles.timelineViewport}><div className={styles.timelineCards}>{data.timeline.map((item, index) => <button key={`${item.paper_id}-${index}`} type="button" onClick={() => void openTimeline(item)} className={`${styles.timelineCard} ${item.completed ? styles.timelineCardComplete : ''}`}><div className="flex items-center justify-between gap-3"><span className={styles.timelineNumber}>{index + 1}</span>{item.percentage != null ? <Badge variant="outline">{item.percentage.toFixed(1)}%</Badge> : <Badge variant="outline">Pending</Badge>}</div><strong className="mt-3 block line-clamp-2 text-left text-sm text-[#14232B]">{item.display_name}</strong><span className="mt-2 block text-left text-xs text-[#6B7980]">{dateText(item.submitted_at)}</span></button>)}</div></div></div>}
      </CardContent></Card>

      {!summary?.completed_tests ? <Card className="border-[#E7ECEB] shadow-none"><CardContent className={styles.emptyState}><div><Activity className="mx-auto mb-3 h-10 w-10 text-[#9FBDBD]" /><h2 className="font-semibold text-[#14232B]">No completed tests are available</h2></div></CardContent></Card> : <>
        {!summary.percentile_available && <div className="flex items-start gap-3 rounded-xl border border-[#E8D39B] bg-[#FFF9E9] px-4 py-3 text-sm text-[#6A4B0B]"><LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" /><div><strong className="text-[#14232B]">Product percentile is locked.</strong><p className="mt-1">Complete every test in one selected series to unlock its average percentile.</p></div></div>}
        <section className={styles.metricGrid}>{metricCards.map(({ label, value, caption, explanation, change, icon: Icon, locked, action }) => <Card key={label} className={`${styles.metricCard} gap-0`}><CardContent className="p-4"><div className="flex items-start gap-3"><div className={`${styles.metricIcon} ${locked ? styles.metricIconAmber : ''}`}><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-[#44545C]">{label}</p><MetricInfo text={explanation} /></div><p className={`${styles.metricValue} ${locked ? 'text-[#9A6508]' : 'text-[#0E5A5A]'}`}>{value}</p><p className="mt-1 text-xs leading-5 text-[#6B7980]">{caption}</p>{action}{change != null && <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${change >= 0 ? 'text-[#237A57]' : 'text-[#B54747]'}`}>{change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{change >= 0 ? '+' : ''}{change.toFixed(1)} from previous test</p>}</div></div></CardContent></Card>)}</section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,.8fr)]"><Card className={`${styles.chartCard} gap-0`}><CardContent className="p-4 sm:p-5"><h2 className="font-semibold text-[#14232B]">Comparison summary</h2><p className="mt-1 text-xs text-[#6B7980]">Where the selected results sit against students who wrote the same tests.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{[
          ['Average', formatted(summary.comparison_average_percentage, '%')],['Top 10%', formatted(summary.top10_threshold, '%')],['Top 5%', formatted(summary.top5_threshold, '%')],['Highest', formatted(summary.highest_percentage, '%')],['Students compared', countText(summary.cohort_size)],
        ].map(([label, value]) => <div key={label} className={styles.comparisonCard}><span className="text-xs font-semibold text-[#6B7980]">{label}</span><strong className="mt-2 block text-xl text-[#14232B]">{value}</strong></div>)}</div></CardContent></Card>
        <Card className={`${styles.chartCard} gap-0`}><CardContent className="p-4 sm:p-5"><h2 className="font-semibold text-[#14232B]">Answer distribution</h2><p className="mt-1 text-xs text-[#6B7980]">Correct, wrong and unanswered questions across the selected tests.</p><div className="h-[230px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={answerDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={3}>{answerDistribution.map((item) => <Cell key={item.name} fill={item.fill} />)}</Pie><ChartTooltip /><Legend /></PieChart></ResponsiveContainer></div><div className="grid grid-cols-3 gap-2">{answerDistribution.map((item) => <div key={item.name} className="rounded-xl border border-[#E7ECEB] p-3 text-center"><strong className="block text-lg text-[#14232B]">{countText(item.value)}</strong><span className="text-[11px] text-[#6B7980]">{item.name}</span></div>)}</div></CardContent></Card></section>

        <section className={styles.chartGrid}>
          <Card className={`${styles.chartCard} gap-0`}><CardContent className="p-4 sm:p-5"><div className={styles.subjectComparisonHeader}><div><h2 className="font-semibold text-[#14232B]">Performance profile</h2><p className="mt-1 text-xs text-[#6B7980]">Choose a metric and control every comparison layer.</p></div><Select value={profileMetric} onValueChange={(value) => setProfileMetric(value as SubjectMetric)}><SelectTrigger className="w-full sm:w-[175px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="accuracy">Overall accuracy</SelectItem><SelectItem value="time_score">Time score</SelectItem></SelectContent></Select></div><SeriesToggles visible={profileSeries} onToggle={(key) => toggleSeries(setProfileSeries, key)} /><div className={styles.radarChartHeight}><ResponsiveContainer width="100%" height="100%"><RadarChart data={profileData} margin={{ top: 20, right: 30, bottom: 16, left: 30 }}><PolarGrid stroke="#DFE6E5" /><PolarAngleAxis dataKey="subject_name" tick={{ fontSize: 11, fill: '#44545C' }} /><PolarRadiusAxis domain={[0, profileMetric === 'time_score' ? 10 : 100]} tick={{ fontSize: 9, fill: '#6B7980' }} />{seriesDefinitions.map((series) => profileSeries[series.key] && <Radar key={series.key} name={series.label} dataKey={series.key} stroke={series.stroke} fill={series.key === 'student' ? series.stroke : 'transparent'} fillOpacity={series.key === 'student' ? 0.12 : 0} strokeWidth={series.key === 'student' ? 3 : 2} strokeDasharray={series.dash} />)}<Legend wrapperStyle={{ fontSize: 11 }} /><ChartTooltip /></RadarChart></ResponsiveContainer></div></CardContent></Card>

          <Card className={`${styles.chartCard} gap-0`}><CardContent className="p-4 sm:p-5"><div className={styles.subjectComparisonHeader}><div><h2 className="font-semibold text-[#14232B]">Subject comparison</h2><p className="mt-1 text-xs text-[#6B7980]">Turn benchmark markers on or off for a clean subject-by-subject view.</p></div><Select value={subjectMetric} onValueChange={(value) => setSubjectMetric(value as SubjectMetric)}><SelectTrigger className="w-full sm:w-[175px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="accuracy">Overall accuracy</SelectItem><SelectItem value="time_score">Time score</SelectItem></SelectContent></Select></div><SeriesToggles visible={subjectSeries} onToggle={(key) => toggleSeries(setSubjectSeries, key)} /><div className={styles.subjectComparisonRows}>{(data?.subjects || []).map((subject) => { const values = subjectConfig(subject, subjectMetric); const max = values.max; return <div key={subject.subject_name} className={styles.subjectComparisonRowV3}><div className={styles.subjectName}>{subject.subject_name}</div><div className={styles.subjectBarArea}><div className={styles.subjectTrack}>{subjectSeries.student && <div className={styles.subjectFill} style={{ width: `${Math.max(0, Math.min(100, number(values.student) / max * 100))}%` }} />}{seriesDefinitions.filter((series) => series.key !== 'student' && subjectSeries[series.key]).map((series) => { const value = values[series.key]; return typeof value === 'number' ? <span key={series.key} className={styles.subjectBenchmarkMarker} style={{ left: `${Math.max(0, Math.min(100, value / max * 100))}%`, background: series.stroke }} title={`${series.label}: ${value.toFixed(1)}${values.suffix}`} /> : null; })}</div></div><strong className={styles.subjectValue}>{formatted(values.student, values.suffix)}</strong></div>; })}</div><div className={styles.subjectAxis}>{[0,25,50,75,100].map((value) => <span key={value}>{subjectMetric === 'time_score' ? (value / 10).toFixed(value ? 1 : 0) : `${value}%`}</span>)}</div></CardContent></Card>

          <Card className={`${styles.chartCard} ${styles.trendCard} gap-0`}><CardContent className="overflow-hidden p-4 sm:p-5"><div className={styles.trendHeader}><div><h2 className="font-semibold text-[#14232B]">Performance trends</h2><p className="mt-1 text-xs text-[#6B7980]">Choose the metric, then turn individual comparison lines on or off.</p></div><div className={styles.trendControls}><Select value={trendView} onValueChange={(value) => setTrendView(value as TrendView)}><SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="tests">Test-wise</SelectItem><SelectItem value="rolling">3-test average</SelectItem></SelectContent></Select><Select value={trendMetric} onValueChange={(value) => setTrendMetric(value as TrendMetric)}><SelectTrigger className="w-full sm:w-[175px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="percentile">Percentile</SelectItem><SelectItem value="accuracy">Overall accuracy</SelectItem><SelectItem value="time_score">Time score</SelectItem></SelectContent></Select></div></div><SeriesToggles visible={trendSeries} onToggle={(key) => toggleSeries(setTrendSeries, key)} /><div className={styles.trendChartHeight}><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData} margin={{ left: -8, right: 18, top: 10, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={18} /><YAxis domain={trendConfig.domain} tick={{ fontSize: 10 }} /><ChartTooltip /><Legend wrapperStyle={{ fontSize: 11 }} />{seriesDefinitions.map((series) => trendSeries[series.key] && <Line key={`${trendMetric}-${series.key}`} name={series.key === 'student' ? trendConfig.label : series.label} type="monotone" dataKey={series.key} stroke={series.stroke} strokeWidth={series.key === 'student' ? 3 : 2} strokeDasharray={series.dash} dot={series.key === 'student' ? { r: 3 } : false} connectNulls />)}</LineChart></ResponsiveContainer></div></CardContent></Card>
        </section>

        <Card ref={reviewRef} className={`${styles.chartCard} gap-0`}><CardContent className="p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div><h2 className="font-semibold text-[#14232B]">Test marks and answer review</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-[#6B7980]">Choose a completed test. The benchmark appears first, followed by every question, selected answer, correct answer, marks and time.</p></div><Select value={reviewPaperId} onValueChange={(value) => { setReviewPaperId(value); setExpandedQuestion(null); }}><SelectTrigger className="w-full lg:w-[360px]"><SelectValue placeholder="Choose completed test" /></SelectTrigger><SelectContent>{(data?.timeline || []).filter((item) => item.completed).map((item) => <SelectItem key={item.paper_id} value={item.paper_id}>{item.display_name} · {item.percentage?.toFixed(1)}%</SelectItem>)}</SelectContent></Select></div>
        {reviewLoading && <div className="grid min-h-[240px] place-items-center text-sm text-[#6B7980]"><LoaderCircle className="h-6 w-6 animate-spin" /></div>}{reviewError && <div className="mt-4 rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4 text-sm text-[#B54747]">{reviewError}</div>}{review && !reviewLoading && <div className="mt-5 space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">{[
          ['Your result', formatted(review.student.percentage, '%')],['Average', formatted(review.percentage.average, '%')],['Lowest', formatted(review.percentage.lowest, '%')],['Highest', formatted(review.percentage.highest, '%')],['Top 10%', formatted(review.percentage.top10, '%')],['Top 5%', formatted(review.percentage.top5, '%')],['Position', review.rank_position ? `${review.rank_position}/${review.test_takers}` : '—'],
        ].map(([label,value]) => <div key={label} className={styles.comparisonCard}><span className="text-[11px] font-semibold text-[#6B7980]">{label}</span><strong className="mt-2 block text-lg text-[#14232B]">{value}</strong></div>)}</div><div className="overflow-x-auto rounded-xl border border-[#E7ECEB]"><table className="w-full min-w-[1050px] border-collapse text-left text-xs"><thead className="bg-[#F2F8F7] text-[#44545C]"><tr><th className="p-3">Q</th><th className="p-3">Subject</th><th className="p-3">Question</th><th className="p-3">Selected answer</th><th className="p-3">Correct answer</th><th className="p-3">Status</th><th className="p-3">Marks</th><th className="p-3">Time</th></tr></thead><tbody>{review.questions.map((question) => <><tr key={question.paper_question_id} className="cursor-pointer border-t border-[#E7ECEB] align-top hover:bg-[#FBFCFB]" onClick={() => setExpandedQuestion((current) => current === question.paper_question_id ? null : question.paper_question_id)}><td className="p-3 font-bold text-[#14232B]">{question.question_number}</td><td className="p-3 text-[#44545C]">{question.subject_name}</td><td className="max-w-[280px] p-3 text-[#14232B]"><div className="line-clamp-2">{question.question_text}</div></td><td className="max-w-[170px] p-3 text-[#44545C]">{question.selected_answer}</td><td className="max-w-[170px] p-3 text-[#44545C]">{question.correct_answer}</td><td className="p-3"><QuestionStatus status={question.status} /></td><td className="p-3 font-semibold text-[#14232B]">{question.marks_awarded}/{question.maximum_marks}</td><td className="p-3 text-[#44545C]">{question.time_spent_seconds}s</td></tr>{expandedQuestion === question.paper_question_id && <tr className="border-t border-[#E7ECEB] bg-[#F7F9F7]"><td colSpan={8} className="p-4"><div className="grid gap-4 lg:grid-cols-2"><div><h4 className="font-semibold text-[#14232B]">Options</h4><div className="mt-2 space-y-2">{question.options.map((option) => <div key={option.option_key} className={`rounded-lg border p-2 ${question.correct_keys.includes(option.option_key) ? 'border-[#237A57]/30 bg-[#EAF4EF]' : question.selected_keys.includes(option.option_key) ? 'border-[#B54747]/25 bg-[#FAEEEE]' : 'border-[#E7ECEB] bg-white'}`}><strong>{option.option_key}.</strong> {option.content_text}</div>)}</div></div><div><h4 className="font-semibold text-[#14232B]">Explanation</h4><p className="mt-2 whitespace-pre-wrap leading-6 text-[#44545C]">{question.solution_text || 'No solution was attached to this question.'}</p>{question.marked_for_review && <Badge className="mt-3 bg-[#FCF1DB] text-[#8A5F00]">Marked for review</Badge>}</div></div></td></tr>}</>)}</tbody></table></div></div>}
        </CardContent></Card>
      </>}
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-4xl overflow-hidden p-0"><div className="max-h-[88vh] overflow-y-auto p-6"><DialogHeader><DialogTitle>{review?.paper_title || 'Test comparison'}</DialogTitle><DialogDescription>{review?.product_name || 'Assessment'} · {review?.submitted_at ? dateText(review.submitted_at) : 'Pending'}</DialogDescription></DialogHeader>{reviewLoading && <div className="grid min-h-[220px] place-items-center"><LoaderCircle className="h-6 w-6 animate-spin" /></div>}{review && !reviewLoading && <div className="mt-5 space-y-5"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"><div className="rounded-xl border border-[#CFE0DE] bg-[#F2F8F7] p-4"><Activity className="h-5 w-5 text-[#0E5A5A]" /><p className="mt-3 text-xs text-[#6B7980]">Percentage</p><strong className="mt-1 block text-2xl text-[#0E5A5A]">{formatted(review.student.percentage, '%')}</strong></div><div className="rounded-xl border border-[#E7ECEB] p-4"><Users className="h-5 w-5 text-[#2E6D8B]" /><p className="mt-3 text-xs text-[#6B7980]">Students</p><strong className="mt-1 block text-2xl text-[#14232B]">{review.test_takers}</strong></div><div className="rounded-xl border border-[#E7ECEB] p-4"><Trophy className="h-5 w-5 text-[#9A6508]" /><p className="mt-3 text-xs text-[#6B7980]">Position</p><strong className="mt-1 block text-2xl text-[#14232B]">{review.rank_position ? `${review.rank_position}/${review.test_takers}` : '—'}</strong></div><div className="rounded-xl border border-[#E7ECEB] p-4"><Target className="h-5 w-5 text-[#7B61A8]" /><p className="mt-3 text-xs text-[#6B7980]">Percentile</p><strong className="mt-1 block text-2xl text-[#14232B]">{formatted(review.student_percentile)}</strong></div><div className="rounded-xl border border-[#E7ECEB] p-4"><Gauge className="h-5 w-5 text-[#0E5A5A]" /><p className="mt-3 text-xs text-[#6B7980]">Time score</p><strong className="mt-1 block text-2xl text-[#14232B]">{formatted(review.student.time_score, '/10')}</strong></div></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[#237A57]/20 bg-[#EAF4EF] p-4"><CheckCircle2 className="h-5 w-5 text-[#237A57]" /><strong className="mt-2 block text-xl text-[#14232B]">{review.student.correct}</strong><span className="text-xs text-[#6B7980]">Correct</span></div><div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4"><XCircle className="h-5 w-5 text-[#B54747]" /><strong className="mt-2 block text-xl text-[#14232B]">{review.student.incorrect}</strong><span className="text-xs text-[#6B7980]">Wrong</span></div><div className="rounded-xl border border-[#F2B84B]/30 bg-[#FFF9E9] p-4"><CircleHelp className="h-5 w-5 text-[#9A6508]" /><strong className="mt-2 block text-xl text-[#14232B]">{review.student.unanswered}</strong><span className="text-xs text-[#6B7980]">Unanswered</span></div></div><Button className="w-full bg-[#0E5A5A] hover:bg-[#0A4747]" onClick={() => { setDialogOpen(false); window.setTimeout(() => reviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150); }}>Open complete question review <ChevronDown className="ml-2 h-4 w-4" /></Button></div>}</div></DialogContent></Dialog>
  </TooltipProvider>;
}
