import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/39_v10_question_collections_reference_analytics.sql');
const hardening = read('supabase/39a_v10_question_collections_hardening.sql');
const taxonomy = read('supabase/39b_v10_reference_taxonomy_detail.sql');
const scoped = read('supabase/39c_v10_reference_breakdown_scope.sql');
const dashboard = read('src/components/analytics/StudentAnalyticsReferenceDashboard.tsx');
const collections = read('src/components/questions/QuestionCollectionsManager.tsx');
const questionsWorkspace = read('src/components/questions/QuestionManagementWorkspace.tsx');
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
  [migration.includes('get_student_reference_breakdowns_v13'), 'reference breakdown RPC'],
  [hardening.includes('member.member_role'), 'organization role compatibility'],
  [taxonomy.includes('get_student_reference_taxonomy_detail_v13'), 'chapter topic detail RPC'],
  [taxonomy.includes('average_time_seconds') && taxonomy.includes('attempt_rate'), 'live response-time and attempt-rate evidence'],
  [scoped.includes('get_student_reference_scoped_breakdowns_v13'), 'scoped difficulty and format RPC'],
  [['Overview','Subjects','Chapters','Topics','Practice','Test History','Goals'].every((value) => dashboard.includes(value)), 'complete analytics navigation'],
  [dashboard.includes('Performance profile') && dashboard.includes('Subject comparison') && dashboard.includes('Performance trend'), 'overview charts'],
  [dashboard.includes('Chapter mastery') && dashboard.includes('Question format performance'), 'subject analysis'],
  [dashboard.includes('Topic mastery within') && dashboard.includes('Accuracy vs response time'), 'chapter analysis'],
  [dashboard.includes('Question-tag mastery') && dashboard.includes('Incorrect questions'), 'topic analysis'],
  [dashboard.includes('No per-question target time') || dashboard.includes('no target time is assigned'), 'no question target-time fabrication'],
  [dashboard.includes('get_student_test_review_v12'), 'test history answer review'],
  [dashboard.includes('upsert_student_analytics_goal_v13'), 'goal management'],
  [collections.includes('Question Collections') && collections.includes('Create draft paper'), 'collection manager UI'],
  [collections.includes('save_question_collection_v13') && collections.includes('create_paper_from_question_collection_v13'), 'collection manager live RPCs'],
  [questionsWorkspace.includes('Question Bank') && questionsWorkspace.includes('Question Collections'), 'question workspace tabs'],
  [page.includes('QuestionManagementWorkspace') && page.includes('PaperWorkspace'), 'application question and paper routing'],
  [layout.includes('evidara-analytics-reference.css'), 'reference visual system loaded'],
  [docs.includes('Questions are not copied') && docs.includes('No unsupported confidence or semantic-error value is shown'), 'evidence and reuse documentation'],
];

const failed = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) {
  console.error(`\n${failed.length} reference analytics / Question Collections smoke checks failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} reference analytics / Question Collections smoke checks passed.`);
