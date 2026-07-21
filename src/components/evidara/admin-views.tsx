'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
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
  School,
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
  Shield,
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
  Unlock,
  UserPlus,
  Crown,
  Medal,
  Package,
  Database,
  ChevronRight,
} from 'lucide-react';

import { useAppStore } from '@/store/use-app-store';
import {
  demoQuestions,
  demoPapers,
  demoSchoolStudents,
  demoProducts,
  demoBenchmarks,
  demoAchievements,
  demoSegments,
  demoAdminStats,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';

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
  expired: 'bg-[#B54747]/60 text-white',
};

const difficultyBadge: Record<string, string> = {
  easy: 'bg-[#DCE9E7] text-[#0E5A5A]',
  medium: 'bg-[#F2B84B]/20 text-[#F2B84B]',
  hard: 'bg-[#B54747]/20 text-[#B54747]',
};

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } },
};

const formatCurrency = (amount: number) => {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString('en-IN')}`;
};

const formatNumber = (num: number) => {
  if (num >= 1000) return num.toLocaleString('en-IN');
  return num.toString();
};

// ─── 1. AdminDashboardView (Command Centre) ────────────────────────

export function AdminDashboardView() {
  const setView = useAppStore((s) => s.setView);

  const statCards = [
    { label: 'Schools', value: formatNumber(demoAdminStats.totalSchools), icon: School, color: '#0E5A5A', view: 'admin-subscriptions' as const },
    { label: 'Students', value: formatNumber(demoAdminStats.totalStudents), icon: Users, color: '#2E6D8B', view: 'admin-segments' as const },
    { label: 'Assessments', value: formatNumber(demoAdminStats.totalAssessments), icon: FileText, color: '#F2B84B', view: 'admin-papers' as const },
    { label: 'Revenue', value: formatCurrency(demoAdminStats.totalRevenue), icon: TrendingUp, color: '#0E5A5A', view: 'admin-products' as const },
    { label: 'Active Subs', value: formatNumber(demoAdminStats.activeSubscriptions), icon: CreditCard, color: '#B54747', view: 'admin-subscriptions' as const },
    { label: 'Benchmarks', value: formatNumber(demoAdminStats.benchmarksPublished), icon: Trophy, color: '#6B7980', view: 'admin-benchmarks' as const },
  ];

  const moduleCards = [
    { title: 'Questions', description: 'Manage question bank across all schools', icon: FilePlus, stat: `${demoQuestions.length} questions`, view: 'admin-questions' as const, color: '#0E5A5A' },
    { title: 'Papers', description: 'Assessment papers from all schools', icon: FileText, stat: `${demoPapers.length} papers`, view: 'admin-papers' as const, color: '#2E6D8B' },
    { title: 'Products', description: 'Manage subscriptions and pricing', icon: Package, stat: `${demoProducts.length} products`, view: 'admin-products' as const, color: '#F2B84B' },
    { title: 'Subscriptions', description: 'School subscription management', icon: CreditCard, stat: `${demoAdminStats.activeSubscriptions} active`, view: 'admin-subscriptions' as const, color: '#B54747' },
    { title: 'Achievements', description: 'Achievement definitions and governance', icon: Award, stat: `${demoAchievements.length} definitions`, view: 'admin-achievements' as const, color: '#6B7980' },
    { title: 'Benchmarks', description: 'Benchmark publications and analytics', icon: Trophy, stat: `${demoAdminStats.benchmarksPublished} published`, view: 'admin-benchmarks' as const, color: '#0E5A5A' },
  ];

  return (
    <motion.div className="space-y-6 p-4 md:p-6" variants={staggerContainer} initial="initial" animate="animate">
      {/* Header */}
      <motion.div {...fadeUp} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Command Centre</h1>
          <p className="text-sm text-[#6B7980]">Platform-wide overview and management</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-[#DCE9E7] px-3 py-1.5 text-xs font-medium text-[#0E5A5A]">
          <Activity className="h-3 w-3 animate-pulse" />
          All systems operational
        </div>
      </motion.div>

      {/* Stats Row — 6 cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card
              className="cursor-pointer gap-0 overflow-hidden transition-all hover:shadow-md hover:border-[#0E5A5A]/30"
              onClick={() => setView(stat.view)}
            >
              <CardContent className="p-3 text-center">
                <div
                  className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${stat.color}15`, color: stat.color }}
                >
                  <stat.icon className="h-4 w-4" />
                </div>
                <p className="text-lg font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="text-xs text-[#6B7980]">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Module Grid — 2x3 */}
      <motion.div {...fadeUp}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[#6B7980]">
          Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {moduleCards.map((mod, i) => (
            <motion.div
              key={mod.title}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.06 }}
              whileHover={{ scale: 1.01 }}
            >
              <Card
                className="h-full cursor-pointer gap-0 overflow-hidden transition-all hover:shadow-md hover:border-[#0E5A5A]/30"
                onClick={() => setView(mod.view)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${mod.color}15`, color: mod.color }}
                    >
                      <mod.icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-[#14232B]">{mod.title}</h3>
                      <p className="mt-0.5 text-xs text-[#6B7980]">{mod.description}</p>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-[#6B7980]">{mod.stat}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-[#6B7980]" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* System Health */}
      <motion.div {...fadeUp}>
        <Card className="gap-0 overflow-hidden">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-2.5 w-2.5 rounded-full bg-[#0E5A5A] animate-pulse" />
            <span className="text-sm text-[#14232B]">
              <span className="font-semibold text-[#0E5A5A]">All systems operational</span>
              <span className="mx-2 text-[#6B7980]">·</span>
              <span className="text-[#6B7980]">Uptime 99.97% · Last incident: 14 days ago</span>
            </span>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── 2. AdminQuestionsView ─────────────────────────────────────────

const adminExtendedQuestions = [
  ...demoQuestions,
  { id: 'q13', text: 'What is the hybridization of carbon in ethyne? Explain with diagram.', subject: 'Chemistry', chapter: 'Chemical Bonding', type: 'short-answer' as const, difficulty: 'easy' as const, status: 'published' as const },
  { id: 'q14', text: 'A ball is thrown vertically upward with velocity 20 m/s. Find max height and time of flight.', subject: 'Physics', chapter: 'Mechanics', type: 'numerical' as const, difficulty: 'easy' as const, status: 'published' as const },
  { id: 'q15', text: 'Explain the process of photosynthesis in detail with chemical equations.', subject: 'Biology', chapter: 'Plant Physiology', type: 'long-answer' as const, difficulty: 'hard' as const, status: 'review' as const },
  { id: 'q16', text: 'Evaluate the integral ∫(0 to 1) x² e^x dx using integration by parts.', subject: 'Mathematics', chapter: 'Integration', type: 'numerical' as const, difficulty: 'hard' as const, status: 'published' as const },
  { id: 'q17', text: 'Describe the structure of DNA with a labelled diagram.', subject: 'Biology', chapter: 'Molecular Biology', type: 'short-answer' as const, difficulty: 'medium' as const, status: 'published' as const },
  { id: 'q18', text: 'State and prove the law of conservation of linear momentum.', subject: 'Physics', chapter: 'Mechanics', type: 'derivation' as const, difficulty: 'medium' as const, status: 'draft' as const },
];

export function AdminQuestionsView() {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const subjects = ['all', ...Array.from(new Set(adminExtendedQuestions.map((q) => q.subject)))];
  const statuses = ['all', 'published', 'review', 'draft'];
  const difficulties = ['all', 'easy', 'medium', 'hard'];

  const filtered = adminExtendedQuestions.filter((q) => {
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
          <h1 className="text-xl font-bold text-[#14232B]">All Questions</h1>
          <p className="text-sm text-[#6B7980]">{adminExtendedQuestions.length} questions across all schools</p>
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
                placeholder="Search questions across all schools..."
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

// ─── 3. AdminPapersView ────────────────────────────────────────────

const adminExtendedPapers = [
  ...demoPapers,
  { id: 'p6', title: 'NEET Full Syllabus — Biology', subject: 'Biology', sections: 2, questions: 90, duration: '2h', status: 'published' as const, submissions: 234, createdAt: '2026-07-02', school: 'Delhi Public School' },
  { id: 'p7', title: 'JEE Advanced — Physics', subject: 'Physics', sections: 3, questions: 60, duration: '3h', status: 'published' as const, submissions: 178, createdAt: '2026-06-28', school: 'IIT Academy' },
  { id: 'p8', title: 'CBSE Class 12 — Chemistry', subject: 'Chemistry', sections: 2, questions: 35, duration: '1h 30m', status: 'scheduled' as const, submissions: 0, createdAt: '2026-07-19', school: 'Green Valley High', scheduledFor: '2026-08-05' },
];

export function AdminPapersView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statuses = ['all', 'published', 'draft', 'scheduled'];

  const filtered = adminExtendedPapers.filter((p) => {
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
          <h1 className="text-xl font-bold text-[#14232B]">All Assessment Papers</h1>
          <p className="text-sm text-[#6B7980]">{adminExtendedPapers.length} papers across all schools</p>
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
                placeholder="Search papers across all schools..."
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
                {'school' in paper && paper.school && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-[#6B7980]">
                    <School className="h-3 w-3" />
                    {paper.school as string}
                  </p>
                )}
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

// ─── 4. AdminProductsView ──────────────────────────────────────────

export function AdminProductsView() {
  const [addProductOpen, setAddProductOpen] = useState(false);

  const audienceBadge: Record<string, string> = {
    student: 'bg-[#2E6D8B] text-white',
    school: 'bg-[#F2B84B] text-[#14232B]',
  };

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Products</h1>
          <p className="text-sm text-[#6B7980]">{demoProducts.length} products listed</p>
        </div>
        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90">
              <Plus className="mr-2 h-4 w-4" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
              <DialogDescription>Create a new subscription product for students or schools.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Product Name</label>
                <Input placeholder="e.g., NEET Advanced Package" className="border-[#E7ECEB]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Description</label>
                <Input placeholder="Brief description of the product" className="border-[#E7ECEB]" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#14232B]">Original Price (₹)</label>
                  <Input placeholder="5999" type="number" className="border-[#E7ECEB]" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#14232B]">Discount Price (₹)</label>
                  <Input placeholder="1999" type="number" className="border-[#E7ECEB]" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Audience</label>
                <Select>
                  <SelectTrigger className="w-full border-[#E7ECEB]">
                    <SelectValue placeholder="Select audience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="border-[#E7ECEB]" onClick={() => setAddProductOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90" onClick={() => setAddProductOpen(false)}>
                Create Product
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Product Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {demoProducts.map((product, i) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="h-full gap-0 overflow-hidden transition-shadow hover:shadow-md">
              <div className="border-b border-[#E7ECEB] bg-[#F7F9F7] px-4 py-3">
                <div className="flex items-center justify-between">
                  <Badge className={audienceBadge[product.audience] || 'bg-[#E7ECEB] text-[#14232B]'}>
                    {product.audience === 'student' ? <GraduationCap className="mr-1 h-3 w-3" /> : <School className="mr-1 h-3 w-3" />}
                    {product.audience === 'student' ? 'Student' : 'School'}
                  </Badge>
                  <Badge className={statusBadge[product.status] || ''}>
                    {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                  </Badge>
                </div>
              </div>
              <CardContent className="p-4">
                <h3 className="text-base font-semibold text-[#14232B]">{product.name}</h3>
                <p className="mt-1 text-sm text-[#6B7980]">{product.description}</p>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#0E5A5A]">
                    ₹{product.discountPrice.toLocaleString('en-IN')}
                  </span>
                  <span className="text-sm text-[#6B7980] line-through">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  <Badge variant="secondary" className="bg-[#B54747]/10 text-[#B54747]">
                    {Math.round(((product.price - product.discountPrice) / product.price) * 100)}% off
                  </Badge>
                </div>
                <div className="mt-3 flex items-center gap-1 text-sm text-[#6B7980]">
                  <Users className="h-4 w-4" />
                  <span>{product.subscribers.toLocaleString('en-IN')} subscribers</span>
                </div>
                <div className="mt-2 text-xs text-[#6B7980]">
                  Monthly revenue: ₹{((product.discountPrice * product.subscribers) / 12).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </div>
              </CardContent>
              <div className="border-t border-[#E7ECEB] px-4 py-2">
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs text-[#6B7980] hover:text-[#0E5A5A]">
                    <Edit className="mr-1 h-3 w-3" />
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs text-[#6B7980] hover:text-[#B54747]">
                    <Eye className="mr-1 h-3 w-3" />
                    Analytics
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── 5. AdminSubscriptionsView ─────────────────────────────────────

const adminSubscriptions = [
  { id: 'sub1', school: 'Green Valley High School', city: 'Bengaluru', plan: 'Annual Pro', seats: 500, seatsUsed: 347, status: 'active', expiry: '2027-01-15', revenue: 18999 },
  { id: 'sub2', school: 'Delhi Public School', city: 'New Delhi', plan: 'Starter', seats: 200, seatsUsed: 198, status: 'active', expiry: '2026-11-20', revenue: 5999 },
  { id: 'sub3', school: 'IIT Academy', city: 'Hyderabad', plan: 'Annual Pro', seats: 500, seatsUsed: 412, status: 'active', expiry: '2027-03-10', revenue: 18999 },
  { id: 'sub4', school: 'St. Xavier\'s Senior Sec.', city: 'Mumbai', plan: 'Starter', seats: 200, seatsUsed: 156, status: 'active', expiry: '2026-12-05', revenue: 5999 },
  { id: 'sub5', school: 'Kendriya Vidyalaya', city: 'Chennai', plan: 'Annual Pro', seats: 500, seatsUsed: 289, status: 'expired', expiry: '2026-06-30', revenue: 18999 },
  { id: 'sub6', school: 'Modern School', city: 'Pune', plan: 'Starter', seats: 200, seatsUsed: 180, status: 'active', expiry: '2027-02-28', revenue: 5999 },
  { id: 'sub7', school: 'Narayana Junior College', city: 'Vijayawada', plan: 'Annual Pro', seats: 500, seatsUsed: 467, status: 'active', expiry: '2027-04-15', revenue: 18999 },
  { id: 'sub8', school: 'Birla School', city: 'Kolkata', plan: 'Starter', seats: 200, seatsUsed: 45, status: 'active', expiry: '2027-05-01', revenue: 5999 },
];

const revenueData = [
  { month: 'Jan', revenue: 420000 },
  { month: 'Feb', revenue: 380000 },
  { month: 'Mar', revenue: 510000 },
  { month: 'Apr', revenue: 490000 },
  { month: 'May', revenue: 620000 },
  { month: 'Jun', revenue: 740000 },
  { month: 'Jul', revenue: 680000 },
  { month: 'Aug', revenue: 810000 },
  { month: 'Sep', revenue: 760000 },
  { month: 'Oct', revenue: 920000 },
  { month: 'Nov', revenue: 880000 },
  { month: 'Dec', revenue: 950000 },
];

export function AdminSubscriptionsView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const statuses = ['all', 'active', 'expired'];

  const filtered = adminSubscriptions.filter((sub) => {
    if (search && !sub.school.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
    return true;
  });

  const totalActive = adminSubscriptions.filter((s) => s.status === 'active').length;
  const totalRevenue = adminSubscriptions.reduce((acc, s) => acc + s.revenue, 0);

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div>
        <h1 className="text-xl font-bold text-[#14232B]">Subscriptions</h1>
        <p className="text-sm text-[#6B7980]">School subscription management and revenue</p>
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div {...fadeUp}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-[#6B7980]">Total Schools</p>
              <p className="mt-1 text-2xl font-bold text-[#14232B]">{adminSubscriptions.length}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.05 }}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-[#6B7980]">Active Subscriptions</p>
              <p className="mt-1 text-2xl font-bold text-[#0E5A5A]">{totalActive}</p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-[#6B7980]">Total Seats Sold</p>
              <p className="mt-1 text-2xl font-bold text-[#2E6D8B]">
                {adminSubscriptions.reduce((a, s) => a + s.seatsUsed, 0).toLocaleString('en-IN')}
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-[#6B7980]">Annual Revenue</p>
              <p className="mt-1 text-2xl font-bold text-[#0E5A5A]">₹{(totalRevenue / 100000).toFixed(1)} L</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Revenue Chart */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-[#14232B]">Monthly Revenue</CardTitle>
            <CardDescription className="text-xs">Revenue trend over the past 12 months</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="adminRevenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0E5A5A" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#0E5A5A" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" />
                  <XAxis dataKey="month" tick={{ fill: '#6B7980', fontSize: 12 }} axisLine={{ stroke: '#E7ECEB' }} />
                  <YAxis tick={{ fill: '#6B7980', fontSize: 12 }} axisLine={{ stroke: '#E7ECEB' }} tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: '#14232B',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#0E5A5A" strokeWidth={2} fill="url(#adminRevenueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Subscriptions Table */}
      <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="px-6 pt-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-sm font-semibold text-[#14232B]">School Subscriptions</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#6B7980]" />
                  <Input
                    placeholder="Search schools..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 w-[200px] border-[#E7ECEB] pl-8 text-xs"
                  />
                </div>
                <div className="flex gap-1">
                  {statuses.map((s) => (
                    <Button
                      key={s}
                      variant={statusFilter === s ? 'default' : 'outline'}
                      size="sm"
                      className={`h-8 text-xs ${statusFilter === s ? 'bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90' : 'border-[#E7ECEB] text-[#6B7980]'}`}
                      onClick={() => setStatusFilter(s)}
                    >
                      {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                  <TableHead className="text-xs font-semibold text-[#6B7980]">School</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980]">Plan</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980]">Seats</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980]">Utilization</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980]">Expiry</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((sub) => {
                  const utilPct = Math.round((sub.seatsUsed / sub.seats) * 100);
                  return (
                    <TableRow key={sub.id} className="border-[#E7ECEB]">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-[#14232B]">{sub.school}</p>
                          <p className="text-xs text-[#6B7980]">{sub.city}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-[#E7ECEB] text-[#14232B]">
                          {sub.plan === 'Annual Pro' && <Crown className="mr-1 h-3 w-3 text-[#F2B84B]" />}
                          {sub.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-[#14232B]">{sub.seatsUsed}/{sub.seats}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E7ECEB]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${utilPct}%`,
                                backgroundColor: utilPct >= 90 ? '#B54747' : utilPct >= 70 ? '#F2B84B' : '#0E5A5A',
                              }}
                            />
                          </div>
                          <span className="text-xs text-[#6B7980]">{utilPct}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusBadge[sub.status] || ''}>
                          {sub.status === 'active' && <CheckCircle className="mr-1 h-3 w-3" />}
                          {sub.status === 'expired' && <XCircle className="mr-1 h-3 w-3" />}
                          {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-[#6B7980]">
                        {new Date(sub.expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold text-[#14232B]">
                        ₹{sub.revenue.toLocaleString('en-IN')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}

// ─── 6. AdminAchievementsView ──────────────────────────────────────

const adminAchievementDefs = [
  { id: 'def1', title: 'First Assessment', tier: 'bronze', description: 'Completed your first assessment on Evidara', activeCount: 1842, revokedCount: 12, certificateCount: 1830, status: 'active' },
  { id: 'def2', title: 'Assessment Excellence', tier: 'gold', description: 'Scored above 90% on any assessment', activeCount: 567, revokedCount: 3, certificateCount: 564, status: 'active' },
  { id: 'def3', title: 'Perfect Score', tier: 'gold', description: 'Achieved 100% on any question paper', activeCount: 23, revokedCount: 0, certificateCount: 23, status: 'active' },
  { id: 'def4', title: 'Growth Milestone', tier: 'silver', description: 'Improved score by 12+ points between assessments', activeCount: 891, revokedCount: 5, certificateCount: 886, status: 'active' },
  { id: 'def5', title: 'Consistent Performer', tier: 'silver', description: 'Maintained above 75% across 5 consecutive assessments', activeCount: 432, revokedCount: 2, certificateCount: 430, status: 'active' },
  { id: 'def6', title: 'Integrity Streak', tier: 'bronze', description: 'Completed 10 assessments with zero violations', activeCount: 1205, revokedCount: 45, certificateCount: 1160, status: 'active' },
  { id: 'def7', title: 'Benchmark Participant', tier: 'bronze', description: 'Participated in your first benchmark publication', activeCount: 2340, revokedCount: 0, certificateCount: 0, status: 'active' },
  { id: 'def8', title: 'Top Decile', tier: 'gold', description: 'Ranked in the 90th percentile in a benchmark', activeCount: 234, revokedCount: 1, certificateCount: 233, status: 'active' },
];

const tierColor: Record<string, string> = {
  gold: '#F2B84B',
  silver: '#6B7980',
  bronze: '#2E6D8B',
};

export function AdminAchievementsView() {
  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div>
        <h1 className="text-xl font-bold text-[#14232B]">Achievement Governance</h1>
        <p className="text-sm text-[#6B7980]">Manage achievement definitions, issuance, and revocation</p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <motion.div {...fadeUp}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E5A5A]/10 text-[#0E5A5A]">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#14232B]">{adminAchievementDefs.length}</p>
                  <p className="text-xs text-[#6B7980]">Total Definitions</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.05 }}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0E5A5A]/10 text-[#0E5A5A]">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#0E5A5A]">
                    {adminAchievementDefs.reduce((a, d) => a + d.activeCount, 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-[#6B7980]">Active Awards</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#B54747]/10 text-[#B54747]">
                  <XCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#B54747]">
                    {adminAchievementDefs.reduce((a, d) => a + d.revokedCount, 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-[#6B7980]">Revoked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
          <Card className="gap-0 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F2B84B]/10 text-[#F2B84B]">
                  <Medal className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#F2B84B]">
                    {adminAchievementDefs.reduce((a, d) => a + d.certificateCount, 0).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-[#6B7980]">Certificates Issued</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Achievement Definitions Table */}
      <Card className="gap-0 overflow-hidden">
        <CardHeader className="px-6 pt-6">
          <CardTitle className="text-sm font-semibold text-[#14232B]">Achievement Definitions</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                <TableHead className="text-xs font-semibold text-[#6B7980]">Achievement</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Tier</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Description</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Active</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Revoked</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Certificates</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminAchievementDefs.map((def) => (
                <TableRow key={def.id} className="border-[#E7ECEB]">
                  <TableCell className="text-sm font-medium text-[#14232B]">{def.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      style={{
                        borderColor: tierColor[def.tier],
                        color: tierColor[def.tier],
                      }}
                    >
                      <Medal className="mr-1 h-3 w-3" />
                      {def.tier.charAt(0).toUpperCase() + def.tier.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[220px] text-sm text-[#6B7980]">{def.description}</TableCell>
                  <TableCell className="text-right text-sm text-[#0E5A5A] font-semibold">{def.activeCount.toLocaleString('en-IN')}</TableCell>
                  <TableCell className="text-right text-sm text-[#B54747]">{def.revokedCount}</TableCell>
                  <TableCell className="text-right text-sm text-[#14232B]">{def.certificateCount.toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <Badge className={statusBadge[def.status] || ''}>
                      {def.status.charAt(0).toUpperCase() + def.status.slice(1)}
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
                        <TooltipContent>View Details</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[#6B7980] hover:text-[#F2B84B]">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Edit</TooltipContent>
                      </Tooltip>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
    </motion.div>
  );
}

// ─── 7. AdminBenchmarksView ────────────────────────────────────────

const adminExtendedBenchmarks = [
  ...demoBenchmarks,
  { id: 'b4', title: 'NEET 2026 — Full Syllabus Prelims', subject: 'NEET', participants: 5620, schoolRank: 5, schoolScore: 82.1, topScore: 98.5, avgScore: 61.2, status: 'active', privacy: 'public', schools: 42 },
  { id: 'b5', title: 'JEE 2026 — Mathematics Mid-Year', subject: 'Mathematics', participants: 1890, schoolRank: 18, schoolScore: 68.4, topScore: 99.1, avgScore: 58.7, status: 'active', privacy: 'public', schools: 35 },
  { id: 'b6', title: 'CBSE 2026 — Class 12 Annual', subject: 'All', participants: 8430, schoolRank: 22, schoolScore: 74.6, topScore: 98.0, avgScore: 64.1, status: 'closed', privacy: 'private', schools: 58 },
];

export function AdminBenchmarksView() {
  const [createOpen, setCreateOpen] = useState(false);
  const [privacyFilter, setPrivacyFilter] = useState('all');

  const privacies = ['all', 'public', 'private'];
  const filtered = adminExtendedBenchmarks.filter((b) => {
    if (privacyFilter !== 'all' && ('privacy' in b ? b.privacy : 'public') !== privacyFilter) return false;
    return true;
  });

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#14232B]">Benchmark Publications</h1>
          <p className="text-sm text-[#6B7980]">{adminExtendedBenchmarks.length} benchmarks published</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90">
              <Plus className="mr-2 h-4 w-4" />
              Create Benchmark
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Benchmark</DialogTitle>
              <DialogDescription>Publish a new benchmark for cross-school performance comparison.</DialogDescription>
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
                    <SelectItem value="all">All Subjects</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Privacy</label>
                <Select>
                  <SelectTrigger className="w-full border-[#E7ECEB]">
                    <SelectValue placeholder="Select privacy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Unlock className="h-3 w-3" />
                        Public — Visible to all schools
                      </div>
                    </SelectItem>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-3 w-3" />
                        Private — Invite only
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#14232B]">Participating Schools</label>
                <Input placeholder="0" type="number" disabled className="border-[#E7ECEB] bg-[#F7F9F7]" />
                <p className="text-xs text-[#6B7980]">Schools are added automatically when they opt in.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" className="border-[#E7ECEB]" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button className="bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90" onClick={() => setCreateOpen(false)}>
                Publish Benchmark
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Privacy Filter */}
      <div className="flex gap-2">
        {privacies.map((p) => (
          <Button
            key={p}
            variant={privacyFilter === p ? 'default' : 'outline'}
            size="sm"
            className={
              privacyFilter === p
                ? 'bg-[#0E5A5A] text-white hover:bg-[#0E5A5A]/90'
                : 'border-[#E7ECEB] text-[#6B7980] hover:border-[#0E5A5A] hover:text-[#0E5A5A]'
            }
            onClick={() => setPrivacyFilter(p)}
          >
            {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
          </Button>
        ))}
      </div>

      {/* Benchmark List */}
      <div className="space-y-4">
        {filtered.map((bm, i) => {
          const privacy = 'privacy' in bm ? (bm.privacy as string) : 'public';
          const schools = 'schools' in bm ? (bm.schools as number) : 0;
          return (
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-[#14232B]">{bm.title}</h3>
                        <Badge className={statusBadge[bm.status] || ''}>
                          {bm.status.charAt(0).toUpperCase() + bm.status.slice(1)}
                        </Badge>
                        <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">
                          {privacy === 'public' ? <Unlock className="mr-1 h-3 w-3" /> : <Lock className="mr-1 h-3 w-3" />}
                          {privacy.charAt(0).toUpperCase() + privacy.slice(1)}
                        </Badge>
                      </div>
                      <Badge className={subjectColorMap[bm.subject] || 'bg-[#E7ECEB] text-[#14232B]'}>
                        {bm.subject}
                      </Badge>
                      <div className="flex gap-4 text-xs text-[#6B7980]">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {bm.participants.toLocaleString('en-IN')} participants
                        </span>
                        {schools > 0 && (
                          <span className="flex items-center gap-1">
                            <School className="h-3 w-3" />
                            {schools} schools
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                        <p className="text-xs text-[#6B7980]">Participants</p>
                        <p className="mt-1 text-lg font-bold text-[#14232B]">{(bm.participants / 1000).toFixed(1)}K</p>
                      </div>
                      <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                        <p className="text-xs text-[#6B7980]">Top Score</p>
                        <p className="mt-1 text-lg font-bold text-[#F2B84B]">{bm.topScore}%</p>
                      </div>
                      <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                        <p className="text-xs text-[#6B7980]">Avg Score</p>
                        <p className="mt-1 text-lg font-bold text-[#6B7980]">{bm.avgScore}%</p>
                      </div>
                      <div className="rounded-lg bg-[#F7F9F7] p-3 text-center">
                        <p className="text-xs text-[#6B7980]">School Rank</p>
                        <p className="mt-1 text-lg font-bold text-[#0E5A5A]">#{bm.schoolRank}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── 8. AdminSegmentsView ──────────────────────────────────────────

const adminSegmentDefs = [
  { id: 'seg-def-1', name: 'Academic Elite', criteria: '95th+ percentile, 88%+ accuracy, efficient time management', totalStudents: 1250, color: '#F2B84B' },
  { id: 'seg-def-2', name: 'Fast Improver', criteria: 'Score improvement of 12+ points between recent assessments', totalStudents: 2840, color: '#0E5A5A' },
  { id: 'seg-def-3', name: 'High Potential (Careless)', criteria: '75th+ percentile with 20%+ avoidable mark loss', totalStudents: 1920, color: '#2E6D8B' },
  { id: 'seg-def-4', name: 'Accurate Slow', criteria: '80%+ accuracy but takes significantly more time than average', totalStudents: 1580, color: '#6B7980' },
  { id: 'seg-def-5', name: 'Developing', criteria: 'Building foundation, needs structured practice and concept support', totalStudents: 3210, color: '#B54747' },
  { id: 'seg-def-6', name: 'Not Yet Assessed', criteria: 'Fewer than 3 assessments completed for segment evaluation', totalStudents: 2047, color: '#E7ECEB' },
];

const adminSegmentSchools = [
  { school: 'Green Valley High School', elite: 2, fastImprover: 1, highPotential: 1, accurateSlow: 1, developing: 2, notAssessed: 1 },
  { school: 'Delhi Public School', elite: 8, fastImprover: 12, highPotential: 6, accurateSlow: 4, developing: 28, notAssessed: 40 },
  { school: 'IIT Academy', elite: 15, fastImprover: 22, highPotential: 10, accurateSlow: 8, developing: 35, notAssessed: 12 },
  { school: 'St. Xavier\'s Senior Sec.', elite: 5, fastImprover: 8, highPotential: 4, accurateSlow: 6, developing: 18, notAssessed: 15 },
  { school: 'Kendriya Vidyalaya', elite: 3, fastImprover: 5, highPotential: 2, accurateSlow: 3, developing: 12, notAssessed: 8 },
  { school: 'Narayana Junior College', elite: 20, fastImprover: 30, highPotential: 15, accurateSlow: 12, developing: 45, notAssessed: 25 },
];

export function AdminSegmentsView() {
  const totalStudents = adminSegmentDefs.reduce((a, s) => a + s.totalStudents, 0);

  return (
    <motion.div className="space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div>
        <h1 className="text-xl font-bold text-[#14232B]">Segment Definitions</h1>
        <p className="text-sm text-[#6B7980]">{totalStudents.toLocaleString('en-IN')} students segmented across {adminSegmentDefs.length} categories</p>
      </div>

      {/* Segment Distribution Bar */}
      <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-[#14232B]">Student Distribution</CardTitle>
            <CardDescription className="text-xs">Distribution across all schools</CardDescription>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {/* Stacked bar */}
            <div className="mb-4 flex h-8 w-full overflow-hidden rounded-lg">
              {adminSegmentDefs.map((seg) => (
                <motion.div
                  key={seg.id}
                  className="h-full"
                  style={{ backgroundColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(seg.totalStudents / totalStudents) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              {adminSegmentDefs.map((seg) => (
                <div key={seg.id} className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }} />
                  <span className="text-xs text-[#6B7980]">
                    {seg.name} ({((seg.totalStudents / totalStudents) * 100).toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Segment Definitions Table */}
      <motion.div {...fadeUp} transition={{ delay: 0.15 }}>
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-[#14232B]">Segment Criteria</CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                  <TableHead className="text-xs font-semibold text-[#6B7980]">Segment</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980]">Criteria</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Students</TableHead>
                  <TableHead className="text-xs font-semibold text-[#6B7980] text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminSegmentDefs.map((seg) => (
                  <TableRow key={seg.id} className="border-[#E7ECEB]">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }} />
                        <span className="text-sm font-medium text-[#14232B]">{seg.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px] text-sm text-[#6B7980]">{seg.criteria}</TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-[#14232B]">{seg.totalStudents.toLocaleString('en-IN')}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[#E7ECEB]">
                          <div
                            className="h-full rounded-full"
                            style={{ backgroundColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color, width: `${(seg.totalStudents / totalStudents) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-[#6B7980]">{((seg.totalStudents / totalStudents) * 100).toFixed(1)}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>

      {/* School-level Segmentation Table */}
      <motion.div {...fadeUp} transition={{ delay: 0.2 }}>
        <Card className="gap-0 overflow-hidden">
          <CardHeader className="px-6 pt-6">
            <CardTitle className="text-sm font-semibold text-[#14232B]">Segmentation by School</CardTitle>
            <CardDescription className="text-xs">Student count per segment for each school</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                  <TableHead className="text-xs font-semibold text-[#6B7980]">School</TableHead>
                  {adminSegmentDefs.map((seg) => (
                    <TableHead key={seg.id} className="text-xs font-semibold text-[#6B7980] text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: seg.color === '#E7ECEB' ? '#6B7980' : seg.color }} />
                        {seg.name.split(' ')[0]}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-xs font-semibold text-[#6B7980] text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminSegmentSchools.map((row) => {
                  const total = row.elite + row.fastImprover + row.highPotential + row.accurateSlow + row.developing + row.notAssessed;
                  return (
                    <TableRow key={row.school} className="border-[#E7ECEB]">
                      <TableCell className="text-sm font-medium text-[#14232B]">{row.school}</TableCell>
                      <TableCell className="text-right text-sm text-[#14232B]">{row.elite}</TableCell>
                      <TableCell className="text-right text-sm text-[#14232B]">{row.fastImprover}</TableCell>
                      <TableCell className="text-right text-sm text-[#14232B]">{row.highPotential}</TableCell>
                      <TableCell className="text-right text-sm text-[#14232B]">{row.accurateSlow}</TableCell>
                      <TableCell className="text-right text-sm text-[#14232B]">{row.developing}</TableCell>
                      <TableCell className="text-right text-sm text-[#14232B]">{row.notAssessed}</TableCell>
                      <TableCell className="text-right text-sm font-semibold text-[#0E5A5A]">{total}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </motion.div>
    </motion.div>
  );
}