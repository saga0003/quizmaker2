'use client';

import { motion } from 'framer-motion';
import {
  FileText,
  Target,
  BarChart3,
  Zap,
  TrendingUp,
  Play,
  ArrowRight,
  Clock,
  Calendar,
  ChevronRight,
  Trophy,
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
import { Separator } from '@/components/ui/separator';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAppStore } from '@/store/use-app-store';
import {
  demoStudent,
  demoStudentStats,
  demoStudentTrend,
  demoTests,
  demoResults,
  demoAchievements,
} from '@/data/demo-data';

const fadeIn = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

function ReadinessRing({ value }: { value: number }) {
  const radius = 40;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={radius * 2} height={radius * 2} className="-rotate-90">
        <circle
          stroke="#DCE9E7"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          stroke="#0E5A5A"
          fill="transparent"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-lg font-bold text-[#0E5A5A]">
        {value}%
      </span>
    </div>
  );
}

function scoreColor(score: number, total: number) {
  const pct = (score / total) * 100;
  if (pct >= 80) return 'text-emerald-600';
  if (pct >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function subjectColor(subject: string) {
  const map: Record<string, string> = {
    Physics: 'bg-blue-100 text-blue-800',
    Chemistry: 'bg-violet-100 text-violet-800',
    Biology: 'bg-emerald-100 text-emerald-800',
    Mathematics: 'bg-amber-100 text-amber-800',
    NEET: 'bg-teal-100 text-teal-800',
  };
  return map[subject] || 'bg-gray-100 text-gray-800';
}

const tierColors: Record<string, string> = {
  gold: '#F2B84B',
  silver: '#9CA3AF',
  bronze: '#CD7F32',
};

export function StudentDashboard() {
  const { setView } = useAppStore();

  const upcomingTests = demoTests.slice(0, 3);
  const recentResults = [...demoResults].slice(0, 3);
  const earnedAchievements = demoAchievements
    .filter((a) => !a.locked)
    .slice(-4)
    .reverse();

  return (
    <div className="min-h-screen bg-[#F7F9F7]">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* Welcome Banner */}
        <motion.div
          {...fadeIn}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#DCE9E7] via-[#DCE9E7] to-[#c5ddd9] p-6 sm:p-8"
        >
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[#0E5A5A]/5" />
          <div className="absolute -bottom-6 -left-6 h-32 w-32 rounded-full bg-[#0E5A5A]/5" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-[#14232B] sm:text-3xl">
                Good morning, {demoStudent.name.split(' ')[0]}
              </h1>
              <p className="text-sm text-[#6B7980] sm:text-base">
                Grade {demoStudent.grade} &middot; {demoStudent.board} &middot;{' '}
                {demoStudent.track} Track &middot; {demoStudent.school}
              </p>
              <Badge
                className="mt-2 border-[#0E5A5A]/20 bg-[#0E5A5A]/10 px-3 py-1 text-xs font-semibold text-[#0E5A5A]"
              >
                <Zap className="mr-1 h-3 w-3" />
                {demoStudentStats.segment}
              </Badge>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-[#6B7980]">
                Exam Readiness
              </span>
              <ReadinessRing value={demoStudentStats.readiness} />
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          {...fadeIn}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        >
          <Card className="border-[#E7ECEB] bg-white py-4 shadow-none">
            <CardContent className="flex items-center gap-3 px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DCE9E7]">
                <FileText className="h-5 w-5 text-[#0E5A5A]" />
              </div>
              <div>
                <p className="text-xs text-[#6B7980]">Total Assessments</p>
                <p className="text-xl font-bold text-[#14232B]">
                  {demoStudentStats.totalAssessments}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E7ECEB] bg-white py-4 shadow-none">
            <CardContent className="flex items-center gap-3 px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50">
                <Target className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-[#6B7980]">Average Score</p>
                <div className="flex items-center gap-1.5">
                  <p className="text-xl font-bold text-[#14232B]">
                    {demoStudentStats.avgScore}%
                  </p>
                  {demoStudentStats.trend === 'improving' && (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E7ECEB] bg-white py-4 shadow-none">
            <CardContent className="flex items-center gap-3 px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                <BarChart3 className="h-5 w-5 text-[#2E6D8B]" />
              </div>
              <div>
                <p className="text-xs text-[#6B7980]">Percentile</p>
                <p className="text-xl font-bold text-[#14232B]">
                  {demoStudentStats.percentile}
                  <span className="text-sm font-normal text-[#6B7980]">nd</span>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E7ECEB] bg-white py-4 shadow-none">
            <CardContent className="flex items-center gap-3 px-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DCE9E7]">
                <Zap className="h-5 w-5 text-[#0E5A5A]" />
              </div>
              <div>
                <p className="text-xs text-[#6B7980]">Segment</p>
                <Badge className="mt-0.5 border-[#0E5A5A]/20 bg-[#0E5A5A]/10 text-xs text-[#0E5A5A]">
                  {demoStudentStats.segment}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          {...fadeIn}
          transition={{ duration: 0.4, delay: 0.14 }}
          className="flex flex-wrap gap-3"
        >
          <Button
            onClick={() => setView('student-tests')}
            className="bg-[#F2B84B] font-semibold text-[#14232B] hover:bg-[#e5a938]"
          >
            <Play className="mr-2 h-4 w-4" />
            Take a Test
          </Button>
          <Button
            variant="outline"
            onClick={() => setView('student-results')}
            className="border-[#0E5A5A]/30 text-[#0E5A5A] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]"
          >
            View Results
          </Button>
          <Button
            variant="outline"
            onClick={() => setView('student-resources')}
            className="border-[#E7ECEB] text-[#6B7980] hover:bg-[#DCE9E7]"
          >
            Study Resources
          </Button>
        </motion.div>

        {/* Score Trend Chart + Upcoming Tests */}
        <div className="grid gap-6 lg:grid-cols-5">
          <motion.div
            {...fadeIn}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:col-span-3"
          >
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#14232B]">
                  Performance Trend
                </CardTitle>
                <CardDescription>Score &amp; accuracy across assessments</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-64 w-full sm:h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={demoStudentTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" />
                      <XAxis
                        dataKey="assessment"
                        tick={{ fontSize: 11, fill: '#6B7980' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E7ECEB' }}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: '#6B7980' }}
                        tickLine={false}
                        axisLine={{ stroke: '#E7ECEB' }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: '1px solid #E7ECEB',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          fontSize: '13px',
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: '12px' }}
                        iconType="circle"
                        iconSize={8}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#0E5A5A"
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: '#0E5A5A' }}
                        activeDot={{ r: 6 }}
                        name="Score"
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#2E6D8B"
                        strokeWidth={2}
                        dot={{ r: 3, fill: '#2E6D8B' }}
                        activeDot={{ r: 5 }}
                        name="Accuracy"
                        strokeDasharray="5 3"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            {...fadeIn}
            transition={{ duration: 0.4, delay: 0.26 }}
            className="lg:col-span-2"
          >
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#14232B]">
                  Upcoming Tests
                </CardTitle>
                <CardDescription>Your scheduled assessments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-0 pt-0">
                {upcomingTests.map((test, idx) => (
                  <div key={test.id}>
                    <div className="flex items-start justify-between gap-2 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#14232B]">
                          {test.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#6B7980]">
                          <Badge
                            className={`text-[10px] font-medium ${subjectColor(test.subject)}`}
                            variant="secondary"
                          >
                            {test.subject}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {test.scheduledFor}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {test.duration}
                          </span>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0 bg-[#0E5A5A] text-white hover:bg-[#0a4747]"
                        onClick={() => setView('student-tests')}
                      >
                        Start
                      </Button>
                    </div>
                    {idx < upcomingTests.length - 1 && (
                      <Separator className="bg-[#E7ECEB]" />
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Recent Results + Achievements Preview */}
        <div className="grid gap-6 lg:grid-cols-5">
          <motion.div
            {...fadeIn}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="lg:col-span-3"
          >
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold text-[#14232B]">
                  Recent Results
                </CardTitle>
                <CardDescription>Latest assessment outcomes</CardDescription>
              </CardHeader>
              <CardContent className="space-y-0 pt-0">
                {recentResults.map((r, idx) => (
                  <div key={r.id}>
                    <div className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#14232B]">
                          {r.paper}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6B7980]">{r.date}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className={`text-lg font-bold ${scoreColor(r.score, r.total)}`}>
                          {r.score}
                          <span className="text-xs font-normal text-[#6B7980]">
                            /{r.total}
                          </span>
                        </span>
                        <Badge
                          variant="outline"
                          className="border-[#E7ECEB] text-[10px] font-semibold text-[#6B7980]"
                        >
                          {r.percentile}th pctl
                        </Badge>
                      </div>
                    </div>
                    {idx < recentResults.length - 1 && (
                      <Separator className="bg-[#E7ECEB]" />
                    )}
                  </div>
                ))}
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  variant="ghost"
                  className="ml-auto gap-1 text-xs text-[#0E5A5A] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]"
                  onClick={() => setView('student-results')}
                >
                  View All Results
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          </motion.div>

          <motion.div
            {...fadeIn}
            transition={{ duration: 0.4, delay: 0.36 }}
            className="lg:col-span-2"
          >
            <Card className="border-[#E7ECEB] bg-white shadow-none">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-[#14232B]">
                      Achievements
                    </CardTitle>
                    <CardDescription>Recent milestones unlocked</CardDescription>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-[#0E5A5A] hover:bg-[#DCE9E7] hover:text-[#0E5A5A]"
                    onClick={() => setView('student-achievements')}
                  >
                    All
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                  {earnedAchievements.map((ach) => (
                    <div
                      key={ach.id}
                      className="flex items-center gap-2.5 rounded-lg border border-[#E7ECEB] bg-[#F7F9F7] p-3"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                        style={{ backgroundColor: `${tierColors[ach.tier]}22` }}
                      >
                        {ach.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-[#14232B]">
                          {ach.title}
                        </p>
                        <p className="truncate text-[10px] capitalize text-[#6B7980]">
                          {ach.tier}
                        </p>
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