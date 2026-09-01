import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (name, condition) => {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
};

const sidebar = read('src/components/evidara/app-sidebar.tsx');
const store = read('src/store/use-app-store.ts');
const views = read('src/lib/workspaceViews.ts');
const page = read('src/app/page.tsx');
const auditHealth = read('src/components/evidara/admin-audit-health.tsx');
const phase1 = read('src/config/phase1-launch.ts');

const adminBlock = sidebar.slice(sidebar.indexOf('const adminNav: NavEntry[] = ['), sidebar.indexOf('function isGroup'));
for (const label of ['Command Centre', 'Institutions', 'Subscriptions', 'Analytics', 'Questions', 'Papers', 'Resources', 'Access & Accounts', 'Audit & Health']) {
  check(`H1 Super Admin menu includes ${label}`, adminBlock.includes(`label: '${label}'`));
}
check('H1 Audit & Health has a first-class AppView', store.includes("'admin-audit-health'") && views.includes("'admin-audit-health'"));
check('H1 Audit & Health route renders a real workspace', page.includes("view === 'admin-audit-health'") && page.includes('<AdminAuditHealthView />') && (/Audit &amp; Health/.test(auditHealth) || /title=["']Audit & Health["']/.test(auditHealth)));
check('H1 View As remains a visible Super Admin sidebar affordance', sidebar.includes('<LoginAsSwitcher />'));
check('H2 parked Products is absent from Phase 1 admin navigation', !adminBlock.includes("label: 'Products'"));
check('H2 parked Referral Settings is absent from Phase 1 admin navigation', !adminBlock.includes("label: 'Referral Settings'"));
check('H2 parked Self Assessment is absent from Phase 1 admin navigation', !adminBlock.includes("label: 'Self Assessment'"));
check('H2 source feature flags still identify commerce/referral/self-assessment as parked', /directStudentCommerce:\s*false/.test(phase1) && /referrals:\s*false/.test(phase1) && /selfAssessment:\s*false/.test(phase1));
check('Audit & Health avoids fabricated operational claims', /does not fabricate uptime or incident claims/i.test(auditHealth));

console.log(`\n${17 - failures.length}/17 H1/H2 role-navigation checks passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
