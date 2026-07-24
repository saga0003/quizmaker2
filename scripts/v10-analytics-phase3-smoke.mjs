import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/37_v10_analytics_phase_3.sql');
const hardening = read('supabase/37a_v10_analytics_phase_3_review_hardening.sql');
const student = read('src/components/analytics/StudentAnalyticsDashboardV3.tsx');
const school = read('src/components/analytics/SchoolAdminAnalyticsDashboard.tsx');
const workspace = read('src/components/analytics/AnalyticsWorkspacePhase3.tsx');
const finalWorkspace = read('src/components/analytics/AnalyticsWorkspacePhase4.tsx');
const pdf = read('src/lib/analytics-pdf.ts');
const phase3Types = read('src/types/analytics-phase3.ts');
const page = read('src/app/page.tsx');
const layout = read('src/app/layout.tsx');
const responsive = read('src/app/evidara-analytics-phase3.css');

const checks = [
  [migration.includes('create table if not exists public.analytics_interventions'), 'intervention tracker table'],
  [migration.includes('upsert_analytics_intervention_v12'), 'intervention write RPC'],
  [migration.includes('get_student_test_review_v12'), 'student question-review RPC'],
  [migration.includes('get_school_analytics_overview_v12'), 'school command-centre RPC'],
  [migration.includes('latest submitted result per student per test') || migration.includes('row_number() over(partition by attempt.student_id,attempt.paper_id'), 'latest result boundary'],
  [migration.includes("'grades'"), 'grade analytics payload'],
  [migration.includes("'sections'"), 'section analytics payload'],
  [migration.includes("'teachers'"), 'teacher comparison payload'],
  [migration.includes("'tests'"), 'test monitoring payload'],
  [hardening.includes('selected_answer'), 'selected answer labels'],
  [hardening.includes('correct_answer'), 'correct answer labels'],
  [student.includes('Download analytics PDF'), 'student PDF export action'],
  [student.includes('Answer distribution'), 'student answer donut'],
  [student.includes('Performance profile'), 'performance profile retained'],
  [student.includes('SeriesToggles visible={profileSeries}'), 'profile benchmark toggles'],
  [student.includes('SeriesToggles visible={subjectSeries}'), 'subject benchmark toggles'],
  [student.includes('SeriesToggles visible={trendSeries}'), 'trend benchmark toggles'],
  [student.includes('Test marks and answer review'), 'question review table'],
  [student.includes('selected_answer'), 'selected answer table data'],
  [student.includes('correct_answer'), 'correct answer table data'],
  [!student.includes('Evidence-based next step'), 'removed unsupported next-step panel'],
  [school.includes('School command centre'), 'school command centre UI'],
  [school.includes('Grade comparison'), 'grade comparison UI'],
  [school.includes('Section comparison'), 'section comparison UI'],
  [school.includes('Subject heatmap'), 'subject heatmap UI'],
  [school.includes('Teacher and class comparison'), 'teacher comparison UI'],
  [school.includes('Academic follow-up tracker'), 'intervention UI'],
  [school.includes('Export CSV'), 'school CSV export'],
  [school.includes('Download school PDF'), 'school PDF export'],
  [workspace.includes('SchoolAdminAnalyticsDashboard'), 'Phase 3 role-aware school routing'],
  [finalWorkspace.includes('SchoolAdminAnalyticsDashboard') && finalWorkspace.includes('StudentAnalyticsDashboard'), 'Phase 4 preserves Phase 3 school and student drill-down'],
  [page.includes('AnalyticsWorkspacePhase3') || page.includes('AnalyticsWorkspacePhase4'), 'application Phase 3-or-later routes'],
  [pdf.includes('%PDF-1.4'), 'native PDF document builder'],
  [pdf.includes('Selected test answer review'), 'PDF question review section'],
  [pdf.includes('Student surface report'), 'school PDF student table'],
  [phase3Types.includes('StudentTestReview'), 'question review payload types'],
  [phase3Types.includes('SchoolAnalyticsPayload'), 'school payload types'],
  [layout.includes('evidara-analytics-phase3.css'), 'responsive Phase 3 stylesheet'],
  [responsive.includes('subjectComparisonRows'), 'responsive subject comparison layout'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`Missing: ${label}`);
  process.exit(1);
}
console.log(`V10 analytics Phase 3 smoke checks passed (${checks.length} checks).`);
