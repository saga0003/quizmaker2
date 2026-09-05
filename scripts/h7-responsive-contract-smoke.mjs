import fs from 'node:fs';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('src/components/evidara/phase1-ui.tsx', 'utf8');
const analytics = fs.readFileSync('src/components/institution-analytics/institution-analytics-workspace.tsx', 'utf8');
const demoAnalytics = fs.readFileSync('src/components/evidara/analytics-hierarchy.tsx', 'utf8');

const checks = [
  ['page heading can shrink inside narrow layouts', ui.includes('flex flex-col min-w-0') && ui.includes('sm:flex-row')],
  ['long heading text can wrap anywhere', ui.includes('break-words text-2xl') && ui.includes('[overflow-wrap:anywhere]')],
  ['long descriptions can wrap anywhere', /max-w-3xl break-words[\s\S]*\[overflow-wrap:anywhere\]/.test(ui)],
  ['heading actions wrap instead of escaping viewport', ui.includes('w-full min-w-0 flex-wrap') && ui.includes('sm:w-auto')],
  ['cards and card content allow intrinsic shrinking', ui.includes('min-w-0 rounded-xl') && ui.includes('<CardContent className="min-w-0')],
  ['filter bar stacks on narrow screens', ui.includes('flex flex-col min-w-0') && ui.includes('[&>*]:min-w-0') && ui.includes('sm:flex-row')],
  ['table frame is width bounded', ui.includes('max-w-full min-w-0 overflow-x-auto')],
  ['table frame contains horizontal overscroll', ui.includes('overscroll-x-contain')],
  ['table frame reserves scrollbar gutter', ui.includes('[scrollbar-gutter:stable]')],
  ['async states can shrink within responsive grids', ui.includes('grid min-w-0 place-items-center') && ui.includes('<div className="min-w-0 max-w-xl">')],
  ['async titles and descriptions wrap long content', ui.includes('break-words font-semibold') && ui.includes('mt-1 break-words text-sm')],
  ['async actions wrap', ui.includes('mt-4 flex flex-wrap justify-center gap-2')],
  ['live institutional analytics keeps intentionally wide tables internally contained', analytics.includes('institution-table-card') && analytics.includes('min-w-[1180px]') && analytics.includes('min-w-[1050px]')],
  ['demo analytics retains explicit horizontal containment for history', demoAnalytics.includes('overflow-x-auto p-0')],
];

for (const [name, ok] of checks) assert.ok(ok, `H7 failed: ${name}`);
console.log(`H7 responsive contract smoke: ${checks.length}/${checks.length} assertions passed.`);
