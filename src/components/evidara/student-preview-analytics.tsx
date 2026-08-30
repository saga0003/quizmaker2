'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { AnalyticsV12Workspace } from '@/components/analytics-v12/student-analytics-v12';
import { QuestionResponseAudit } from '@/components/analytics-v12/question-response-audit';
import { useAppStore } from '@/store/use-app-store';
import type { AnalyticsV12View } from '@/types/analytics-v12';

type DemoStudent = {
  id: string;
  name: string;
  email: string | null;
  completedTests: number;
};

export function StudentPreviewAnalytics({ view }: { view: AnalyticsV12View }) {
  const { session } = useAuth();
  const impersonatingAs = useAppStore((state) => state.impersonatingAs);
  const user = useAppStore((state) => state.user);
  const [resolving, setResolving] = useState(impersonatingAs === 'student');
  const [error, setError] = useState('');

  useEffect(() => {
    if (impersonatingAs !== 'student') {
      setResolving(false);
      return;
    }
    const token = session?.access_token;
    if (!token) return;
    let cancelled = false;
    void fetch('/api/sales-demo/', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Unable to resolve the Sales Demo student.');
        const students = (payload.students || []) as DemoStudent[];
        const student = students.find((row) => row.completedTests > 0) || students[0];
        if (!student) throw new Error('No active Sales Demo student is available.');
        if (cancelled) return;
        const previewUser = {
          id: student.id,
          name: student.name,
          email: student.email || '',
          role: 'student' as const,
          accessRole: 'student' as const,
        };
        useAppStore.setState({ user: previewUser, impersonatedUser: previewUser });
        setError('');
      })
      .catch((value) => {
        if (!cancelled) setError(value instanceof Error ? value.message : 'Unable to resolve demo student.');
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => { cancelled = true; };
  }, [impersonatingAs, session?.access_token]);

  if (resolving && impersonatingAs === 'student') {
    return <div className="grid min-h-[420px] place-items-center rounded-xl border border-[var(--line)] bg-white"><div className="text-center"><div className="mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--teal)]" /><strong>Opening a real demo student</strong><p className="mt-1 text-sm text-[var(--muted-foreground)]">Loading Supabase attempts, marks and analytics.</p></div></div>;
  }

  if (error) {
    return <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}</div>;
  }

  return <div className="space-y-4"><AnalyticsV12Workspace mode="student" view={view} key={user?.id || 'student-analytics'} />{view === 'question-intelligence' && user?.id && <QuestionResponseAudit studentId={user.id} defaultOpen />}</div>;
}
