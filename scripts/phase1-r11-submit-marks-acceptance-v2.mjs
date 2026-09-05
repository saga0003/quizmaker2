#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const EXPECTED_ORG = 'evidara-school-acceptance';
const LOCAL_ACK = 'YES_LOCAL_SYNTHETIC_ACCEPTANCE_ONLY';
const EXPECTED_PAPER = 'e5801a88-1e7f-4b4f-a715-ad44ce2b3c43';
const EXPECTED_PAPER_TITLE = 'Phase 1 R8 Physics Acceptance Test';
const SEEDED_RESPONSES = [
  ['1a35b63a-423d-4dac-8b52-4d9ed8279c01', ['A']],
  ['182c2554-713c-493c-9c7d-6e95663d115b', ['A']],
];
const EVIDENCE_DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/r11-submit-marks-v2';

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertSafeLocalTarget(rawTarget) {
  const url = new URL(rawTarget);
  const host = url.hostname.toLowerCase();
  if (!['127.0.0.1', 'localhost'].includes(host) || url.protocol !== 'http:') {
    throw new Error(`R11 acceptance is restricted to the branch-checkout localhost surface: ${url.origin}`);
  }
  if (process.env.EVIDARA_ACCEPTANCE_LOCALHOST !== LOCAL_ACK) throw new Error('R11 local synthetic acceptance acknowledgement missing.');
  return url.origin;
}

async function prepareCanonicalAttempt(email, password) {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const publishableKey = requireEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw new Error(`Synthetic R11 setup login failed: ${authError.message}`);

  try {
    const { data: available, error: availableError } = await client.rpc('list_available_papers');
    if (availableError) throw new Error(`Unable to verify synthetic R11 paper availability: ${availableError.message}`);
    const paper = (Array.isArray(available) ? available : []).find((item) => item?.id === EXPECTED_PAPER);
    if (!paper || paper.title !== EXPECTED_PAPER_TITLE) {
      throw new Error(`R11 refuses to start anything except the isolated ${EXPECTED_PAPER_TITLE} paper.`);
    }

    const { data: attemptData, error: startError } = await client.rpc('start_exam_attempt', {
      p_paper_id: EXPECTED_PAPER,
      p_access_code: null,
    });
    if (startError) throw new Error(`Unable to start fresh synthetic R11 attempt: ${startError.message}`);
    const attemptId = String(attemptData || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw new Error(`Unexpected R11 attempt identifier: ${attemptId || '(empty)'}`);

    for (const [paperQuestionId, response] of SEEDED_RESPONSES) {
      const { error: saveError } = await client.rpc('save_exam_response', {
        p_attempt_id: attemptId,
        p_paper_question_id: paperQuestionId,
        p_response: response,
        p_marked_for_review: false,
        p_time_spent_seconds: 5,
      });
      if (saveError) throw new Error(`Unable to seed canonical R11 answer ${paperQuestionId}: ${saveError.message}`);
    }

    const { data: payload, error: payloadError } = await client.rpc('get_exam_attempt_payload', { p_attempt_id: attemptId });
    if (payloadError) throw new Error(`Unable to verify fresh R11 attempt payload: ${payloadError.message}`);
    if (payload?.paper?.id !== EXPECTED_PAPER || payload?.paper?.result_mode !== 'score_only') {
      throw new Error('Fresh R11 attempt is not the isolated score-only acceptance paper.');
    }
    const saved = Array.isArray(payload?.responses)
      ? payload.responses.filter((row) => SEEDED_RESPONSES.some(([questionId]) => questionId === row.paper_question_id) && Array.isArray(row.response) && row.response[0] === 'A').length
      : 0;
    if (saved !== SEEDED_RESPONSES.length) throw new Error(`Expected ${SEEDED_RESPONSES.length} seeded server responses, found ${saved}.`);
    return attemptId;
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
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== REQUIRED_ACK) throw new Error('R11 acceptance acknowledgement missing.');
  if ((process.env.EVIDARA_ACCEPTANCE_ORG_SLUG || '').trim() !== EXPECTED_ORG) throw new Error(`R11 is restricted to ${EXPECTED_ORG}.`);
  const target = assertSafeLocalTarget(requireEnv('EVIDARA_ACCEPTANCE_URL'));
  const email = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_EMAIL');
  const password = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD');
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const attemptId = await prepareCanonicalAttempt(email, password);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  let submissionBaselineReached = false;

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', (error) => pageErrors.push(String(error.message || error).slice(0, 500)));
  page.on('response', (response) => {
    if (!submissionBaselineReached || response.status() < 400) return;
    const url = new URL(response.url());
    failedResponses.push({ status: response.status(), method: response.request().method(), resourceType: response.request().resourceType(), url: `${url.origin}${url.pathname}` });
  });

  try {
    await page.goto(`${target}/?view=login`, { waitUntil: 'networkidle', timeout: 45_000 });
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /^Sign In$/ }).click();
    await waitForStudentWorkspace(page);

    await page.goto(`${target}/student/tests/take/?attempt=${encodeURIComponent(attemptId)}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.getByText(/Question 1 of \d+/).waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByText('All answers saved').first().waitFor({ state: 'visible', timeout: 20_000 });

    await page.waitForTimeout(4_500);
    consoleErrors.length = 0;
    pageErrors.length = 0;
    failedResponses.length = 0;
    submissionBaselineReached = true;

    await page.screenshot({ path: `${EVIDENCE_DIR}/01-before-final-submit.png`, fullPage: true });
    const submitButton = page.getByRole('button', { name: /^Submit test$/ });
    if (await submitButton.isDisabled()) throw new Error('Final submission remained disabled despite rendered All answers saved state.');
    await submitButton.click();
    await page.getByText('Submit this test now?').waitFor({ state: 'visible', timeout: 10_000 });
    await page.getByText(/Sync status:/).waitFor({ state: 'visible', timeout: 10_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/02-submit-confirmation.png`, fullPage: true });
    await page.getByRole('button', { name: /Submit final answers/ }).click();

    await page.getByRole('heading', { name: 'Test submitted' }).waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByText('Your answers and authoritative result have been stored.').waitFor({ state: 'visible', timeout: 10_000 });
    const rendered = await page.locator('.post-test-result-grid > div').evaluateAll((nodes) => Object.fromEntries(nodes.map((node) => {
      const strong = node.querySelector('strong')?.textContent?.trim() || '';
      const span = node.querySelector('span')?.textContent?.trim() || '';
      return [span, strong];
    })));
    for (const label of ['Score', 'Percentage', 'Correct', 'Incorrect', 'Unanswered']) {
      if (!rendered[label]) throw new Error(`Rendered authoritative result is missing ${label}.`);
    }
    if (rendered.Score !== '8/80' || rendered.Percentage !== '10%' || rendered.Correct !== '2' || rendered.Incorrect !== '0' || rendered.Unanswered !== '18') {
      throw new Error(`Rendered authoritative result did not match the known synthetic acceptance scoring contract: ${JSON.stringify(rendered)}`);
    }
    if (await page.getByRole('button', { name: /Continue optional reflection/ }).count()) {
      throw new Error('Score-only result incorrectly exposed the post-test reflection action.');
    }
    await page.screenshot({ path: `${EVIDENCE_DIR}/03-authoritative-result.png`, fullPage: true });
    await page.waitForTimeout(1_000);

    const manifest = {
      result: 'PASS', acceptanceItem: 'R11', target, executionSurface: 'branch-checkout-localhost', organizationSlug: EXPECTED_ORG,
      paperId: EXPECTED_PAPER, attemptId, seededResponses: SEEDED_RESPONSES.length,
      renderedSubmissionConfirmationObserved: true, renderedAuthoritativeResultObserved: true, rendered,
      scoreOnlyReflectionSuppressed: true, requiresIndependentSupabaseComparison: true, productionProtected: true, secretsRecorded: false,
      unexpectedConsoleErrorCount: consoleErrors.length, unexpectedConsoleErrorSamples: consoleErrors.slice(0, 5),
      pageErrorCount: pageErrors.length, pageErrorSamples: pageErrors.slice(0, 5),
      failedResponseCount: failedResponses.length, failedResponseSamples: failedResponses.slice(0, 5), capturedAt: new Date().toISOString(),
    };
    await writeFile(`${EVIDENCE_DIR}/r11-results.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(manifest, null, 2));
    if (consoleErrors.length || pageErrors.length || failedResponses.length) {
      throw new Error(`R11 final submission captured ${consoleErrors.length} console errors, ${pageErrors.length} page errors, and ${failedResponses.length} failed responses.`);
    }
  } catch (error) {
    const failure = { result: 'FAIL', acceptanceItem: 'R11', target, organizationSlug: EXPECTED_ORG, attemptId, productionProtected: true, secretsRecorded: false,
      error: error instanceof Error ? error.message : String(error), unexpectedConsoleErrorCount: consoleErrors.length,
      unexpectedConsoleErrorSamples: consoleErrors.slice(0, 5), pageErrorCount: pageErrors.length, pageErrorSamples: pageErrors.slice(0, 5),
      failedResponseCount: failedResponses.length, failedResponseSamples: failedResponses.slice(0, 5), capturedAt: new Date().toISOString() };
    await page.screenshot({ path: `${EVIDENCE_DIR}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${EVIDENCE_DIR}/r11-results.json`, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
    console.error(JSON.stringify(failure, null, 2));
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`R11 SUBMISSION/MARKS ACCEPTANCE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
