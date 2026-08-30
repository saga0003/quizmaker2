import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (label, value) => checks.push({ label, ok: Boolean(value) });

const activeViews = read('src/components/evidara/school-views.tsx');
const lifecycle = read('src/components/school/StudentLifecycleManager.tsx');
const hook = read('src/components/school/useSchoolPlatform.ts');
const api = read('src/app/api/school-platform/route.ts');
const migration = read('supabase/migrations/20260807150537_secure_institution_student_lifecycle.sql');
const sqlTest = read('supabase/tests/institution_student_lifecycle_authorization.sql');

const activeRosterStart = activeViews.indexOf('export function SchoolStudentsView()');
const legacyRosterStart = activeViews.indexOf('function LegacyDemoSchoolStudentsView()');
const activeRoster = activeViews.slice(activeRosterStart, legacyRosterStart);

check('the active school roster renders the reusable lifecycle manager', activeRoster.includes('<StudentLifecycleManager />'));
check('the active school roster no longer references synthetic students', !/demoSchoolStudents|demoSegments/.test(activeRoster));
check('the lifecycle manager explicitly disables demo fallback', lifecycle.includes('allowDemo: false'));
check('the lifecycle manager has loading, unavailable, empty, retry, and permission states', [
  'Loading authorized student roster',
  'Student roster unavailable',
  'No student records match this view',
  'Retry',
  'Student roster access is not permitted',
].every((copy) => lifecycle.includes(copy)));
check('teacher UI explains assigned-section read-only scope', lifecycle.includes('Assigned-section read-only access') && lifecycle.includes('Assigned sections'));
check('student invitation and lifecycle statuses are represented honestly', lifecycle.includes('invitationStatus') && lifecycle.includes('<option value="invited">Invited</option>') && lifecycle.includes('<option value="revoked">Revoked</option>'));
check('manager actions retain add, edit, password, promotion, track and revocation behavior', [
  'inviteStudent',
  'updateStudent',
  'setStudentPassword',
  'resetStudentPassword',
  'promote',
  'revoke',
  'removeStudent',
].every((action) => lifecycle.includes(`execute("${action}"`) || lifecycle.includes(`command("${action}"`)));
check('dangerous lifecycle actions use explicit confirmation dialogs', lifecycle.includes('Revoke this student') && lifecycle.includes('Promote {selected.size} selected student') && lifecycle.includes('Remove {detail.fullName} from this institution?'));
check('desktop roster is responsive and exposes an explicit empty state', lifecycle.includes('min-w-[980px]') && lifecycle.includes('overflow-x-auto') && lifecycle.includes('No student records match this view'));
check('narrow roster view collapses the existing sidebar without redesigning it', lifecycle.includes('window.matchMedia("(max-width: 640px)")') && lifecycle.includes('setSidebarOpen(false)'));
check('cloud failures retain status for explicit permission handling', hook.includes('SchoolPlatformRequestError') && hook.includes('errorStatus'));

check('school context derives staff access from active membership role', api.includes('schoolStaffMemberRoles.has(memberRole ?? "")'));
check('school context no longer grants roster scope from profile school role alone', !api.includes('isSchoolStaff(profile.role)') && !api.includes('isSchoolManager(profile.role)'));
check('teacher/admin roster names come from the scoped database DTO', api.includes('list_school_student_lifecycle_v13'));
check('the client-supplied organization remains platform-admin-only', api.includes('if (platformAdmin && requestedOrg)'));
check('staff roster does not use a service-role organization-wide membership read', /if \(schoolStaff\) \{[\s\S]{0,180}?client\.rpc\([\s\S]{0,120}?list_school_student_lifecycle_v13/.test(api));
check('lifecycle writes use the checked V13 RPCs', [
  'school_roster_promote_student_v13',
  'school_roster_revoke_student_v13',
  'school_roster_promote_all_v13',
  'school_roster_revoke_all_v13',
  'update_school_student_tracks_v13',
  'add_school_student_membership_v13',
].every((rpc) => api.includes(rpc)));
check('server-side profile writes remain manager-only and organization scoped', api.includes('if (!ctx.manager)') && /from\("student_school_memberships"\)\.update\([\s\S]{0,380}?\.eq\("organization_id", organizationId\)/.test(api));

check('membership RLS limits teachers through active assignments and active membership', /create policy memberships_read[\s\S]*teacher_section_assignments[\s\S]*member\.is_active = true[\s\S]*student_school_memberships\.section_id/.test(migration));
check('membership writes use the strict Evidara school-manager helper', /create policy memberships_school_write[\s\S]{0,260}?is_evidara_school_manager/.test(migration));
check('authenticated clients cannot mutate membership rows directly', /revoke insert, update, delete on table public\.student_school_memberships[\s\S]{0,80}?from public, anon, authenticated/.test(migration));
check('roster function uses auth uid and derives an authorized organization', migration.includes('v_actor uuid := auth.uid()') && migration.includes('No active authorized institution membership was found'));
check('roster function returns manager or assigned-section scope', migration.includes("'scope', case when v_manager then 'organization' else 'assigned_sections' end"));
check('teacher parent data is omitted from the roster DTO', migration.includes("'parentName', case when v_manager") && migration.includes('jsonb_strip_nulls'));
check('roster DTO returns no email, profile role, or auth metadata keys', !/['"](email|role|avatarUrl|rawUserMetaData|rawAppMetaData)['"]\s*,/.test(migration.slice(migration.indexOf('create or replace function public.list_school_student_lifecycle_v13'), migration.indexOf('create or replace function public.school_roster_promote_student_v13'))));
check('legacy teacher-permissive lifecycle RPC execution is revoked', [
  'promote_school_student(uuid, text)',
  'revoke_school_student(uuid, text)',
  'promote_all_school_students(uuid, text, text)',
  'revoke_all_school_students(uuid, text, text)',
].every((signature) => migration.includes(`revoke all on function public.${signature}`)));
check('new roster and lifecycle RPCs are authenticated-only', migration.includes('from public, anon, authenticated, service_role') && migration.includes('to authenticated;'));

for (const requiredCase of [
  'School Admin could not access the complete own-organization roster',
  'School Admin accessed another organization roster',
  'teacher received organization-wide or incorrect roster data',
  'student opened the institution roster',
  'inactive teacher membership opened the roster',
  'teacher used an arbitrary organization identifier',
  'School Admin changed a cross-organization student by membership id',
  'roster DTO exposed privileged or unrelated profile/security fields',
  'authorized roster mutation was not audited',
]) {
  check(`isolated SQL test covers: ${requiredCase}`, sqlTest.includes(requiredCase));
}

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`);
if (failed.length) {
  console.error(`\nPhase 1 Increment 4 smoke failed (${failed.length}/${checks.length} checks).`);
  process.exit(1);
}

console.log(`\nPhase 1 Increment 4 smoke passed (${checks.length} checks).`);
