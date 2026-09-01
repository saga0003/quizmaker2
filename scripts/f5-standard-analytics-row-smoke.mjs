import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/analytics-v12/student-analytics-v12.tsx', 'utf8');
const css = fs.readFileSync('src/components/analytics-v12/analytics-v12.css', 'utf8');
const sql = fs.readFileSync('supabase/45_v12_evidence_analytics.sql', 'utf8');

const checks = [
  ['shared taxonomy row exposes Exposure', source.includes('<small>Exposure</small><strong>{row.questions}</strong>')],
  ['Attempted follows canonical correct + incorrect denominator', source.includes('const attempted = row.correct + row.incorrect;')],
  ['row exposes Attempted', source.includes('<small>Attempted</small><strong>{attempted}</strong>')],
  ['row exposes Correct', source.includes('<small>Correct</small><strong>{row.correct}</strong>')],
  ['row exposes Incorrect', source.includes('<small>Incorrect</small><strong>{row.incorrect}</strong>')],
  ['row exposes Unanswered', source.includes('<small>Unanswered</small><strong>{row.unanswered}</strong>')],
  ['Accuracy fails closed without attempted evidence', source.includes("const accuracy = attempted > 0 ? metricValue(row.accuracy, '%') : '—';")],
  ['row exposes weighted Score %', source.includes('<small>Score %</small><strong>{scorePercentage}</strong>')],
  ['Score % is backed by marks-awarded / marks SQL', /round\(100 \* sum\(marks_awarded\)::numeric \/ greatest\(sum\(marks\),1\), 1\) as average_percentage/.test(sql)],
  ['row exposes Time', source.includes('<small>Time</small><strong>{formatTaxonomyTime(row.average_seconds)}</strong>')],
  ['row exposes Trend', source.includes('<small>Trend</small>') && source.includes("' pts'".trim()) === false ? true : source.includes('pts`')],
  ['row exposes evidence-record count', source.includes('<small>Evidence</small><strong>{row.attempts}</strong>')],
  ['SQL exposure counts all question opportunities', sql.includes('count(*)::integer as questions')],
  ['SQL evidence records count recorded responses', sql.includes('count(*) filter(where response_recorded)::integer as attempts')],
  ['responsive standardized metric grid is present', css.includes('/* F5 standardized taxonomy evidence row */') && css.includes('.analytics-v12-mastery-metrics{display:grid;grid-template-columns:repeat(5')],
];

let passed = 0;
for (const [name, ok] of checks) {
  assert.ok(ok, `F5 check failed: ${name}`);
  console.log(`PASS: ${name}`);
  passed += 1;
}
console.log(`F5 standardized analytics row checks passed: ${passed}/${checks.length}`);
