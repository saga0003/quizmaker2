import fs from 'node:fs';
import assert from 'node:assert/strict';

const cards = fs.readFileSync('src/components/institution-analytics/institution-mobile-cards.tsx', 'utf8');
const workspace = fs.readFileSync('src/components/institution-analytics/institution-analytics-workspace.tsx', 'utf8');

const cardUsages = (workspace.match(/<InstitutionMobileCards/g) || []).length;
const desktopTableTreatments = (workspace.match(/institution-table-card hidden md:block/g) || []).length;
const checks = [
  ['reusable mobile analytics card component exists', cards.includes('export function InstitutionMobileCards')],
  ['mobile cards disappear from tablet/desktop', cards.includes('md:hidden')],
  ['mobile record titles wrap long content', cards.includes('[overflow-wrap:anywhere]')],
  ['mobile records expose semantic metric labels', cards.includes('<dl') && cards.includes('<dt') && cards.includes('<dd')],
  ['interactive records have visible keyboard focus', cards.includes('focus-visible:ring-2')],
  ['interactive records meet baseline touch height', cards.includes('min-h-11')],
  ['interactive records use native buttons', cards.includes('<button') && cards.includes('type="button"')],
  ['institution analytics imports mobile cards', workspace.includes("institution-mobile-cards")],
  ['schools, hierarchy, classes and student tables have mobile card alternatives', cardUsages >= 5],
  ['desktop wide tables are hidden on narrow screens when card alternatives exist', desktopTableTreatments >= 5],
  ['school cards retain student/test/average/participation evidence', workspace.includes("label: 'Students'") && workspace.includes("label: 'Participation'")],
  ['student cards retain tests/average/accuracy evidence', workspace.includes("label: 'Accuracy'") && workspace.includes('onStudent(row)')],
];
for (const [name, ok] of checks) assert.ok(ok, `H8 failed: ${name}`);
console.log(`H8 mobile analytics smoke: ${checks.length}/${checks.length} assertions passed.`);
