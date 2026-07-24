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
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type { AnalyticsTrendRow, StudentAnalyticsPayload } from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import styles from './analytics.module.css';

type Props = {
  studentId: string;
  onBack?: () => void;
};

type TrendMetric = 'percentage' | 'accuracy' | 'time_score' | 'percentile';
type TrendView = 'tests' | 'rolling';

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

function rollingAverage(values: AnalyticsTrendRow[], key: TrendMetric) {
  return values.map((row, index) => {
    const window = values.slice(Math.max(0, index - 2), index + 1);
    const valid = window.map((item) => item[key]).filter((value): value is number => typeof value === 'number');
    return {
      ...row,
      [key]: valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null,
    };
  });
}

function metricLabel(metric: TrendMetric) {
  if (metric === 'time_score') return 'Time score';
  return metric[0].toUpperCase() + metric.slice(1);
}

function changeFor(rows: AnalyticsTrendRow[], key: TrendMetric) {
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
      <TooltipContent side="top" className="max-w-[320px] text-xs leading-5">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

export function StudentAnalyticsDashboard({ studentId, onBack }: Props) {
  const [data, setData] = useState<StudentAnalyticsPayload | null>(null);
  const [productId, setProductId] = useState('all');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('percentage');
  const [trendView, setTrendView] = useState<TrendView>('tests');
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
    const { data: result, error: loadError } = await supabase.rpc('get_student_analytics_overview_v10', {
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

  const trends = useMemo(
    () => trendView === 'rolling' ? rollingAverage(data?.trends || [], trendMetric) : (data?.trends || []),
    [data?.trends, trendMetric, trendView],
  );

  const trendChartData = useMemo(() => trends.map((row) => ({
    ...row,
    label: new Date(row.submitted_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
    student: row[trendMetric],
  })), [trendMetric, trends]);

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
  const percentileChange = changeFor(data?.trends || [], 'percentile');

  const metricCards: Array<{
    label: string;
    value: string;
    caption: string;
    explanation: string;
    change: number | null;
    icon: React.ElementType;
    locked?: boolean;
    amber?: boolean;
  }> = [
    {
      label: 'Average percentage',
      value: summary?.average_percentage == null ? '—' : `${summary.average_percentage}%`,
      caption: `Latest result from each of ${summary?.completed_tests || 0} completed tests`,
      explanation: 'Evidara keeps only the latest submitted attempt for every selected test. It adds those test percentages and divides by the number of completed tests.',
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
      explanation: 'For each test, Evidara compares the latest score with other students’ latest scores on the same test. The product average unlocks only after every test in that product is completed.',
      change: summary?.percentile_available ? percentileChange : null,
      icon: Target,
      locked: !summary?.percentile_available,
      amber: !summary?.percentile_available,
    },
    {
      label: 'Accuracy',
      value: summary?.accuracy == null ? '—' : `${summary.accuracy}%`,
      caption: `${countText(summary?.correct)} correct out of ${countText((summary?.correct || 0) + (summary?.incorrect || 0))} answered · ${countText(summary?.unanswered)} unanswered`,
      explanation: 'Accuracy = correct ÷ (correct + incorrect) × 100. Unanswered questions are displayed separately and are not included in the accuracy denominator.',
      change: accuracyChange,
      icon: CheckCircle2,
    },
    {
      label: 'Time management',
      value: summary?.time_score == null ? '—' : `${summary.time_score} / 10`,
      caption: asNumber(summary?.time_score) >= 8 ? 'Well-controlled pacing' : asNumber(summary?.time_score) >= 6.5 ? 'Improving pacing control' : 'Pacing needs attention',
      explanation: 'Time score = 35% question completion + 25% controlled time per question + 20% avoiding rushed answers + 20% finishing within the test time. The result is converted to a score out of 10.',
      change: timeChange,
      icon: Gauge,
    },
  ];

  const comparisonCards = [
    {
      label: 'Group average',
      value: formatted(summary?.comparison_average_percentage, '%'),
      help: 'Average percentage scored by comparison students on the same selected tests.',
    },
    {
      label: 'Top 10% score',
      value: formatted(summary?.top10_threshold, '%'),
      help: 'The approximate score needed to enter the top 10% of comparison students. This is the 90th-percentile score line.',
    },
    {
      label: 'Top 5% score',
      value: formatted(summary?.top5_threshold, '%'),
      help: 'The approximate score needed to enter the top 5% of comparison students. This is the 95th-percentile score line.',
    },
    {
      label: 'Highest score',
      value: formatted(summary?.highest_percentage, '%'),
      help: 'The highest percentage recorded among comparison students across the selected tests.',
    },
    {
      label: 'Students compared',
      value: countText(summary?.cohort_size),
      help: 'The largest number of students whose latest result was available for one of the same selected tests.',
    },
  ];

  function scrollTimeline(direction: 'left' | 'right') {
    timelineRef.current?.scrollBy({ left: direction === 'left' ? -420 : 420, behavior: 'smooth' });
  }

  if (loading && !data) {
    return <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Calculating live student analytics…</div></div>;
  }

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
                  <SelectTrigger className="w-full max-w-[560px]"><SelectValue /></SelectTrigger>
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
                    <p className="mt-0.5 text-xs text-[#6B7980]">Each test is listed once with its latest submitted date.</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="icon" variant="outline" onClick={() => scrollTimeline('left')} aria-label="Earlier tests"><ChevronLeft className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" onClick={() => scrollTimeline('right')} aria-label="Later tests"><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
                <div ref={timelineRef} className={styles.timelineViewport}>
                  <div className={styles.timelineCards}>
                    {data.timeline.map((item, index) => (
                      <article key={`${item.paper_id}-${index}`} className={`${styles.timelineCard} ${item.completed ? styles.timelineCardComplete : ''}`}>
                        <div className="flex items-center justify-between gap-3">
                          <span className={styles.timelineNumber}>{index + 1}</span>
                          {item.percentage != null && <Badge variant="outline">{Number(item.percentage).toFixed(1)}%</Badge>}
                        </div>
                        <strong className="mt-3 block line-clamp-2 text-sm text-[#14232B]">{item.display_name}</strong>
                        <span className="mt-2 block text-xs text-[#6B7980]">{dateText(item.submitted_at)}</span>
                      </article>
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
                <div><strong className="text-[#14232B]">Product percentile is locked.</strong><p className="mt-1">Percentage, accuracy and time management remain visible. Complete every test in one selected product to unlock its average percentile.</p></div>
              </div>
            )}

            <section className={styles.metricGrid}>
              {metricCards.map(({ label, value, caption, explanation, change, icon: Icon, locked, amber }) => (
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
                  <h2 className="font-semibold text-[#14232B]">Subject performance profile</h2>
                  <p className="mt-1 text-xs text-[#6B7980]">Your score compared with the group average, Top 10%, Top 5% and highest score.</p>
                  <div className={styles.radarChartHeight}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={data?.subjects || []} margin={{ top: 16, right: 28, bottom: 12, left: 28 }}>
                        <PolarGrid stroke="#DFE6E5" />
                        <PolarAngleAxis dataKey="subject_name" tick={{ fontSize: 11, fill: '#44545C' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#6B7980' }} />
                        <Radar name="Your score" dataKey="student_percentage" stroke="#0E5A5A" fill="#0E5A5A" fillOpacity={0.12} strokeWidth={3} />
                        <Radar name="Group average" dataKey="average_percentage" stroke="#2E6D8B" fillOpacity={0} strokeDasharray="6 5" />
                        <Radar name="Top 10% score" dataKey="top10_threshold" stroke="#6D8F8F" fillOpacity={0} />
                        <Radar name="Top 5% score" dataKey="top5_threshold" stroke="#7B61A8" fillOpacity={0} />
                        <Radar name="Highest score" dataKey="highest_percentage" stroke="#F2B84B" fillOpacity={0} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <ChartTooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${styles.chartCard} gap-0`}>
                <CardContent className="p-4 sm:p-5">
                  <h2 className="font-semibold text-[#14232B]">Subject comparison</h2>
                  <p className="mt-1 text-xs text-[#6B7980]">The same five reference levels shown as compact subject bars.</p>
                  <div className={styles.barChartHeight}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.subjects || []} layout="vertical" margin={{ left: 10, right: 12, top: 10 }} barCategoryGap="20%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <YAxis type="category" dataKey="subject_name" width={98} tick={{ fontSize: 11 }} />
                        <ChartTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar name="Your score" dataKey="student_percentage" fill="#0E5A5A" radius={[0, 3, 3, 0]} />
                        <Bar name="Group average" dataKey="average_percentage" fill="#9FBDBD" radius={[0, 3, 3, 0]} />
                        <Bar name="Top 10%" dataKey="top10_threshold" fill="#2E6D8B" radius={[0, 3, 3, 0]} />
                        <Bar name="Top 5%" dataKey="top5_threshold" fill="#7B61A8" radius={[0, 3, 3, 0]} />
                        <Bar name="Highest" dataKey="highest_percentage" fill="#F2B84B" radius={[0, 3, 3, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${styles.chartCard} ${styles.trendCard} gap-0`}>
                <CardContent className="overflow-hidden p-4 sm:p-5">
                  <div className={styles.trendHeader}>
                    <div className="min-w-0">
                      <h2 className="font-semibold text-[#14232B]">Performance trends</h2>
                      <p className="mt-1 text-xs text-[#6B7980]">Test-wise results or a three-test rolling average.</p>
                    </div>
                    <div className={styles.trendControls}>
                      <Select value={trendView} onValueChange={(value) => setTrendView(value as TrendView)}>
                        <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="tests">Test-wise</SelectItem><SelectItem value="rolling">3-test average</SelectItem></SelectContent>
                      </Select>
                      <Select value={trendMetric} onValueChange={(value) => setTrendMetric(value as TrendMetric)}>
                        <SelectTrigger className="w-full sm:w-[150px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="accuracy">Accuracy</SelectItem>
                          <SelectItem value="time_score">Time score</SelectItem>
                          <SelectItem value="percentile">Percentile</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className={styles.trendChartHeight}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ left: -8, right: 18, top: 10, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" />
                        <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={18} />
                        <YAxis domain={trendMetric === 'time_score' ? [0, 10] : [0, 100]} tick={{ fontSize: 10 }} />
                        <ChartTooltip />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Line name={metricLabel(trendMetric)} type="monotone" dataKey="student" stroke="#0E5A5A" strokeWidth={3} dot={{ r: 3 }} connectNulls />
                        {trendMetric === 'percentage' && <Line name="Group average" type="monotone" dataKey="average_percentage" stroke="#2E6D8B" strokeDasharray="6 5" dot={false} connectNulls />}
                        {trendMetric === 'percentage' && <Line name="Top 10% score" type="monotone" dataKey="top10_threshold" stroke="#6D8F8F" strokeDasharray="4 4" dot={false} connectNulls />}
                        {trendMetric === 'percentage' && <Line name="Top 5% score" type="monotone" dataKey="top5_threshold" stroke="#7B61A8" strokeDasharray="3 4" dot={false} connectNulls />}
                        {trendMetric === 'percentage' && <Line name="Highest score" type="monotone" dataKey="highest_percentage" stroke="#F2B84B" dot={false} connectNulls />}
                        {trendMetric === 'percentile' && <ReferenceLine y={50} stroke="#9FBDBD" strokeDasharray="6 5" label={{ value: 'Average percentile', fontSize: 10, fill: '#6B7980' }} />}
                        {trendMetric === 'percentile' && <ReferenceLine y={90} stroke="#2E6D8B" strokeDasharray="4 4" label={{ value: 'Top 10%', fontSize: 10, fill: '#2E6D8B' }} />}
                        {trendMetric === 'percentile' && <ReferenceLine y={95} stroke="#7B61A8" strokeDasharray="3 4" label={{ value: 'Top 5%', fontSize: 10, fill: '#7B61A8' }} />}
                        {trendMetric === 'percentile' && <ReferenceLine y={100} stroke="#F2B84B" label={{ value: 'Highest', fontSize: 10, fill: '#9A6508' }} />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-xs text-[#6B7980]">Comparison lines appear only when enough students have submitted the same test.</p>
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
    </TooltipProvider>
  );
}
