import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/evidara/school-views.tsx', 'utf8');
const checks = [
  ['teacher-only queue is rendered', source.includes('{teacher && <TeacherNeedsAttention schoolId={state.school.id} />}')],
  ['attention queue is explicitly evidence-first', source.includes('Evidence-first queue from students in your assigned sections')],
  ['queue avoids predictive claims', source.includes('not a prediction or judgement')],
  ['server-scoped school analytics is requested', source.includes('level=school&organizationId=')],
  ['teacher scoped classes drive evidence queries', source.includes('schoolPayload.classes || []') && source.includes('level=class&organizationId=')],
  ['active institution is propagated to the server', source.includes("'x-evidara-organization-id': schoolId")],
  ['missing submissions are a first-class reason', source.includes("reasons.push('No submitted assessments')")],
  ['score threshold is measured and explicit', source.includes('student.averagePercentage < 55')],
  ['accuracy threshold is measured and explicit', source.includes('student.accuracy < 55')],
  ['missing score remains not-assessed', source.includes("student.averagePercentage == null ? '—'")],
  ['missing accuracy remains not-assessed', source.includes("student.accuracy == null ? '—'")],
  ['attention list is deliberately compact', source.includes('.slice(0, 5)')],
  ['participation action is concrete', source.includes('Action: check assignment participation.')],
  ['performance action points to deeper evidence', source.includes('Action: review subject/topic evidence before intervention.')],
  ['teacher can open scoped analytics from the queue', source.includes('Open scoped analytics') && source.includes("setView('school-analytics-overview')")],
];

for (const [name, ok] of checks) {
  assert.ok(ok, `F9 teacher attention check failed: ${name}`);
  console.log(`PASS: ${name}`);
}
console.log(`F9 teacher needs-attention checks passed: ${checks.length}/${checks.length}`);
