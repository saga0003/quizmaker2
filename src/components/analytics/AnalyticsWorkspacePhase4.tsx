'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, BarChart3, FlaskConical, Layers3, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { AnalyticsScope, AnalyticsViewerRole } from '@/types/analytics';
import { Button } from '@/components/ui/button';
import { AnalyticsWorkspace } from './AnalyticsWorkspace';
import { PlatformAdminAnalyticsDashboard } from './PlatformAdminAnalyticsDashboard';
import { SchoolAdminAnalyticsDashboard } from './SchoolAdminAnalyticsDashboard';
import { StudentAnalyticsDashboard } from './StudentAnalyticsDashboard';
import { DemoCohortStudio } from './DemoCohortStudio';
import { QuestionCollectionsManager } from '@/components/questions/QuestionCollectionsManager';
import styles from './analytics.module.css';

type AnalyticsModuleTab = 'overview' | 'cohorts' | 'collections';

export function AnalyticsWorkspacePhase4({ audience }: { audience: 'student' | 'school' | 'admin' }) {
  const { profile } = useAuth();
  const role = normalizeEvidaraRole(profile?.role) as AnalyticsViewerRole;
  const [scope, setScope] = useState<AnalyticsScope | null>(null);
  const [selectedOrganization, setSelectedOrganization] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showManagement, setShowManagement] = useState(false);
  const [moduleTab, setModuleTab] = useState<AnalyticsModuleTab>('overview');
  const [loading, setLoading] = useState(audience !== 'student' && role !== 'school_teacher');
  const [error, setError] = useState('');

  const loadScope = useCallback(async () => {
    if (!supabase) { setError('Connect Supabase and apply migrations through 40 to use Analytics.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.rpc('list_analytics_scope_v10');
    if (loadError) setError(loadError.message); else setScope(data as AnalyticsScope);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (audience !== 'student' && role !== 'school_teacher') void loadScope();
  }, [audience, loadScope, role]);

  const schoolScope = useMemo<AnalyticsScope | null>(() => {
    if (!scope || !selectedOrganization) return scope;
    const sectionIds = new Set(scope.sections.filter((section) => section.organization_id === selectedOrganization).map((section) => section.id));
    return {
      ...scope,
      organizations: scope.organizations.filter((organization) => organization.id === selectedOrganization),
      sections: scope.sections.filter((section) => section.organization_id === selectedOrganization),
      students: scope.students.filter((student) => student.organization_id === selectedOrganization),
      teachers: scope.teachers.filter((teacher) => teacher.organization_id === selectedOrganization),
      teacher_assignments: scope.teacher_assignments.filter((assignment) => sectionIds.has(assignment.section_id)),
    };
  }, [scope, selectedOrganization]);

  if (audience === 'student') return <AnalyticsWorkspace audience="student" />;

  const effectiveRole = scope?.viewer_role || role;
  const platformAdmin = effectiveRole === 'super_admin' || effectiveRole === 'evidara_admin';
  const superAdmin = effectiveRole === 'super_admin';
  const collectionKind: 'admin' | 'school' = platformAdmin ? 'admin' : 'school';
  const drilldownOpen = Boolean(selectedStudent || selectedOrganization || showManagement);

  let overview: ReactNode;
  if (role === 'school_teacher') {
    overview = <AnalyticsWorkspace audience={audience} />;
  } else if (selectedStudent) {
    overview = <StudentAnalyticsDashboard studentId={selectedStudent} onBack={() => setSelectedStudent(null)} />;
  } else if (showManagement) {
    overview = <div className="space-y-4"><Button variant="outline" onClick={() => { setShowManagement(false); void loadScope(); }}><ArrowLeft className="mr-2 h-4 w-4" />Back to analytics</Button><AnalyticsWorkspace audience={audience} /></div>;
  } else if (loading) {
    overview = <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading analytics access…</div></div>;
  } else if (error) {
    overview = <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4 text-sm text-[#B54747]">{error}</div>;
  } else if (!scope) {
    overview = <div className={styles.emptyState}>No analytics scope is available.</div>;
  } else if (platformAdmin) {
    overview = selectedOrganization && schoolScope
      ? <div className="space-y-4"><Button variant="outline" onClick={() => setSelectedOrganization(null)}><ArrowLeft className="mr-2 h-4 w-4" />Back to platform overview</Button><SchoolAdminAnalyticsDashboard scope={schoolScope} viewerRole={effectiveRole} onOpenStudent={setSelectedStudent} onManage={() => setShowManagement(true)} /></div>
      : <PlatformAdminAnalyticsDashboard scope={scope} onOpenSchool={setSelectedOrganization} />;
  } else {
    overview = <SchoolAdminAnalyticsDashboard scope={scope} viewerRole={effectiveRole} onOpenStudent={setSelectedStudent} onManage={() => setShowManagement(true)} />;
  }

  return (
    <div className="space-y-6">
      {!drilldownOpen && (
        <div className="rounded-2xl border border-[#D5E2E0] bg-white p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <ModuleButton active={moduleTab === 'overview'} icon={BarChart3} onClick={() => setModuleTab('overview')}>Analytics Overview</ModuleButton>
            {superAdmin && <ModuleButton active={moduleTab === 'cohorts'} icon={FlaskConical} onClick={() => setModuleTab('cohorts')}>Demo Cohorts</ModuleButton>}
            <ModuleButton active={moduleTab === 'collections'} icon={Layers3} onClick={() => setModuleTab('collections')}>Question Collections</ModuleButton>
          </div>
        </div>
      )}

      {drilldownOpen || moduleTab === 'overview'
        ? overview
        : moduleTab === 'cohorts' && superAdmin
          ? <DemoCohortStudio />
          : <QuestionCollectionsManager kind={collectionKind} />}
    </div>
  );
}

function ModuleButton({ active, icon: Icon, onClick, children }: { active: boolean; icon: typeof BarChart3; onClick: () => void; children: ReactNode }) {
  return <Button variant={active ? 'default' : 'ghost'} onClick={onClick} className={active ? 'bg-[#0E5A5A] text-white hover:bg-[#0A4747]' : 'text-[#44545C] hover:bg-[#EDF6F5] hover:text-[#0E5A5A]'}><Icon className="mr-2 h-4 w-4" />{children}</Button>;
}
