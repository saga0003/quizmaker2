import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('src/components/evidara/phase1-ui.tsx', 'utf8');
const health = fs.readFileSync('src/components/evidara/admin-audit-health.tsx', 'utf8');
const school = fs.readFileSync('src/components/evidara/school-views.tsx', 'utf8');
const student = fs.readFileSync('src/components/evidara/student-dashboard.tsx', 'utf8');
const questionBank = fs.readFileSync('src/components/evidara/live-question-bank.tsx', 'utf8');

const checks = [
  ['shared page heading exists', ui.includes('export function Phase1PageHeading')],
  ['shared card exists', ui.includes('export function Phase1Card')],
  ['shared filter bar exists', ui.includes('export function Phase1FilterBar')],
  ['shared table frame exists', ui.includes('export function Phase1TableFrame')],
  ['shared async state exists', ui.includes('export function Phase1AsyncState')],
  ['async states distinguish loading/error/empty', /'loading' \| 'error' \| 'empty'/.test(ui)],
  ['async status is announced', ui.includes('aria-live=') && ui.includes("role={statusRole}")],
  ['table frame is keyboard focusable', ui.includes('tabIndex={0}') && ui.includes('overflow-x-auto')],
  ['filters stack on narrow screens', ui.includes('flex flex-col') && ui.includes('sm:flex-row')],
  ['audit health adopts standard heading', health.includes('<Phase1PageHeading')],
  ['audit health adopts standard cards', health.includes('<Phase1Card>')],
  ['audit health adopts loading state', health.includes('state="loading"')],
  ['audit health adopts error state', health.includes('state="error"') && health.includes('Retry')],
  ['audit health adopts empty state', health.includes('state="empty"')],
  ['role dashboards retain responsive layouts', school.includes('sm:grid-cols-2') && school.includes('lg:grid-cols-') && student.includes('sm:p-6') && student.includes('lg:p-8')],
  ['question bank retains bounded responsive table overflow', questionBank.includes('overflow-x-auto') || questionBank.includes('overflow-auto')],
];

for (const [name, ok] of checks) assert.ok(ok, `H6 failed: ${name}`);
console.log(`H6 UI consistency smoke: ${checks.length}/${checks.length} assertions passed.`);
