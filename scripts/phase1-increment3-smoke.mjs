import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (label, value) => checks.push({ label, ok: Boolean(value) });

const liveExam = read('src/components/papers/LiveExam.tsx');
const reflection = read('src/components/evidara/post-test-error-classification.tsx');
const results = read('src/components/evidara/student-live-views.tsx');
const analytics = read('src/components/analytics-v12/student-analytics-v12.tsx');
const reflectionSql = read('supabase/47_v13_topic_confidence_question_intelligence.sql');
const authorizationTest = read('supabase/tests/post_test_reflection_authorization.sql');

check('authoritative submit RPC remains the submission boundary', liveExam.includes("rpc('submit_exam_attempt'"));
check('result is committed before optional reflection renders', liveExam.indexOf('setResult(data as AttemptResult)') < liveExam.indexOf('<PostTestErrorClassification'));
check('post-test reflection is connected only inside the successful result branch', liveExam.includes('if (result)') && liveExam.includes('attemptId={result.attempt_id}'));
check('result navigation remains available independently of reflection', liveExam.includes('href="/student/results/"'));
check('student can explicitly pause reflection', reflection.includes('Finish for now'));
check('student can skip an individual reflection item', reflection.includes('Skip this item'));
check('reflection load failure has retry and finish actions', reflection.includes('onClick={() => void load()}') && reflection.includes('Reflection could not be loaded'));
check('reflection explains that scoring is unaffected', reflection.includes('cannot change your answers, marks, or result'));
check('existing reflections resume from the first incomplete item', reflection.includes('firstIncomplete') && reflection.includes('!isComplete(item)'));
check('results view exposes a safe resume path', results.includes('Continue reflection') && results.includes('attemptId={reflectionAttemptId}'));

check('queue RPC verifies attempt ownership', reflectionSql.includes('v_attempt.student_id<>auth.uid()'));
check('queue RPC verifies submitted status', reflectionSql.includes("v_attempt.status<>'submitted'"));
check('save RPC verifies response ownership through its attempt', reflectionSql.includes('v_attempt.student_id <> auth.uid()'));
check('save RPC verifies submitted status', reflectionSql.includes("v_attempt.status <> 'submitted'"));
check('classification values use the database enum contract', reflectionSql.includes('p_classification public.student_error_classification'));
check('retry is idempotent through response-id upsert', reflectionSql.includes('on conflict(response_id) do update'));
check('reflection save only targets the reflection table', reflectionSql.includes('insert into public.exam_response_self_classifications') && !reflectionSql.match(/update public\.exam_(attempts|responses)/i));

check('real student analytics no longer calls benchmark bridge', !analytics.includes('get_v13_benchmark_analytics'));
check('real student analytics has no embedded demo payload', !analytics.includes('demoPayload'));
check('no-evidence analytics are explicit', analytics.includes('Not enough data yet') && analytics.includes('will not substitute benchmark students'));
check('question detail does not fabricate unavailable rows', analytics.includes('No synthetic questions, retry status, confidence, or mistake reasons are being substituted.'));
check('hard-coded practice counts are removed', !analytics.includes('<span>10</span>') && !analytics.includes('<span>15</span>'));

for (const token of [
  'student classifying another student response',
  'student classifying an unsubmitted response',
  'unsupported classification value',
  'retry created a duplicate reflection row',
  'reflection altered the authoritative attempt result',
  'reflection altered the authoritative answer/outcome',
  'saved reflection cannot be safely resumed',
]) {
  check(`isolated SQL test covers: ${token}`, authorizationTest.includes(token));
}

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.label}`);
if (failed.length) {
  console.error(`\nPhase 1 Increment 3 smoke failed (${failed.length}/${checks.length} checks).`);
  process.exit(1);
}

console.log(`\nPhase 1 Increment 3 smoke passed (${checks.length} checks).`);
