import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let passed = 0;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const check = (label, condition) => {
  if (condition) { passed += 1; console.log(`✓ ${label}`); }
  else { failures.push(label); console.error(`✗ ${label}`); }
};

const metrics = read('src/lib/evidaraMetrics.ts');
const analyticsSql = read('supabase/45_v12_evidence_analytics.sql');
const normalize = (value) => value.replace(/\s+/g, ' ').toLowerCase();
const sql = normalize(analyticsSql);
const canonicalStart = metrics.indexOf('export const analyticsMetricDefinitions = {');
const canonicalEnd = metrics.indexOf('} satisfies Record<string, AnalyticsMetricDefinition>;', canonicalStart);
const canonicalMetrics = canonicalStart >= 0 && canonicalEnd > canonicalStart
  ? metrics.slice(canonicalStart, canonicalEnd)
  : '';

for (const [id, label] of [
  ['testsTaken', 'Tests Taken'],
  ['uniqueQuestions', 'Unique Questions'],
  ['questionOutcomes', 'Question Outcomes'],
  ['attempted', 'Attempted'],
  ['unanswered', 'Unanswered'],
  ['accuracy', 'Accuracy'],
  ['scorePercentage', 'Score %'],
  ['participation', 'Participation'],
]) {
  check(`${label} has a canonical dictionary entry`, canonicalMetrics.includes(`${id}: {`) && canonicalMetrics.includes(`title: '${label}'`));
}

check('dictionary makes repeated question exposure distinct from unique-question breadth',
  canonicalMetrics.includes('count(distinct canonical question_id)')
    && canonicalMetrics.includes('Repeated exposure counts again.'));
check('question outcomes are canonically correct + incorrect + unanswered', canonicalMetrics.includes("canonicalFormula: 'correct + incorrect + unanswered'"));
check('attempted is canonically correct + incorrect', canonicalMetrics.includes("canonicalFormula: 'correct + incorrect'"));
check('accuracy denominator is attempted and zero-attempt evidence is Not assessed',
  canonicalMetrics.includes("canonicalFormula: '100 × correct / attempted'")
    && canonicalMetrics.includes('If attempted = 0, Accuracy has no denominator'));
check('Score % is weighted by available marks rather than averaging test percentages',
  canonicalMetrics.includes("canonicalFormula: '100 × sum(marks awarded) / sum(marks available)'")
    && canonicalMetrics.includes('Do not substitute an unweighted average of per-test percentages'));
check('Participation is assignment-based and cannot be derived from question attempt rate',
  canonicalMetrics.includes("canonicalFormula: '100 × submitted eligible assignments / eligible assignments'")
    && canonicalMetrics.includes('Never derive Participation from attempted questions'));
check('all eight canonical analytics entries use explicit Not assessed empty semantics',
  canonicalMetrics.length > 0 && (canonicalMetrics.match(/emptyDisplay: 'Not assessed'/g) || []).length === 8);

check('live evidence SQL counts Tests Taken only from submitted attempts',
  sql.includes("attempt.status = 'submitted'") && sql.includes('count(*)::integer as completed_tests'));
check('live evidence SQL represents one question outcome for each paper question in each selected submitted attempt',
  sql.includes('join public.paper_questions paper_question on paper_question.paper_id = attempt.paper_id')
    && sql.includes('count(*)::integer as total_questions'));
check('live evidence SQL separates correct, incorrect and unanswered outcomes',
  sql.includes('case when response.is_correct = true then 1 else 0 end as correct')
    && sql.includes('case when response.is_correct = false then 1 else 0 end as incorrect')
    && sql.includes('case when response.id is null or response.is_correct is null then 1 else 0 end as unanswered'));
check('live evidence SQL accuracy uses correct / (correct + incorrect)',
  sql.includes('fact_summary.correct,0)::numeric / greatest(coalesce(fact_summary.correct,0) + coalesce(fact_summary.incorrect,0),1)'));
check('legacy completion_rate is visibly question attempt rate and therefore must not be treated as Participation',
  sql.includes("'completion_rate', round(100 * (coalesce(fact_summary.correct,0) + coalesce(fact_summary.incorrect,0))::numeric / greatest(coalesce(fact_summary.total_questions,0),1),1)")
    && canonicalMetrics.includes('Do not label attempted/question-outcomes as Participation'));

if (failures.length) {
  console.error(`\nF2 analytics metric dictionary smoke failed: ${failures.length} failed, ${passed} passed.`);
  process.exit(1);
}
console.log(`\nF2 analytics metric dictionary checks passed (${passed} checks).`);
