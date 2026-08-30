import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { normalizeEvidaraRole } from '@/lib/roles';

function fail(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  return NextResponse.json({ error: value.message || 'Paper file import failed.' }, {
    status: value.status || (value.code === '42501' ? 403 : value.code === '22023' ? 400 : 500),
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
  return { ...auth, profile };
}
export async function POST(request: Request) {
  try {
    const ctx = await platformAdmin(request);
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || 'preview');
    if (action === 'preview') {
      const rows = Array.isArray(body.rows) ? body.rows : [];
      if (!rows.length || rows.length > 250) throw Object.assign(new Error('Preview 1–250 questions at a time.'), { status: 400 });
      const { data, error } = await ctx.admin.rpc('preview_paper_import_duplicates_service_v18', { p_rows: rows });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
      return NextResponse.json({ matches: Array.isArray(data) ? data : [] }, { headers: { 'Cache-Control': 'no-store' } });
    }
    if (action === 'commit') {
      const bundle = body.bundle && typeof body.bundle === 'object' ? body.bundle : null;
      if (!bundle) throw Object.assign(new Error('Paper import bundle is required.'), { status: 400 });
      const { data, error } = await ctx.admin.rpc('paper_file_import_bundle_service_v18', { p_bundle: bundle, p_actor: ctx.user.id });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
      return NextResponse.json({ result: data }, { headers: { 'Cache-Control': 'no-store' } });
    }
    throw Object.assign(new Error('Unsupported paper import action.'), { status: 400 });
  } catch (error) { return fail(error); }
}
