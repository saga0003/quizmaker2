#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const preflight = readFileSync(new URL('./phase1-acceptance-preflight.mjs', import.meta.url), 'utf8');
const addendum = readFileSync(new URL('../PHASE1_SAME_PROJECT_ACCEPTANCE_ADDENDUM.md', import.meta.url), 'utf8');
const protocol = readFileSync(new URL('../PHASE1_REAL_SCHOOL_ACCEPTANCE_PROTOCOL.md', import.meta.url), 'utf8');

const assertions = [
  ['same-project mode is explicit', preflight.includes("const SAME_PROJECT_MODE = 'same-project-isolated-tenant'")],
  ['acceptance Supabase ref is pinned', preflight.includes("const EVIDARA_SUPABASE_REF = 'xzfozpnzvznqrvcsoail'")],
  ['acceptance tenant slug is pinned', preflight.includes("const ACCEPTANCE_ORG_SLUG = 'evidara-school-acceptance'")],
  ['database ceiling is 450 MiB', preflight.includes('450 * 1024 * 1024')],
  ['fresh database byte measurement is required', preflight.includes('EVIDARA_ACCEPTANCE_DB_BYTES')],
  ['wrong Supabase ref fails closed', preflight.includes('same-project mode requires EVIDARA_ACCEPTANCE_SUPABASE_REF=')],
  ['wrong tenant fails closed', preflight.includes('same-project mode requires EVIDARA_ACCEPTANCE_ORG_SLUG=')],
  ['capacity ceiling fails closed', preflight.includes('hard acceptance ceiling')],
  ['permanent web aliases remain forbidden', preflight.includes("host === 'evidara.in'") && preflight.includes("host.includes('git-main')")],
  ['addendum names Evidara School', addendum.includes('Acceptance institution name: **Evidara School**')],
  ['addendum forbids future-client acceptance data', addendum.includes("St. Mary's or any future client institution must not be used")],
  ['addendum requires preview web target', addendum.includes('READY `phase1-hardening` Vercel preview/acceptance deployment')],
  ['addendum preserves R/L evidence requirement', addendum.includes('does not itself satisfy any R or L checklist item')],
  ['addendum preserves legal sign-off', addendum.includes('J3 legal review remains independently required')],
  ['protocol uses Evidara School synthetic acceptance', protocol.includes('Acceptance institution: **Evidara School**') && protocol.includes('synthetic acceptance identities and data')],
  ['protocol forbids future-client data', protocol.includes("Do not use St. Mary's or any future client institution data")],
  ['protocol keeps actual R execution mandatory', protocol.includes('does **not** by itself satisfy any R item') && protocol.includes('actual product path')],
  ['protocol keeps permanent production protected', protocol.includes('Permanent production remains protected')],
  ['protocol binds shared backend to addendum', protocol.includes('PHASE1_SAME_PROJECT_ACCEPTANCE_ADDENDUM.md')],
];

const failures = assertions.filter(([, ok]) => !ok);
for (const [name, ok] of assertions) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failures.length) {
  console.error(`${failures.length}/${assertions.length} same-project acceptance checks failed.`);
  process.exit(1);
}
console.log(`PASS ${assertions.length}/${assertions.length} same-project acceptance checks.`);
