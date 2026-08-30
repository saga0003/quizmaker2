'use client';

import { useEffect, useState, type MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, BookOpen, FilePlus, FileText, GraduationCap, Users } from 'lucide-react';
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

export function SchoolDashboardView() {
  const setView = useAppStore((s) => s.setView);
  const { profile } = useAuth();
  const accessRole = normalizeEvidaraRole(profile?.role);
  const teacher = accessRole === 'school_teacher';
  const salesDemoMode = useSalesDemoMode();
  const { data: salesDemo } = useSalesDemoData(salesDemoMode);
  const [contentMetrics, setContentMetrics] = useState({ questions: 0, papers: 0 });
  const { state, ready, mode, error, syncing, refresh } = useSchoolPlatform({
    allowDemo: false,
    unavailableMessage: 'Live institution dashboard requires configured Evidara cloud access.',
  });
  const liveActiveStudents = state.students.filter((student) => student.status === 'active').length;
  const activeStudents = salesDemoMode && salesDemo ? salesDemo.stats.students : liveActiveStudents;
  const seatLimit = state.school.subscription.seatLimit || salesDemo?.subscription?.seat_limit || 0;
  const displayedQuestions = salesDemoMode && salesDemo ? salesDemo.stats.questionInstances : contentMetrics.questions;
  const displayedPapers = salesDemoMode && salesDemo ? salesDemo.stats.tests : contentMetrics.papers;

  const quickActions = [
    { label: teacher ? 'New My Question' : 'New Question', icon: FilePlus, view: 'school-questions' as const },
    { label: 'Create Paper', icon: FileText, view: 'school-papers' as const },
    { label: teacher ? 'Assigned Students' : 'Manage Students', icon: Users, view: 'school-students' as const },
    { label: 'View Analytics', icon: BarChart3, view: 'school-analytics-overview' as const },
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

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label={teacher ? 'Students in scope' : 'Active students'}
          value={String(activeStudents)}
          sub={
            salesDemoMode && salesDemo
              ? `${salesDemo.stats.neetStudents} NEET + ${salesDemo.stats.jeeStudents} JEE · ${Math.max(0, seatLimit - activeStudents)} of ${seatLimit} licences available`
              : teacher
                ? 'Only actively assigned sections'
                : seatLimit > 0
                  ? `${Math.max(0, seatLimit - activeStudents)} of ${seatLimit} seats available`
                  : state.school.subscription.status === 'active'
                    ? 'Unlimited student access'
                    : 'Activates with institution plan'
          }
        />
        <StatCard
          icon={BookOpen}
          label={salesDemoMode ? 'Demo question instances' : teacher ? 'My questions' : 'School questions'}
          value={String(displayedQuestions)}
          sub={salesDemoMode ? 'Across seeded chapter, topic, mock and full-length tests' : 'Live question count'}
        />
        <StatCard
          icon={FileText}
          label={salesDemoMode ? 'Demo tests' : teacher ? 'My papers' : 'School papers'}
          value={String(displayedPapers)}
          sub={salesDemoMode && salesDemo ? `${salesDemo.stats.attempts.toLocaleString('en-IN')} submitted demo attempts` : 'Live paper count'}
        />
        <StatCard
          icon={BookOpen}
          label="Resources"
          value={String(state.resources.length)}
          sub="Authorized live resources"
        />
      </div>

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
