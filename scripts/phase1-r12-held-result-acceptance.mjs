#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const LOCAL_ACK = 'YES_LOCAL_SYNTHETIC_ACCEPTANCE_ONLY';
const EXPECTED_ORG = 'evidara-school-acceptance';
const EXPECTED_PAPER = 'e5801a88-1e7f-4b4f-a715-ad44ce2b3c43';
const EXPECTED_PAPER_TITLE = 'Phase 1 R8 Physics Acceptance Test';
const EXPECTED_ATTEMPT = '134ddbe2-bc9f-4863-9aba-3b9def08d69e';
const EVIDENCE_DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/r12-held-result';

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertSafeLocalTarget(rawTarget) {
  const url = new URL(rawTarget);
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname.toLowerCase())) {
    throw new Error(`R12 acceptance is restricted to localhost: ${url.origin}`);
  }
  if (process.env.EVIDARA_ACCEPTANCE_LOCALHOST !== LOCAL_ACK) throw new Error('R12 localhost acknowledgement missing.');
  return url.origin;
}

async function loadHeldResultContract(email, password) {
  const client = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`Synthetic R12 setup login failed: ${authError.message}`);
  try {
    const { data, error } = await client.rpc('list_my_attempt_results');
    if (error) throw new Error(`Unable to read R12 student result contract: ${error.message}`);
    const row = (Array.isArray(data) ? data : []).find((item) => item?.attempt_id === EXPECTED_ATTEMPT);
    if (!row) throw new Error(`R12 expected synthetic attempt ${EXPECTED_ATTEMPT} is missing.`);
    if (row.paper_id !== EXPECTED_PAPER || row.paper_title !== EXPECTED_PAPER_TITLE) throw new Error('R12 refuses to inspect a non-acceptance paper.');
    if (row.result_mode !== 'hidden' || row.result_release_level !== 'none' || row.result_released !== false) {
      throw new Error(`Expected hidden/none result contract, received ${JSON.stringify({ mode: row.result_mode, level: row.result_release_level, released: row.result_released })}`);
    }
    for (const key of ['score','maximum_marks','percentage','correct_count','incorrect_count','unanswered_count']) {
      if (row[key] !== null) throw new Error(`Held result leaked ${key}=${row[key]}.`);
    }
    if (row.answers_released !== false || row.analytics_released !== false) throw new Error('Held result incorrectly released answers or analytics.');
    return row;
  } finally {
    await client.auth.signOut().catch(() => {});
  }
}

async function waitForStudentWorkspace(page) {
  await page.waitForFunction(() => {
    const url = new URL(window.location.href);
    const view = url.searchParams.get('view') || '';
    return !document.body.innerText.includes('Sign in to Evidara') && (view === 'student-dashboard' || view.startsWith('student-'));
  }, null, { timeout: 30_000 });
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== REQUIRED_ACK) throw new Error('R12 acceptance acknowledgement missing.');
  if ((process.env.EVIDARA_ACCEPTANCE_ORG_SLUG || '').trim() !== EXPECTED_ORG) throw new Error(`R12 is restricted to ${EXPECTED_ORG}.`);
  const target = assertSafeLocalTarget(requireEnv('EVIDARA_ACCEPTANCE_URL'));
  const email = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_EMAIL');
  const password = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD');
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const contract = await loadHeldResultContract(email, password);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });
  page.on('pageerror', (error) => pageErrors.push(String(error.message || error).slice(0, 500)));
  page.on('response', (response) => {
    if (response.status() < 400) return;
    const url = new URL(response.url());
    failedResponses.push({ status: response.status(), method: response.request().method(), url: `${url.origin}${url.pathname}` });
  });

  try {
    await page.goto(`${target}/?view=login`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /^Sign In$/ }).click();
    await waitForStudentWorkspace(page);
    await page.goto(`${target}/student/results`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.getByText(EXPECTED_PAPER_TITLE, { exact: false }).first().waitFor({ state: 'visible', timeout: 30_000 });
    const body = await page.locator('body').innerText();
    if (body.includes('8/80') || body.includes('10%')) throw new Error('Rendered Student Results leaked the held authoritative score.');
    await page.screenshot({ path: `${EVIDENCE_DIR}/01-held-result.png`, fullPage: true });

    const manifest = {
      result: 'PASS', acceptanceItem: 'R12-held', target, executionSurface: 'branch-checkout-localhost', organizationSlug: EXPECTED_ORG,
      paperId: EXPECTED_PAPER, attemptId: EXPECTED_ATTEMPT, resultMode: contract.result_mode, resultReleaseLevel: contract.result_release_level,
      resultReleased: contract.result_released, scoreFieldsWithheld: true, renderedPaperVisible: true, renderedScoreWithheld: true,
      productionProtected: true, secretsRecorded: false, unexpectedConsoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length, failedResponseCount: failedResponses.length, capturedAt: new Date().toISOString(),
    };
    await writeFile(`${EVIDENCE_DIR}/r12-held-results.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(manifest, null, 2));
    if (consoleErrors.length || pageErrors.length || failedResponses.length) {
      throw new Error(`R12 held-result run captured ${consoleErrors.length} console errors, ${pageErrors.length} page errors, ${failedResponses.length} failed responses.`);
    }
  } catch (error) {
    const failure = { result: 'FAIL', acceptanceItem: 'R12-held', target, organizationSlug: EXPECTED_ORG, paperId: EXPECTED_PAPER,
      attemptId: EXPECTED_ATTEMPT, productionProtected: true, secretsRecorded: false, error: error instanceof Error ? error.message : String(error),
      unexpectedConsoleErrorCount: consoleErrors.length, pageErrorCount: pageErrors.length, failedResponseCount: failedResponses.length, capturedAt: new Date().toISOString() };
    await page.screenshot({ path: `${EVIDENCE_DIR}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${EVIDENCE_DIR}/r12-held-results.json`, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
    console.error(JSON.stringify(failure, null, 2));
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`R12 HELD RESULT ACCEPTANCE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
