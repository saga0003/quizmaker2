import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/36_v10_analytics_phase_2.sql');
const safety = read('supabase/36a_v10_analytics_phase_2_safety.sql');
const attemptLimitHotfix = read('supabase/36b_v10_analytics_phase_2_attempt_limit_hotfix.sql');
const studentFix = read('supabase/36c_v10_analytics_student_calculation_ui_fix.sql');
const cohort = read('supabase/36d_v10_analytics_100_student_demo_cohort.sql');
const comparison = read('supabase/36e_v10_analytics_comparison_engine.sql');
const resetSafety = read('supabase/36f_v10_analytics_demo_reset_safety.sql');
const workspace = read('src/components/analytics/AnalyticsWorkspace.tsx');
const student = read('src/components/analytics/StudentAnalyticsDashboard.tsx');
const teacher = read('src/components/analytics/TeacherAnalyticsDashboard.tsx');
const demo = read('src/components/analytics/DemoAnalyticsDataLab.tsx');
const demoTable = read('src/components/analytics/DemoStudentResultsTable.tsx');
const types = read('src/types/analytics.ts');

const checks = [
  [migration.includes('analytics_demo_batches'), 'demo batch ledger'],
  [migration.includes('generate_analytics_demo_data_v10'), 'demo generator RPC'],
  [migration.includes('reset_analytics_demo_data_v10'), 'demo reset RPC'],
  [migration.includes("p_confirmation<>'RESET DEMO ANALYTICS'"), 'backend reset phrase'],
  [migration.includes('get_teacher_analytics_overview_v10'), 'teacher aggregate RPC'],
  [safety.includes('analytics_demo_section_identity_v10'), 'batch-unique section trigger'],
  [attemptLimitHotfix.includes('new.attempt_limit := 100'), 'valid maximum demo attempt limit'],
  [studentFix.includes('partition by attempt.paper_id'), 'latest attempt per selected test'],
  [cohort.includes('analytics_demo_students'), '100-student demo cohort table'],
  [cohort.includes("track in ('PCM','PCB')"), 'PCM and PCB cohort boundary'],
  [cohort.includes('for v_series in 1..6 loop'), 'six generated series'],
  [cohort.includes('for v_test in 1..10 loop'), 'ten tests per series'],
  [cohort.includes('total_marks,total_questions'), '100-question generated papers'],
  [cohort.includes('list_analytics_demo_students_v11'), 'Super Admin results table RPC'],
  [comparison.includes('analytics_test_snapshot_v11'), 'multi-metric test comparison snapshot'],
  [comparison.includes('get_student_analytics_overview_v11'), 'upgraded student overview RPC'],
  [comparison.includes('get_student_test_comparison_v11'), 'timeline test detail RPC'],
  [comparison.includes("'accuracy_top10'"), 'accuracy benchmark lines'],
  [comparison.includes("'time_top5'"), 'time-score benchmark lines'],
  [resetSafety.includes('previous_tracks'), 'original student tracks reset safety'],
  [workspace.includes('TeacherAnalyticsDashboard'), 'teacher workspace routing'],
  [workspace.includes('DemoAnalyticsDataLab'), 'Super Admin demo lab routing'],
  [teacher.includes("supabase.rpc('get_teacher_analytics_overview_v10'"), 'live teacher RPC usage'],
  [student.includes("supabase.rpc('get_student_analytics_overview_v11'"), 'student uses upgraded comparison RPC'],
  [student.includes("supabase.rpc('get_student_test_comparison_v11'"), 'timeline popup uses test comparison RPC'],
  [student.includes('Show answered-only accuracy'), 'accuracy card swap control'],
  [student.includes('seriesToggleGroup'), 'trend benchmark toggles'],
  [student.includes('Subject comparison'), 'redesigned subject comparison'],
  [!student.includes('Last 3'), 'removed ambiguous Last 3 quick filter'],
  [!student.includes('Date band'), 'removed date-band control'],
  [demo.includes('Generate 100-student cohort'), 'fixed cohort generator UI'],
  [demo.includes('First confirmation'), 'first reset confirmation'],
  [demo.includes('Second and final confirmation'), 'second reset confirmation'],
  [demoTable.includes('100-student comparison table'), 'Super Admin cohort table UI'],
  [demoTable.includes('Math / Biology'), 'track-aware subject surface table'],
  [types.includes('StudentTestComparison'), 'test detail payload types'],
  [types.includes('AnalyticsDemoStudentTablePayload'), 'cohort table payload types'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`Missing: ${label}`);
  process.exit(1);
}
console.log(`V10 analytics Phase 2 smoke checks passed (${checks.length} checks).`);
