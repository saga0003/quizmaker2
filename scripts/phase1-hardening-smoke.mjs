import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const checks = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function check(name, condition, details = '') {
  checks.push({ name, ok: Boolean(condition), details });
  if (!condition) failures.push(name);
}

const eligibilityMigration = read('supabase/migrations/20260830171000_phase1_real_student_test_access.sql');
const assignmentMigration = read('supabase/migrations/20260830172500_phase1_assignment_and_subscription_core.sql');
const assignmentSearchMigration = read('supabase/migrations/20260830172700_phase1_assignment_student_search.sql');
const assignmentPublishGuard = read('supabase/migrations/20260830231500_phase1_assignment_publish_guard.sql');
const resultReleaseMigration = read('supabase/migrations/20260830235800_phase1_result_release_security.sql');
const resultLegacyLockdown = read('supabase/migrations/20260830235900_phase1_result_release_legacy_rpc_lockdown.sql');
const crossSchoolMigration = read('supabase/migrations/20260831001200_phase1_cross_school_analytics_isolation.sql');
const supportScopeMigration = read('supabase/migrations/20260831005500_phase1_platform_support_analytics_scope.sql');
const assignmentCenter = read('src/components/evidara/paper-assignment-center.tsx');
const responseAudit = read('src/components/analytics-v12/question-response-audit.tsx');
const studentResults = read('src/components/papers/StudentResults.tsx');
const subscriptionCenter = read('src/components/school/SubscriptionCenter.tsx');
const viewAsSwitcher = read('src/components/evidara/login-as-switcher.tsx');
const homeShell = read('src/app/page.tsx');
const releaseChecklist = read('PHASE1_RELEASE_CHECKLIST.md');
const releaseWorkflow = read('.github/workflows/phase1-release-gate.yml');

check('real student helper exists', /create or replace function public\.is_active_student_member/i.test(eligibilityMigration));
check('student helper reads student_school_memberships', /from public\.student_school_memberships/i.test(eligibilityMigration));
check('student helper requires active membership', /membership\.status\s*=\s*'active'/i.test(eligibilityMigration));
check('available paper listing accepts active student membership', /create or replace function public\.list_available_papers[\s\S]*is_active_student_member/i.test(eligibilityMigration));
check('private-code lookup accepts active student membership', /create or replace function public\.find_paper_by_code[\s\S]*is_active_student_member/i.test(eligibilityMigration));
check('exam start accepts active student membership', /create or replace function public\.start_exam_attempt[\s\S]*is_active_student_member/i.test(eligibilityMigration));
check('staff is_org_member helper is not redefined', !/create or replace function public\.is_org_member/i.test(eligibilityMigration));
check('student membership helper is not directly browser-executable', /revoke all on function public\.is_active_student_member\(uuid, uuid\) from authenticated/i.test(eligibilityMigration));

check('assignment tables are defined', /create table if not exists public\.paper_assignment_profiles/i.test(assignmentMigration) && /create table if not exists public\.paper_student_assignments/i.test(assignmentMigration));
check('assignment preview is server-authoritative', /create or replace function public\.preview_paper_assignment_v19/i.test(assignmentMigration));
check('assignment cohort is materialized server-side', /create or replace function public\.(assign_paper_audience_v19|materialize_paper_assignment_v19)/i.test(assignmentMigration));
check('student assignment search RPC exists', /create or replace function public\.search_assignment_students_v19/i.test(assignmentSearchMigration));
check('school papers workspace renders assignment center', /import \{ PaperAssignmentCenter \}/.test(homeShell) && /kind === 'school' && <PaperAssignmentCenter/.test(homeShell));
check('assignment UI previews exact audience count', /Preview audience/.test(assignmentCenter) && /assigned_count/.test(assignmentCenter));
check('assignment UI supports class filters and specific students', /Class filters/.test(assignmentCenter) && /Specific students/.test(assignmentCenter));
check('new institutional papers require assigned cohort before publish', /phase1_require_assigned_audience_v19/.test(assignmentPublishGuard) && /Assign this test to students before publishing it/.test(assignmentPublishGuard));
check('zero-student assignment cannot be published', /has no eligible students/.test(assignmentPublishGuard));

check('result release policy is server-authoritative', /create or replace function public\.student_result_release_level/i.test(resultReleaseMigration));
check('hidden results resolve to no release', /when v_mode = 'hidden' then 'none'/i.test(resultReleaseMigration));
check('score-only results expose only score level', /when v_mode = 'score_only' then 'score'/i.test(resultReleaseMigration));
check('score-and-answers results expose answer level', /when v_mode = 'score_and_answers' then 'answers'/i.test(resultReleaseMigration));
check('in-depth results expose analytics level', /when v_mode = 'in_depth_analytics' then 'analytics'/i.test(resultReleaseMigration));
check('after-close uses authoritative server time', /v_mode = 'after_close'[\s\S]*now\(\) >= v_until/i.test(resultReleaseMigration));
check('submission masks unreleased score facts', /'score', case when v_released then v_attempt\.score else null end/i.test(resultReleaseMigration));
check('student results listing masks unreleased score facts', /create or replace function public\.list_my_attempt_results[\s\S]*case when release\.level in \('score','answers','analytics'\) then a\.score else null end/i.test(resultReleaseMigration));
check('answer review requires answers release', /Answers and solutions have not been released/i.test(resultReleaseMigration));
check('post-test reflection requires answers release', /Post-test reflection is available after answers are released/i.test(resultReleaseMigration));
check('raw live analytics is not browser executable', /revoke all on function public\.get_live_student_analytics_v12[\s\S]*authenticated/i.test(resultReleaseMigration));
check('student self analytics fails closed on unreleased evidence', /Detailed analytics contains assessment evidence that has not been released/i.test(resultReleaseMigration));
check('legacy result analytics helpers are browser-locked', [
  'get_student_test_comparison_base_v12', 'get_student_test_comparison_v11',
  'analytics_test_snapshot_base_v12', 'analytics_test_snapshot_v11',
  'analytics_subject_snapshot_base_v12', 'analytics_subject_snapshot_v11',
  'analytics_attempt_time_snapshot_v12',
].every((fn) => new RegExp(`revoke all on function public\\.${fn}[^;]*authenticated`, 'i').test(resultLegacyLockdown)));
check('student results UI shows withheld state', /Result not released/.test(studentResults) && /result_released/.test(studentResults));

check('membership-specific analytics authorization exists', /create or replace function public\.analytics_can_view_membership_v20/i.test(crossSchoolMigration));
check('school-staff analytics resolves a single shared institution', /create or replace function public\.analytics_scope_organization_v20/i.test(crossSchoolMigration) && /Multiple institutions match this student/.test(crossSchoolMigration));
check('analytics directory filters each membership row, not only student identity', /list_analytics_students_v12[\s\S]*analytics_can_view_membership_v20\(membership\.organization_id, membership\.section_id\)/i.test(crossSchoolMigration));
check('live analytics membership is institution-scoped', /membership\.organization_id = v_scope_org/i.test(crossSchoolMigration));
check('live analytics attempts are institution-scoped', /attempt\.organization_id = v_scope_org/i.test(crossSchoolMigration));
check('live analytics comparison cohort is institution-scoped', /cohort_attempt\.organization_id = v_scope_org/i.test(crossSchoolMigration));
check('cross-school answer review is rejected', /This assessment belongs to another institution/i.test(crossSchoolMigration));
check('scoped helper RPCs are internal-only', /revoke all on function public\.analytics_scope_organization_v20\(uuid\) from public, anon, authenticated/i.test(crossSchoolMigration));
check('platform support has an explicit institution-scoped analytics RPC', /create or replace function public\.get_student_analytics_scoped_v20/i.test(supportScopeMigration) && /p_organization_id uuid/i.test(supportScopeMigration));
check('platform support analytics writes an audit record', /support\.analytics\.view/.test(supportScopeMigration) && /insert into public\.audit_logs/i.test(supportScopeMigration));
check('platform support raw scope cannot be implicit', /Platform support analytics requires an explicit institution scope/.test(supportScopeMigration));
check('transferred student compatibility path refuses multi-school aggregation', /history in multiple institutions\. Choose one institution/i.test(supportScopeMigration));
check('explicit support scope is propagated into live analytics', /set_config\('evidara\.analytics_scope_org',\s*p_organization_id::text,\s*true\)/i.test(supportScopeMigration));
check('explicit support RPC is not anonymous', /revoke all on function public\.get_student_analytics_scoped_v20[\s\S]*from public, anon/i.test(supportScopeMigration));

check('question evidence code no longer uses PromiseLike.finally', !/\.finally\s*\(/.test(responseAudit));
check('school licence UI states ₹199 per licensed student', /₹199\s*\/\s*licensed student\s*\/\s*year/i.test(subscriptionCenter));
check('school licence UI does not promise unlimited students', !/Unlimited students|Unlimited on activation|No seat limits/i.test(subscriptionCenter));
check('school licence UI shows licensed and active quantities', /Licensed students/i.test(subscriptionCenter) && /Active students/i.test(subscriptionCenter));
check('Super Admin switcher is labelled View As', /View As · Read only|Viewing as/i.test(viewAsSwitcher));
check('Super Admin preview is explicitly read-only', /Read-only Super Admin preview|Page actions are disabled/i.test(viewAsSwitcher));
check('workspace shell uses inert during View As', /inert=\{readOnlyPreview \|\| undefined\}/.test(homeShell));
check('workspace shell displays no-writes preview banner', /No writes allowed/.test(homeShell) && /Super Admin · Read-only View As/.test(homeShell));
check('release checklist contains all P0 items', Array.from({ length: 12 }, (_, index) => `P0.${index + 1}`).every((item) => releaseChecklist.includes(item)));
check('release workflow runs hardening checks', /phase1-hardening-smoke\.mjs/.test(releaseWorkflow));
const regressionCovered = /npm run qa:regression/.test(releaseWorkflow)
  || [
    'phase1-clean-school-ux-smoke.mjs', 'phase1-launch-smoke.mjs', 'institution-analytics-smoke.mjs',
    'phase1-increment3-smoke.mjs', 'phase1-increment4-smoke.mjs', 'phase1-increment5-8-smoke.mjs',
    'post8-public-student-smoke.mjs', 'profile-authorization-smoke.mjs', 'student-live-dashboard-resources-smoke.mjs',
    'v13-2-analytics-smoke.mjs', 'v13-2-vercel-smoke.mjs', 'v14-smoke.mjs', 'v15-seo-smoke.mjs',
    'v16-neet-pyq-smoke.mjs', 'v18-pyq-paper-engine-smoke.mjs', 'v19-pyq-source-fidelity-smoke.mjs',
    'v19-1-latex-paper-import-smoke.mjs',
  ].every((script) => releaseWorkflow.includes(script));
check(
  'release workflow runs complete final QA gate',
  /npm run typecheck -- --incremental false/.test(releaseWorkflow)
    && /npm run lint/.test(releaseWorkflow)
    && regressionCovered
    && /npm run build/.test(releaseWorkflow),
);

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
}
console.log(`\n${checks.length - failures.length}/${checks.length} hardening checks passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
