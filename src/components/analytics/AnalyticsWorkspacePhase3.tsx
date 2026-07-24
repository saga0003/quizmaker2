'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, LoaderCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { AnalyticsScope, AnalyticsViewerRole } from '@/types/analytics';
import { Button } from '@/components/ui/button';
import { AnalyticsWorkspace } from './AnalyticsWorkspace';
import { SchoolAdminAnalyticsDashboard } from './SchoolAdminAnalyticsDashboard';
import { StudentAnalyticsDashboard } from './StudentAnalyticsDashboard';
import styles from './analytics.module.css';

export function AnalyticsWorkspacePhase3({ audience }: { audience: 'student' | 'school' | 'admin' }) {
  const { profile } = useAuth();
  const role = normalizeEvidaraRole(profile?.role) as AnalyticsViewerRole;
  const [scope, setScope] = useState<AnalyticsScope | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showManagement, setShowManagement] = useState(false);
  const [loading, setLoading] = useState(audience !== 'student' && role !== 'school_teacher');
  const [error, setError] = useState('');

  const loadScope = useCallback(async () => {
    if (!supabase) { setError('Connect Supabase and apply migration 37 to use Analytics Phase 3.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: loadError } = await supabase.rpc('list_analytics_scope_v10');
    if (loadError) setError(loadError.message); else setScope(data as AnalyticsScope);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (audience !== 'student' && role !== 'school_teacher') void loadScope();
  }, [audience, loadScope, role]);

  if (audience === 'student') return <AnalyticsWorkspace audience="student" />;
  if (role === 'school_teacher') return <AnalyticsWorkspace audience={audience} />;

  if (selectedStudent) return <StudentAnalyticsDashboard studentId={selectedStudent} onBack={() => setSelectedStudent(null)} />;

  if (showManagement) {
    return <div className="space-y-4"><Button variant="outline" onClick={() => { setShowManagement(false); void loadScope(); }}><ArrowLeft className="mr-2 h-4 w-4" />Back to school overview</Button><AnalyticsWorkspace audience={audience} /></div>;
  }

  if (loading) return <div className={styles.emptyState}><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading school analytics access…</div></div>;
  if (error) return <div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4 text-sm text-[#B54747]">{error}</div>;
  if (!scope) return <div className={styles.emptyState}>No school analytics scope is available.</div>;

  return <SchoolAdminAnalyticsDashboard scope={scope} viewerRole={scope.viewer_role || role} onOpenStudent={setSelectedStudent} onManage={() => setShowManagement(true)} />;
}
