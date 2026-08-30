'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  LoaderCircle,
  PackageCheck,
  Play,
  RefreshCw,
  Target,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import type { AttemptResult, StudentPaperSummary } from '@/types/papers';

type ProductRelation = {
  name?: string | null;
  cover_image_url?: string | null;
} | Array<{
  name?: string | null;
  cover_image_url?: string | null;
}> | null;

type StudentEntitlement = {
  id: string;
  status: string;
  source: string;
  starts_at: string;
  expires_at: string | null;
  attempts_limit: number | null;
  attempts_used: number;
  organization_id: string | null;
  products: ProductRelation;
};

type DashboardState = {
  papers: StudentPaperSummary[] | null;
  results: AttemptResult[] | null;
  entitlements: StudentEntitlement[] | null;
};

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const emptyState: DashboardState = {
  papers: null,
  results: null,
  entitlements: null,
};

function productName(products: ProductRelation) {
  const product = Array.isArray(products) ? products[0] : products;
  return product?.name || 'Evidara product';
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return 'No closing date';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', includeTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
}

function percentageValue(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function scoreClass(percentage: number) {
  if (percentage >= 80) return 'text-emerald-600';
  if (percentage >= 60) return 'text-amber-600';
  return 'text-[var(--destructive)]';
}

function sourceError(label: string, message: string) {
  return `${label}: ${message}`;
}

export function StudentDashboard() {
  const { setView, setSidebarOpen, user } = useAppStore();
  const [data, setData] = useState<DashboardState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!supabase) {
      setData(emptyState);
      setErrors(['Supabase is not configured. Live student data is unavailable.']);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrors([]);

    const [paperResult, attemptResult, entitlementResult] = await Promise.all([
      supabase.rpc('list_available_papers'),
      supabase.rpc('list_my_attempt_results'),
      supabase.rpc('list_my_entitlements_v12'),
    ]);

    const nextErrors: string[] = [];
    if (paperResult.error) nextErrors.push(sourceError('Available tests', paperResult.error.message));
    if (attemptResult.error) nextErrors.push(sourceError('Attempt history', attemptResult.error.message));
    if (entitlementResult.error) nextErrors.push(sourceError('Product access', entitlementResult.error.message));

    setData({
      papers: paperResult.error ? null : ((paperResult.data || []) as StudentPaperSummary[]),
      results: attemptResult.error ? null : ((attemptResult.data || []) as AttemptResult[]),
      entitlements: entitlementResult.error
        ? null
        : ((entitlementResult.data || []) as unknown as StudentEntitlement[]),
    });
    setErrors(nextErrors);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 640px)');
    const collapseSidebar = () => {
      if (narrow.matches) setSidebarOpen(false);
    };
    collapseSidebar();
    narrow.addEventListener('change', collapseSidebar);
    return () => narrow.removeEventListener('change', collapseSidebar);
  }, [setSidebarOpen]);

  const submittedResults = useMemo(
    () => data.results?.filter((result) => result.status === 'submitted' && result.submitted_at) ?? null,
    [data.results],
  );
  const startablePapers = useMemo(
    () => data.papers?.filter((paper) => paper.attempts_used < paper.attempt_limit) ?? null,
    [data.papers],
  );
  const activeEntitlements = useMemo(() => data.entitlements?.filter((entitlement) => (
    entitlement.status === 'active'
    && (!entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now())
  )) ?? null, [data.entitlements]);
  const averagePerformance = useMemo(() => {
    if (!submittedResults?.length) return null;
    return submittedResults.reduce((sum, result) => sum + percentageValue(result.percentage), 0) / submittedResults.length;
  }, [submittedResults]);
  const trend = useMemo(() => [...(submittedResults ?? [])]
    .slice(0, 8)
    .reverse()
    .map((result) => {
      const answered = Number(result.correct_count) + Number(result.incorrect_count);
      return {
        assessment: formatDate(result.submitted_at),
        score: Number(percentageValue(result.percentage).toFixed(1)),
        accuracy: answered > 0
          ? Number(((Number(result.correct_count) / answered) * 100).toFixed(1))
          : 0,
      };
    }), [submittedResults]);

  const firstName = user?.name?.trim().split(/\s+/)[0] || 'student';

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto grid min-h-[420px] max-w-7xl place-items-center rounded-2xl border border-[var(--line)] bg-white text-center text-sm text-[var(--muted-foreground)]">
          <div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin text-[var(--teal)]" />Loading your live dashboard…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-w-0 bg-[var(--canvas)]">
      <div className="mx-auto max-w-7xl flex flex-col gap-4 sm:gap-5 lg:gap-6 p-4 sm:p-6 lg:p-8">
        <motion.section {...fadeIn} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--secondary)] to-[#c5ddd9] p-4 sm:p-5 lg:p-6">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[var(--teal)]/5" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <Badge className="mb-3 border-[var(--teal)]/20 bg-white/60 text-[var(--teal)]">Live student workspace</Badge>
              <h1 className="break-words text-2xl font-bold text-[var(--foreground)] sm:text-3xl">Welcome back, {firstName}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">Your summary is calculated only from assessments and access currently authorized for your account.</p>
            </div>
            <Button variant="outline" onClick={() => void load()} className="shrink-0 border-white/70 bg-white/60 text-[var(--teal)] hover:bg-white">
              <RefreshCw className="mr-2 h-4 w-4" />Refresh
            </Button>
          </div>
        </motion.section>

        {errors.length > 0 && (
          <div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 p-4 text-sm text-[#8A3C3C]" role="alert">
            <div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><div><strong>Some live data could not be loaded.</strong><ul className="mt-1 list-disc space-y-1 pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul></div></div>
          </div>
        )}

        <motion.div {...fadeIn} transition={{ duration: 0.35, delay: 0.05 }} className="grid grid-cols-1 gap-4 sm:gap-5 lg:gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Available tests', value: startablePapers?.length, icon: FileText, color: 'bg-[var(--secondary)] text-[var(--teal)]' },
            { label: 'Submitted tests', value: submittedResults?.length, icon: CheckCircle2, color: 'bg-emerald-50 text-emerald-600' },
            { label: 'Average performance', value: averagePerformance === null ? null : `${averagePerformance.toFixed(1)}%`, icon: Target, color: 'bg-amber-50 text-amber-600' },
            { label: 'Active products', value: activeEntitlements?.length, icon: PackageCheck, color: 'bg-blue-50 text-[var(--info)]' },
          ].map((metric) => (
            <Card key={metric.label} className="min-w-0 rounded-xl border-[var(--line)] bg-white py-4 shadow-sm">
              <CardContent className="flex min-w-0 items-center gap-3 px-4 py-0">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${metric.color}`}><metric.icon className="h-5 w-5" /></div>
                <div className="min-w-0"><p className="truncate text-xs text-[var(--muted-foreground)]">{metric.label}</p><p className="mt-0.5 text-xl font-bold text-[var(--foreground)]">{metric.value ?? '—'}</p></div>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {submittedResults?.length === 0 && (
          <motion.section {...fadeIn} className="rounded-2xl border border-[var(--teal)]/15 bg-white p-4 sm:p-5 lg:p-6 shadow-sm">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--secondary)]"><BookOpen className="h-5 w-5 text-[var(--teal)]" /></div>
                <div><h2 className="font-semibold text-[var(--foreground)]">Start building your assessment history</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">Take an available test first. Submitted attempts will then populate your result history, average performance, and evidence trend. If no test is listed, check your product access or ask your institution when the next assessment will be published.</p></div>
              </div>
              <Button onClick={() => setView('student-tests')} className="shrink-0 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Play className="mr-2 h-4 w-4" />View tests</Button>
            </div>
          </motion.section>
        )}

        <div className="flex flex-wrap gap-3">
          <Button onClick={() => setView('student-tests')} className="bg-[var(--amber)] font-semibold text-[var(--foreground)] hover:bg-[#e5a938]"><Play className="mr-2 h-4 w-4" />Take a Test</Button>
          <Button variant="outline" onClick={() => setView('student-results')} className="border-[var(--teal)]/30 text-[var(--teal)] hover:bg-[var(--secondary)]">View Results</Button>
          <Button variant="outline" onClick={() => setView('student-resources')} className="border-[var(--line)] text-[var(--muted-foreground)] hover:bg-[var(--secondary)]">Study Resources</Button>
        </div>

        <div className="grid min-w-0 gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-5">
          <motion.div {...fadeIn} className="min-w-0 lg:col-span-3">
            <Card className="h-full min-w-0 rounded-xl border-[var(--line)] bg-white shadow-sm">
              <CardHeader><CardTitle className="text-base text-[var(--foreground)]">Performance trend</CardTitle><CardDescription>Submitted score and answer accuracy from your latest attempts</CardDescription></CardHeader>
              <CardContent>
                {trend.length >= 2 ? (
                  <div className="min-h-[16rem] min-w-0 sm:min-h-[18rem]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trend} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                        <XAxis dataKey="assessment" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} minTickGap={20} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={{ stroke: 'var(--line)' }} />
                        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid var(--line)', fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
                        <Line type="monotone" dataKey="score" stroke="var(--teal)" strokeWidth={2.5} dot={{ r: 3 }} name="Score %" />
                        <Line type="monotone" dataKey="accuracy" stroke="var(--info)" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 3" name="Answer accuracy %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="grid min-h-64 place-items-center rounded-xl bg-[var(--canvas)] px-5 text-center"><div><BarChart3 className="mx-auto h-9 w-9 text-[#AEB8BC]" /><h3 className="mt-3 font-semibold text-[var(--foreground)]">More evidence is needed</h3><p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">A trend appears after at least two submitted tests. No benchmark or synthetic result is substituted.</p></div></div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div {...fadeIn} className="min-w-0 lg:col-span-2">
            <Card className="h-full min-w-0 rounded-xl border-[var(--line)] bg-white shadow-sm">
              <CardHeader><CardTitle className="text-base text-[var(--foreground)]">Available tests</CardTitle><CardDescription>Open assessments your account can currently access</CardDescription></CardHeader>
              <CardContent className="pt-0">
                {startablePapers === null ? <Unavailable copy="Test availability could not be loaded." /> : startablePapers.length === 0 ? <Empty copy="No eligible open tests are available right now." /> : startablePapers.slice(0, 3).map((paper, index) => (
                  <div key={paper.id}>
                    <div className="flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0"><p className="break-words text-sm font-medium text-[var(--foreground)]">{paper.title}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]"><span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{paper.duration_minutes} min</span><span>{paper.total_questions} questions</span><span>{Math.max(0, paper.attempt_limit - paper.attempts_used)} attempts left</span>{paper.available_until && <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Closes {formatDate(paper.available_until)}</span>}</div></div>
                      <Button size="sm" onClick={() => setView('student-tests')} className="shrink-0 bg-[var(--teal)] text-white hover:bg-[#0A4747]">Open</Button>
                    </div>
                    {index < Math.min(startablePapers.length, 3) - 1 && <Separator className="bg-[var(--line)]" />}
                  </div>
                ))}
              </CardContent>
              {startablePapers && startablePapers.length > 0 && <CardFooter><Button variant="ghost" className="ml-auto text-xs text-[var(--teal)]" onClick={() => setView('student-tests')}>View all tests<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></CardFooter>}
            </Card>
          </motion.div>
        </div>

        <div className="grid min-w-0 gap-4 sm:gap-5 lg:gap-6 lg:grid-cols-2">
          <Card className="min-w-0 rounded-xl border-[var(--line)] bg-white shadow-sm">
            <CardHeader><CardTitle className="text-base text-[var(--foreground)]">Recent results</CardTitle><CardDescription>Your latest submitted assessment outcomes</CardDescription></CardHeader>
            <CardContent className="pt-0">
              {submittedResults === null ? <Unavailable copy="Attempt history could not be loaded." /> : submittedResults.length === 0 ? <Empty copy="No submitted results yet." /> : submittedResults.slice(0, 3).map((result, index) => {
                const percentage = percentageValue(result.percentage);
                return <div key={result.attempt_id}><div className="flex min-w-0 items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--foreground)]">{result.paper_title}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{formatDate(result.submitted_at, true)} · {result.correct_count} correct · {result.incorrect_count} incorrect</p></div><div className="shrink-0 text-right"><p className={`text-lg font-bold ${scoreClass(percentage)}`}>{percentage.toFixed(1)}%</p><p className="text-[11px] text-[var(--muted-foreground)]">{result.score}/{result.maximum_marks}</p></div></div>{index < Math.min(submittedResults.length, 3) - 1 && <Separator className="bg-[var(--line)]" />}</div>;
              })}
            </CardContent>
            {submittedResults && submittedResults.length > 0 && <CardFooter><Button variant="ghost" className="ml-auto text-xs text-[var(--teal)]" onClick={() => setView('student-results')}>View all results<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></CardFooter>}
          </Card>

          <Card className="min-w-0 rounded-xl border-[var(--line)] bg-white shadow-sm">
            <CardHeader><CardTitle className="text-base text-[var(--foreground)]">Active product access</CardTitle><CardDescription>Current individual purchases and assigned school seats</CardDescription></CardHeader>
            <CardContent className="pt-0">
              {activeEntitlements === null ? <Unavailable copy="Product access could not be loaded." /> : activeEntitlements.length === 0 ? <Empty copy="No active purchased or school-assigned products were found." /> : activeEntitlements.slice(0, 3).map((entitlement, index) => {
                const remaining = entitlement.attempts_limit === null ? null : Math.max(0, entitlement.attempts_limit - entitlement.attempts_used);
                return <div key={entitlement.id}><div className="min-w-0 py-3"><div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="truncate text-sm font-medium text-[var(--foreground)]">{productName(entitlement.products)}</p><p className="mt-1 text-xs capitalize text-[var(--muted-foreground)]">{entitlement.organization_id ? 'Institution-assigned access' : 'Individual access'} · {entitlement.source.replaceAll('_', ' ')}</p></div><Badge variant="outline" className="w-fit shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700">Active</Badge></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted-foreground)]">{remaining !== null && <span>{remaining} of {entitlement.attempts_limit} attempts remaining</span>}<span>{entitlement.expires_at ? `Expires ${formatDate(entitlement.expires_at)}` : 'No expiry date'}</span></div></div>{index < Math.min(activeEntitlements.length, 3) - 1 && <Separator className="bg-[var(--line)]" />}</div>;
              })}
            </CardContent>
            <CardFooter><Button variant="ghost" className="ml-auto text-xs text-[var(--teal)]" onClick={() => setView('student-purchases')}>Open My Products<ArrowRight className="ml-1 h-3.5 w-3.5" /></Button></CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Empty({ copy }: { copy: string }) {
  return <div className="rounded-xl bg-[var(--canvas)] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]">{copy}</div>;
}

function Unavailable({ copy }: { copy: string }) {
  return <div className="rounded-xl border border-dashed border-[#D5DEDC] px-4 py-8 text-center text-sm text-[var(--muted-foreground)]"><AlertCircle className="mx-auto mb-2 h-5 w-5 text-[#9A6508]" />{copy}</div>;
}
