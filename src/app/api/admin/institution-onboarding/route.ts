import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isSuperAdmin } from '@/lib/roles';

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const { data: profile } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
    if (!profile || !isSuperAdmin(profile.role)) return fail('Super Admin permission is required.', 403);

    const body = await request.json() as Record<string, unknown>;
    const school = (body.school || {}) as Record<string, unknown>;
    const subscription = (body.subscription || {}) as Record<string, unknown>;
    const firstAdminUserId = String(body.firstAdminUserId || '').trim();
    const name = String(school.name || '').trim();

    if (!name) return fail('Institution name is required.');
    if (!firstAdminUserId) return fail('First School Admin is required.');

    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const { data, error } = await auth.admin.rpc('onboard_institution_v1', {
      p_actor_id: auth.user.id,
      p_admin_user_id: firstAdminUserId,
      p_name: name,
      p_institute_type: String(school.institute_type || 'School'),
      p_board: String(school.board || 'Other'),
      p_city: String(school.city || ''),
      p_state: String(school.state || ''),
      p_phone: String(school.phone || ''),
      p_contact_name: String(school.contact_name || '') || null,
      p_contact_email: String(school.contact_email || '') || null,
      p_seat_limit: Math.max(1, Number(subscription.seat_limit || 100)),
      p_starts_at: String(subscription.starts_at || today),
      p_ends_at: String(subscription.ends_at || nextYear.toISOString().slice(0, 10)),
    });

    if (error) return fail(error.message, 500);
    return NextResponse.json({ ok: true, onboarding: data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const value = error as { message?: string; status?: number };
    return fail(value.message || 'Institution onboarding failed.', value.status || 500);
  }
}
