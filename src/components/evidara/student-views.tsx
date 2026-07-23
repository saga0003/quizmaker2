'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Clock,
  Calendar,
  FileText,
  Play,
  ArrowLeft,
  Download,
  Lock,
  CheckCircle,
  XCircle,
  Eye,
  Trophy,
  Users,
  BookOpen,
  ChevronRight,
  Zap,
  BarChart3,
  Target,
  TrendingUp,
  ArrowRight,
  Medal,
  Shield,
  Star,
  Flame,
} from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useAppStore } from '@/store/use-app-store';
import {
  demoTests,
  demoResults,
  demoAchievements,
  demoBenchmarks,
  demoResources,
  demoErrorCauses,
  demoTopicMastery,
  segmentCriteria,
  demoStudentStats,
} from '@/data/demo-data';

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.05 } },
};

const subjectColorMap: Record<string, string> = {
  Physics: 'bg-blue-100 text-blue-800',
  Chemistry: 'bg-violet-100 text-violet-800',
  Biology: 'bg-emerald-100 text-emerald-800',
  Mathematics: 'bg-amber-100 text-amber-800',
  NEET: 'bg-teal-100 text-teal-800',
  Science: 'bg-rose-100 text-rose-800',
  All: 'bg-gray-100 text-gray-700',
};

const subjectBorderMap: Record<string, string> = {
  Physics: 'border-l-blue-400',
  Chemistry: 'border-l-violet-400',
  Biology: 'border-l-emerald-400',
  Mathematics: 'border-l-amber-400',
  NEET: 'border-l-teal-400',
};

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
          className="h-8 w-8 text-[#6B7980] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]"
          onClick={() => setView('student-dashboard')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-[#14232B] sm:text-2xl">{title}</h1>
          <p className="text-sm text-[#6B7980]">{description}</p>
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
  gold: '#F2B84B',
  silver: '#9CA3AF',
  bronze: '#CD7F32',
};

/* ------------------------------------------------------------------ */
/*  StudentTestsView                                                   */
/* ------------------------------------------------------------------ */

export function StudentTestsView() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = demoTests.filter((t) => {
    const matchSearch = t.title.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || t.subject === filter;
    return matchSearch && matchFilter;
  });

  const subjects = ['All', 'Physics', 'Chemistry', 'Biology', 'Mathematics'];

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PageHeader title="Available Tests" description="Browse and start your assessments" />

        <motion.div {...fadeIn} className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
            <Input
              placeholder="Search tests..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-[#E7ECEB] bg-white pl-9 placeholder:text-[#6B7980]/60"
            />
          </div>
        </motion.div>

        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="flex-wrap bg-white border border-[#E7ECEB]">
            {subjects.map((s) => (
              <TabsTrigger
                key={s}
                value={s}
                className="data-[state=active]:bg-[#0E5A5A] data-[state=active]:text-white text-[#6B7980]"
              >
                {s}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <motion.div
          {...staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((test) => (
            <motion.div key={test.id} {...fadeIn}>
              <Card className={`border-l-4 ${subjectBorderMap[test.subject] || 'border-l-[#0E5A5A]'} border-[#E7ECEB] bg-white shadow-none transition-shadow hover:shadow-md`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-snug text-[#14232B]">
                      {test.title}
                    </CardTitle>
                    <Badge
                      className={`shrink-0 border-0 text-[10px] font-medium ${subjectColorMap[test.subject] || ''}`}
                      variant="secondary"
                    >
                      {test.subject}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7980]">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {test.questions} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {test.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {test.scheduledFor}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  {test.accessCode ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-[#0E5A5A]/30 text-[#0E5A5A] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]"
                    >
                      Enter Code
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full bg-[#0E5A5A] text-white hover:bg-[#0a4747]"
                    >
                      <Play className="mr-1.5 h-3.5 w-3.5" />
                      Start
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-[#6B7980]">
              No tests found matching your search.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StudentAnalyticsView                                               */
/* ------------------------------------------------------------------ */

export function StudentAnalyticsView() {
  const barColors = ['#0E5A5A', '#2E6D8B', '#F2B84B', '#B54747', '#6B7980'];

  const sortedTopics = [...demoTopicMastery].sort((a, b) => b.mastery - a.mastery);

  const devSteps = [
    {
      step: 1,
      title: 'Strengthen Electrostatics Fundamentals',
      desc: 'Focus on Coulomb\'s Law and electric field calculations \u2014 your weakest conceptual area (14 errors).',
    },
    {
      step: 2,
      title: 'Improve Calculation Speed & Accuracy',
      desc: 'Practice timed numerical problems daily. Target reducing calculation errors from 25% to under 15%.',
    },
    {
      step: 3,
      title: 'Bridge Inorganic Chemistry Gaps',
      desc: 'Your lowest mastery topic at 60%. Complete NCERT chapter exercises and review periodic table trends.',
    },
    {
      step: 4,
      title: 'Timed Practice for Time Pressure',
      desc: 'Take weekly mock tests under exam conditions. Aim to complete 10% more questions within time limits.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PageHeader title="Analytics" description="Deep-dive into your performance patterns" />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Error Causes */}
          <motion.div {...fadeIn}>
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#14232B]">
                  Error Cause Distribution
                </CardTitle>
                <CardDescription>What is causing your mistakes?</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={demoErrorCauses}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#6B7980' }} axisLine={{ stroke: '#E7ECEB' }} />
                      <YAxis
                        type="category"
                        dataKey="cause"
                        tick={{ fontSize: 11, fill: '#6B7980' }}
                        axisLine={false}
                        tickLine={false}
                        width={75}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E7ECEB',
                          fontSize: '12px',
                        }}
                        formatter={(value: number) => [
                          `${value} errors`,
                        ]}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
                        {demoErrorCauses.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Segment Evidence */}
          <motion.div {...fadeIn} transition={{ duration: 0.35, delay: 0.08 }}>
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#14232B]">
                  Segment Evidence
                </CardTitle>
                <CardDescription>
                  Your segment:{' '}
                  <span className="font-semibold text-[#0E5A5A]">{demoStudentStats.segment}</span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {segmentCriteria.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[#E7ECEB] bg-[#F7F9F7] p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        {c.passed ? (
                          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : (
                          <XCircle className="h-4 w-4 shrink-0 text-red-400" />
                        )}
                        <span className="text-sm text-[#14232B]">{c.label}</span>
                      </div>
                      <span
                        className={`shrink-0 text-xs font-semibold ${
                          c.passed ? 'text-emerald-600' : 'text-red-500'
                        }`}
                      >
                        {c.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Topic Mastery */}
          <motion.div {...fadeIn} transition={{ duration: 0.35, delay: 0.16 }} className="lg:col-span-2">
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#14232B]">
                  Topic Mastery
                </CardTitle>
                <CardDescription>Performance breakdown by topic (sorted by mastery)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-[#E7ECEB] hover:bg-transparent">
                        <TableHead className="text-xs font-semibold text-[#6B7980]">Topic</TableHead>
                        <TableHead className="text-xs font-semibold text-[#6B7980]">Mastery</TableHead>
                        <TableHead className="text-xs font-semibold text-[#6B7980]">Questions</TableHead>
                        <TableHead className="text-xs font-semibold text-[#6B7980]">Avg Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedTopics.map((t) => (
                        <TableRow key={t.topic} className="border-[#E7ECEB] hover:bg-[#F7F9F7]">
                          <TableCell className="text-sm font-medium text-[#14232B]">
                            {t.topic}
                          </TableCell>
                          <TableCell className="w-48">
                            <div className="flex items-center gap-2.5">
                              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#E7ECEB]">
                                <div
                                  className={`absolute left-0 top-0 h-full rounded-full transition-all ${masteryColorClass(t.mastery)}`}
                                  style={{ width: `${t.mastery}%` }}
                                />
                              </div>
                              <span className="w-9 text-right text-xs font-semibold text-[#14232B]">
                                {t.mastery}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-[#6B7980]">{t.questions}</TableCell>
                          <TableCell className="text-sm font-medium text-[#14232B]">{t.avg}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Development Plan */}
          <motion.div {...fadeIn} transition={{ duration: 0.35, delay: 0.24 }} className="lg:col-span-2">
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#14232B]">
                  Development Plan
                </CardTitle>
                <CardDescription>Personalised improvement roadmap</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  {devSteps.map((s) => (
                    <div
                      key={s.step}
                      className="flex gap-4 rounded-lg border border-[#E7ECEB] bg-[#F7F9F7] p-4"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0E5A5A] text-sm font-bold text-white">
                        {s.step}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-[#14232B]">{s.title}</p>
                        <p className="mt-1 text-xs leading-relaxed text-[#6B7980]">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StudentResultsView                                                 */
/* ------------------------------------------------------------------ */

export function StudentResultsView() {
  const sorted = [...demoResults].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const calcAccuracy = (r: (typeof sorted)[0]) =>
    Math.round((r.correct / (r.correct + r.incorrect + r.unanswered)) * 100);

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PageHeader title="Results" description="Complete history of your assessments" />

        <motion.div {...fadeIn}>
          <Card className="border-[#E7ECEB] bg-white shadow-none">
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#E7ECEB] hover:bg-transparent">
                      <TableHead className="text-xs font-semibold text-[#6B7980]">Paper</TableHead>
                      <TableHead className="text-xs font-semibold text-[#6B7980]">Date</TableHead>
                      <TableHead className="text-xs font-semibold text-[#6B7980]">Score</TableHead>
                      <TableHead className="text-xs font-semibold text-[#6B7980]">Accuracy</TableHead>
                      <TableHead className="text-xs font-semibold text-[#6B7980]">Percentile</TableHead>
                      <TableHead className="text-xs font-semibold text-[#6B7980]">Time</TableHead>
                      <TableHead className="text-xs font-semibold text-[#6B7980]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sorted.map((r) => (
                      <TableRow key={r.id} className="border-[#E7ECEB] hover:bg-[#F7F9F7]">
                        <TableCell className="max-w-[240px]">
                          <p className="truncate text-sm font-medium text-[#14232B]">{r.paper}</p>
                          <p className="text-[10px] text-[#6B7980]">
                            {r.correct} correct &middot; {r.incorrect} wrong &middot; {r.unanswered} skipped
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-[#6B7980]">
                          {r.date}
                        </TableCell>
                        <TableCell>
                          <ScoreBadge score={r.score} total={r.total} />
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-sm font-semibold ${
                              calcAccuracy(r) >= 80
                                ? 'text-emerald-600'
                                : calcAccuracy(r) >= 60
                                  ? 'text-amber-600'
                                  : 'text-red-500'
                            }`}
                          >
                            {calcAccuracy(r)}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="border-[#E7ECEB] text-xs font-semibold text-[#2E6D8B]"
                          >
                            {r.percentile}th
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-[#6B7980]">
                          {r.timeTaken}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs text-[#0E5A5A] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StudentAchievementsView                                            */
/* ------------------------------------------------------------------ */

export function StudentAchievementsView() {
  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PageHeader title="Achievements" description="Your milestones and recognitions" />

        <motion.div
          {...staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {demoAchievements.map((ach) => {
            const isLocked = ach.locked;
            return (
              <motion.div key={ach.id} {...fadeIn}>
                <Card
                  className={`relative overflow-hidden border-[#E7ECEB] bg-white shadow-none transition-shadow hover:shadow-md ${isLocked ? 'opacity-60 grayscale' : ''}`}
                >
                  {isLocked && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/40">
                      <div className="flex flex-col items-center gap-1.5">
                        <Lock className="h-6 w-6 text-[#6B7980]" />
                        <span className="text-xs font-medium text-[#6B7980]">Locked</span>
                      </div>
                    </div>
                  )}
                  <CardHeader className="pb-2 text-center">
                    <div
                      className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-3xl"
                      style={{ backgroundColor: `${tierColors[ach.tier]}20` }}
                    >
                      {ach.icon}
                    </div>
                    <CardTitle className="text-sm font-semibold text-[#14232B]">
                      {ach.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-center">
                    <p className="text-xs text-[#6B7980]">{ach.description}</p>
                    <Badge
                      className="mt-3 border-0 text-[10px] font-semibold uppercase tracking-wider"
                      style={{
                        backgroundColor: `${tierColors[ach.tier]}20`,
                        color: tierColors[ach.tier],
                      }}
                    >
                      <Medal className="mr-1 h-3 w-3" />
                      {ach.tier}
                    </Badge>
                    {ach.earnedAt && (
                      <p className="mt-2 text-[10px] text-[#6B7980]">Earned {ach.earnedAt}</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StudentBenchmarksView                                              */
/* ------------------------------------------------------------------ */

export function StudentBenchmarksView() {
  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PageHeader title="Benchmarks" description="Compare your school's performance across publications" />

        <motion.div {...staggerContainer} initial="initial" animate="animate" className="space-y-4">
          {demoBenchmarks.map((b) => {
            const scorePct = Math.min((b.schoolScore / b.topScore) * 100, 100);
            const avgPct = Math.min((b.avgScore / b.topScore) * 100, 100);
            return (
              <motion.div key={b.id} {...fadeIn}>
                <Card className="border-[#E7ECEB] bg-white shadow-none">
                  <CardContent className="p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`h-2.5 w-2.5 rounded-full ${b.status === 'active' ? 'bg-emerald-500' : 'bg-gray-400'}`}
                          />
                          <h3 className="text-sm font-semibold text-[#14232B]">{b.title}</h3>
                          <Badge
                            className={`border-0 text-[10px] font-semibold uppercase tracking-wider ${b.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                          >
                            {b.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7980]">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {b.participants.toLocaleString()} participants
                          </span>
                          <span className="font-semibold text-[#0E5A5A]">
                            Rank #{b.schoolRank}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 text-center">
                        <div>
                          <p className="text-2xl font-bold text-[#0E5A5A]">{b.schoolScore}</p>
                          <p className="text-[10px] text-[#6B7980]">School Score</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#6B7980]">{b.avgScore}</p>
                          <p className="text-[10px] text-[#6B7980]">Avg Score</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-[#F2B84B]">{b.topScore}</p>
                          <p className="text-[10px] text-[#6B7980]">Top Score</p>
                        </div>
                      </div>
                    </div>

                    {/* Comparison bar */}
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-[#6B7980]">School vs Average</span>
                        <span className="text-[#6B7980]">
                          +{(b.schoolScore - b.avgScore).toFixed(1)} pts above avg
                        </span>
                      </div>
                      <div className="relative h-3 w-full overflow-hidden rounded-full bg-[#E7ECEB]">
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-[#0E5A5A] transition-all"
                          style={{ width: `${scorePct}%` }}
                        />
                        <div
                          className="absolute left-0 top-0 h-full rounded-full bg-[#6B7980]/40 transition-all"
                          style={{ width: `${avgPct}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-4 text-[10px]">
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-[#0E5A5A]" />
                          Your School
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="h-2 w-2 rounded-full bg-[#6B7980]/40" />
                          Average
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  StudentResourcesView                                               */
/* ------------------------------------------------------------------ */

const typeLabels: Record<string, string> = {
  PYQ: 'Previous Year Papers',
  'study-material': 'Study Material',
  'solution-guide': 'Solution Guides',
  olympiad: 'Olympiad',
};

const typeColorMap: Record<string, string> = {
  PYQ: 'bg-teal-100 text-teal-800',
  'study-material': 'bg-blue-100 text-blue-800',
  'solution-guide': 'bg-violet-100 text-violet-800',
  olympiad: 'bg-amber-100 text-amber-800',
};

export function StudentResourcesView() {
  const [filter, setFilter] = useState('All');

  const types = ['All', 'PYQ', 'study-material', 'solution-guide', 'olympiad'];
  const typeTabLabels: Record<string, string> = {
    All: 'All',
    PYQ: 'PYQ',
    'study-material': 'Study Material',
    'solution-guide': 'Solution Guides',
    olympiad: 'Olympiad',
  };

  const filtered =
    filter === 'All'
      ? demoResources
      : demoResources.filter((r) => r.type === filter);

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        <PageHeader title="Resources" description="Download study materials and previous year papers" />

        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="flex-wrap bg-white border border-[#E7ECEB]">
            {types.map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="data-[state=active]:bg-[#0E5A5A] data-[state=active]:text-white text-[#6B7980]"
              >
                {typeTabLabels[t]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <motion.div
          {...staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filtered.map((res) => (
            <motion.div key={res.id} {...fadeIn}>
              <Card className="border-[#E7ECEB] bg-white shadow-none transition-shadow hover:shadow-md">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${typeColorMap[res.type] || 'bg-gray-100 text-gray-600'}`}
                    >
                      <FileText className="h-5 w-5" />
                    </div>
                    <Badge
                      className={`border-0 text-[10px] font-medium ${typeColorMap[res.type] || ''}`}
                      variant="secondary"
                    >
                      {typeLabels[res.type] || res.type}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-sm font-semibold leading-snug text-[#14232B]">
                    {res.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex items-center gap-3 text-xs text-[#6B7980]">
                    <Badge variant="outline" className="border-[#E7ECEB] text-[10px]">
                      {res.subject}
                    </Badge>
                    <span>{res.files} files</span>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  {res.eligible ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-[#0E5A5A]/30 text-[#0E5A5A] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]"
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full border-[#E7ECEB] text-[#6B7980]"
                      disabled
                    >
                      <Lock className="mr-1.5 h-3.5 w-3.5" />
                      Not Eligible
                    </Button>
                  )}
                </CardFooter>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-sm text-[#6B7980]">
              No resources found in this category.
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
