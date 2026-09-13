import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { isSuperAdmin } from '@/lib/roles';

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

function readableError(error: unknown, fallback: string) {
  if (typeof error === 'string') {
    const value = error.trim();
    if (value && value !== '{}') return value;
  }
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    for (const key of ['message', 'error_description', 'msg', 'code']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim() && value.trim() !== '{}') return value.trim();
    }
  }
  return fallback;
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

type ExistingOnboardingAccount = {
  user_id: string;
  profile_role: string | null;
  full_name: string | null;
  phone: string | null;
  active_memberships: number | string | null;
};

async function findOnboardingAccountByEmail(
  admin: Awaited<ReturnType<typeof authenticateRequest>>['admin'],
  email: string,
): Promise<ExistingOnboardingAccount | null> {
  const { data, error } = await admin.rpc('resolve_onboarding_account_by_email', {
    p_email: email.trim().toLowerCase(),
  });
  if (error) throw new Error(`Unable to resolve the School Admin email: ${readableError(error, 'account lookup failed')}`);
  const rows = Array.isArray(data) ? data : [];
  return (rows[0] as ExistingOnboardingAccount | undefined) ?? null;
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

    const actorEmail = String(auth.user.email || '').trim().toLowerCase();
    if (actorEmail && adminEmail === actorEmail) {
      return fail('Use a different email for the institution School Admin. Your Super Admin login must remain separate from institution accounts.');
    }

    const existing = await findOnboardingAccountByEmail(auth.admin, adminEmail);
    let adminUser: { id: string } | null = null;
    let adminCreated = false;
    let invitationSent = false;
    let invitationLink: string | null = null;

    if (existing) {
      const profile = {
        id: existing.user_id,
        full_name: existing.full_name,
        phone: existing.phone,
        role: existing.profile_role,
      };
      adminUser = { id: existing.user_id };
      if (!profile.role) return fail('The existing Evidara account is missing its profile. Use another admin email or repair the account first.');
      if (String(profile.role) !== 'school_admin') {
        return fail(`An Evidara account already exists for ${adminEmail}, but its role is ${String(profile.role)}. Use a dedicated School Admin email so another account is not changed unexpectedly.`);
      }
      if (Number(existing.active_memberships || 0) > 0) return fail('This School Admin already belongs to an institution. Use a dedicated admin email for the new institution.');
    } else {
      const invited = await auth.admin.auth.admin.inviteUserByEmail(adminEmail, { data: { full_name: adminFullName } });

      if (!invited.error && invited.data.user) {
        adminUser = invited.data.user;
        createdUserId = adminUser.id;
        adminCreated = true;
        invitationSent = true;
      } else {
        const inviteFailure = readableError(invited.error, 'Automatic invitation email could not be sent.');
        console.warn('[institution-onboarding] automatic invitation email failed; generating a secure invitation link instead', {
          message: inviteFailure,
        });

        const partial = await findOnboardingAccountByEmail(auth.admin, adminEmail);
        if (partial) {
          if (!partial.profile_role && Number(partial.active_memberships || 0) === 0) {
            await auth.admin.auth.admin.deleteUser(partial.user_id);
          } else {
            return fail('The School Admin email is already registered. Use another email or open the existing account instead.');
          }
        }

        const generated = await auth.admin.auth.admin.generateLink({ type: 'invite', email: adminEmail });
        if (generated.error || !generated.data.user || !generated.data.properties?.action_link) {
          const linkFailure = readableError(generated.error, 'Unable to create a secure School Admin invitation link.');
          return fail(`${inviteFailure} ${linkFailure}`, 502);
        }

        adminUser = generated.data.user;
        createdUserId = adminUser.id;
        adminCreated = true;
        invitationLink = generated.data.properties.action_link;
      }

      const now = new Date().toISOString();
      const [{ error: profileError }, { error: securityError }] = await Promise.all([
        auth.admin.from('profiles').upsert({
          id: adminUser.id,
          full_name: adminFullName,
          phone: adminPhone || null,
          role: 'school_admin',
        }, { onConflict: 'id' }),
        auth.admin.from('credential_security_states').upsert({
          user_id: adminUser.id,
          must_change_password: true,
          temporary_issued_at: now,
          password_changed_at: null,
          updated_by: auth.user.id,
          updated_at: now,
        }, { onConflict: 'user_id' }),
      ]);
      if (profileError || securityError) {
        await auth.admin.auth.admin.deleteUser(adminUser.id);
        createdUserId = null;
        return fail(`School Admin security setup failed: ${readableError(profileError || securityError, 'unknown error')}`, 500);
      }
    }

    if (!adminUser) return fail('Unable to resolve the first School Admin account.', 500);

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
      return fail(readableError(error, 'Institution creation failed.'), error.code === '23505' || error.code === '22023' ? 400 : 500);
    }

    return NextResponse.json({
      ok: true,
      onboarding: data,
      firstAdmin: {
        userId: adminUser.id,
        email: adminEmail,
        fullName: adminFullName,
        created: adminCreated,
        invitationSent,
        invitationLink,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const value = error as { status?: number };
    const message = readableError(error, 'Institution onboarding failed.');
    console.error('[institution-onboarding] request failed', {
      message,
      status: value.status || 500,
    });
    return fail(message, value.status || 500);
  }
}
