import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let passed = 0;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
function check(label, condition) {
  if (condition) { passed += 1; console.log(`✓ ${label}`); }
  else { failures.push(label); console.error(`✗ ${label}`); }
}
function contains(file, token, label) { check(label, exists(file) && read(file).includes(token)); }

const pkg = JSON.parse(read('package.json'));
check('package is current Evidara V19', pkg.version === '19.1.0');
check('analytics QA targets the V13.2 smoke suite', pkg.scripts?.['qa:analytics'] === 'node scripts/v13-2-analytics-smoke.mjs');
contains('src/lib/release.ts', "EVIDARA_RELEASE = '19.1.0'", 'central release metadata is V19');
contains('src/lib/release.ts', "EVIDARA_DEPLOYMENT_TARGET = 'vercel-supabase'", 'deployment target is Vercel + Supabase');
contains('src/app/page.tsx', 'AnalyticsV12Workspace', 'root workspace loads the evidence analytics application');
contains('src/app/page.tsx', "view.startsWith('student-analytics-')", 'student analytics hierarchy is routed');
contains('src/app/page.tsx', "view.startsWith('school-analytics-')", 'school analytics hierarchy is routed');

const analyticsFile = 'src/components/analytics-v12/student-analytics-v12.tsx';
for (const [token, label] of [
  ['function OverviewView', 'overview analytics exists'],
  ['function SubjectView', 'subject analytics exists'],
  ['function ChapterView', 'chapter analytics exists'],
  ['function TopicView', 'topic analytics exists'],
  ['function QuestionIntelligenceView', 'question intelligence exists'],
  ['function PrioritiesView', 'revision priorities exists'],
  ['function HistoryView', 'test history exists'],
  ["get_student_analytics_v12", 'live evidence analytics RPC is used'],
  ["get_topic_reflection_analytics_v13", 'topic confidence/reflection analytics is connected'],
  ['Question-level detail is not available yet', 'unavailable question intelligence is labelled honestly'],
  ['Sub-concept mastery will appear', 'fabricated sub-concept mastery is not shown'],
]) contains(analyticsFile, token, label);
check('real student analytics does not call the benchmark bridge', !read(analyticsFile).includes('get_v13_benchmark_analytics'));
check('real student analytics has no embedded demo payload', !read(analyticsFile).includes('demoPayload'));
check('real student analytics has an honest no-evidence state', read(analyticsFile).includes('Not enough data yet'));

for (const view of [
  'student-analytics-overview','student-analytics-subject','student-analytics-chapter',
  'student-analytics-topic','student-analytics-question-intelligence','student-analytics-priorities','student-analytics-history',
  'school-analytics-overview','school-analytics-subject','school-analytics-chapter',
  'school-analytics-topic','school-analytics-question-intelligence','school-analytics-priorities','school-analytics-history',
]) contains('src/lib/workspaceViews.ts', `'${view}'`, `workspace view exists: ${view}`);

contains('src/components/evidara/app-sidebar.tsx', "label: 'Overview'", 'analytics Overview navigation exists');
contains('src/components/evidara/app-sidebar.tsx', "label: 'Subject Analysis'", 'Subject Analysis navigation exists');
contains('src/components/evidara/app-sidebar.tsx', "label: 'Chapter Analysis'", 'Chapter Analysis navigation exists');
contains('src/components/evidara/app-sidebar.tsx', "label: 'Topic Analysis'", 'Topic Analysis navigation exists');
contains('src/components/analytics-v12/student-analytics-v12.tsx', "openQuestionIntelligence={() => go('question-intelligence')}", 'Question Intelligence opens from Topic Analysis');
contains('src/components/evidara/app-sidebar.tsx', "label: 'Revision Priorities'", 'Revision Priorities navigation exists');
contains('src/components/evidara/app-sidebar.tsx', "label: 'Test History'", 'Test History navigation exists');
contains('supabase/45_v12_evidence_analytics.sql', 'get_student_analytics_v12', 'evidence analytics database migration is included');
contains('supabase/47_v13_topic_confidence_question_intelligence.sql', 'get_topic_reflection_analytics_v13', 'topic confidence migration is included');
contains('supabase/50_v13_2_benchmark_analytics_bridge.sql', "'demo_mode', true", 'explicitly labelled isolated benchmark bridge remains available for test mode');
contains('src/components/evidara/post-test-error-classification.tsx', 'save_exam_response_reflection_v13', 'post-test confidence/reflection UI is included');
contains('src/components/papers/LiveExam.tsx', '<PostTestErrorClassification', 'post-test reflection is connected after live submission');

if (failures.length) {
  console.error(`\nV14 analytics smoke failed: ${failures.length} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`\nEvidara V14 analytics checks passed (${passed} checks).`);
