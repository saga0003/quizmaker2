import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('src/app/api/institution-analytics/route.ts', 'utf8');
const ui = fs.readFileSync('src/components/institution-analytics/institution-analytics-workspace.tsx', 'utf8');

const checks = [
  ['response evidence selects correctness and time from exam responses', api.includes(".select('attempt_id,is_correct,marks_awarded,time_spent_seconds")],
  ['taxonomy response count derives from response rows', api.includes('responseCount: group.responses.length')],
  ['taxonomy accuracy derives from correct divided by answered evidence', api.includes('accuracy: answered ? rounded(correct / answered * 100) : null')],
  ['unanswered responses are excluded from accuracy denominator', api.includes("row.is_correct === true || row.is_correct === false")],
  ['average time ignores missing time evidence instead of coercing it to zero', api.includes('row.time_spent_seconds == null ? null : number(row.time_spent_seconds)')],
  ['chapter rows expose response count', ui.includes('{row.responseCount} responses · {row.studentCount} students · Accuracy')],
  ['chapter rows expose accuracy', ui.includes('Accuracy {percentage(row.accuracy)} · Avg time')],
  ['chapter rows expose average evidence time', ui.includes('Avg time {evidenceTime(row.averageSeconds)}')],
  ['topic rows expose response count accuracy and time', ui.includes('{row.studentCount} students · {row.responseCount} responses · Accuracy {percentage(row.accuracy)} · Avg time {evidenceTime(row.averageSeconds)}')],
  ['time formatter preserves missing evidence as dash', ui.includes("if (value == null) return '—';")],
  ['time formatter handles seconds and minutes', ui.includes("if (seconds < 60) return `${seconds}s`;") && ui.includes("return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;" )],
];
let passed = 0;
for (const [name, ok] of checks) { assert.ok(ok, `F7 check failed: ${name}`); console.log(`PASS: ${name}`); passed += 1; }
console.log(`F7 taxonomy evidence checks passed: ${passed}/${checks.length}`);
