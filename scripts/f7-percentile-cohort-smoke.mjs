import fs from 'node:fs';
import assert from 'node:assert/strict';
const ui=fs.readFileSync('src/components/analytics-v12/student-analytics-v12.tsx','utf8');
const sql=fs.readFileSync('supabase/45_v12_evidence_analytics.sql','utf8');
const checks=[
 ['percentile cohort uses same paper/assessment',sql.includes('on cohort.paper_id = selected.paper_id')],
 ['percentile cohort includes submitted attempts only',sql.includes("and cohort.status = 'submitted'")],
 ['backend percentile requires cohort size at least five',sql.includes('case when cohort.cohort_size >= 5')],
 ['prominent percentile requires minimum cohort across product assessments',sql.includes('and completion.minimum_cohort >= 5')],
 ['percentile availability uses same threshold',sql.includes('and completion.minimum_cohort >= 5, false')],
 ['UI names actual cohort as same-assessment submitters',ui.includes('Percentile · same assessment') && ui.includes('Same-assessment submitters')],
 ['UI states minimum cohort threshold',ui.includes('const MIN_PERCENTILE_COHORT = 5;') && ui.includes('cohort threshold ≥ ${MIN_PERCENTILE_COHORT}')],
 ['unavailable copy explains all comparable assessments must meet threshold',ui.includes('submitted attempts on every comparable product assessment')],
 ['UI does not label percentile as school or class cohort',!ui.includes('Percentile · class') && !ui.includes('Percentile · school')],
];
for(const [name,ok] of checks){assert.ok(ok,`F7 canonical check failed: ${name}`);console.log(`PASS: ${name}`)}
console.log(`F7 canonical percentile cohort checks passed: ${checks.length}/${checks.length}`);
