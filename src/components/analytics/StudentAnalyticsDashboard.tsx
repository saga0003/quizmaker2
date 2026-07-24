'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Gauge,
  Info,
  LoaderCircle,
  LockKeyhole,
  Printer,
  RefreshCw,
  RotateCcw,
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
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import type {
  AnalyticsProduct,
  AnalyticsTrendRow,
  StudentAnalyticsPayload,
} from '@/types/analytics';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import styles from './analytics.module.css';

type Props = {
  studentId: string;
  onBack?: () => void;
};

type TrendMetric = 'percentage' | 'accuracy' | 'time_score' | 'percentile';
type TrendView = 'tests' | 'rolling';

function dateText(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function asNumber(value?: number | null) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function ProductButton({
  product,
  active,
  onClick,
}: {
  product: AnalyticsProduct;
  active: boolean;
  onClick: () => void;
}) {
  const progress = product.total_tests
    ? Math.min(100, (product.completed_tests / product.total_tests) * 100)
    : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${styles.productButton} ${active ? styles.productButtonActive : ''}`}
    >
      <strong className="block text-sm text-[#14232B]">{product.name}</strong>
      <span className="mt-1 block text-xs text-[#6B7980]">
        {product.exam_type || 'Multiple exams'} · {product.completed_tests}/{product.total_tests} tests
      </span>
      <div className="mt-3 flex items-center gap-2">
        <div className={`${styles.progressTrack} flex-1`}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[11px] font-semibold text-[#44545C]">{Math.round(progress)}%</span>
      </div>
      <span className={`mt-2 flex items-center gap-1 text-[11px] font-semibold ${product.completed_tests >= product.total_tests && product.total_tests > 0 ? 'text-[#237A57]' : 'text-[#9A6508]'}`}>
        {product.completed_tests >= product.total_tests && product.total_tests > 0
          ? <><CheckCircle2 className="h-3 w-3" />Series completed</>
          : <><Clock3 className="h-3 w-3" />Series in progress</>}
      </span>
    </button>
  );
}

export function StudentAnalyticsDashboard({ studentId, onBack }: Props) {
  const [data, setData] = useState<StudentAnalyticsPayload | null>(null);
  const [productId, setProductId] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('percentage');
  const [trendView, setTrendView] = useState<TrendView>('tests');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Connect Supabase and apply migration 35 to load live analytics.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data: result, error: loadError } = await supabase.rpc('get_student_analytics_overview_v10', {
      p_student_id: studentId,
      p_product_id: productId === 'all' ? null : productId,
      p_from: from || null,
      p_to: to || null,
    });
    if (loadError) {
      setError(/get_student_analytics_overview_v10/i.test(loadError.message)
        ? 'Apply Supabase migration 35 to enable Analytics Phase 1.'
        : loadError.message);
    } else {
      setData(result as StudentAnalyticsPayload);
    }
    setLoading(false);
  }, [from, productId, studentId, to]);

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

  const percentageChange = changeFor(data?.trends || [], 'percentage');
  const accuracyChange = changeFor(data?.trends || [], 'accuracy');
  const timeChange = changeFor(data?.trends || [], 'time_score');
  const percentileChange = changeFor(data?.trends || [], 'percentile');

  function applyQuickRange(count: number) {
    const rows = data?.trends || [];
    if (!rows.length) return;
    const selected = rows.slice(-count);
    setFrom(selected[0]?.submitted_at.slice(0, 10) || '');
    setTo(selected.at(-1)?.submitted_at.slice(0, 10) || '');
  }

  function resetFilters() {
    setFrom('');
    setTo('');
  }

  const summary = data?.summary;
  const metricCards: Array<{
    label: string;
    value: string;
    caption: string;
    change: number | null;
    icon: React.ElementType;
    locked?: boolean;
    amber?: boolean;
  }> = [
    {
      label: 'Average percentage',
      value: summary?.average_percentage == null ? '—' : `${summary.average_percentage}%`,
      caption: `Average of ${summary?.completed_tests || 0} completed tests`,
      change: percentageChange,
      icon: Activity,
    },
    {
      label: 'Average percentile',
      value: summary?.percentile_available && summary.average_percentile != null ? `${summary.average_percentile}` : 'Locked',
      caption: summary?.percentile_available
        ? `Cohort reference · n=${summary.cohort_size || 0}`
        : data?.selected_product
          ? `${data.selected_product.completed_tests}/${data.selected_product.total_tests} product tests complete`
          : 'Choose and complete a product series',
      change: summary?.percentile_available ? percentileChange : null,
      icon: Target,
      locked: !summary?.percentile_available,
      amber: !summary?.percentile_available,
    },
    {
      label: 'Accuracy',
      value: summary?.accuracy == null ? '—' : `${summary.accuracy}%`,
      caption: `${summary?.correct || 0} correct of ${(summary?.correct || 0) + (summary?.incorrect || 0)} attempted`,
      change: accuracyChange,
      icon: CheckCircle2,
    },
    {
      label: 'Time management',
      value: summary?.time_score == null ? '—' : `${summary.time_score} / 10`,
      caption: asNumber(summary?.time_score) >= 8 ? 'Well-controlled pacing' : asNumber(summary?.time_score) >= 6.5 ? 'Improving pacing control' : 'Pacing needs attention',
      change: timeChange,
      icon: Gauge,
    },
  ];

  if (loading && !data) {
    return <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Calculating live student analytics…</div></div>;
  }

  return (
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

      <div className={styles.dashboardShell}>
        <aside className={`${styles.productRail} ${styles.noPrint}`}>
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-[#6B7980]">Analytics products</p>
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setProductId('all')}
              className={`${styles.productButton} ${productId === 'all' ? styles.productButtonActive : ''}`}
            >
              <strong className="block text-sm text-[#14232B]">All assessments</strong>
              <span className="mt-1 block text-xs text-[#6B7980]">Every submitted test available to this profile</span>
            </button>
            {(data?.products || []).map((product) => (
              <ProductButton key={product.id} product={product} active={productId === product.id} onClick={() => setProductId(product.id)} />
            ))}
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          <Card className={`${styles.filterPanel} ${styles.noPrint} gap-0`}>
            <CardContent className="p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(280px,1fr)_minmax(340px,1fr)_auto] xl:items-end">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-[#44545C]">Date band</label>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                    <span className="text-xs text-[#6B7980]">to</span>
                    <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
                  </div>
                </div>
                <div>
                  <span className="mb-2 block text-xs font-semibold text-[#44545C]">Quick range</span>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => applyQuickRange(3)}>Last 3</Button>
                    <Button size="sm" variant="outline" onClick={() => applyQuickRange(5)}>Last 5</Button>
                    <Button size="sm" variant="outline" onClick={() => applyQuickRange(999)}>Full history</Button>
                  </div>
                </div>
                <Button variant="outline" onClick={resetFilters}><RotateCcw className="mr-2 h-4 w-4" />Reset</Button>
              </div>
              {!!data?.timeline?.length && (
                <div className="mt-4 overflow-x-auto border-t border-[#E7ECEB] pt-4">
                  <div className={styles.timeline}>
                    {data.timeline.map((item, index) => (
                      <div key={`${item.paper_id}-${index}`} className={styles.timelineItem}>
                        <span className={`${styles.timelineDot} ${item.completed ? styles.timelineDotComplete : styles.timelineDotPending}`} />
                        <strong className="block max-w-[130px] truncate text-xs text-[#44545C]">{item.display_name}</strong>
                        <span className="mt-1 block text-[11px] text-[#6B7980]">{item.submitted_at ? dateText(item.submitted_at) : 'Pending'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {!summary?.completed_tests ? (
            <Card className="border-[#E7ECEB] shadow-none"><CardContent className={styles.emptyState}><div><Activity className="mx-auto mb-3 h-10 w-10 text-[#9FBDBD]" /><h2 className="font-semibold text-[#14232B]">No completed tests in this range</h2><p className="mt-1 text-sm">Submit assessments or change the product and date filters.</p></div></CardContent></Card>
          ) : (
            <>
              {!summary.percentile_available && (
                <div className="flex items-start gap-3 rounded-xl border border-[#E8D39B] bg-[#FFF9E9] px-4 py-3 text-sm text-[#6A4B0B]">
                  <LockKeyhole className="mt-0.5 h-5 w-5 shrink-0" />
                  <div><strong className="text-[#14232B]">Product percentile is locked.</strong><p className="mt-1">Percentage, accuracy and pacing remain available. Select a product and complete every included test to unlock its average percentile.</p></div>
                </div>
              )}

              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {metricCards.map(({ label, value, caption, change, icon: Icon, locked, amber }) => (
                  <Card key={label} className={`${styles.metricCard} gap-0`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`${styles.metricIcon} ${amber ? styles.metricIconAmber : ''}`}><Icon className="h-6 w-6" /></div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-[#44545C]">{label}</p>
                          <p className={`mt-1 text-3xl font-extrabold tracking-tight ${locked ? 'text-[#9A6508]' : 'text-[#0E5A5A]'}`}>{value}</p>
                          <p className="mt-1 text-xs leading-5 text-[#6B7980]">{caption}</p>
                          {change != null && (
                            <p className={`mt-2 flex items-center gap-1 text-xs font-semibold ${change >= 0 ? 'text-[#237A57]' : 'text-[#B54747]'}`}>
                              {change >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                              {change >= 0 ? '+' : ''}{change.toFixed(1)} from previous test
                            </p>
                          )}
                        </div>
                        <Info className="h-4 w-4 shrink-0 text-[#AEB8BC]" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </section>

              <section className="grid gap-4 xl:grid-cols-3">
                <Card className={`${styles.chartCard} gap-0`}>
                  <CardContent className="p-4">
                    <h2 className="font-semibold text-[#14232B]">Performance profile</h2>
                    <p className="mt-1 text-xs text-[#6B7980]">Subject performance against anonymous cohort reference values.</p>
                    <div className="mt-4 h-[370px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={data?.subjects || []}>
                          <PolarGrid stroke="#DFE6E5" />
                          <PolarAngleAxis dataKey="subject_name" tick={{ fontSize: 11, fill: '#44545C' }} />
                          <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6B7980' }} />
                          <Radar name="Student" dataKey="student_percentage" stroke="#0E5A5A" fill="#0E5A5A" fillOpacity={0.12} strokeWidth={3} />
                          <Radar name="Cohort average" dataKey="average_percentage" stroke="#2E6D8B" fillOpacity={0} strokeDasharray="6 5" />
                          <Radar name="Highest" dataKey="highest_percentage" stroke="#F2B84B" fillOpacity={0} />
                          <Legend />
                          <ChartTooltip />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${styles.chartCard} gap-0`}>
                  <CardContent className="p-4">
                    <h2 className="font-semibold text-[#14232B]">Subject comparison</h2>
                    <p className="mt-1 text-xs text-[#6B7980]">Average percentage by subject in the selected evidence window.</p>
                    <div className="mt-4 h-[370px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data?.subjects || []} layout="vertical" margin={{ left: 18, right: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" horizontal={false} />
                          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} />
                          <YAxis type="category" dataKey="subject_name" width={92} tick={{ fontSize: 11 }} />
                          <ChartTooltip />
                          <Legend />
                          <Bar name="Student" dataKey="student_percentage" fill="#0E5A5A" radius={[0, 4, 4, 0]} />
                          <Bar name="Average" dataKey="average_percentage" fill="#9FBDBD" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className={`${styles.chartCard} gap-0`}>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-semibold text-[#14232B]">Performance trends</h2>
                        <p className="mt-1 text-xs text-[#6B7980]">Test-wise evidence or a three-test rolling average.</p>
                      </div>
                      <div className="flex gap-2">
                        <Select value={trendView} onValueChange={(value) => setTrendView(value as TrendView)}>
                          <SelectTrigger className="w-[128px]"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="tests">Test-wise</SelectItem><SelectItem value="rolling">3-test average</SelectItem></SelectContent>
                        </Select>
                        <Select value={trendMetric} onValueChange={(value) => setTrendMetric(value as TrendMetric)}>
                          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">Percentage</SelectItem>
                            <SelectItem value="accuracy">Accuracy</SelectItem>
                            <SelectItem value="time_score">Time score</SelectItem>
                            <SelectItem value="percentile">Percentile</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mt-4 h-[330px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendChartData} margin={{ left: -12, right: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis domain={trendMetric === 'time_score' ? [0, 10] : [0, 100]} tick={{ fontSize: 10 }} />
                          <ChartTooltip />
                          <Legend />
                          <Line name={metricLabel(trendMetric)} type="monotone" dataKey="student" stroke="#0E5A5A" strokeWidth={3} dot={{ r: 4 }} connectNulls />
                          {trendMetric === 'percentage' && <Line name="Cohort average" type="monotone" dataKey="average_percentage" stroke="#2E6D8B" strokeDasharray="6 5" connectNulls />}
                          {trendMetric === 'percentage' && <Line name="Top 10% threshold" type="monotone" dataKey="top10_threshold" stroke="#F2B84B" strokeDasharray="3 4" connectNulls />}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-[#6B7980]">Anonymous cohort series are shown only when at least five comparable submitted attempts exist.</p>
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
        </main>
      </div>
    </div>
  );
}
