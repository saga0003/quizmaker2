#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const runner = readFileSync(new URL('./phase1-authenticated-acceptance-readiness.mjs', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/phase1-authenticated-acceptance-readiness.yml', import.meta.url), 'utf8');
const protocol = readFileSync(new URL('../PHASE1_REAL_SCHOOL_ACCEPTANCE_PROTOCOL.md', import.meta.url), 'utf8');

const assertions = [
  ['runner requires non-production acknowledgement', runner.includes('YES_I_UNDERSTAND_NON_PRODUCTION_ONLY')],
  ['runner rejects permanent Evidara aliases', runner.includes("'evidara.in'") && runner.includes("'www.evidara.in'")],
  ['runner rejects git-main', runner.includes("host.includes('git-main')")],
  ['runner requires Evidara Vercel preview host', runner.includes("host.endsWith('.vercel.app')") && runner.includes("host.includes('quizmaker2')")],
  ['runner verifies school admin', runner.includes("role: 'school_admin'")],
  ['runner verifies school teacher', runner.includes("role: 'school_teacher'")],
  ['runner verifies student', runner.includes("role: 'student'")],
  ['runner uses rendered Chromium', runner.includes("import { chromium } from 'playwright'") && runner.includes('chromium.launch')],
  ['runner never records account passwords', runner.includes('secretsRecorded: false') && !runner.includes('password: config.password')],
  ['runner captures role screenshots', runner.includes('page.screenshot')],
  ['runner supports protected-preview bootstrap without recording token', runner.includes('EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL') && runner.includes("url.searchParams.get('_vercel_share')") && runner.includes('protectedPreviewBootstrapUsed: Boolean(protectedPreviewBootstrap)')],
  ['runner rejects mismatched protected-preview origin', runner.includes('url.origin !== target')],
  ['runner reports Vercel SSO blocker explicitly', runner.includes('Acceptance preview is protected by Vercel SSO')],
  ['workflow is manual only', workflow.includes('workflow_dispatch:') && !workflow.includes('\n  push:')],
  ['workflow pins same-project acceptance tenant', workflow.includes('EVIDARA_ACCEPTANCE_ORG_SLUG: evidara-school-acceptance')],
  ['workflow pins acceptance Supabase project', workflow.includes('EVIDARA_ACCEPTANCE_SUPABASE_REF: xzfozpnzvznqrvcsoail')],
  ['workflow requires fresh database bytes input', workflow.includes('database_bytes:') && workflow.includes('EVIDARA_ACCEPTANCE_DB_BYTES: ${{ inputs.database_bytes }}')],
  ['workflow runs canonical safety preflight first', workflow.indexOf('phase1-acceptance-preflight.mjs') < workflow.indexOf('phase1-authenticated-acceptance-readiness.mjs')],
  ['workflow sources credentials only from secrets', workflow.includes('secrets.EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_PASSWORD') && workflow.includes('secrets.EVIDARA_ACCEPTANCE_TEACHER_PASSWORD') && workflow.includes('secrets.EVIDARA_ACCEPTANCE_STUDENT_PASSWORD')],
  ['workflow fails fast on missing role credentials', workflow.includes('Acceptance credential missing') && workflow.includes('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD; do')],
  ['workflow sources protected-preview bootstrap only from secret', workflow.includes('secrets.EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL')],
  ['workflow Playwright install tolerates existing optional peer conflict without lockfile mutation', workflow.includes('--package-lock=false --legacy-peer-deps playwright@1.55.0')],
  ['protocol requires rendered R10 browser test', protocol.includes('physical/rendered browser network exercise')],
  ['runner clearly does not satisfy R items', runner.includes('this does not satisfy an R item')],
];

const failures = assertions.filter(([, ok]) => !ok);
for (const [name, ok] of assertions) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failures.length) {
  console.error(`${failures.length}/${assertions.length} authenticated acceptance readiness checks failed.`);
  process.exit(1);
}
console.log(`PASS ${assertions.length}/${assertions.length} authenticated acceptance readiness checks.`);
