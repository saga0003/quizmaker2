import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import {
  isPlatformAdmin,
  isSchoolManager,
  isSuperAdmin,
  normalizeEvidaraRole,
} from '@/lib/roles';

const MODULES = new Set([
  'questions',
  'papers',
  'students',
  'analytics',
  'resources',
  'achievements',
  'benchmarks',
  'subscriptions',
]);

const ROLES = new Set([
  'super_admin',
  'evidara_admin',
  'school_admin',
  'school_teacher',
  'student',
]);

const SCHOOL_SCOPE_ROLES = new Set(['school_admin', 'school_teacher', 'student']);
const SCHOOL_MANAGER_MEMBER_ROLES = new Set([
  'institute_owner',
  'institute_admin',
  'school_owner',
  'school_admin',
]);

function failure(error: unknown) {
  const value = error as { message?: string; status?: number };
  return NextResponse.json(
    { error: value.message || 'Unexpected access-control error.' },
    { status: value.status || 500, headers: { 'Cache-Control': 'no-store' } },
  );
}

async function requestContext(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error } = await auth.admin
    .from('profiles')
    .select('id,full_name,role')
    .eq('id', auth.user.id)
    .single();
  if (error || !profile) throw Object.assign(new Error(error?.message || 'Evidara profile not found.'), { status: 403 });

  const role = normalizeEvidaraRole(profile.role);
  const platformAdmin = isPlatformAdmin(role);
  const superAdmin = isSuperAdmin(role);

  const { data: membership } = await auth.admin
    .from('organization_members')
    .select('organization_id,member_role,is_active')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const schoolManager = isSchoolManager(role)
    && (platformAdmin || SCHOOL_MANAGER_MEMBER_ROLES.has(String(membership?.member_role || '')));

  return {
    ...auth,
    profile,
    role,
    platformAdmin,
    superAdmin,
    schoolManager,
    organizationId: membership?.organization_id || null,
  };
}

type AccessContext = Awaited<ReturnType<typeof requestContext>>;

async function snapshot(ctx: AccessContext, requestedOrganizationId: string | null) {
  if (!ctx.platformAdmin && !ctx.schoolManager) {
    throw Object.assign(new Error('Access Control is available only to Super Admin, Evidara Admin and School Admin.'), { status: 403 });
  }

  const activeOrganizationId = ctx.platformAdmin
    ? requestedOrganizationId
    : ctx.organizationId;

  const [{ data: organizations, error: organizationError }, { data: settings, error: settingsError }] = await Promise.all([
    ctx.admin.from('organizations').select('id,name').order('name'),
    ctx.admin
      .from('module_access_settings')
      .select('id,organization_id,role,module_key,enabled,updated_at')
      .or(activeOrganizationId ? `organization_id.is.null,organization_id.eq.${activeOrganizationId}` : 'organization_id.is.null')
      .order('role')
      .order('module_key'),
  ]);
  if (organizationError || settingsError) throw new Error(organizationError?.message || settingsError?.message || 'Unable to load access settings.');

  let profilesQuery = ctx.admin
    .from('profiles')
    .select('id,full_name,phone,role,updated_at')
    .order('full_name')
    .limit(2000);

  let memberRows: Array<{ organization_id: string; user_id: string; member_role: string; is_active: boolean; organizations?: Array<{ name: string }> | null }> = [];
  if (!ctx.platformAdmin) {
    const { data: members, error: memberError } = await ctx.admin
      .from('organization_members')
      .select('organization_id,user_id,member_role,is_active,organizations(name)')
      .eq('organization_id', ctx.organizationId)
      .eq('is_active', true);
    if (memberError) throw new Error(memberError.message);
    memberRows = (members || []) as typeof memberRows;
    const ids = memberRows.map((member) => member.user_id);
    profilesQuery = ids.length
      ? profilesQuery.in('id', ids)
      : profilesQuery.eq('id', '00000000-0000-0000-0000-000000000000');
  } else {
    const { data: members, error: memberError } = await ctx.admin
      .from('organization_members')
      .select('organization_id,user_id,member_role,is_active,organizations(name)')
      .eq('is_active', true)
      .limit(5000);
    if (memberError) throw new Error(memberError.message);
    memberRows = (members || []) as typeof memberRows;
  }

  const { data: profiles, error: profileError } = await profilesQuery;
  if (profileError) throw new Error(profileError.message);

  const emailById = new Map<string, string>();
  for (let page = 1; page <= 20; page += 1) {
    const { data: users, error: userError } = await ctx.admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (userError) throw new Error(userError.message);
    users.users.forEach((user) => emailById.set(user.id, user.email || ''));
    if (users.users.length < 1000) break;
  }

  const memberships = new Map<string, Array<{ organizationId: string; organizationName: string; role: string }>>();
  memberRows.forEach((member) => {
    const list = memberships.get(member.user_id) || [];
    list.push({
      organizationId: member.organization_id,
      organizationName: member.organizations?.[0]?.name || 'School',
      role: normalizeEvidaraRole(member.member_role),
    });
    memberships.set(member.user_id, list);
  });

  return {
    actor: {
      id: ctx.user.id,
      role: ctx.role,
      superAdmin: ctx.superAdmin,
      platformAdmin: ctx.platformAdmin,
      schoolManager: ctx.schoolManager,
      organizationId: ctx.organizationId,
    },
    activeOrganizationId,
    organizations: organizations || [],
    settings: settings || [],
    accounts: (profiles || []).map((profile) => ({
      ...profile,
      role: normalizeEvidaraRole(profile.role),
      email: emailById.get(profile.id) || '',
      memberships: memberships.get(profile.id) || [],
    })),
  };
}

export async function GET(request: Request) {
  try {
    const ctx = await requestContext(request);
    const requestedOrganizationId = new URL(request.url).searchParams.get('organizationId');
    return NextResponse.json(await snapshot(ctx, requestedOrganizationId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await requestContext(request);
    if (!ctx.platformAdmin && !ctx.schoolManager) {
      throw Object.assign(new Error('Access Control permission is required.'), { status: 403 });
    }

    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'setModuleAccess') {
      const role = normalizeEvidaraRole(String(body.role || 'student'));
      const moduleKey = String(body.moduleKey || '');
      const enabled = Boolean(body.enabled);
      const requestedOrganizationId = body.organizationId ? String(body.organizationId) : null;
      const organizationId = ctx.platformAdmin ? requestedOrganizationId : ctx.organizationId;

      if (!MODULES.has(moduleKey)) throw Object.assign(new Error('Unsupported module.'), { status: 400 });
      if (!ROLES.has(role)) throw Object.assign(new Error('Unsupported role.'), { status: 400 });
      if (organizationId && !SCHOOL_SCOPE_ROLES.has(role)) {
        throw Object.assign(new Error('School-level settings apply only to School Admin, School Teacher and Student roles.'), { status: 400 });
      }
      if (!ctx.platformAdmin && (!organizationId || organizationId !== ctx.organizationId)) {
        throw Object.assign(new Error('School Admin can modify only their own school.'), { status: 403 });
      }
      if (role === 'student' && moduleKey === 'questions' && enabled) {
        throw Object.assign(new Error('Students cannot be granted the Questions workspace.'), { status: 400 });
      }

      const { error } = await ctx.admin.from('module_access_settings').upsert({
        organization_id: organizationId,
        role,
        module_key: moduleKey,
        enabled,
        updated_by: ctx.user.id,
      }, { onConflict: 'scope_key,role,module_key' });
      if (error) throw new Error(error.message);
    } else if (action === 'setRole') {
      if (!ctx.superAdmin) throw Object.assign(new Error('Only Super Admin can change account roles.'), { status: 403 });
      const userId = String(body.userId || '');
      const role = normalizeEvidaraRole(String(body.role || 'student'));
      const organizationId = body.organizationId ? String(body.organizationId) : null;
      if (!userId || !ROLES.has(role)) throw Object.assign(new Error('A valid account and role are required.'), { status: 400 });
      if ((role === 'school_admin' || role === 'school_teacher') && !organizationId) {
        throw Object.assign(new Error('Choose a school for School Admin or School Teacher.'), { status: 400 });
      }

      const { error: roleError } = await ctx.admin.from('profiles').update({ role }).eq('id', userId);
      if (roleError) throw new Error(roleError.message);

      if (role === 'school_admin' || role === 'school_teacher') {
        const { error: deactivateOldError } = await ctx.admin
          .from('organization_members')
          .update({ is_active: false })
          .eq('user_id', userId)
          .neq('organization_id', organizationId);
        if (deactivateOldError) throw new Error(deactivateOldError.message);

        const { error: memberError } = await ctx.admin.from('organization_members').upsert({
          organization_id: organizationId,
          user_id: userId,
          member_role: role,
          is_active: true,
        }, { onConflict: 'organization_id,user_id' });
        if (memberError) throw new Error(memberError.message);
      } else {
        const { error: deactivateError } = await ctx.admin
          .from('organization_members')
          .update({ is_active: false })
          .eq('user_id', userId);
        if (deactivateError) throw new Error(deactivateError.message);
      }
    } else if (action === 'resetPassword') {
      if (!ctx.superAdmin) throw Object.assign(new Error('Only Super Admin can reset account passwords.'), { status: 403 });
      const userId = String(body.userId || '');
      const temporaryPassword = String(body.temporaryPassword || '');
      if (!userId || temporaryPassword.length < 8) {
        throw Object.assign(new Error('Temporary password must contain at least 8 characters.'), { status: 400 });
      }
      const { error } = await ctx.admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
      if (error) throw new Error(error.message);
    } else {
      throw Object.assign(new Error('Unsupported access-control action.'), { status: 400 });
    }

    const requestedOrganizationId = body.organizationId ? String(body.organizationId) : null;
    return NextResponse.json(await snapshot(ctx, requestedOrganizationId), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
