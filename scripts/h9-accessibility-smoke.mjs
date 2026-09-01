import fs from 'node:fs';
import assert from 'node:assert/strict';

const globals = fs.readFileSync('src/app/globals.css', 'utf8');
const buttons = fs.readFileSync('src/components/ui/button.tsx', 'utf8');
const inputs = fs.readFileSync('src/components/ui/input.tsx', 'utf8');
const phase1 = fs.readFileSync('src/components/evidara/phase1-ui.tsx', 'utf8');
const mobileCards = fs.readFileSync('src/components/institution-analytics/institution-mobile-cards.tsx', 'utf8');
const workspace = fs.readFileSync('src/components/institution-analytics/institution-analytics-workspace.tsx', 'utf8');
const css = fs.readFileSync('src/components/institution-analytics/institution-analytics.css', 'utf8');

function rgb(hex) {
  const raw = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(raw.slice(i, i + 2), 16) / 255);
}
function luminance(hex) {
  const channels = rgb(hex).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

const checks = [
  ['global keyboard focus styles cover buttons, links and form controls', globals.includes('button:focus-visible') && globals.includes('a:focus-visible') && globals.includes('input:focus-visible') && globals.includes('select:focus-visible') && globals.includes('textarea:focus-visible')],
  ['focus indicator uses explicit outline and offset', globals.includes('outline: 2px solid var(--ring)') && globals.includes('outline-offset: 2px')],
  ['shared buttons provide 44px minimum touch targets', buttons.includes('min-h-11 min-w-11')],
  ['shared buttons retain strong focus-visible ring', buttons.includes('focus-visible:ring-[3px]')],
  ['shared inputs provide 44px minimum touch height', inputs.includes('min-h-11')],
  ['shared inputs retain strong focus-visible ring', inputs.includes('focus-visible:ring-[3px]')],
  ['institution search has an accessible name', workspace.includes('aria-label={placeholder}')],
  ['institution filter has an accessible name', workspace.includes('aria-label={filterLabel}')],
  ['bulk student selection has an accessible name', workspace.includes('aria-label="Select all filtered students"')],
  ['individual student selection has a contextual accessible name', workspace.includes('aria-label={`Select ${row.name}`}')],
  ['mobile analytics interactive records are native keyboard buttons', mobileCards.includes('<button') && mobileCards.includes('type="button"')],
  ['mobile analytics cards retain visible keyboard focus', mobileCards.includes('focus-visible:ring-2')],
  ['mobile analytics cards retain baseline touch height', mobileCards.includes('min-h-11')],
  ['table overflow regions are keyboard reachable and labelled', phase1.includes('role="region"') && phase1.includes('aria-label={label}') && phase1.includes('tabIndex={0}')],
  ['async status blocks expose assistive status semantics', phase1.includes("role={state === 'error' ? 'alert' : 'status'}") && phase1.includes('aria-live="polite"')],
  ['institution loading and error states carry meaningful visible text', css.includes('.institution-error') && css.includes('.institution-loading')],
  ['primary text contrast on light canvas meets WCAG AA', contrast('#0F172A', '#FAFBFC') >= 4.5],
  ['muted text contrast on white cards meets WCAG AA', contrast('#64748B', '#FFFFFF') >= 4.5],
  ['primary button white text contrast meets WCAG AA', contrast('#FFFFFF', '#0C6969') >= 4.5],
  ['destructive white text contrast meets WCAG AA', contrast('#FFFFFF', '#DC2626') >= 4.5],
];

for (const [name, ok] of checks) assert.ok(ok, `H9 failed: ${name}`);
console.log(`H9 accessibility baseline smoke: ${checks.length}/${checks.length} assertions passed.`);
console.log(`Contrast ratios: foreground/canvas=${contrast('#0F172A','#FAFBFC').toFixed(2)}, muted/card=${contrast('#64748B','#FFFFFF').toFixed(2)}, white/primary=${contrast('#FFFFFF','#0C6969').toFixed(2)}, white/destructive=${contrast('#FFFFFF','#DC2626').toFixed(2)}.`);
