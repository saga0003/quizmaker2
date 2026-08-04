'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { normalizeEvidaraRole } from '@/lib/roles';
import { useQuestionScope } from '@/components/questions/useQuestionScope';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

type ReviewQuestion = {
  id: string;
  stem_text: string;
  difficulty: string;
  created_at: string;
  subjects?: { name?: string } | null;
  chapters?: { name?: string } | null;
};

export function SchoolQuestionReview() {
  const { profile, session, configured } = useAuth();
  const { organizationId, loading: scopeLoading } = useQuestionScope('school');
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const role = normalizeEvidaraRole(profile?.role);
  const canReview = role === 'school_admin' || role === 'super_admin' || role === 'evidara_admin';

  const load = useCallback(async () => {
    if (!configured || !supabase || !canReview || scopeLoading || !organizationId) return;
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('questions')
      .select('id,stem_text,difficulty,created_at,subjects(name),chapters(name)')
      .eq('organization_id', organizationId)
      .eq('status', 'in_review')
      .order('created_at', { ascending: true })
      .limit(20);
    if (loadError) setError(loadError.message);
    else setQuestions((data || []) as unknown as ReviewQuestion[]);
    setLoading(false);
  }, [canReview, configured, organizationId, scopeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(questionId: string, status: 'approved' | 'rejected') {
    if (!session?.access_token) return;
    setBusy(questionId);
    setError('');
    const response = await fetch('/api/questions/review/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ questionId, status }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setError(payload.error || 'Unable to review the question.');
    else setQuestions((current) => current.filter((question) => question.id !== questionId));
    setBusy('');
  }

  if (!canReview || !configured) return null;

  return (
    <Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#0E5A5A]">
              <ShieldCheck className="h-4 w-4" />School Admin Review
            </div>
            <h2 className="mt-1 font-semibold text-[#14232B]">Questions waiting for approval</h2>
            <p className="mt-1 text-xs text-[#6B7980]">Approved questions become available immediately inside the paper builder.</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-[#F2B84B]/20 text-[#8A5F00]">{questions.length} pending</Badge>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} className="border-[#E7ECEB]">
              <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
            </Button>
          </div>
        </div>

        {error && <div className="mt-3 rounded-lg border border-[#B54747]/20 bg-[#B54747]/5 px-3 py-2 text-xs text-[#B54747]">{error}</div>}

        {loading ? (
          <div className="py-7 text-center text-xs text-[#6B7980]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading the review queue…</div>
        ) : questions.length ? (
          <div className="mt-4 space-y-2">
            {questions.map((question) => (
              <div key={question.id} className="flex flex-col gap-3 rounded-xl border border-[#E7ECEB] bg-[#F7F9F7]/55 p-3 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium text-[#14232B]">{question.stem_text}</p>
                  <p className="mt-1 text-xs text-[#6B7980]">{question.subjects?.name || 'Unclassified'} · {question.chapters?.name || 'No chapter'} · {question.difficulty.replaceAll('_', ' ')}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" disabled={busy === question.id} onClick={() => void decide(question.id, 'rejected')} className="border-[#B54747]/30 text-[#B54747] hover:bg-[#B54747]/10">
                    <XCircle className="mr-1 h-4 w-4" />Reject
                  </Button>
                  <Button size="sm" disabled={busy === question.id} onClick={() => void decide(question.id, 'approved')} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
                    {busy === question.id ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-[#DCE9E7] px-4 py-5 text-center text-xs text-[#6B7980]">No school questions are waiting for review.</div>
        )}
      </CardContent>
    </Card>
  );
}
