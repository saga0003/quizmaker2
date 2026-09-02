'use client';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, ListChecks, LoaderCircle, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/lib/supabase';
import type { AttemptResult } from '@/types/papers';
import { ResourceLibrary } from '@/components/school/ResourceLibrary';
import { PostTestErrorClassification } from '@/components/evidara/post-test-error-classification';
import { useAppStore } from '@/store/use-app-store';
function PageHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { setView } = useAppStore();
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-[var(--muted-foreground)] hover:bg-[var(--secondary)] hover:text-[var(--teal)]"
          onClick={() => setView('student-dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] sm:text-2xl">{title}</h1>
          <p className="text-sm text-[var(--muted-foreground)]">{description}</p>
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score, total }: { score: number; total: number }) {
  const pct = (score / total) * 100;
  let bg: string;
  if (pct >= 80) bg = 'bg-emerald-100 text-emerald-700';
  else if (pct >= 60) bg = 'bg-amber-100 text-amber-700';
  else bg = 'bg-red-100 text-red-700';
  return (
    <Badge className={`${bg} border-0 font-semibold`}>
      {score}/{total}
    </Badge>
  );
}

function masteryColorClass(value: number) {
  if (value >= 80) return 'bg-emerald-500';
  if (value >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

const tierColors: Record<string, string> = {
  gold: 'var(--amber)',
  silver: '#9CA3AF',
  bronze: '#CD7F32',
};

/* ------------------------------------------------------------------ */
/*  StudentTestsView                                                   */
/* ------------------------------------------------------------------ */

export function StudentResultsView() {
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reflectionAttemptId, setReflectionAttemptId] = useState('');
  const [reflectionNotice, setReflectionNotice] = useState('');

  const loadResults = useCallback(async () => {
    if (!supabase) {
      setResults([]);
      setError('Evidara cloud is not configured. Live results are unavailable.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase.rpc('list_my_attempt_results');

    if (loadError) {
      setResults([]);
      setError('Evidara could not load your results. Please try again.');
    } else {
      const submitted = ((data || []) as AttemptResult[]).filter(
        (result) => result.status === 'submitted'
      );
      setResults(submitted);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  function formatDate(value: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDuration(result: AttemptResult) {
    if (!result.submitted_at) return '—';
    const elapsed = new Date(result.submitted_at).getTime() - new Date(result.started_at).getTime();
    if (!Number.isFinite(elapsed) || elapsed < 0) return '—';
    const minutes = Math.max(1, Math.round(elapsed / 60_000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
  }

  function accuracy(result: AttemptResult) {
    const answered = result.correct_count + result.incorrect_count;
    return answered > 0 ? Math.round((result.correct_count / answered) * 100) : 0;
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <PageHeader
            title="Results"
            description="Your submitted assessment history from Evidara cloud"
          />
          <Button
            variant="outline"
            onClick={() => void loadResults()}
            disabled={loading}
            className="border-[var(--line)]"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 mt-4 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]"
          >
            {error}
          </div>
        )}

        {loading ? (
          <div
            className="mt-6 grid min-h-[280px] place-items-center rounded-xl border border-[var(--line)] bg-white text-sm text-[var(--muted-foreground)]"
            aria-live="polite"
          >
            <div className="text-center">
              <LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin text-[var(--teal)]" />
              Loading your results…
            </div>
          </div>
        ) : results.length === 0 ? (
          <Card className="mt-6 border-[var(--line)] bg-white text-center shadow-sm rounded-xl">
            <CardContent className="py-14">
              <BarChart3 className="mx-auto h-10 w-10 text-[var(--secondary)]" />
              <h2 className="mt-3 font-semibold text-[var(--foreground)]">No submitted tests yet</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Complete a published assessment and your result will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="mt-6 space-y-4">
            {reflectionAttemptId && (
              <Card className="border-[#D7E8E6] bg-white shadow-sm rounded-xl">
                <CardContent className="p-4 sm:p-6">
                  <PostTestErrorClassification
                    attemptId={reflectionAttemptId}
                    onComplete={({ completed, total }) => {
                      setReflectionAttemptId('');
                      setReflectionNotice(
                        completed === total && total > 0
                          ? 'Reflection complete. Your result remains unchanged.'
                          : `Reflection paused after ${completed} of ${total} available response${total === 1 ? '' : 's'}.`,
                      );
                    }}
                  />
                </CardContent>
              </Card>
            )}

            {reflectionNotice && (
              <div role="status" className="rounded-xl border border-[#D7E8E6] bg-[#F1FAF8] px-4 py-3 text-sm text-[var(--teal)]">
                {reflectionNotice}
              </div>
            )}

            <Card className="border-[var(--line)] bg-white shadow-sm rounded-xl">
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[var(--line)] hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Paper</TableHead>
                        <TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Submitted</TableHead>
                        <TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Score</TableHead>
                        <TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Accuracy</TableHead>
                        <TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Questions</TableHead>
                        <TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Time</TableHead>
                        <TableHead className="text-xs font-semibold text-[var(--muted-foreground)]">Result type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((result) => (
                        <TableRow
                          key={result.attempt_id}
                          className="border-[var(--line)] hover:bg-[var(--canvas)]"
                        >
                          <TableCell className="max-w-[240px]">
                            <p className="truncate text-sm font-medium text-[var(--foreground)]">
                              {result.paper_title}
                            </p>
                            <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                              Submitted
                            </p>
                            {result.answers_released === true && (
                              <button
                                type="button"
                                className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--teal)] hover:underline"
                                onClick={() => {
                                  setReflectionNotice('');
                                  setReflectionAttemptId(result.attempt_id);
                                }}
                              >
                                <ListChecks className="h-3.5 w-3.5" />
                                {reflectionAttemptId === result.attempt_id ? 'Reflection open' : 'Continue reflection'}
                              </button>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-[var(--muted-foreground)]">
                            {formatDate(result.submitted_at)}
                          </TableCell>
                          <TableCell>
                            <ScoreBadge score={result.score} total={result.maximum_marks} />
                            <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{result.percentage}%</p>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-semibold ${
                                accuracy(result) >= 80
                                  ? 'text-emerald-600'
                                  : accuracy(result) >= 60
                                    ? 'text-amber-600'
                                    : 'text-red-500'
                              }`}
                            >
                              {accuracy(result)}%
                            </span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-[var(--muted-foreground)]">
                            <span className="font-semibold text-emerald-600">
                              {result.correct_count}
                            </span>{' '}
                            correct <span className="mx-1.5">·</span>
                            <span className="font-semibold text-red-500">
                              {result.incorrect_count}
                            </span>{' '}
                            wrong <span className="mx-1.5">·</span>
                            {result.unanswered_count} skipped
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-[var(--muted-foreground)]">
                            {formatDuration(result)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="whitespace-nowrap border-[var(--line)] text-[10px] capitalize text-[var(--info)]"
                            >
                              {result.result_mode.replaceAll('_', ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StudentAchievementsView                                            */
/* ------------------------------------------------------------------ */

export function StudentResourcesView() {
  const setSidebarOpen = useAppStore((state) => state.setSidebarOpen);

  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 640px)');
    const collapseSidebar = () => {
      if (narrow.matches) setSidebarOpen(false);
    };
    collapseSidebar();
    narrow.addEventListener('change', collapseSidebar);
    return () => narrow.removeEventListener('change', collapseSidebar);
  }, [setSidebarOpen]);

  return (
    <div className="min-h-screen min-w-0 bg-[var(--canvas)]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <ResourceLibrary studentMode />
      </div>
    </div>
  );
}
