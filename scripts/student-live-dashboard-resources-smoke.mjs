import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');

const dashboard = read('src/components/evidara/student-dashboard.tsx');
const studentViews = read('src/components/evidara/student-live-views.tsx');
const resourceLibrary = read('src/components/school/ResourceLibrary.tsx');
const schoolHook = read('src/components/school/useSchoolPlatform.ts');
const schoolApi = read('src/app/api/school-platform/route.ts');
const resourceMigration = read('supabase/migrations/20260807120348_secure_student_resource_access.sql');

let passed = 0;
function expect(name, condition) {
  if (!condition) throw new Error(`Student live-data smoke failed: ${name}`);
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

expect('dashboard does not import the demo-data module', !dashboard.includes('@/data/demo-data'));
expect('dashboard reads authorized available papers', dashboard.includes("supabase.rpc('list_available_papers')"));
expect('dashboard reads the current student attempt history', dashboard.includes("supabase.rpc('list_my_attempt_results')"));
expect('dashboard reads self-scoped entitlements', dashboard.includes("supabase.rpc('list_my_entitlements_v12')"));
expect('dashboard has explicit loading, error, unavailable, and no-attempt states', [
  'Loading your live dashboard',
  'Some live data could not be loaded',
  'More evidence is needed',
  'Start building your assessment history',
].every((copy) => dashboard.includes(copy)));
expect('dashboard does not render removed synthetic metrics', !/Exam Readiness|Percentile|Revision priorities|demoStudentStats|fake rank|streak/i.test(dashboard));
expect('dashboard collapses the existing sidebar at narrow widths', dashboard.includes("window.matchMedia('(max-width: 640px)')") && dashboard.includes('setSidebarOpen(false)'));

expect('active student resources use the existing ResourceLibrary', studentViews.includes('<ResourceLibrary studentMode />'));
expect('active student resources no longer use demoResources', !studentViews.includes('demoResources'));
expect('student resources collapse the existing sidebar at narrow widths', studentViews.includes("window.matchMedia('(max-width: 640px)')") && studentViews.includes('setSidebarOpen(false)'));
expect('student resource mode uses the V14 fail-closed manager', resourceLibrary.includes('ResourceManagerV14') && resourceLibrary.includes("studentMode ? 'student' : 'school'"));
expect('student resources route through structured V14 resource manager', resourceLibrary.includes('ResourceManagerV14'));
expect('school platform hook retains live-only mode', schoolHook.includes('allowDemo'));

expect('student organization fallback requires an active membership', /from\("student_school_memberships"\)[\s\S]{0,240}?eq\("student_id", auth\.user\.id\)[\s\S]{0,120}?eq\("status", "active"\)/.test(schoolApi));
expect('student snapshot requires the current user and active membership', /eq\("student_id", user\.id\)[\s\S]{0,120}?eq\("status", "active"\)/.test(schoolApi));
expect('student resources are filtered server-side before serialization', /schoolStaff[\s\S]{0,120}?allResources\.filter\(\(resource\) => memberships\[0\] && eligible/.test(schoolApi));
expect('student content URLs are serialized only from the filtered resource set', /resources\.map\(\(resource\)[\s\S]{0,700}?contentUrl: resource\.content_url/.test(schoolApi));
expect('client organizationId is accepted only for a platform admin', /if \(platformAdmin && requestedOrg\)/.test(schoolApi));
expect('broad authenticated resource table reads are removed', resourceMigration.includes('drop policy if exists resources_metadata_read') && /revoke select on table public\.academic_resources from public, anon, authenticated/i.test(resourceMigration));
expect('direct resource eligibility checks cannot impersonate another student', /auth\.uid\(\) is not null[\s\S]{0,100}?p_student_id = auth\.uid\(\)[\s\S]{0,100}?public\.is_super_admin\(\)/.test(resourceMigration));
expect('clients cannot execute the arbitrary-student eligibility helper', /revoke all on function public\.student_can_access_resource\(uuid, uuid\)[\s\S]{0,100}?from public, anon, authenticated, service_role/.test(resourceMigration));
expect('the student resource RPC remains self-scoped and authenticated-only', /list_my_eligible_resources\(\)[\s\S]*auth\.uid\(\) is not null[\s\S]*student_can_access_resource\(resource\.id, auth\.uid\(\)\)[\s\S]*grant execute on function public\.list_my_eligible_resources\(\)[\s\S]*to authenticated/i.test(resourceMigration));

console.log(`Student live dashboard/resources smoke passed (${passed}/${passed}).`);
