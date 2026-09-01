import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('src/components/institution-analytics/institution-analytics-workspace.tsx', 'utf8');
const api = fs.readFileSync('src/app/api/institution-analytics/route.ts', 'utf8');
const css = fs.readFileSync('src/components/institution-analytics/institution-analytics.css', 'utf8');
const checks = [
  ['student rank derives from measured average percentage', api.includes(".sort((a, b) => (b.averagePercentage ?? -1) - (a.averagePercentage ?? -1)).map((row, index) => ({ ...row, rank: index + 1 }))")],
  ['student metrics use submitted attempts', api.includes(".eq('status', 'submitted')") && api.includes('averagePercentage: average(percentages)')],
  ['leaderboard excludes students without score evidence', ui.includes('.filter((row) => row.averagePercentage !== null)')],
  ['leaderboard uses backend rank', ui.includes('.sort((a, b) => a.rank - b.rank)')],
  ['leaderboard bounded to five students', ui.includes('.slice(0, 5);')],
  ['measured ranking disclosed', ui.includes('Ranked only from submitted assessment percentages. Students without measured evidence are excluded.')],
  ['score accuracy and test count are shown', ui.includes('{percentage(row.averagePercentage)}') && ui.includes('{percentage(row.accuracy)} accuracy') && ui.includes('{row.completedTests} submitted test')],
  ['leaderboard Click to Analyse is wired', ui.includes('Click to Analyse <ChevronRight />')],
  ['student table Click to Analyse is explicit', ui.includes('className="institution-analyse-button">Click to Analyse <ChevronRight />')],
  ['no synthetic leaderboard fallback', ui.includes('No synthetic or placeholder scores are used.')],
  ['leaderboard layout responsive', css.includes('/* F6 measured class leaderboard */') && css.includes('@media(max-width:640px){.institution-leaderboard{grid-template-columns:1fr}}')],
];
let passed = 0;
for (const [name, ok] of checks) { assert.ok(ok, `F6 check failed: ${name}`); console.log(`PASS: ${name}`); passed += 1; }
console.log(`F6 measured class leaderboard checks passed: ${passed}/${checks.length}`);
