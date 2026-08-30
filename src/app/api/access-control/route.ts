import { NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/server/supabaseServer';
import { EVIDARA_MODULE_SET } from '@/lib/modules';
import {
  isPlatformAdmin,
  isSchoolManager,
  isSuperAdmin,
  normalizeEvidaraRole,
  type EvidaraRole,
} from '@/lib/roles';

const MODULES = EVIDARA_MODULE_SET;
const ROLES = new Set<EvidaraRole>(['super_admin', 'evidara_admin', 'school_admin', 'school_teacher', 'student']);
const SCHOOL_SCOPE_ROLES = new Set<EvidaraRole>(['school_admin', 'school_teacher', 'student']);
const SCHOOL_MANAGER_MEMBER_ROLES = new Set(['institute_owner', 'institute_admin', 'school_owner', 'school_admin']);

function failure(error: unknown) {
  const value = error as { message?: string; status?: number; code?: string };
  const status = value.status || (value.code === '42501' ? 403 : value.code === '22023' ? 400 : 500);
  return NextResponse.json({ error: value.message || 'Unexpected access-control error.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function requestContext(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error } = await auth.admin.from('profiles').select('id,full_name,role').eq('id', auth.user.id).single();
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
  const schoolManager = isSchoolManager(role) && (platformAdmin || SCHOOL_MANAGER_MEMBER_ROLES.has(String(membership?.member_role || '')));
  return { ...auth, profile, role, platformAdmin, superAdmin, schoolManager, organizationId: membership?.organization_id || null };
}

type AccessContext = Awaited<ReturnType<typeof requestContext>>;
type SnapshotOptions = { organizationId: string | null; search?: string; role?: string; page?: number; pageSize?: number };
type DirectoryPayload = { accounts?: Array<Record<string, unknown>>; page?: number; pageSize?: number; total?: number; totalPages?: number };

function activeScope(ctx: AccessContext, requested: string | null) {
  return ctx.platformAdmin ? requested : ctx.organizationId;
}

async function assertAccountInScope(ctx: AccessContext, userId: string, organizationId: string | null) {
  if (ctx.superAdmin) return;
  if (!organizationId) throw Object.assign(new Error('Choose an institution first.'), { status: 400 });
  const [{ data: member }, { data: student }] = await Promise.all([
    ctx.admin.from('organization_members').select('id').eq('organization_id', organizationId).eq('user_id', userId).eq('is_active', true).maybeSingle(),
    ctx.admin.from('student_school_memberships').select('id').eq('organization_id', organizationId).eq('student_id', userId).eq('status', 'active').maybeSingle(),
  ]);
  if (!member && !student) throw Object.assign(new Error('The selected account is outside your institution scope.'), { status: 403 });
  const { data: target } = await ctx.admin.from('profiles').select('role').eq('id', userId).single();
  const targetRole = normalizeEvidaraRole(target?.role);
  if (ctx.role === 'evidara_admin' && ['super_admin', 'evidara_admin'].includes(targetRole)) {
    throw Object.assign(new Error('Evidara Admin cannot change platform-administrator accounts.'), { status: 403 });
  }
  if (ctx.role === 'school_admin' && ['super_admin', 'evidara_admin', 'school_admin'].includes(targetRole)) {
    throw Object.assign(new Error('School Admin can manage only teachers and students.'), { status: 403 });
  }
}

async function snapshot(ctx: AccessContext, options: SnapshotOptions) {
  if (!ctx.platformAdmin && !ctx.schoolManager) {
    throw Object.assign(new Error('Access Control is available only to Super Admin, Evidara Admin and School Admin.'), { status: 403 });
  }
  const organizationId = activeScope(ctx, options.organizationId);
  let organizationsQuery = ctx.admin.from('organizations').select('id,name,city,state,status').order('name');
  if (!ctx.platformAdmin && ctx.organizationId) organizationsQuery = organizationsQuery.eq('id', ctx.organizationId);

  const [{ data: organizations, error: organizationError }, { data: settings, error: settingsError }, directoryResult] = await Promise.all([
    organizationsQuery,
    ctx.admin.from('module_access_settings')
      .select('id,organization_id,role,module_key,enabled,updated_at')
      .or(organizationId ? `organization_id.is.null,organization_id.eq.${organizationId}` : 'organization_id.is.null')
      .in('module_key', [...MODULES]).order('role').order('module_key'),
    ctx.admin.rpc('admin_account_directory_service_v14', {
      p_actor_id: ctx.user.id,
      p_organization_id: organizationId,
      p_search: options.search?.trim() || null,
      p_role: options.role && options.role !== 'all' ? options.role : null,
      p_page: Math.max(1, Number(options.page || 1)),
      p_page_size: Math.min(100, Math.max(1, Number(options.pageSize || 50))),
    }),
  ]);
  if (organizationError || settingsError || directoryResult.error) {
    throw new Error(organizationError?.message || settingsError?.message || directoryResult.error?.message || 'Unable to load access settings.');
  }
  const directory = (directoryResult.data || {}) as DirectoryPayload;
  return {
    actor: { id: ctx.user.id, role: ctx.role, superAdmin: ctx.superAdmin, platformAdmin: ctx.platformAdmin, schoolManager: ctx.schoolManager, organizationId: ctx.organizationId },
    activeOrganizationId: organizationId,
    organizations: organizations || [], settings: settings || [],
    accounts: (directory.accounts || []).map((account) => ({
      ...account,
      role: normalizeEvidaraRole(String(account.role || 'student')),
      memberships: Array.isArray(account.memberships) ? account.memberships.map((membership) => {
        const value = membership as Record<string, unknown>;
        return {
          organizationId: String(value.organization_id || value.organizationId || ''),
          organizationName: String(value.organization_name || value.organizationName || ''),
          role: normalizeEvidaraRole(String(value.role || 'student')),
          isActive: Boolean(value.is_active ?? value.isActive ?? true),
        };
      }) : [],
    })),
    accountPage: { page: Number(directory.page || 1), pageSize: Number(directory.pageSize || 50), total: Number(directory.total || 0), totalPages: Number(directory.totalPages || 1) },
  };
}

function optionsFromUrl(request: Request): SnapshotOptions {
  const params = new URL(request.url).searchParams;
  return { organizationId: params.get('organizationId'), search: params.get('search') || '', role: params.get('role') || 'all', page: Number(params.get('page') || 1), pageSize: Number(params.get('pageSize') || 50) };
}

export async function GET(request: Request) {
  try { const ctx = await requestContext(request); return NextResponse.json(await snapshot(ctx, optionsFromUrl(request)), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';
  return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export async function POST(request: Request) {
  try {
    const ctx = await requestContext(request);
    if (!ctx.platformAdmin && !ctx.schoolManager) throw Object.assign(new Error('Access Control permission is required.'), { status: 403 });
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || '');

    if (action === 'setModuleAccess') {
      const role = normalizeEvidaraRole(String(body.role || 'student'));
      const moduleKey = String(body.moduleKey || '');
      const enabled = Boolean(body.enabled);
      const requestedOrganizationId = body.organizationId ? String(body.organizationId) : null;
      const organizationId = activeScope(ctx, requestedOrganizationId);
      if (!MODULES.has(moduleKey)) throw Object.assign(new Error('Unsupported or retired module.'), { status: 400 });
      if (!ROLES.has(role)) throw Object.assign(new Error('Unsupported role.'), { status: 400 });
      if (organizationId && !SCHOOL_SCOPE_ROLES.has(role)) throw Object.assign(new Error('School-level settings apply only to school roles.'), { status: 400 });
      if (!ctx.platformAdmin && (!organizationId || organizationId !== ctx.organizationId)) throw Object.assign(new Error('School Admin can modify only their own school.'), { status: 403 });
      if (role === 'student' && moduleKey === 'questions' && enabled) throw Object.assign(new Error('Students cannot be granted the Questions workspace.'), { status: 400 });
      const { error } = await ctx.admin.from('module_access_settings').upsert({ organization_id: organizationId, role, module_key: moduleKey, enabled, updated_by: ctx.user.id }, { onConflict: 'scope_key,role,module_key' });
      if (error) throw new Error(error.message);
    } else if (action === 'setRole') {
      const userId = String(body.userId || '');
      const role = normalizeEvidaraRole(String(body.role || 'student'));
      const requestedOrg = body.organizationId ? String(body.organizationId) : null;
      const organizationId = ctx.role === 'school_admin' ? ctx.organizationId : requestedOrg;
      if (!userId || !ROLES.has(role)) throw Object.assign(new Error('A valid account and role are required.'), { status: 400 });
      if (!ctx.superAdmin) await assertAccountInScope(ctx, userId, organizationId);
      const { error } = await ctx.admin.rpc('assign_account_role_service_v14', { p_actor_id: ctx.user.id, p_user_id: userId, p_role: role, p_organization_id: organizationId });
      if (error) throw Object.assign(new Error(error.message), { code: error.code });
    } else if (action === 'resetPassword') {
      const userId = String(body.userId || '');
      const requestedOrg = body.organizationId ? String(body.organizationId) : null;
      const organizationId = ctx.role === 'school_admin' ? ctx.organizationId : requestedOrg;
      const temporaryPassword = String(body.temporaryPassword || '') || generatePassword();
      if (!userId || temporaryPassword.length < 8) throw Object.assign(new Error('Temporary password must contain at least 8 characters.'), { status: 400 });
      await assertAccountInScope(ctx, userId, organizationId);
      const { error } = await ctx.admin.auth.admin.updateUserById(userId, { password: temporaryPassword });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ...(await snapshot(ctx, { organizationId, search: String(body.search || ''), role: String(body.roleFilter || 'all'), page: Number(body.page || 1), pageSize: Number(body.pageSize || 50) })), temporaryPassword }, { headers: { 'Cache-Control': 'no-store' } });
    } else if (action === 'bulkCreateAccounts') {
      const rows = Array.isArray(body.rows) ? body.rows.slice(0, 1000) as Array<Record<string, unknown>> : [];
      const requestedOrg = body.organizationId ? String(body.organizationId) : null;
      const organizationId = ctx.role === 'school_admin' ? ctx.organizationId : requestedOrg;
      if (!organizationId) throw Object.assign(new Error('Choose an institution for this import.'), { status: 400 });
      if (ctx.role === 'evidara_admin') {
        const today = new Date().toISOString().slice(0, 10);
        const { data: subscription } = await ctx.admin.from('school_subscriptions').select('id').eq('organization_id', organizationId).eq('status', 'active').lte('starts_at', today).gte('ends_at', today).limit(1).maybeSingle();
        if (!subscription) throw Object.assign(new Error('Evidara Admin can provision an institution only after an active paid subscription is confirmed.'), { status: 403 });
      }
      if (ctx.role === 'school_admin' && organizationId !== ctx.organizationId) throw Object.assign(new Error('School Admin can import only into their own school.'), { status: 403 });
      const results: Array<Record<string, unknown>> = [];
      for (const row of rows) {
        const email = String(row.email || '').trim().toLowerCase();
        const fullName = String(row.fullName || row.name || '').trim();
        const requestedRole = normalizeEvidaraRole(String(row.role || 'student'));
        const role: EvidaraRole = ctx.role === 'school_admin' ? (requestedRole === 'school_teacher' ? 'school_teacher' : 'student') : requestedRole;
        if (!email || !email.includes('@')) { results.push({ email, status: 'failed', error: 'Valid email required.' }); continue; }
        if (!ctx.superAdmin && ['super_admin', 'evidara_admin'].includes(role)) { results.push({ email, status: 'failed', error: 'Platform roles are not allowed in this import.' }); continue; }
        const password = String(row.password || '').trim() || generatePassword();
        const created = await ctx.admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName || email.split('@')[0] } });
        if (created.error || !created.data.user) { results.push({ email, status: 'failed', error: created.error?.message || 'Unable to create account.' }); continue; }
        const userId = created.data.user.id;
        await ctx.admin.from('profiles').update({ full_name: fullName || null, phone: String(row.phone || '').trim() || null }).eq('id', userId);
        if (role === 'student') {
          const grade = Math.max(1, Math.min(12, Number(row.grade || 1)));
          const { error: membershipError } = await ctx.admin.from('student_school_memberships').insert({ organization_id: organizationId, student_id: userId, academic_year: String(row.academicYear || new Date().getFullYear()), grade, section: String(row.section || '').trim() || null, board: String(row.board || 'Other'), tracks: [], status: 'active', parent_name: String(row.parentName || '').trim() || null, parent_phone: String(row.parentPhone || '').trim() || null });
          if (membershipError) { results.push({ email, status: 'partial', userId, password, error: membershipError.message }); continue; }
        } else {
          const { error: roleError } = await ctx.admin.rpc('assign_account_role_service_v14', { p_actor_id: ctx.user.id, p_user_id: userId, p_role: role, p_organization_id: organizationId });
          if (roleError) { results.push({ email, status: 'partial', userId, password, error: roleError.message }); continue; }
        }
        results.push({ email, fullName, role, status: 'created', userId, temporaryPassword: password });
      }
      return NextResponse.json({ results, created: results.filter((r) => r.status === 'created').length, failed: results.filter((r) => r.status !== 'created').length }, { headers: { 'Cache-Control': 'no-store' } });
    } else {
      throw Object.assign(new Error('Unsupported access-control action.'), { status: 400 });
    }

    return NextResponse.json(await snapshot(ctx, { organizationId: body.organizationId ? String(body.organizationId) : null, search: String(body.search || ''), role: String(body.roleFilter || 'all'), page: Number(body.page || 1), pageSize: Number(body.pageSize || 50) }), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
