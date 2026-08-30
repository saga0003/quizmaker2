import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { normalizeEvidaraRole } from '@/lib/roles';
import { uploadPyqV19AssetToR2 } from '@/lib/server/r2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function failure(error: unknown) {
  const value = error as { message?: string; status?: number };
  return NextResponse.json({ error: value.message || 'Unable to upload V19 PYQ asset.' }, { status: value.status || 500, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const { data: profile, error } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
    if (error || !profile || normalizeEvidaraRole(profile.role) !== 'super_admin') {
      throw Object.assign(new Error('Only Super Admin can upload V19 PYQ source assets.'), { status: 403 });
    }
    const form = await request.formData();
    const file = form.get('file');
    const relativePath = String(form.get('path') || '').replace(/^\/+/, '');
    if (!(file instanceof File) || !relativePath) throw Object.assign(new Error('V19 asset file and relative path are required.'), { status: 400 });
    if (!relativePath.startsWith('assets/')) throw Object.assign(new Error('Only files inside the V19 assets folder can be uploaded here.'), { status: 400 });
    const type = file.type || (file.name.toLowerCase().endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
    const result = await uploadPyqV19AssetToR2({ bytes: new Uint8Array(await file.arrayBuffer()), contentType: type, relativePath });
    return NextResponse.json({ ok: true, path: relativePath, ...result }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
