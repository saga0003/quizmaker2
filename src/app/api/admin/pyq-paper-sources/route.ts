import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { normalizeEvidaraRole } from '@/lib/roles';

function fail(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json({ error: value.message || 'PYQ paper operation failed.' }, {
    status: value.status || (value.code === '42501' ? 403 : 500),
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function platformAdmin(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error } = await auth.admin.from('profiles').select('id,role').eq('id', auth.user.id).single();
  const role = normalizeEvidaraRole(profile?.role);
  if (error || !profile || !['evidara_admin','super_admin'].includes(role)) {
    throw Object.assign(new Error('Evidara Admin or Super Admin access required.'), { status: 403 });
  }
  return { ...auth, profile, role };
}

export async function GET(request: Request) {
  try {
    const ctx = await platformAdmin(request);
    const { data, error } = await ctx.admin.rpc('list_pyq_source_paper_readiness_service_v18');
    if (error) throw Object.assign(new Error(error.message), { code: error.code });
    return NextResponse.json({ sources: Array.isArray(data) ? data : [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const ctx = await platformAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || '');
    if (action === 'build') {
      const sourcePaperId = String(body.sourcePaperId || '');
      if (!sourcePaperId) throw Object.assign(new Error('Choose a PYQ source paper.'), { status: 400 });
      const { data, error } = await ctx.admin.rpc('build_pyq_paper_service_v18', { p_source_paper_id: sourcePaperId, p_actor: ctx.user.id });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
      return NextResponse.json({ paperId: data }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'syncQuestionOccurrences') {
      const questionId = String(body.questionId || '');
      const occurrences = Array.isArray(body.occurrences) ? body.occurrences : [];
      if (!questionId) throw Object.assign(new Error('Question ID is required.'), { status: 400 });
      const { data, error } = await ctx.admin.rpc('sync_question_pyq_occurrences_service_v18', {
        p_question_id: questionId,
        p_occurrences: occurrences,
        p_actor: ctx.user.id,
      });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
      return NextResponse.json({ result: data }, { headers: { 'Cache-Control': 'no-store' } });
    }
    throw Object.assign(new Error('Unsupported PYQ paper action.'), { status: 400 });
  } catch (error) { return fail(error); }
}
