import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isSuperAdmin } from '@/lib/roles';

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function normaliseWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function findAuthUserByEmail(admin: Awaited<ReturnType<typeof authenticateRequest>>['admin'], email: string) {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const found = data.users.find((user) => String(user.email || '').trim().toLowerCase() === wanted);
    if (found) return found;
    if (data.users.length < 1000) return null;
  }
  throw new Error('Account directory is too large to resolve this email safely.');
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  try {
    const auth = await authenticateRequest(request);
    const { data: actorProfile } = await auth.admin.from('profiles').select('role').eq('id', auth.user.id).single();
    if (!actorProfile || !isSuperAdmin(actorProfile.role)) return fail('Super Admin permission is required.', 403);

    const body = await request.json() as Record<string, unknown>;
    const school = (body.school || {}) as Record<string, unknown>;
    const subscription = (body.subscription || {}) as Record<string, unknown>;
    const firstAdmin = (body.firstAdmin || {}) as Record<string, unknown>;

    const name = String(school.name || '').trim();
    const city = String(school.city || '').trim();
    const state = String(school.state || '').trim();
    const contactEmail = String(school.contact_email || '').trim().toLowerCase();
    const adminFullName = String(firstAdmin.fullName || '').trim();
    const adminEmail = String(firstAdmin.email || '').trim().toLowerCase();
    const adminPhone = String(firstAdmin.phone || '').trim();
    const seatLimit = Number(subscription.seat_limit || 0);
    const startsAt = String(subscription.starts_at || '').trim();
    const endsAt = String(subscription.ends_at || '').trim();
    const resourceAccess = String(subscription.resource_access || 'full').trim() || 'full';
    const websiteInput = String(school.website || '').trim();
    const website = normaliseWebsite(websiteInput);

    if (name.length < 3) return fail('Institution name must contain at least 3 characters.');
    if (city.length < 2 || state.length < 2) return fail('City and state are required.');
    if (adminFullName.length < 2) return fail('First School Admin name is required.');
    if (!validEmail(adminEmail)) return fail('A valid first School Admin email is required.');
    if (contactEmail && !validEmail(contactEmail)) return fail('Contact email is not valid.');
    if (websiteInput && !website) return fail('Website must be a valid web address.');
    if (!Number.isInteger(seatLimit) || seatLimit < 1 || seatLimit > 100000) return fail('Licensed students must be between 1 and 100000.');
    if (!startsAt || !endsAt || endsAt <= startsAt) return fail('Licence end date must be after its start date.');
    if (!['full', 'limited'].includes(resourceAccess)) return fail('Unsupported resource access setting.');

    let adminUser = await findAuthUserByEmail(auth.admin, adminEmail);
    let adminCreated = false;

    if (adminUser) {
      const [{ data: profile }, { count: activeMemberships }] = await Promise.all([
        auth.admin.from('profiles').select('id,full_name,phone,role').eq('id', adminUser.id).maybeSingle(),
        auth.admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('user_id', adminUser.id).eq('is_active', true),
      ]);
      if (!profile) return fail('The existing Evidara account is missing its profile. Use another admin email or repair the account first.');
      if (String(profile.role) !== 'school_admin') {
        return fail(`An Evidara account already exists for ${adminEmail}, but its role is ${String(profile.role)}. Use a dedicated School Admin email so another account is not changed unexpectedly.`);
      }
      if (Number(activeMemberships || 0) > 0) return fail('This School Admin already belongs to an institution. Use a dedicated admin email for the new institution.');
    } else {
      const invited = await auth.admin.auth.admin.inviteUserByEmail(adminEmail, { data: { full_name: adminFullName } });
      if (invited.error || !invited.data.user) return fail(invited.error?.message || 'Unable to invite the first School Admin.', 500);
      adminUser = invited.data.user;
      createdUserId = adminUser.id;
      adminCreated = true;

      const { error: profileError } = await auth.admin.from('profiles').upsert({
        id: adminUser.id,
        full_name: adminFullName,
        phone: adminPhone || null,
        role: 'school_admin',
      }, { onConflict: 'id' });
      if (profileError) {
        await auth.admin.auth.admin.deleteUser(adminUser.id);
        createdUserId = null;
        return fail(`School Admin profile setup failed: ${profileError.message}`, 500);
      }
    }

    const { data, error } = await auth.admin.rpc('onboard_institution_v2', {
      p_actor_id: auth.user.id,
      p_admin_user_id: adminUser.id,
      p_name: name,
      p_institute_type: String(school.institute_type || 'School').trim() || 'School',
      p_board: String(school.board || 'Other').trim() || 'Other',
      p_address_line1: String(school.address_line1 || '').trim() || null,
      p_address_line2: String(school.address_line2 || '').trim() || null,
      p_city: city,
      p_state: state,
      p_postal_code: String(school.postal_code || '').trim() || null,
      p_phone: String(school.phone || '').trim() || adminPhone,
      p_secondary_phone: String(school.secondary_phone || '').trim() || null,
      p_website: website,
      p_contact_name: String(school.contact_name || '').trim() || adminFullName,
      p_contact_email: contactEmail || adminEmail,
      p_seat_limit: seatLimit,
      p_starts_at: startsAt,
      p_ends_at: endsAt,
      p_resource_access: resourceAccess,
    });

    if (error) {
      if (createdUserId) {
        await auth.admin.auth.admin.deleteUser(createdUserId);
        createdUserId = null;
      }
      return fail(error.message, error.code === '23505' || error.code === '22023' ? 400 : 500);
    }

    return NextResponse.json({
      ok: true,
      onboarding: data,
      firstAdmin: {
        userId: adminUser.id,
        email: adminEmail,
        fullName: adminFullName,
        created: adminCreated,
        invitationSent: adminCreated,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const value = error as { message?: string; status?: number };
    return fail(value.message || 'Institution onboarding failed.', value.status || 500);
  }
}
