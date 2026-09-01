import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const checks = [
  ['traditional result sheet is explicitly labelled', source.includes('Traditional result sheet')],
  ['result sheet exposes Rank', source.includes('<TableHead>Rank</TableHead>')],
  ['result sheet exposes Student', source.includes('<TableHead>Student</TableHead>')],
  ['result sheet exposes Score', source.includes('<TableHead>Score</TableHead>')],
  ['result sheet exposes Accuracy', source.includes('<TableHead>Accuracy</TableHead>')],
  ['result sheet exposes Time', source.includes('<TableHead>Time</TableHead>')],
  ['student names are hydrated from authorized profiles', source.includes("from('profiles').select('id,full_name')")],
  ['profile hydration is bounded', source.includes('start += 200')],
  ['attempt list remains bounded', source.includes(".eq('paper_id', paper.id)") && source.includes('.limit(500)')],
  ['accuracy uses answered denominator', source.includes('correct + incorrect') && source.includes('(correct / answered) * 100')],
  ['missing accuracy remains unassessed', source.includes("attempt.accuracy == null ? '—'")],
  ['time uses authoritative attempt timestamps', source.includes('attempt.started_at') && source.includes('attempt.submitted_at') && source.includes('duration_seconds')],
  ['rank uses submitted attempts only', source.includes("attempt.status === 'submitted'")],
  ['rank orders by paper percentage', source.includes('Number(b.percentage) - Number(a.percentage)')],
  ['equal percentages share rank', source.includes('percentage === previousPercentage ? previousRank : index + 1')],
  ['rank definition is explained in UI', source.includes('Equal percentages share the same rank')],
  ['accuracy definition is explained in UI', source.includes('Accuracy uses Correct ÷ (Correct + Incorrect)')],
  ['time definition is explained in UI', source.includes('start-to-submit duration')],
];
for (const [name, ok] of checks) { assert.ok(ok, `F11 result sheet check failed: ${name}`); console.log(`PASS: ${name}`); }
console.log(`F11 traditional result sheet checks passed: ${checks.length}/${checks.length}`);
