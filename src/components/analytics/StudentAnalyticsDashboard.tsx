'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Info,
  LoaderCircle,
  LockKeyhole,
  Printer,
  RefreshCw,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react';
import {
  CartesianGrid,
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
import type {
  AnalyticsTimelineRow,
  AnalyticsTrendRow,
  MetricComparisonSnapshot,
  StudentAnalyticsPayload,
  StudentTestComparison,
  SubjectAnalyticsRow,
} from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import styles from './analytics.module.css';

type Props = {
  studentId: string;
  onBack?: () => void;
};

type TrendMetric = 'percentage' | 'percentile' | 'accuracy' | 'time_score';
type TrendView = 'tests' | 'rolling';
type TrendSeriesKey = 'student' | 'average' | 'top10' | 'top5' | 'highest';
type SubjectMetric = 'percentage' | 'accuracy' | 'time_score';
type AccuracyMode = 'overall' | 'attempted';

type TrendMetricConfig = {
  label: string;
  studentKey: keyof AnalyticsTrendRow;
  averageKey: keyof AnalyticsTrendRow;
  top10Key: keyof AnalyticsTrendRow;
  top5Key: keyof AnalyticsTrendRow;
  highestKey: keyof AnalyticsTrendRow;
  domain: [number, number];
};

const trendConfigs: Record<TrendMetric, TrendMetricConfig> = {
  percentage: {
    label: 'Percentage',
    studentKey: 'percentage',
    averageKey: 'percentage_average',
    top10Key: 'percentage_top10',
    top5Key: 'percentage_top5',
    highestKey: 'percentage_highest',
    domain: [0, 100],
  },
  percentile: {
    label: 'Percentile',
    studentKey: 'student_percentile',
    averageKey: 'percentile_average',
    top10Key: 'percentile_top10',
    top5Key: 'percentile_top5',
    highestKey: 'percentile_highest',
    domain: [0, 100],
  },
  accuracy: {
    label: 'Overall accuracy',
    studentKey: 'accuracy',
    averageKey: 'accuracy_average',
    top10Key: 'accuracy_top10',
    top5Key: 'accuracy_top5',
    highestKey: 'accuracy_highest',
    domain: [0, 100],
  },
  time_score: {
    label: 'Time score',
    studentKey: 'time_score',
    averageKey: 'time_average',
    top10Key: 'time_top10',
    top5Key: 'time_top5',
    highestKey: 'time_highest',
    domain: [0, 10],
  },
};

const seriesDefinitions: Array<{
  key: TrendSeriesKey;
  label: string;
  stroke: string;
  dash?: string;
}> = [
  { key: 'student', label: 'Your result', stroke: '#0E5A5A' },
  { key: 'average', label: 'Average', stroke: '#2E6D8B', dash: '6 5' },
  { key: 'top10', label: 'Top 10%', stroke: '#6D8F8F', dash: '4 4' },
  { key: 'top5', label: 'Top 5%', stroke: '#7B61A8', dash: '3 4' },
  { key: 'highest', label: 'Highest', stroke: '#F2B84B' },
];

function dateText(value?: string | null) {
  if (!value) return 'Pending';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function asNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function formatted(value?: number | null, suffix = '') {
  return value == null ? '—' : `${Number(value).toFixed(1)}${suffix}`;
}

function countText(value?: number | null) {
  return new Intl.NumberFormat('en-IN').format(value || 0);
}

function changeFor(rows: AnalyticsTrendRow[], key: keyof AnalyticsTrendRow) {
  if (rows.length < 2) return null;
  const latest = rows.at(-1)?.[key];
  const previous = rows.at(-2)?.[key];
  if (typeof latest !== 'number' || typeof previous !== 'number') return null;
  return latest - previous;
}

function MetricInfo({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className={styles.infoButton} aria-label="How this is calculated">
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[340px] text-xs leading-5">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function averageWindow(rows: AnalyticsTrendRow[], index: number, key: keyof AnalyticsTrendRow) {
  const values = rows
    .slice(Math.max(0, index - 2), index + 1)
    .map((row) => row[key])
    .filter((value): value is number => typeof value === 'number');
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function buildTrendData(rows: AnalyticsTrendRow[], metric: TrendMetric, view: TrendView) {
  const config = trendConfigs[metric];
  return rows.map((row, index) => {
    const valueFor = (key: keyof AnalyticsTrendRow) => view === 'rolling' ? averageWindow(rows, index, key) : row[key];
    return {
      ...row,
      label: new Date(row.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      student: valueFor(config.studentKey),
      average: valueFor(config.averageKey),
      top10: valueFor(config.top10Key),
      top5: valueFor(config.top5Key),
      highest: valueFor(config.highestKey),
    };
  });
}

function subjectMetricValues(row: SubjectAnalyticsRow, metric: SubjectMetric) {
  if (metric === 'accuracy') {
    return {
      student: row.student_accuracy,
      average: row.average_accuracy,
      suffix: '%',
    };
  }
  if (metric === 'time_score') {
    return {
      student: row.student_time_score,
      average: row.average_time_score,
      suffix: '/10',
    };
  }
  return {
    student: row.student_percentage,
    average: row.average_percentage,
    suffix: '%',
  };
}

function ComparisonStats({ title, values, suffix = '%' }: {
  title: string;
  values: MetricComparisonSnapshot;
  suffix?: string;
}) {
  const rows = [
    ['Highest', values.highest],
    ['Top 5%', values.top5],
    ['Top 10%', values.top10],
    ['Average', values.average],
    ['Lowest', values.lowest],
  ];
  return (
    <div className="rounded-xl border border-[#E7ECEB] bg-[#FBFCFB] p-4">
      <h3 className="text-sm font-semibold text-[#14232B]">{title}</h3>
      <div className="mt-3 space-y-2">
        {rows.map(([label, value]) => (
          <div key={String(label)} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[#6B7980]">{label}</span>
            <strong className="text-[#14232B]">{typeof value === 'number' ? `${value.toFixed(1)}${suffix}` : '—'}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StudentAnalyticsDashboard({ studentId, onBack }: Props) {
  const [data, setData] = useState<StudentAnalyticsPayload | null>(null);
  const [productId, setProductId] = useState('all');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('percentage');
  const [trendView, setTrendView] = useState<TrendView>('tests');
  const [subjectMetric, setSubjectMetric] = useState<SubjectMetric>('percentage');
  const [accuracyMode, setAccuracyMode] = useState<AccuracyMode>('overall');
  const [visibleTrendSeries, setVisibleTrendSeries] = useState<Record<TrendSeriesKey, boolean>>({
    student: true,
    average: true,
    top10: true,
    top5: true,
    highest: true,
  });
  const [selectedTest, setSelectedTest] = useState<AnalyticsTimelineRow | null>(null);
  const [testDetail, setTestDetail] = useState<StudentTestComparison | null>(null);
  const [testDetailLoading, setTestDetailLoading] = useState(false);
  const [testDetailError, setTestDetailError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timelineRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Connect Supabase and apply the analytics migrations to load live analytics.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data: result, error: loadError } = await supabase.rpc('get_student_analytics_overview_v11', {
      p_student_id: studentId,
      p_product_id: productId === 'all' ? null : productId,
      p_from: null,
      p_to: null,
    });
    if (loadError) setError(loadError.message);
    else setData(result as StudentAnalyticsPayload);
    setLoading(false);
  }, [productId, studentId]);

  useEffect(() => { void load(); }, [load]);

  const trendChartData = useMemo(
    () => buildTrendData(data?.trends || [], trendMetric, trendView),
    [data?.trends, trendMetric, trendView],
  );

  const strongest = useMemo(
    () => [...(data?.subjects || [])].sort((a, b) => b.student_percentage - a.student_percentage)[0],
    [data?.subjects],
  );
  const priority = useMemo(
    () => [...(data?.subjects || [])].sort((a, b) => a.student_percentage - b.student_percentage)[0],
    [data?.subjects],
  );
  const selectedProduct = useMemo(
    () => (data?.products || []).find((product) => product.id === productId) || null,
    [data?.products, productId],
  );
  const summary = data?.summary;
  const percentageChange = changeFor(data?.trends || [], 'percentage');
  const accuracyChange = changeFor(data?.trends || [], 'accuracy');
  const timeChange = changeFor(data?.trends || [], 'time_score');
  const percentileChange = changeFor(data?.trends || [], 'student_percentile');

  const accuracyValue = accuracyMode === 'overall' ? summary?.accuracy : summary?.attempted_accuracy;
  const accuracyCaption = accuracyMode === 'overall'
    ? `${countText(summary?.correct)} correct of ${countText(summary?.total_questions)} total questions · ${countText(summary?.incorrect)} wrong · ${countText(summary?.unanswered)} not answered`
    : `${countText(summary?.correct)} correct of ${countText((summary?.correct || 0) + (summary?.incorrect || 0))} answered · unanswered questions excluded`;

  const metricCards: Array<{
    label: string;
    value: string;
    caption: string;
    explanation: string;
    change: number | null;
    icon: React.ElementType;
    locked?: boolean;
    amber?: boolean;
    action?: React.ReactNode;
  }> = [
    {
      label: 'Average percentage',
      value: summary?.average_percentage == null ? '—' : `${summary.average_percentage}%`,
      caption: `Latest result from each of ${summary?.completed_tests || 0} completed tests`,
      explanation: 'Evidara keeps the latest submitted attempt for every selected test. It adds those test percentages and divides by the number of completed tests.',
      change: percentageChange,
      icon: Activity,
    },
    {
      label: 'Average percentile',
      value: summary?.percentile_available && summary.average_percentile != null ? `${summary.average_percentile}` : 'Locked',
      caption: summary?.percentile_available
        ? `Compared with up to ${summary.cohort_size || 0} students per test`
        : data?.selected_product
          ? `${data.selected_product.completed_tests}/${data.selected_product.total_tests} product tests completed`
          : 'Choose and complete one product series',
      explanation: 'Each test result is compared with students who wrote the same test. A product percentile unlocks only after all ten tests in that selected series are completed.',
      change: summary?.percentile_available ? percentileChange : null,
      icon: Target,
      locked: !summary?.percentile_available,
      amber: !summary?.percentile_available,
    },
    {
      label: accuracyMode === 'overall' ? 'Accuracy · all questions' : 'Accuracy · answered only',
      value: accuracyValue == null ? '—' : `${accuracyValue}%`,
      caption: accuracyCaption,
      explanation: accuracyMode === 'overall'
        ? 'Overall accuracy = correct answers ÷ total questions × 100. Example: 50 correct, 30 wrong and 20 unanswered gives 50%. This is the primary accuracy shown by Evidara.'
        : 'Answered-only accuracy = correct answers ÷ (correct + incorrect) × 100. Unanswered questions are excluded from this alternate view.',
      change: accuracyChange,
      icon: CheckCircle2,
      action: (
        <button
          type="button"
          className={styles.metricSwapButton}
          onClick={() => setAccuracyMode((current) => current === 'overall' ? 'attempted' : 'overall')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          {accuracyMode === 'overall' ? 'Show answered-only accuracy' : 'Show all-question accuracy'}
        </button>
      ),
    },
    {
      label: 'Time management',
      value: summary?.time_score == null ? '—' : `${summary.time_score} / 10`,
      caption: asNumber(summary?.time_score) >= 8 ? 'Well-controlled pacing' : asNumber(summary?.time_score) >= 6.5 ? 'Improving pacing control' : 'Pacing needs attention',
      explanation: 'Time score = 35% question completion + 25% controlled time per question + 20% avoiding rushed answers + 20% finishing within the test duration. It is converted to a score out of 10.',
      change: timeChange,
      icon: Gauge,
    },
  ];

  const comparisonCards = [
    { label: 'Group average', value: formatted(summary?.comparison_average_percentage, '%'), help: 'Average percentage scored by students on the same selected tests.' },
    { label: 'Top 10% score', value: formatted(summary?.top10_threshold, '%'), help: 'The approximate percentage needed to enter the top 10% of students who wrote the same tests.' },
    { label: 'Top 5% score', value: formatted(summary?.top5_threshold, '%'), help: 'The approximate percentage needed to enter the top 5% of students who wrote the same tests.' },
    { label: 'Highest score', value: formatted(summary?.highest_percentage, '%'), help: 'The highest percentage recorded by a student in the selected tests.' },
    { label: 'Students compared', value: countText(summary?.cohort_size), help: 'The largest number of students with a result for one of the same selected tests.' },
  ];

  function scrollTimeline(direction: 'left' | 'right') {
    timelineRef.current?.scrollBy({ left: direction === 'left' ? -420 : 420, behavior: 'smooth' });
  }

  function toggleTrendSeries(key: TrendSeriesKey) {
    setVisibleTrendSeries((current) => {
      const activeCount = Object.values(current).filter(Boolean).length;
      if (current[key] && activeCount === 1) return current;
      return { ...current, [key]: !current[key] };
    });
  }

  async function openTestDetails(item: AnalyticsTimelineRow) {
    setSelectedTest(item);
    setTestDetail(null);
    setTestDetailError('');
    if (!supabase) return;
    setTestDetailLoading(true);
    const { data: detail, error: detailError } = await supabase.rpc('get_student_test_comparison_v11', {
      p_student_id: studentId,
      p_paper_id: item.paper_id,
    });
    if (detailError) setTestDetailError(detailError.message);
    else setTestDetail(detail as StudentTestComparison);
    setTestDetailLoading(false);
  }

  if (loading && !data) {
    return <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Calculating live student analytics…</div></div>;
  }

  const config = trendConfigs[trendMetric];
  const subjectMax = subjectMetric === 'time_score' ? 10 : 100;

  return (
    <TooltipProvider delayDuration={120}>
      <div className={`${styles.workspace} space-y-5`}>
        <div className={`${styles.noPrint} flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between`}>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Analytics · Student profile</div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#14232B]">{data?.student?.full_name || 'Student analytics'}</h1>
            <p className="mt-1 text-sm text-[#44545C]">
              {data?.student?.organization_name || 'Evidara'} · Grade {data?.student?.grade || '—'} · Section {data?.student?.section_name || 'Unassigned'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {data?.student?.academic_year && <Badge variant="outline">{data.student.academic_year}</Badge>}
              {data?.student?.board && <Badge variant="outline">{data.student.board}</Badge>}
              {(data?.student?.tracks || []).map((track) => <Badge key={track} variant="outline">{track}</Badge>)}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onBack && <Button variant="outline" onClick={onBack}>Back to students</Button>}
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / PDF</Button>
          </div>
        </div>

        {error && <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] px-4 py-3 text-sm text-[#B54747]">{error}</div>}

        <Card className={`${styles.controlPanel} ${styles.noPrint} gap-0`}>
          <CardContent className="p-4 sm:p-5">
            <div className={styles.productSelectorRow}>
              <div className="min-w-0 flex-1">
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[#6B7980]">Analytics product</label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger className="w-full max-w-[620px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All assessments · latest result from each test</SelectItem>
                    {(data?.products || []).map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name} · {product.completed_tests}/{product.total_tests} tests
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className={styles.selectionSummary}>
                <strong className="text-sm text-[#14232B]">{selectedProduct?.name || 'All assessments'}</strong>
                <span className="text-xs text-[#6B7980]">
                  {selectedProduct
                    ? `${selectedProduct.exam_type || 'Multiple exams'} · ${selectedProduct.completed_tests}/${selectedProduct.total_tests} tests completed`
                    : `${summary?.completed_tests || 0} distinct completed tests`}
                </span>
              </div>
            </div>

            {!!data?.timeline?.length && (
              <div className="mt-5 border-t border-[#E7ECEB] pt-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[#14232B]">Test timeline</h2>
                    <p className="mt-0.5 text-xs text-[#6B7980]">Select a test to see its average, highest, lowest, Top 10%, Top 5%, rank and percentile.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" onClick={() => scrollTimeline('left')} aria-label="Earlier tests"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" onClick={() => scrollTimeline('right')} aria-label="Later tests"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div ref={timelineRef} className={styles.timelineViewport}>
                  <div className={styles.timelineCards}>
                    {data.timeline.map((item, index) => (
                      <button
                        key={`${item.paper_id}-${index}`}
                        type="button"
                        onClick={() => void openTestDetails(item)}
                        className={`${styles.timelineCard} ${item.completed ? styles.timelineCardComplete : ''}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={styles.timelineNumber}>{index + 1}</span>
                          {item.percentage != null ? <Badge variant="outline">{Number(item.percentage).toFixed(1)}%</Badge> : <Badge variant="outline">Pending</Badge>}
                        </div>
                        <strong className="mt-3 block line-clamp-2 text-left text-sm text-[#14232B]">{item.display_name}</strong>
                        <span className="mt-2 block text-left text-xs text-[#6B7980]">{dateText(item.submitted_at)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {!summary?.completed_tests ? (
          <Card className="border-[#E7ECEB] shadow-none"><CardContent className={styles.emptyState}><div><Activity className="mx-auto mb-3 h-10 w-10 text-[#9FBDBD]" /><h2 className="font-semibold text-[#14232B]">No completed tests are available</h2><p className="mt-1 text-sm">Submit assessments or choose another product.</p></div></CardContent></Card>
        ) : (
          <>
            {!summary.percentile_available && (
              <div className="flex items-start gap-3 rounded-xl border border-[#E8D39B] bg-[#FFF9E9] px-4 py-3 text-sm text-[#6A4B0B]">
                <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                <div><strong className="text-[#14232B]">Product percentile is locked.</strong><p className="mt-1">Complete all ten tests in one selected series to unlock its average percentile. Percentage, both accuracy views and time management remain visible.</p></div>
              </div>
            )}

            <section className={styles.metricGrid}>
              {metricCards.map(({ label, value, caption, explanation, change, icon: Icon, locked, amber, action }) => (
                <Card key={label} className={`${styles.metricCard} gap-0`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`${styles.metricIcon} ${amber ? styles.metricIconAmber : ''}`}><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-[#44545C]">{label}</p>
                          <MetricInfo text={explanation} />
                        </div>
                        <p className={`${styles.metricValue} ${locked ? 'text-[#9A6508]' : 'text-[#0E5A5A]'}`}>{value}</p>
                        <p className="mt-1 text-xs leading-5 text-[#6B7980]">{caption}</p>
                        {action}
                        {change != null && (
                          <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${change >= 0 ? 'text-[#237A57]' : 'text-[#B54747]'}`}>
                            {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                            {change >= 0 ? '+' : ''}{change.toFixed(1)} from the previous test
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <section className={styles.comparisonGrid}>
              {comparisonCards.map((item) => (
                <div key={item.label} className={styles.comparisonCard}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#6B7980]">{item.label}</span>
                    <MetricInfo text={item.help} />
                  </div>
                  <strong className="mt-2 block text-xl text-[#14232B]">{item.value}</strong>
                </div>
              ))}
            </section>

            <section className={styles.chartGrid}>
              <Card className={`${styles.chartCard} gap-0`}>
                <CardContent className="p-4 sm:p-5">
                  <h2 className="font-semibold text-[#14232B]">Performance profile</h2>
                  <p className="mt-1 text-xs text-[#6B7980]">Subject percentage compared with the group average, Top 10%, Top 5% and highest score.</p>
                  <div className={styles.radarChartHeight}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={data?.subjects || []} margin={{ top: 16, right: 28, bottom: 12, left: 28 }}>
                        <PolarGrid stroke="#DFE6E5" />
                        <PolarAngleAxis dataKey="subject_name" tick={{ fontSize: 11, fill: '#44545C' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6B7980' }} />
                        <Radar name="Your score" dataKey="student_percentage" stroke="#0E5A5A" fill="#0E5A5A" fillOpacity={0.12} strokeWidth={3} />
                        <Radar name="Average" dataKey="average_percentage" stroke="#2E6D8B" fillOpacity={0} strokeDasharray="6 5" />
                        <Radar name="Top 10%" dataKey="top10_threshold" stroke="#6D8F8F" fillOpacity={0} />
                        <Radar name="Top 5%" dataKey="top5_threshold" stroke="#7B61A8" fillOpacity={0} />
                        <Radar name="Highest" dataKey="highest_percentage" stroke="#F2B84B" fillOpacity={0} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <ChartTooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${styles.chartCard} gap-0`}>
                <CardContent className="p-4 sm:p-5">
                  <div className={styles.subjectComparisonHeader}>
                    <div>
                      <h2 className="font-semibold text-[#14232B]">Subject comparison</h2>
                      <p className="mt-1 text-xs text-[#6B7980]">Your result and the average for students who wrote the same selected tests.</p>
                    </div>
                    <Select value={subjectMetric} onValueChange={(value) => setSubjectMetric(value as SubjectMetric)}>
                      <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="accuracy">Overall accuracy</SelectItem>
                        <SelectItem value="time_score">Time score</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className={styles.subjectComparisonRows}>
                    {(data?.subjects || []).map((subject) => {
                      const values = subjectMetricValues(subject, subjectMetric);
                      const studentValue = asNumber(values.student);
                      const averageValue = values.average;
                      const difference = typeof averageValue === 'number' ? studentValue - averageValue : null;
                      return (
                        <div key={subject.subject_name} className={styles.subjectComparisonRow}>
                          <div className={styles.subjectName}>{subject.subject_name}</div>
                          <div className={styles.subjectBarArea}>
                            <div className={styles.subjectTrack}>
                              <div className={styles.subjectFill} style={{ width: `${Math.max(0, Math.min(100, studentValue / subjectMax * 100))}%` }} />
                              {typeof averageValue === 'number' && (
                                <span className={styles.subjectAverageMarker} style={{ left: `${Math.max(0, Math.min(100, averageValue / subjectMax * 100))}%` }} />
                              )}
                            </div>
                          </div>
                          <strong className={styles.subjectValue}>
                            {studentValue.toFixed(1)}{values.suffix}
                          </strong>
                          <span className={`${styles.subjectDifference} ${difference == null || difference >= 0 ? styles.subjectDifferencePositive : styles.subjectDifferenceNegative}`}>
                            {difference == null ? 'No average' : <>{difference >= 0 ? '▲' : '▼'} {Math.abs(difference).toFixed(1)}{values.suffix}</>}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className={styles.subjectAxis}>
                    {[0, 25, 50, 75, 100].map((value) => <span key={value}>{subjectMetric === 'time_score' ? (value / 10).toFixed(value === 0 ? 0 : 1) : value}{subjectMetric === 'time_score' ? '' : '%'}</span>)}
                  </div>
                  <div className={styles.subjectLegend}>
                    <span><i className={styles.legendSolid} />Your result</span>
                    <span><i className={styles.legendAverage} />Average marker</span>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${styles.chartCard} ${styles.trendCard} gap-0`}>
                <CardContent className="overflow-hidden p-4 sm:p-5">
                  <div className={styles.trendHeader}>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-[#14232B]">Performance trends</h2>
                      <p className="mt-1 text-xs text-[#6B7980]">Choose the metric, then turn individual comparison lines on or off.</p>
                    </div>
                    <div className={styles.trendControls}>
                      <Select value={trendView} onValueChange={(value) => setTrendView(value as TrendView)}>
                        <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="tests">Test-wise</SelectItem><SelectItem value="rolling">3-test average</SelectItem></SelectContent>
                      </Select>
                      <Select value={trendMetric} onValueChange={(value) => setTrendMetric(value as TrendMetric)}>
                        <SelectTrigger className="w-full sm:w-[170px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="percentile">Percentile</SelectItem>
                          <SelectItem value="accuracy">Overall accuracy</SelectItem>
                          <SelectItem value="time_score">Time score</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className={styles.seriesToggleGroup}>
                    {seriesDefinitions.map((series) => (
                      <button
                        key={series.key}
                        type="button"
                        onClick={() => toggleTrendSeries(series.key)}
                        className={`${styles.seriesToggle} ${visibleTrendSeries[series.key] ? styles.seriesToggleActive : ''}`}
                      >
                        <span style={{ background: series.stroke }} />
                        {series.label}
                      </button>
                    ))}
                  </div>

                  <div className={styles.trendChartHeight}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ left: -8, right: 18, top: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={18} />
                        <YAxis domain={config.domain} tick={{ fontSize: 10 }} />
                        <ChartTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {seriesDefinitions.map((series) => visibleTrendSeries[series.key] && (
                          <Line
                            key={`${trendMetric}-${series.key}`}
                            name={series.key === 'student' ? config.label : series.label}
                            type="monotone"
                            dataKey={series.key}
                            stroke={series.stroke}
                            strokeWidth={series.key === 'student' ? 3 : 2}
                            strokeDasharray={series.dash}
                            dot={series.key === 'student' ? { r: 3 } : false}
                            connectNulls
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-[#6B7980]">Average and benchmark lines appear when enough students have results for the same test.</p>
                </CardContent>
              </Card>
            </section>

            <Card className={`${styles.insightPanel} gap-0`}>
              <CardContent className="grid gap-4 p-5 md:grid-cols-[52px_minmax(0,1fr)]">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-[#0E5A5A]"><Sparkles className="h-6 w-6" /></div>
                <div>
                  <h2 className="font-semibold text-[#14232B]">Evidence-based next step</h2>
                  <p className="mt-1 text-sm leading-6 text-[#44545C]">
                    {strongest && priority
                      ? `${strongest.subject_name} is currently strongest at ${strongest.student_percentage}%. Prioritise ${priority.subject_name}, currently ${priority.student_percentage}%, while maintaining regular practice in the strongest subject.`
                      : 'More submitted subject-level responses are needed before Evidara can identify a reliable strongest subject and development priority.'}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {strongest && <Badge className="bg-[#DCE9E7] text-[#0E5A5A]">Strength: {strongest.subject_name}</Badge>}
                    {priority && <Badge className="bg-[#FCF1DB] text-[#9A6508]">Priority: {priority.subject_name}</Badge>}
                    <Badge variant="outline">Latest pacing: {asNumber(data?.trends?.at(-1)?.time_score).toFixed(1)}/10</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={!!selectedTest} onOpenChange={(open) => { if (!open) { setSelectedTest(null); setTestDetail(null); setTestDetailError(''); } }}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <div className="overflow-y-auto p-6">
            <DialogHeader>
              <DialogTitle>{selectedTest?.display_name || testDetail?.paper_title || 'Test comparison'}</DialogTitle>
              <DialogDescription>
                {testDetail?.product_name || 'Assessment'} · {testDetail?.submitted_at ? dateText(testDetail.submitted_at) : 'This student has not completed this test'}
              </DialogDescription>
            </DialogHeader>

            {testDetailLoading && <div className="grid min-h-[260px] place-items-center text-sm text-[#6B7980]"><div><LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading this test comparison…</div></div>}
            {testDetailError && <div className="mt-5 rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4 text-sm text-[#B54747]">{testDetailError}</div>}

            {testDetail && !testDetailLoading && (
              <div className="mt-5 space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <div className="rounded-xl border border-[#CFE0DE] bg-[#F2F8F7] p-4"><Activity className="h-5 w-5 text-[#0E5A5A]" /><p className="mt-3 text-xs text-[#6B7980]">Student percentage</p><strong className="mt-1 block text-2xl text-[#0E5A5A]">{formatted(testDetail.student.percentage, '%')}</strong></div>
                  <div className="rounded-xl border border-[#E7ECEB] p-4"><Users className="h-5 w-5 text-[#2E6D8B]" /><p className="mt-3 text-xs text-[#6B7980]">Students who wrote</p><strong className="mt-1 block text-2xl text-[#14232B]">{testDetail.test_takers}</strong></div>
                  <div className="rounded-xl border border-[#E7ECEB] p-4"><Trophy className="h-5 w-5 text-[#9A6508]" /><p className="mt-3 text-xs text-[#6B7980]">Position</p><strong className="mt-1 block text-2xl text-[#14232B]">{testDetail.rank_position ? `${testDetail.rank_position}/${testDetail.test_takers}` : '—'}</strong></div>
                  <div className="rounded-xl border border-[#E7ECEB] p-4"><Target className="h-5 w-5 text-[#7B61A8]" /><p className="mt-3 text-xs text-[#6B7980]">Percentile</p><strong className="mt-1 block text-2xl text-[#14232B]">{formatted(testDetail.student_percentile)}</strong></div>
                  <div className="rounded-xl border border-[#E7ECEB] p-4"><Gauge className="h-5 w-5 text-[#0E5A5A]" /><p className="mt-3 text-xs text-[#6B7980]">Time score</p><strong className="mt-1 block text-2xl text-[#14232B]">{formatted(testDetail.student.time_score, '/10')}</strong></div>
                </div>

                {testDetail.completed ? (
                  <div className="rounded-xl border border-[#E7ECEB] bg-white p-4 text-sm text-[#44545C]">
                    <strong className="text-[#14232B]">Answer summary:</strong> {testDetail.student.correct} correct · {testDetail.student.incorrect} wrong · {testDetail.student.unanswered} not answered · {formatted(testDetail.student.accuracy, '%')} overall accuracy · {formatted(testDetail.student.attempted_accuracy, '%')} answered-only accuracy
                  </div>
                ) : (
                  <div className="rounded-xl border border-[#E8D39B] bg-[#FFF9E9] p-4 text-sm text-[#6A4B0B]">This student has not completed the test. The comparison statistics still show how other students performed.</div>
                )}

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <ComparisonStats title="Percentage comparison" values={testDetail.percentage} />
                  <ComparisonStats title="Overall accuracy" values={testDetail.accuracy} />
                  <ComparisonStats title="Answered-only accuracy" values={testDetail.attempted_accuracy} />
                  <ComparisonStats title="Time-score comparison" values={testDetail.time_score} suffix="/10" />
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
