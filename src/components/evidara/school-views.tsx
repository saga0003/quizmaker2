'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, BarChart3, BookOpen, FilePlus, FileText, GraduationCap, Users } from 'lucide-react';
import { useAppStore, type AppView } from '@/store/use-app-store';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { normalizeEvidaraRole } from '@/lib/roles';
import { StudentLifecycleManager } from '@/components/school/StudentLifecycleManager';
import { ResourceLibrary } from '@/components/school/ResourceLibrary';
import { SubscriptionCenter } from '@/components/school/SubscriptionCenter';
import { useSchoolPlatform } from '@/components/school/useSchoolPlatform';
import { SalesDemoStudentRoster, useSalesDemoData, useSalesDemoMode } from '@/components/evidara/sales-demo-workspace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35 },
};

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
            <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</p>
            {sub && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{sub}</p>}
          </div>
          <Icon className="h-5 w-5 text-[var(--teal)]" />
        </div>
      </CardContent>
    </Card>
  );
}

function viewHref(view: AppView) {
  return `/?view=${encodeURIComponent(view)}`;
}

type TeacherAttentionCandidate = {
  id: string;
  name: string;
  section: string;
  completedTests: number;
  averagePercentage: number | null;
  accuracy: number | null;
  priority: number;
  reasons: string[];
};

function TeacherNeedsAttention({ schoolId }: { schoolId: string }) {
  const setView = useAppStore((s) => s.setView);
  const [rows, setRows] = useState<TeacherAttentionCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [attentionError, setAttentionError] = useState('');

  useEffect(() => {
    if (!schoolId || !supabase) return;
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setAttentionError('');
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Your Evidara session has expired.');
        const headers = { Authorization: `Bearer ${token}`, 'x-evidara-organization-id': schoolId };
        const schoolResponse = await fetch(`/api/institution-analytics?level=school&organizationId=${encodeURIComponent(schoolId)}`, { headers, cache: 'no-store' });
        const schoolPayload = await schoolResponse.json() as { error?: string; classes?: Array<{ id: string; name: string }> };
        if (!schoolResponse.ok) throw new Error(schoolPayload.error || 'Unable to load assigned sections.');
        const sections = schoolPayload.classes || [];
        const sectionPayloads = await Promise.all(sections.map(async (section) => {
          const response = await fetch(`/api/institution-analytics?level=class&organizationId=${encodeURIComponent(schoolId)}&sectionId=${encodeURIComponent(section.id)}`, { headers, cache: 'no-store' });
          const payload = await response.json() as {
            error?: string;
            class?: { name?: string };
            students?: Array<{ id: string; name: string; completedTests: number; averagePercentage: number | null; accuracy: number | null }>;
          };
          if (!response.ok) throw new Error(payload.error || `Unable to load ${section.name}.`);
          return { section: payload.class?.name || section.name, students: payload.students || [] };
        }));
        const candidates = sectionPayloads.flatMap(({ section, students }) => students.map((student) => {
          const reasons: string[] = [];
          let priority = 0;
          if (student.completedTests === 0) {
            reasons.push('No submitted assessments');
            priority += 90;
          } else {
            if (student.averagePercentage != null && student.averagePercentage < 55) {
              reasons.push(`Average score ${Math.round(student.averagePercentage)}%`);
              priority += 70 - student.averagePercentage;
            }
            if (student.accuracy != null && student.accuracy < 55) {
              reasons.push(`Accuracy ${Math.round(student.accuracy)}%`);
              priority += 70 - student.accuracy;
            }
          }
          return { ...student, section, reasons, priority };
        })).filter((student) => student.reasons.length > 0)
          .sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
          .slice(0, 5);
        if (!cancelled) setRows(candidates);
      } catch (value) {
        if (!cancelled) setAttentionError(value instanceof Error ? value.message : 'Unable to load attention evidence.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [schoolId]);

  function openAnalytics(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setView('school-analytics-overview');
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.set('view', 'school-analytics-overview');
    window.history.pushState({ evidaraView: 'school-analytics-overview' }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /><p className="font-semibold text-[var(--foreground)]">Needs attention</p></div>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">Evidence-first queue from students in your assigned sections. It is a review prompt, not a prediction or judgement.</p>
          </div>
          <Badge variant="outline">Up to 5 priorities</Badge>
        </div>
        {loading ? <p className="mt-4 text-sm text-[var(--muted-foreground)]">Checking current assessment evidence…</p> : attentionError ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{attentionError}</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--muted)]/30 px-3 py-3 text-sm text-[var(--muted-foreground)]">No students currently meet the attention rules. Students are flagged only for no submitted assessments or measured score/accuracy below 55%.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {rows.map((student) => (
              <div key={`${student.id}:${student.section}`} className="flex flex-col gap-3 rounded-lg border border-[var(--line)] bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{student.name}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">{student.section} · {student.completedTests} submitted test{student.completedTests === 1 ? '' : 's'}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{student.reasons.map((reason) => <Badge key={reason} variant="outline" className="border-amber-200 bg-amber-50 text-amber-900">{reason}</Badge>)}</div>
                </div>
                <div className="shrink-0 text-left sm:text-right">
                  <p className="text-xs text-[var(--muted-foreground)]">Measured evidence</p>
                  <p className="text-sm font-medium text-[var(--foreground)]">Score {student.averagePercentage == null ? '—' : `${Math.round(student.averagePercentage)}%`} · Accuracy {student.accuracy == null ? '—' : `${Math.round(student.accuracy)}%`}</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">{student.completedTests === 0 ? 'Action: check assignment participation.' : 'Action: review subject/topic evidence before intervention.'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <a href={viewHref('school-analytics-overview')} onClick={openAnalytics} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--teal)] hover:underline">Open scoped analytics <ArrowRight className="h-4 w-4" /></a>
      </CardContent>
    </Card>
  );
}

export function SchoolDashboardView() {
  const setView = useAppStore((s) => s.setView);
  const { profile } = useAuth();
  const accessRole = normalizeEvidaraRole(profile?.role);
  const teacher = accessRole === 'school_teacher';
  const salesDemoMode = useSalesDemoMode();
  const { data: salesDemo } = useSalesDemoData(salesDemoMode);
  const [contentMetrics, setContentMetrics] = useState({ questions: 0, papers: 0 });
  const [schoolAdminMetrics, setSchoolAdminMetrics] = useState<{ teachers: number | null; participation: number | null; averageScore: number | null }>({ teachers: null, participation: null, averageScore: null });
  const { state, ready, mode, error, syncing, refresh } = useSchoolPlatform({
    allowDemo: false,
    unavailableMessage: 'Live institution dashboard requires configured Evidara cloud access.',
  });
  const liveActiveStudents = state.students.filter((student) => student.status === 'active').length;
  const activeStudents = salesDemoMode && salesDemo ? salesDemo.stats.students : liveActiveStudents;
  const seatLimit = state.school.subscription.seatLimit || salesDemo?.subscription?.seat_limit || 0;
  const displayedQuestions = salesDemoMode && salesDemo ? salesDemo.stats.questionInstances : contentMetrics.questions;
  const displayedPapers = salesDemoMode && salesDemo ? salesDemo.stats.tests : contentMetrics.papers;

  const quickActions = teacher
    ? [
        { label: 'Upload Questions', icon: FilePlus, view: 'school-questions' as const },
        { label: 'Create Test', icon: FileText, view: 'school-papers' as const },
        { label: 'Upcoming Tests', icon: FileText, view: 'school-papers' as const },
        { label: 'Recent Results', icon: BarChart3, view: 'school-analytics-overview' as const },
      ]
    : [
        { label: 'Manage Students', icon: Users, view: 'school-students' as const },
        { label: 'Manage Teachers', icon: Users, view: 'school-access' as const },
        { label: 'Create Test', icon: FileText, view: 'school-papers' as const },
        { label: 'View Results', icon: BarChart3, view: 'school-analytics-overview' as const },
      ];

  function openView(event: MouseEvent<HTMLAnchorElement>, next: AppView) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setView(next);
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.set('view', next);
    window.history.pushState({ evidaraView: next }, '', `${url.pathname}${url.search}${url.hash}`);
  }

  useEffect(() => {
    if (salesDemoMode) return;
    if (!supabase || !profile?.id || !state.school.id) return;
    let cancelled = false;
    void (async () => {
      let questionQuery = supabase.from('questions').select('id', { count: 'exact', head: true });
      let paperQuery = supabase.from('question_papers').select('id', { count: 'exact', head: true });
      if (teacher) {
        questionQuery = questionQuery.eq('created_by', profile.id).eq('organization_id', state.school.id);
        paperQuery = paperQuery.eq('created_by', profile.id).eq('organization_id', state.school.id);
      } else {
        questionQuery = questionQuery.eq('organization_id', state.school.id);
        paperQuery = paperQuery.eq('organization_id', state.school.id);
      }
      const [questions, papers] = await Promise.all([questionQuery, paperQuery]);
      if (!cancelled) setContentMetrics({ questions: questions.count || 0, papers: papers.count || 0 });
    })();
    return () => { cancelled = true; };
  }, [profile?.id, salesDemoMode, state.school.id, teacher]);

  useEffect(() => {
    if (teacher || salesDemoMode || !supabase || !state.school.id) {
      setSchoolAdminMetrics({ teachers: null, participation: null, averageScore: null });
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (!token) throw new Error('Your Evidara session has expired.');
        const headers = { Authorization: `Bearer ${token}`, 'x-evidara-organization-id': state.school.id };
        const [accessResponse, analyticsResponse] = await Promise.all([
          fetch(`/api/access-control/?organizationId=${encodeURIComponent(state.school.id)}&page=1&pageSize=1&role=school_teacher`, { headers, cache: 'no-store' }),
          fetch(`/api/institution-analytics?level=school&organizationId=${encodeURIComponent(state.school.id)}`, { headers, cache: 'no-store' }),
        ]);
        const accessPayload = await accessResponse.json() as { accountPage?: { total?: number } };
        const analyticsPayload = await analyticsResponse.json() as { classes?: Array<{ studentCount: number; participation: number | null; averagePercentage: number | null }> };
        if (!accessResponse.ok) throw new Error('Unable to load teacher count.');
        if (!analyticsResponse.ok) throw new Error('Unable to load school assessment summary.');
        const classes = analyticsPayload.classes || [];
        const weighted = (key: 'participation' | 'averagePercentage') => {
          const rows = classes.filter((row) => row[key] != null && row.studentCount > 0);
          const denominator = rows.reduce((sum, row) => sum + row.studentCount, 0);
          if (!denominator) return null;
          return rows.reduce((sum, row) => sum + Number(row[key]) * row.studentCount, 0) / denominator;
        };
        if (!cancelled) setSchoolAdminMetrics({
          teachers: Number(accessPayload.accountPage?.total ?? 0),
          participation: weighted('participation'),
          averageScore: weighted('averagePercentage'),
        });
      } catch {
        if (!cancelled) setSchoolAdminMetrics({ teachers: null, participation: null, averageScore: null });
      }
    })();
    return () => { cancelled = true; };
  }, [salesDemoMode, state.school.id, teacher]);

  if (!ready)
    return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading live institution dashboard…</div>;

  if (error)
    return (
      <div className="p-6">
        <Card className="rounded-xl shadow-sm">
          <CardContent className="p-6">
            <p className="font-semibold text-[var(--foreground)]">Institution dashboard unavailable</p>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">{error}</p>
            <Button className="mt-4" variant="outline" disabled={syncing} onClick={() => void refresh()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );

  return (
    <motion.div className="space-y-4 p-4 md:space-y-6 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <div className="rounded-xl border border-[var(--line)] bg-gradient-to-r from-[#14232B] to-[#117C78] px-4 py-5 text-white sm:px-6 sm:py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white">
            <GraduationCap className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold !text-white md:text-2xl">
              {teacher ? `Teacher Dashboard · ${state.school.name}` : `Welcome, ${state.school.name}`}
            </h1>
            <p className="text-sm !text-white/80">
              {state.school.board}{state.school.city ? ` · ${state.school.city}` : ''}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge className="border-white/25 bg-white/15 !text-white">{state.school.subscription.planName}</Badge>
          <Badge variant="outline" className="border-white/30 bg-transparent !text-white">{state.school.subscription.status}</Badge>
          <Badge variant="outline" className="border-white/30 bg-transparent !text-white">{salesDemoMode ? 'Sales demo dataset' : `Live · ${mode}`}</Badge>
        </div>
      </div>

      {teacher ? (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <StatCard icon={Users} label="Students in scope" value={String(activeStudents)} sub="Only actively assigned sections" />
          <StatCard icon={BookOpen} label="My questions" value={String(displayedQuestions)} sub="Questions authored by you" />
          <StatCard icon={FileText} label="My tests" value={String(displayedPapers)} sub="Tests authored by you" />
          <StatCard icon={BarChart3} label="Students Needing Attention" value="Review" sub="Evidence-first queue below" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6" aria-label="School Admin focus metrics">
          <StatCard icon={Users} label="Students" value={String(activeStudents)} sub="Active licensed students" />
          <StatCard icon={Users} label="Teachers" value={schoolAdminMetrics.teachers == null ? '—' : String(schoolAdminMetrics.teachers)} sub="Active teacher accounts" />
          <StatCard icon={FileText} label="Tests" value={String(displayedPapers)} sub="Institution tests" />
          <StatCard icon={BarChart3} label="Participation" value={schoolAdminMetrics.participation == null ? '—' : `${schoolAdminMetrics.participation.toFixed(1)}%`} sub="Submitted-participant evidence" />
          <StatCard icon={BarChart3} label="Score" value={schoolAdminMetrics.averageScore == null ? '—' : `${schoolAdminMetrics.averageScore.toFixed(1)}%`} sub="Weighted measured class score" />
          <StatCard icon={GraduationCap} label="Licence usage" value={seatLimit > 0 ? `${activeStudents}/${seatLimit}` : '—'} sub={seatLimit > 0 ? `${Math.max(0, seatLimit - activeStudents)} licences available` : 'Licence quantity unavailable'} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {quickActions.map((action) => (
          <a
            key={action.view}
            href={viewHref(action.view)}
            onClick={(event) => openView(event, action.view)}
            className="flex min-h-[4.5rem] items-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-left shadow-sm transition hover:border-[var(--teal)]"
          >
            <action.icon className="h-5 w-5 shrink-0 text-[var(--teal)]" />
            <span className="text-sm font-semibold text-[var(--foreground)]">{action.label}</span>
          </a>
        ))}
      </div>

      {teacher && <TeacherNeedsAttention schoolId={state.school.id} />}

      <Card className="rounded-xl shadow-sm">
        <CardContent className="p-5">
          <p className="text-sm font-semibold text-[var(--foreground)]">{salesDemoMode ? 'Sales Demo School data' : 'Live data only'}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {salesDemoMode
              ? 'This one authorised demo school uses a clearly separated synthetic roster and assessment dataset for product demonstrations. No other school receives these records.'
              : 'All cards above are sourced from authorized live records. Teacher counts are narrowed to the signed-in teacher and assigned student scope; school admins receive institution scope.'}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function SchoolStudentsView() {
  const salesDemoMode = useSalesDemoMode();
  if (salesDemoMode) {
    return (
      <motion.div className="min-w-0 space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
        <div><h1 className="text-2xl font-bold">Demo student roster</h1><p className="text-sm text-[var(--muted-foreground)]">500 seeded sales-demo students. Real school rosters are never mixed with this dataset.</p></div>
        <SalesDemoStudentRoster />
      </motion.div>
    );
  }
  return (
    <motion.div className="min-w-0 space-y-6 p-4 md:p-6" {...fadeUp} initial="initial" animate="animate">
      <StudentLifecycleManager />
    </motion.div>
  );
}

export function SchoolSubscriptionView() {
  return (
    <div className="p-4 md:p-6">
      <SubscriptionCenter />
    </div>
  );
}

export function SchoolResourcesView() {
  return (
    <div className="p-4 md:p-6">
      <ResourceLibrary />
    </div>
  );
}
