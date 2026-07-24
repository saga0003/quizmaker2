import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/39_v10_question_collections_reference_analytics.sql');
const hardening = read('supabase/39a_v10_question_collections_hardening.sql');
const taxonomy = read('supabase/39b_v10_reference_taxonomy_detail.sql');
const scoped = read('supabase/39c_v10_reference_breakdown_scope.sql');
const unanswered = read('supabase/39d_v10_reference_unanswered_hardening.sql');
const paperHardening = read('supabase/39e_v10_collection_paper_hardening.sql');
const cohortMigration = read('supabase/40_v10_demo_cohort_studio.sql');
const cohortHardening = read('supabase/40a_v10_demo_cohort_studio_hardening.sql');
const dashboard = read('src/components/analytics/StudentAnalyticsReferenceDashboard.tsx');
const cohortStudio = read('src/components/analytics/DemoCohortStudio.tsx');
const demoLab = read('src/components/analytics/DemoAnalyticsDataLab.tsx');
const analyticsWorkspace = read('src/components/analytics/AnalyticsWorkspacePhase4.tsx');
const collections = read('src/components/questions/QuestionCollectionsManager.tsx');
const page = read('src/app/page.tsx');
const layout = read('src/app/layout.tsx');
const docs = read('docs/EVIDARA_V10_ANALYTICS_REFERENCE_UI_QUESTION_COLLECTIONS.md');

const checks = [
  [migration.includes('create table if not exists public.question_collections'), 'Question Collections table'],
  [migration.includes('create table if not exists public.question_collection_items'), 'collection item links'],
  [migration.includes('create table if not exists public.student_analytics_goals'), 'student analytics goals'],
  [migration.includes('save_question_collection_v13'), 'collection save RPC'],
  [migration.includes('clone_question_collection_v13'), 'collection clone RPC'],
  [migration.includes('create_paper_from_question_collection_v13'), 'collection-to-paper RPC'],
  [migration.includes('public.save_question_paper') && migration.includes("'source_collection_id'"), 'existing Paper Builder RPC handoff'],
  [migration.includes('get_student_reference_breakdowns_v13'), 'reference breakdown RPC'],
  [hardening.includes('public.is_evidara_school_staff') && hardening.includes('public.is_evidara_platform_admin'), 'existing permission helpers'],
  [taxonomy.includes('get_student_reference_taxonomy_detail_v13'), 'chapter topic detail RPC'],
  [taxonomy.includes('average_time_seconds') && taxonomy.includes('attempt_rate'), 'live response-time and attempt-rate evidence'],
  [taxonomy.includes('left join public.exam_responses') && taxonomy.includes('deterministic_unassigned_ids'), 'taxonomy unanswered and stable identifiers'],
  [scoped.includes('get_student_reference_scoped_breakdowns_v13'), 'scoped difficulty and format RPC'],
  [scoped.includes('left join public.exam_responses') && scoped.includes('unanswered_from_all_paper_questions'), 'scoped unanswered handling'],
  [unanswered.includes('missing_response_is_unanswered') && unanswered.includes('join public.paper_questions'), 'complete unanswered hardening'],
  [paperHardening.includes('ordered_grouped') && paperHardening.includes('public.save_question_paper'), 'ordered Paper Builder payload hardening'],
  [cohortMigration.includes('get_analytics_demo_cohort_studio_v14'), 'demo cohort directory RPC'],
  [cohortMigration.includes('get_analytics_demo_student_drilldown_v14'), 'demo student topic drill-down RPC'],
  [cohortMigration.includes('analytics_demo_topic_results_v12') && cohortMigration.includes('questions'), 'cohort question and topic evidence'],
  [cohortHardening.includes('correct_count+subject.incorrect_count+subject.unanswered_count'), 'subject question total schema compatibility'],
  [['Overview','Subjects','Chapters','Topics','Practice','Test History','Goals'].every((value) => dashboard.includes(value)), 'complete student analytics navigation'],
  [dashboard.includes('Performance profile') && dashboard.includes('Subject comparison') && dashboard.includes('Performance trend'), 'overview charts'],
  [dashboard.includes('Chapter mastery') && dashboard.includes('Question format performance'), 'subject analysis'],
  [dashboard.includes('Topic mastery within') && dashboard.includes('Accuracy vs response time'), 'chapter analysis'],
  [dashboard.includes('Question-tag mastery') && dashboard.includes('Incorrect questions'), 'topic analysis'],
  [dashboard.includes('No per-question target time') || dashboard.includes('no target time is assigned'), 'no question target-time fabrication'],
  [dashboard.includes('get_student_test_review_v12'), 'test history answer review'],
  [dashboard.includes('upsert_student_analytics_goal_v13'), 'goal management'],
  [cohortStudio.includes('Cohort explorer') && cohortStudio.includes('Open any generated student'), 'visible cohort explorer UI'],
  [cohortStudio.includes('Weakest topics') && cohortStudio.includes('Chapter and topic evidence'), 'per-student topic diagnosis'],
  [demoLab.includes('Create cohort + questions'), 'one-click cohort and question action'],
  [analyticsWorkspace.includes('Demo Cohorts') && analyticsWorkspace.includes('Question Collections'), 'analytics module tabs'],
  [collections.includes('Question Collections') && collections.includes('Create draft paper'), 'collection manager UI'],
  [collections.includes('save_question_collection_v13') && collections.includes('create_paper_from_question_collection_v13'), 'collection manager live RPCs'],
  [page.includes('admin-questions') && page.includes('<LiveQuestionBank kind="admin" />'), 'Questions restored to live bank only'],
  [!page.includes('QuestionManagementWorkspace'), 'Question Collections removed from Questions route'],
  [layout.includes('evidara-analytics-reference.css'), 'reference visual system loaded'],
  [docs.includes('Questions are not copied') && docs.includes('No unsupported confidence or semantic-error value is shown'), 'evidence and reuse documentation'],
  [docs.includes('40_v10_demo_cohort_studio.sql') && docs.includes('40a_v10_demo_cohort_studio_hardening.sql'), 'demo cohort migrations documented'],
];

const failed = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) {
  console.error(`\n${failed.length} reference analytics / demo cohort / Question Collections smoke checks failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} reference analytics / demo cohort / Question Collections smoke checks passed.`);
