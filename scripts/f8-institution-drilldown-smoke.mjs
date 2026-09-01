import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('src/components/institution-analytics/institution-analytics-workspace.tsx', 'utf8');
const api = fs.readFileSync('src/app/api/institution-analytics/route.ts', 'utf8');
const types = fs.readFileSync('src/types/institution-analytics.ts', 'utf8');

const checks = [
  ['analytics levels expose programme', types.includes("'programme'")],
  ['analytics levels expose grade', types.includes("'grade'")],
  ['analytics levels expose section independently of class', types.includes("'section'")],
  ['school drilldown exposes programme rows', types.includes('programmes?:') || types.includes('InstitutionProgrammeRow')],
  ['programme drilldown exposes grades', types.includes('grades?:') || types.includes('InstitutionGradeRow')],
  ['grade drilldown exposes sections', types.includes('sections?:') || types.includes('InstitutionSectionRow')],
  ['API accepts programme level', api.includes("level === 'programme'")],
  ['API accepts grade level', api.includes("level === 'grade'")],
  ['API accepts section level', api.includes("level === 'section'")],
  ['programme selection is propagated as an API parameter', ui.includes("query.set('programme')") || ui.includes("query.set('programmeId')")],
  ['grade selection is propagated as an API parameter', ui.includes("query.set('grade')")],
  ['section remains a distinct breadcrumb/drilldown step', ui.includes("navigate('section'") || ui.includes("level: 'section'")],
  ['subject drilldown remains after section', ui.includes("navigate('subject'")],
  ['chapter drilldown remains after subject', ui.includes("navigate('chapter'")],
  ['student drilldown remains available from scoped institution analytics', ui.includes("navigate('student'")],
];

for (const [name, ok] of checks) {
  assert.ok(ok, `F8 institution drilldown check failed: ${name}`);
  console.log(`PASS: ${name}`);
}
console.log(`F8 institution drilldown checks passed: ${checks.length}/${checks.length}`);
