'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  BookOpen,
  BarChart3,
  Trophy,
  Users,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Eye,
  Download,
  Upload,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Star,
  Award,
  GraduationCap,
  FileText,
  FilePlus,
  Target,
  Zap,
  ArrowRight,
  CreditCard,
  Activity,
  PieChart,
  LayoutDashboard,
  Lock,
  UserPlus,
  UserMinus,
  Crown,
  Medal,
  ChevronRight,
  MoreVertical,
} from 'lucide-react';

import { useAppStore } from '@/store/use-app-store';
import {
  demoSchool,
  demoQuestions,
  demoPapers,
  demoSchoolStudents,
  demoResources,
  demoAchievements,
  demoBenchmarks,
  demoSegments,
} from '@/data/demo-data';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

// ─── Shared helpers ────────────────────────────────────────────────

const subjectColorMap: Record<string, string> = {
  Physics: 'bg-[#2E6D8B] text-white',
  Chemistry: 'bg-[#0E5A5A] text-white',
  Biology: 'bg-[#B54747] text-white',
  Mathematics: 'bg-[#6B7980] text-white',
  NEET: 'bg-[#14232B] text-white',
  Science: 'bg-[#F2B84B] text-[#14232B]',
  All: 'bg-[#E7ECEB] text-[#14232B]',
};

const statusBadge: Record<string, string> = {
  published: 'bg-[#0E5A5A] text-white',
  review: 'bg-[#F2B84B] text-[#14232B]',
  draft: 'bg-[#E7ECEB] text-[#6B7980]',
  active: 'bg-[#0E5A5A] text-white',
  closed: 'bg-[#6B7980] text-white',
  scheduled: 'bg-[#F2B84B] text-[#14232B]',
  revoked: 'bg-[#B54747] text-white',
};

const difficultyBadge: Record<string, string> = {
  easy: 'bg-[#DCE9E7] text-[#0E5A5A]',
  medium: 'bg-[#F2B84B]/20 text-[#F2B84B]',
  hard: 'bg-[#B54747]/20 text-[#B54747]',
};

const tierStyle: Record<string, string> = {
  gold: 'border-[#F2B84B] bg-[#F2B84B]/10',
  silver: 'border-[#6B7980] bg-[#6B7980]/10',
  bronze: 'border-[#2E6D8B] bg-[#2E6D8B]/10',
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = '#0E5A5A',
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <motion.div {...fadeUp}>
      <Card className="gap-0 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-[#6B7980]">{label}</p>
              <p className="mt-1 text-2xl font-bold" style={{ color }}>
                {value}
              </p>
              {sub && <p className="mt-1 text-xs text-[#6B7980]">{sub}</p>}
            </div>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}15`, color }}
            >
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── 1. SchoolDashboardView ────────────────────────────────────────

export function SchoolDashboardView() {
  const setView = useAppStore((s) => s.setView);

  const quickActions = [
    { label: 'New Question', icon: FilePlus, view: 'school-questions' as const },
    { label: 'Create Paper', icon: FileText, view: 'school-papers' as const },
    { label: 'Manage Students', icon: Users, view: 'school-students' as const },
    { label: 'View Reports', icon: BarChart3, view: 'school-benchmarks' as const },
  ];

  const recentActivity = [
    { id: 1, text: 'New assessment published — Physics Electrostatics', time: '10 min ago', icon: CheckCircle, color: '#0E5A5A' },
    { id: 2, text: '3 students completed Chemistry Organic Reactions test', time: '25 min ago', icon: Users, color: '#2E6D8B' },
    { id: 3, text: 'NEET Mock Test reached 89 submissions', time: '1 hour ago', icon: Trophy, color: '#F2B84B' },
    { id: 4, text: 'Benchmark result: Physics Mid-Year — Rank #12', time: '2 hours ago', icon: Award, color: '#B54747' },
    { id: 5, text: 'Priya Nair earned "Assessment Excellence" badge', time: '3 hours ago', icon: Star, color: '#F2B84B' },
  ];

  return (
    <motion.div className="space-y-6 p-4 md:p-6" variants={staggerContainer} initial="initial" animate="animate">
      {/* Welcome Banner */}
      <motion.div
        {...fadeUp}
        className="relative overflow-hidden rounded-xl border border-[#E7ECEB] bg-gradient-to-r from-[#14232B] to-[#0E5A5A] p-6 text-white"
      >
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 backdrop-blur-sm">
              <GraduationCap className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold md:text-2xl">Welcome, {demoSchool.name}</h1>
              <p className="text-sm text-white/70">{demoSchool.type} · {demoSchool.city}, {demoSchool.state}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Badge className="border-[#F2B84B]/40 bg-[#F2B84B]/20 text-[#F2B84B]">
              <Crown className="mr-1 h-3 w-3" />
              {demoSchool.plan}
            </Badge>
            <Badge variant="outline" className="border-white/20 text-white/80">
              <Calendar className="mr-1 h-3 w-3" />
              {demoSchool.daysRemaining} days remaining
            </Badge>
          </div>
        </div>
        <div className="absolute -right-6 -top-6 h-40 w-40 rounded-full bg-white/5" />
        <div className="absolute -bottom-10 -right-2 h-52 w-52 rounded-full bg-white/5" />
      </motion.div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Students"
          value={`${demoSchool.seatsUsed}/${demoSchool.seatsTotal}`}
          sub={`${Math.round((demoSchool.seatsUsed / demoSchool.seatsTotal) * 100)}% seats used`}
          color="#0E5A5A"
        />
        <StatCard
          icon={CreditCard}
          label="Active Subscription"
          value={`${demoSchool.daysRemaining} days`}
          sub="Renews Jan 15, 2027"
          color="#F2B84B"
        />
        <StatCard
          icon={FileText}
          label="Assessments Created"
          value="24"
          sub="3 published this week"
          color="#2E6D8B"
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue"
          value="₹4,89,500"
          sub="Annual Pro Plan"
          color="#B54747"
        />
      </div>

      {/* Progress bar for seats */}
      <motion.div {...fadeUp}>
        <Card className="gap-0 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-[#14232B]">Seat Utilization</span>
              <span className="text-[#6B7980]">{demoSchool.seatsUsed} of {demoSchool.seatsTotal} used</span>
            </div>
            <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-[#E7ECEB]">
              <motion.div
                className="h-full rounded-full bg-[#0E5A5A]"
                initial={{ width: 0 }}
                animate={{ width: `${(demoSchool.seatsUsed / demoSchool.seatsTotal) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Quick Actions + Segments */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quick Actions */}
        <motion.div {...fadeUp}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7980]">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <motion.button
                key={action.view}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setView(action.view)}
                className="flex items-center gap-3 rounded-xl border border-[#E7ECEB] bg-white p-4 text-left transition-colors hover:border-[#0E5A5A] hover:bg-[#DCE9E7]/40"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#DCE9E7] text-[#0E5A5A]">
                  <action.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#14232B]">{action.label}</p>
                  <p className="text-xs text-[#6B7980]">Get started</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 text-[#6B7980]" />
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Student Segments */}
        <motion.div {...fadeUp}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7980]">
            Student Segments
          </h2>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="space-y-3 p-4">
              {demoSegments.map((seg) => (
                <div key={seg.name} className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="flex-1 text-sm text-[#14232B]">{seg.name}</span>
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{ backgroundColor: `${seg.color}20`, color: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }}
                  >
                    {seg.count}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Recent Activity */}
      <motion.div {...fadeUp}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7980]">
          Recent Activity
        </h2>
        <Card className="gap-0 overflow-hidden">
          <CardContent className="divide-y divide-[#E7ECEB] p-0">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  <item.icon className="h-4 w-4" />
                </div>
                <p className="flex-1 text-sm text-[#14232B]">{item.text}</p>
                <span className="shrink-0 text-xs text-[#6B7980]">{item.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── 2. SchoolQuestionsView ─────────────────────────────────────────

export function SchoolQuestionsView() {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const subjects = ['all', ...Array.from(new Set(demoQuestions.map((q) => q.subject)))];
  const statuses = ['all', 'published', 'review', 'draft'];
  const difficulties = ['all', 'easy', 'medium', 'hard'];

  const filtered = demoQuestions.filter((q) => {
    if (search && !q.text.toLowerCase().includes(search.toLowerCase()) && !q.id.toLowerCase().includes(search.toLowerCase())) return false;
    if (subjectFilter !== 'all' && q.subject !== subjectFilter) return false;
    if (statusFilter !== 'all' && q.status !== statusFilter) return false;
    if (difficultyFilter !== 'all' && q.difficulty !== difficultyFilter) return false;
    return true;
  });

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Question Bank</h1>
          <p className="text-sm text-[#6B7980]">{demoQuestions.length} questions total</p>
        </div>
        <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90">
          <Plus className="mr-2 h-4 w-4" />
          Add Question
        </Button>
      </div>

      {/* Filters */}
      <Card className="gap-0 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input
                placeholder="Search questions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-[#E7ECEB] pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={subjectFilter} onValueChange={setSubjectFilter}>
                <SelectTrigger className="w-[140px] border-[#E7ECEB]">
                  <Filter className="mr-1 h-3 w-3" />
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'all' ? 'All Subjects' : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] border-[#E7ECEB]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="w-[140px] border-[#E7ECEB]">
                  <SelectValue placeholder="Difficulty" />
                </SelectTrigger>
                <SelectContent>
                  {difficulties.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d === 'all' ? 'All Levels' : d.charAt(0).toUpperCase() + d.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="gap-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                <TableHead className="text-xs font-semibold text-[#6B7980]">ID</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Question</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Subject</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Type</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Difficulty</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow key={q.id} className="border-[#E7ECEB]">
                  <TableCell className="font-mono text-xs text-[#6B7980]">{q.id}</TableCell>
                  <TableCell className="max-w-[280px] truncate text-sm text-[#14232B]">{q.text}</TableCell>
                  <TableCell>
                    <Badge className={subjectColorMap[q.subject] || 'bg-[#E7ECEB] text-[#14232B]'}>
                      {q.subject}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize text-[#14232B]">{q.type.replace('-', ' ')}</TableCell>
                  <TableCell>
                    <Badge className={difficultyBadge[q.difficulty] || ''}>
                      {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusBadge[q.status] || ''}>
                      {q.status === 'published' && <CheckCircle className="mr-1 h-3 w-3" />}
                      {q.status === 'review' && <AlertTriangle className="mr-1 h-3 w-3" />}
                      {q.status === 'draft' && <Edit className="mr-1 h-3 w-3" />}
                      {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6B7980] hover:text-[#0E5A5A]">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>View</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6B7980] hover:text-[#F2B84B]">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6B7980] hover:text-[#B54747]">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-sm text-[#6B7980]">
                    No questions match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── 3. SchoolPapersView ───────────────────────────────────────────

export function SchoolPapersView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statuses = ['all', 'published', 'draft', 'scheduled'];

  const filtered = demoPapers.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  const paperStatusIcon: Record<string, React.ReactNode> = {
    published: <CheckCircle className="h-4 w-4" />,
    draft: <Edit className="h-4 w-4" />,
    scheduled: <Clock className="h-4 w-4" />,
  };

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Assessment Papers</h1>
          <p className="text-sm text-[#6B7980]">{demoPapers.length} papers created</p>
        </div>
        <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90">
          <Plus className="mr-2 h-4 w-4" />
          Create Paper
        </Button>
      </div>

      {/* Filters */}
      <Card className="gap-0 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input
                placeholder="Search papers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-[#E7ECEB] pl-9"
              />
            </div>
            <div className="flex gap-2">
              {statuses.map((s) => (
                <Button
                  key={s}
                  variant={statusFilter === s ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setStatusFilter(s)}
                  className={
                    statusFilter === s
                      ? 'bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90'
                      : 'border-[#E7ECEB] text-[#6B7980] hover:border-[#0E5A5A] hover:text-[#0E5A5A]'
                  }
                >
                  {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((paper, i) => (
          <motion.div
            key={paper.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="h-full gap-0 overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Badge className={subjectColorMap[paper.subject] || 'bg-[#E7ECEB] text-[#14232B]'}>
                    {paper.subject}
                  </Badge>
                  <Badge className={statusBadge[paper.status] || ''}>
                    {paperStatusIcon[paper.status]}
                    <span className="ml-1">{paper.status.charAt(0).toUpperCase() + paper.status.slice(1)}</span>
                  </Badge>
                </div>
                <h3 className="mt-3 text-sm font-semibold text-[#14232B] line-clamp-2">{paper.title}</h3>
                <div className="mt-3 flex flex-wrap gap-3 text-xs text-[#6B7980]">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {paper.sections} sections
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    {paper.questions} questions
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {paper.duration}
                  </span>
                </div>
                <Separator className="my-3 bg-[#E7ECEB]" />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#6B7980]">
                    {paper.submissions > 0 ? (
                      <span className="flex items-center gap-1 text-[#0E5A5A]">
                        <Users className="h-3 w-3" />
                        {paper.submissions} submissions
                      </span>
                    ) : (
                      'No submissions'
                    )}
                  </span>
                  <span className="text-[#6B7980]">{paper.createdAt}</span>
                </div>
              </CardContent>
              <div className="border-t border-[#E7ECEB] px-4 py-2">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs text-[#6B7980] hover:text-[#0E5A5A]">
                    <Eye className="mr-1 h-3 w-3" />
                    View
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs text-[#6B7980] hover:text-[#F2B84B]">
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-sm text-[#6B7980]">
            No papers match your filters.
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── 4. SchoolStudentsView ─────────────────────────────────────────

export function SchoolStudentsView() {
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [trackFilter, setTrackFilter] = useState('all');

  const grades = ['all', ...Array.from(new Set(demoSchoolStudents.map((s) => s.grade)))];
  const tracks = ['all', ...Array.from(new Set(demoSchoolStudents.map((s) => s.track)))];

  const filtered = demoSchoolStudents.filter((s) => {
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.email.toLowerCase().includes(search.toLowerCase())) return false;
    if (gradeFilter !== 'all' && s.grade !== gradeFilter) return false;
    if (trackFilter !== 'all' && s.track !== trackFilter) return false;
    return true;
  });

  const activeCount = demoSchoolStudents.filter((s) => s.status === 'active').length;
  const revokedCount = demoSchoolStudents.filter((s) => s.status === 'revoked').length;

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Students</h1>
          <p className="text-sm text-[#6B7980]">
            {demoSchoolStudents.length} total · {activeCount} active · {revokedCount} revoked
          </p>
        </div>
        <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90">
          <UserPlus className="mr-2 h-4 w-4" />
          Add Student
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="gap-0 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E5A5A]/10 text-[#0E5A5A]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#14232B]">{demoSchoolStudents.length}</p>
                <p className="text-xs text-[#6B7980]">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E5A5A]/10 text-[#0E5A5A]">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#0E5A5A]">{activeCount}</p>
                <p className="text-xs text-[#6B7980]">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="gap-0 overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#B54747]/10 text-[#B54747]">
                <XCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#B54747]">{revokedCount}</p>
                <p className="text-xs text-[#6B7980]">Revoked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="gap-0 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input
                placeholder="Search by name or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-[#E7ECEB] pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={gradeFilter} onValueChange={setGradeFilter}>
                <SelectTrigger className="w-[120px] border-[#E7ECEB]">
                  <SelectValue placeholder="Grade" />
                </SelectTrigger>
                <SelectContent>
                  {grades.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g === 'all' ? 'All Grades' : `Grade ${g}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={trackFilter} onValueChange={setTrackFilter}>
                <SelectTrigger className="w-[120px] border-[#E7ECEB]">
                  <SelectValue placeholder="Track" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t === 'all' ? 'All Tracks' : t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="gap-0 overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                <TableHead className="text-xs font-semibold text-[#6B7980]">Name</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Grade</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Track</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Assessments</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Avg Score</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Segment</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((student) => {
                const segColor = demoSegments.find((s) => s.name === student.segment)?.color || '#E7ECEB';
                return (
                  <TableRow key={student.id} className="border-[#E7ECEB]">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium text-[#14232B]">{student.name}</p>
                        <p className="text-xs text-[#6B7980]">{student.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-[#14232B]">{student.grade}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-[#E7ECEB] text-[#14232B]">
                        {student.track}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-[#14232B]">{student.assessments}</TableCell>
                    <TableCell>
                      <span
                        className="text-sm font-semibold"
                        style={{
                          color:
                            student.avgScore >= 80
                              ? '#0E5A5A'
                              : student.avgScore >= 65
                                ? '#F2B84B'
                                : '#B54747',
                        }}
                      >
                        {student.avgScore}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: `${segColor}20`,
                          color: segColor === '#E7ECEB' ? '#6B7980' : segColor,
                        }}
                      >
                        {student.segment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge[student.status] || ''}>
                        {student.status === 'active' && <CheckCircle className="mr-1 h-3 w-3" />}
                        {student.status === 'revoked' && <XCircle className="mr-1 h-3 w-3" />}
                        {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-[#0E5A5A] hover:bg-[#0E5A5A]/10">
                              <TrendingUp className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Promote</TooltipContent>
                        </Tooltip>
                        {student.status === 'active' ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-[#B54747] hover:bg-[#B54747]/10">
                                    <UserMinus className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Revoke Access</TooltipContent>
                              </Tooltip>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke Student Access</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to revoke access for {student.name}? They will no longer be able to take assessments.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction className="bg-[#B54747] text-white hover:bg-[#B54747]/90">
                                  Revoke Access
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#0E5A5A] hover:bg-[#0E5A5A]/10">
                                <UserPlus className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reinstate</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-sm text-[#6B7980]">
                    No students match your filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── 5. SchoolSubscriptionView ─────────────────────────────────────

export function SchoolSubscriptionView() {
  const seatPercent = Math.round((demoSchool.seatsUsed / demoSchool.seatsTotal) * 100);
  const renewalDate = 'Jan 15, 2027';

  const planFeatures = [
    'Unlimited question bank access',
    'Up to 500 student seats',
    'Advanced analytics & dashboards',
    'Benchmark participation',
    'Achievement system',
    'Student segmentation',
    'Custom assessment creation',
    'Resource library uploads',
    'Priority support',
    'API access',
  ];

  const seatData = [
    { month: 'Jan', seats: 120 },
    { month: 'Feb', seats: 165 },
    { month: 'Mar', seats: 198 },
    { month: 'Apr', seats: 230 },
    { month: 'May', seats: 260 },
    { month: 'Jun', seats: 285 },
    { month: 'Jul', seats: 310 },
    { month: 'Aug', seats: 325 },
    { month: 'Sep', seats: 335 },
    { month: 'Oct', seats: 340 },
    { month: 'Nov', seats: 345 },
    { month: 'Dec', seats: 347 },
  ];

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div>
        <h1 className="text-xl font-bold text-[#14232B]">Subscription</h1>
        <p className="text-sm text-[#6B7980]">Manage your school&apos;s subscription plan</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Current Plan */}
        <Card className="gap-0 overflow-hidden">
          <div className="border-b border-[#E7ECEB] bg-[#14232B] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F2B84B]/20 text-[#F2B84B]">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">{demoSchool.plan}</h2>
                <p className="text-sm text-white/60">{demoSchool.type}</p>
              </div>
            </div>
          </div>
          <CardContent className="space-y-5 p-6">
            {/* Seats */}
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#14232B]">Student Seats</span>
                <span className="text-[#6B7980]">
                  <span className="font-bold text-[#0E5A5A]">{demoSchool.seatsUsed}</span> / {demoSchool.seatsTotal} used
                </span>
              </div>
              <Progress value={seatPercent} className="mt-2 h-3" />
              <p className="mt-1 text-xs text-[#6B7980]">{demoSchool.seatsTotal - demoSchool.seatsUsed} seats remaining</p>
            </div>

            {/* Days remaining */}
            <div className="flex items-center justify-between rounded-lg bg-[#F7F9F7] p-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#2E6D8B]" />
                <span className="text-sm text-[#14232B]">Days Remaining</span>
              </div>
              <span className="text-lg font-bold text-[#0E5A5A]">{demoSchool.daysRemaining}</span>
            </div>

            {/* Renewal */}
            <div className="flex items-center justify-between rounded-lg bg-[#F7F9F7] p-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#F2B84B]" />
                <span className="text-sm text-[#14232B]">Renewal Date</span>
              </div>
              <span className="text-sm font-semibold text-[#14232B]">{renewalDate}</span>
            </div>

            <Separator className="bg-[#E7ECEB]" />

            {/* Plan Features */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-[#14232B]">Plan Features</h3>
              <div className="space-y-2">
                {planFeatures.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 shrink-0 text-[#0E5A5A]" />
                    <span className="text-sm text-[#6B7980]">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Usage Chart */}
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-[#14232B]">Seat Usage Over Time</CardTitle>
            <CardDescription className="text-xs">Monthly student seat utilization</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={seatData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="seatGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E5A5A" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0E5A5A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" />
                  <XAxis dataKey="month" tick={{ fill: '#6B7980', fontSize: 12 }} axisLine={{ stroke: '#E7ECEB' }} />
                  <YAxis tick={{ fill: '#6B7980', fontSize: 12 }} axisLine={{ stroke: '#E7ECEB' }} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#14232B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="seats" stroke="#0E5A5A" strokeWidth={2} fill="url(#seatGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-center gap-4 text-xs text-[#6B7980]">
              <span className="flex items-center gap-1">
                <div className="h-2 w-4 rounded bg-[#0E5A5A]" />
                Active Seats
              </span>
              <span>Capacity: {demoSchool.seatsTotal}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// ─── 6. SchoolResourcesView ────────────────────────────────────────

export function SchoolResourcesView() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const types = ['all', ...Array.from(new Set(demoResources.map((r) => r.type)))];

  const filtered = demoResources.filter((r) => {
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    return true;
  });

  const typeIcon: Record<string, React.ElementType> = {
    PYQ: FileText,
    'study-material': BookOpen,
    'solution-guide': CheckCircle,
    olympiad: Trophy,
  };

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Resources</h1>
          <p className="text-sm text-[#6B7980]">{demoResources.length} resources available</p>
        </div>
        <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90">
          <Upload className="mr-2 h-4 w-4" />
          Upload Resource
        </Button>
      </div>

      {/* Filters */}
      <Card className="gap-0 overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input
                placeholder="Search resources..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border-[#E7ECEB] pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] border-[#E7ECEB]">
                <Filter className="mr-1 h-3 w-3" />
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === 'all' ? 'All Types' : t.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resource List */}
      <div className="space-y-3">
        {filtered.map((resource, i) => {
          const Icon = typeIcon[resource.type] || FileText;
          return (
            <motion.div
              key={resource.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="gap-0 overflow-hidden transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#DCE9E7] text-[#0E5A5A]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-[#14232B]">{resource.title}</h3>
                      {!resource.eligible && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock className="h-4 w-4 shrink-0 text-[#B54747]" />
                          </TooltipTrigger>
                          <TooltipContent>Requires higher plan</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#6B7980]">
                      <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">
                        {resource.type.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </Badge>
                      <Badge className={subjectColorMap[resource.subject] || 'bg-[#E7ECEB] text-[#14232B]'}>
                        {resource.subject}
                      </Badge>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {resource.files} files
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-[#E7ECEB] text-[#0E5A5A] hover:bg-[#DCE9E7]"
                      disabled={!resource.eligible}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
        {filtered.length === 0 && (
          <Card className="gap-0 overflow-hidden">
            <CardContent className="py-12 text-center text-sm text-[#6B7980]">
              No resources match your filters.
            </CardContent>
          </Card>
        )}
      </div>
    </motion.div>
  );
}

// ─── 7. SchoolAchievementsView ─────────────────────────────────────

export function SchoolAchievementsView() {
  const earned = demoAchievements.filter((a) => !a.locked);
  const locked = demoAchievements.filter((a) => a.locked);

  const tierColor: Record<string, string> = {
    gold: '#F2B84B',
    silver: '#6B7980',
    bronze: '#2E6D8B',
  };

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div>
        <h1 className="text-xl font-bold text-[#14232B]">Achievements</h1>
        <p className="text-sm text-[#6B7980]">{earned.length} earned · {locked.length} locked</p>
      </div>

      {/* Summary Table */}
      <Card className="gap-0 overflow-hidden">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-sm font-semibold text-[#14232B]">Achievement Summary</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                <TableHead className="text-xs font-semibold text-[#6B7980]">Achievement</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Tier</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Description</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Earned</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoAchievements.map((ach) => (
                <TableRow key={ach.id} className="border-[#E7ECEB]">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{ach.icon}</span>
                      <span className="text-sm font-medium text-[#14232B]">{ach.title}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: tierColor[ach.tier],
                        color: tierColor[ach.tier],
                      }}
                    >
                      <Medal className="mr-1 h-3 w-3" />
                      {ach.tier.charAt(0).toUpperCase() + ach.tier.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[260px] text-sm text-[#6B7980]">{ach.description}</TableCell>
                  <TableCell className="text-sm text-[#14232B]">
                    {ach.earnedAt ? new Date(ach.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge className={ach.locked ? 'bg-[#E7ECEB] text-[#6B7980]' : 'bg-[#0E5A5A] text-white'}>
                      {ach.locked ? (
                        <>
                          <Lock className="mr-1 h-3 w-3" />
                          Locked
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Earned
                        </>
                      )}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Achievement Grid */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7980]">Earned Achievements</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {earned.map((ach, i) => (
            <motion.div
              key={ach.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card className={`h-full gap-0 overflow-hidden border-l-4 ${tierStyle[ach.tier]}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{ach.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[#14232B]">{ach.title}</h3>
                      <p className="mt-1 text-xs text-[#6B7980]">{ach.description}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: tierColor[ach.tier],
                            color: tierColor[ach.tier],
                          }}
                        >
                          {ach.tier.charAt(0).toUpperCase() + ach.tier.slice(1)}
                        </Badge>
                        <span className="text-xs text-[#6B7980]">
                          {ach.earnedAt
                            ? new Date(ach.earnedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                            : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Locked Achievements */}
      {locked.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7980]">Locked Achievements</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((ach) => (
              <Card key={ach.id} className="h-full gap-0 overflow-hidden opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl grayscale">{ach.icon}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[#6B7980]">{ach.title}</h3>
                      <p className="mt-1 text-xs text-[#6B7980]">{ach.description}</p>
                      <Badge variant="outline" className="mt-2 border-[#E7ECEB] text-[#6B7980]">
                        <Lock className="mr-1 h-3 w-3" />
                        Locked
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─── 8. SchoolBenchmarksView ───────────────────────────────────────

export function SchoolBenchmarksView() {
  const [publishOpen, setPublishOpen] = useState(false);

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Benchmarks</h1>
          <p className="text-sm text-[#6B7980]">Compare your school&apos;s performance across assessments</p>
        </div>
        <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90">
              <Upload className="mr-2 h-4 w-4" />
              Publish Benchmark
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Publish New Benchmark</DialogTitle>
              <DialogDescription>Create a new benchmark to compare school performance across participating institutions.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Benchmark Title</label>
                <Input placeholder="e.g., NEET 2026 — Physics End-Year" className="border-[#E7ECEB]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Subject</label>
                <Select>
                  <SelectTrigger className="w-full border-[#E7ECEB]">
                    <SelectValue placeholder="Select subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physics">Physics</SelectItem>
                    <SelectItem value="chemistry">Chemistry</SelectItem>
                    <SelectItem value="biology">Biology</SelectItem>
                    <SelectItem value="mathematics">Mathematics</SelectItem>
                    <SelectItem value="neet">NEET (All)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Based on Assessment</label>
                <Select>
                  <SelectTrigger className="w-full border-[#E7ECEB]">
                    <SelectValue placeholder="Select assessment" />
                  </SelectTrigger>
                  <SelectContent>
                    {demoPapers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="border-[#E7ECEB]" onClick={() => setPublishOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90" onClick={() => setPublishOpen(false)}>
                Publish Benchmark
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Benchmark Cards */}
      <div className="space-y-4">
        {demoBenchmarks.map((bm, i) => (
          <motion.div
            key={bm.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="gap-0 overflow-hidden transition-shadow hover:shadow-md">
              <CardContent className="p-4 md:p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-[#14232B]">{bm.title}</h3>
                      <Badge className={statusBadge[bm.status] || ''}>
                        {bm.status.charAt(0).toUpperCase() + bm.status.slice(1)}
                      </Badge>
                    </div>
                    <Badge className={subjectColorMap[bm.subject] || 'bg-[#E7ECEB] text-[#14232B]'}>
                      {bm.subject}
                    </Badge>
                    <p className="text-sm text-[#6B7980]">{bm.participants.toLocaleString()} participants</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                      <p className="text-xs text-[#6B7980]">School Rank</p>
                      <p className="mt-1 text-xl font-bold text-[#0E5A5A]">#{bm.schoolRank}</p>
                    </div>
                    <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                      <p className="text-xs text-[#6B7980]">School Score</p>
                      <p className="mt-1 text-xl font-bold text-[#2E6D8B]">{bm.schoolScore}%</p>
                    </div>
                    <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                      <p className="text-xs text-[#6B7980]">Top Score</p>
                      <p className="mt-1 text-xl font-bold text-[#F2B84B]">{bm.topScore}%</p>
                    </div>
                    <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                      <p className="text-xs text-[#6B7980]">Avg Score</p>
                      <p className="mt-1 text-xl font-bold text-[#6B7980]">{bm.avgScore}%</p>
                    </div>
                  </div>
                </div>
                {/* Performance bar */}
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[#6B7980]">School Performance vs Average</span>
                    <span className="font-medium text-[#0E5A5A]">+{((bm.schoolScore - bm.avgScore) / bm.avgScore * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#E7ECEB]">
                    <div className="h-full rounded-full bg-[#0E5A5A]" style={{ width: `${(bm.schoolScore / bm.topScore) * 100}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── 9. SchoolSegmentsView ─────────────────────────────────────────

export function SchoolSegmentsView() {
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);

  const total = demoSegments.reduce((acc, s) => acc + s.count, 0);

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div>
        <h1 className="text-xl font-bold text-[#14232B]">Student Segments</h1>
        <p className="text-sm text-[#6B7980]">{total} students across {demoSegments.length} segments</p>
      </div>

      {/* Segment Distribution */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {demoSegments.map((seg, i) => {
          const isSelected = selectedSegment === seg.name;
          const segStudents = demoSchoolStudents.filter((s) => s.segment === seg.name);
          return (
            <motion.div
              key={seg.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileHover={{ scale: 1.01 }}
            >
              <Card
                className={`h-full cursor-pointer gap-0 overflow-hidden border-l-4 transition-all hover:shadow-md ${isSelected ? 'ring-2 ring-[#0E5A5A]/30' : ''}`}
                style={{ borderLeftColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }}
                onClick={() => setSelectedSegment(isSelected ? null : seg.name)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-[#14232B]">{seg.name}</h3>
                      <p className="mt-1 text-xs text-[#6B7980] line-clamp-2">{seg.description}</p>
                    </div>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ backgroundColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }}
                    >
                      {seg.count}
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E7ECEB]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${total > 0 ? (seg.count / total) * 100 : 0}%` }}
                        transition={{ duration: 0.6, delay: i * 0.08 }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#6B7980]">{total > 0 ? Math.round((seg.count / total) * 100) : 0}% of students</p>
                  </div>

                  {/* Student list when selected */}
                  {isSelected && segStudents.length > 0 && (
                    <div className="mt-3 border-t border-[#E7ECEB] pt-3">
                      <p className="mb-2 text-xs font-medium text-[#6B7980]">Students in this segment:</p>
                      {segStudents.map((s) => (
                        <div key={s.id} className="flex items-center justify-between py-1">
                          <span className="text-sm text-[#14232B]">{s.name}</span>
                          <span className="text-xs text-[#6B7980]">{s.avgScore}% avg</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Full Student Distribution Table */}
      <Card className="gap-0 overflow-hidden">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-sm font-semibold text-[#14232B]">All Students by Segment</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                <TableHead className="text-xs font-semibold text-[#6B7980]">Student</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Grade</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Track</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Avg Score</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Segment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoSchoolStudents.map((s) => {
                const segColor = demoSegments.find((seg) => seg.name === s.segment)?.color || '#E7ECEB';
                return (
                  <TableRow key={s.id} className="border-[#E7ECEB]">
                    <TableCell className="text-sm font-medium text-[#14232B]">{s.name}</TableCell>
                    <TableCell className="text-sm text-[#14232B]">{s.grade}</TableCell>
                    <TableCell className="text-sm text-[#6B7980]">{s.track}</TableCell>
                    <TableCell className="text-sm text-[#14232B]">{s.avgScore}%</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        style={{
                          backgroundColor: `${segColor}20`,
                          color: segColor === '#E7ECEB' ? '#6B7980' : segColor,
                        }}
                      >
                        {s.segment}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </motion.div>
  );
}