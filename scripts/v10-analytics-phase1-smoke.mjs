import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/35_v10_analytics_phase_1.sql');
const dashboard = read('src/components/analytics/StudentAnalyticsDashboardV3.tsx');
const workspace = read('src/components/analytics/AnalyticsWorkspace.tsx');
const phase3Workspace = read('src/components/analytics/AnalyticsWorkspacePhase3.tsx');
const phase4Workspace = read('src/components/analytics/AnalyticsWorkspacePhase4.tsx');
const page = read('src/app/page.tsx');
const sidebar = read('src/components/evidara/app-sidebar.tsx');

const routeUsesPhase3OrLater = (audience) =>
  page.includes(`<AnalyticsWorkspacePhase3 audience="${audience}" />`) ||
  page.includes(`<AnalyticsWorkspacePhase4 audience="${audience}" />`);

const checks = [
  ['academic sections table', migration.includes('create table if not exists public.academic_sections')],
  ['teacher section assignments', migration.includes('create table if not exists public.teacher_section_assignments')],
  ['student section normalization', migration.includes('add column if not exists section_id')],
  ['role scoped directory rpc', migration.includes('list_analytics_scope_v10')],
  ['student analytics rpc', migration.includes('get_student_analytics_overview_v10')],
  ['teacher access boundary', migration.includes('analytics_can_view_student_v10')],
  ['section creation rpc', migration.includes('upsert_academic_section_v10')],
  ['student section assignment rpc', migration.includes('assign_student_section_v10')],
  ['teacher section assignment rpc', migration.includes('assign_teacher_section_v10')],
  ['product percentile completion gate', migration.includes('product.total_tests > 0 and product.completed_tests >= product.total_tests')],
  ['live dashboard uses analytics rpc', dashboard.includes("supabase.rpc('get_student_analytics_overview_v11'")],
  ['dashboard contains required KPIs', ['Average percentage', 'Average percentile', 'Accuracy', 'Time management'].every((value) => dashboard.includes(value))],
  ['dashboard contains required charts', ['Performance profile', 'Subject comparison', 'Performance trends'].every((value) => dashboard.includes(value))],
  ['workspace uses role scoped directory', workspace.includes("supabase.rpc('list_analytics_scope_v10'")],
  ['workspace supports section and teacher setup', workspace.includes('Sections & teachers') && workspace.includes('assign_teacher_section_v10')],
  ['Phase 3 preserves legacy workspace', phase3Workspace.includes('<AnalyticsWorkspace audience={audience} />')],
  ['Phase 4 preserves teacher and management workspaces', phase4Workspace.includes('<AnalyticsWorkspace audience={audience} />') && phase4Workspace.includes('SchoolAdminAnalyticsDashboard')],
  ['student analytics route', routeUsesPhase3OrLater('student')],
  ['school analytics route', routeUsesPhase3OrLater('school')],
  ['admin analytics route', routeUsesPhase3OrLater('admin')],
  ['school analytics navigation', sidebar.includes("view: 'school-analytics'")],
  ['admin analytics navigation', sidebar.includes("view: 'admin-analytics'")],
];

const failed = checks.filter(([, passed]) => !passed);
for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} V10 analytics smoke checks failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} V10 analytics Phase 1 smoke checks passed.`);
