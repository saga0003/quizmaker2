#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const EXPECTED_ORG = 'evidara-school-acceptance';
const LOCAL_ACK = 'YES_LOCAL_SYNTHETIC_ACCEPTANCE_ONLY';
const EXPECTED_ATTEMPT = '9739cf8e-df9d-49a9-8318-6a66fd919098';
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
  const attemptId = requireEnv('EVIDARA_ACCEPTANCE_ATTEMPT_ID');
  if (attemptId !== EXPECTED_ATTEMPT) throw new Error('R11 refuses any attempt other than the dedicated synthetic R11 attempt.');
  const target = assertSafeLocalTarget(requireEnv('EVIDARA_ACCEPTANCE_URL'));
  const email = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_EMAIL');
  const password = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD');
  await mkdir(EVIDENCE_DIR, { recursive: true });

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

    // Local branch-checkout shell probes can legitimately fail without server-only secrets.
    // Establish the acceptance error baseline only after the exam surface is fully loaded,
    // so R11 remains strict about failures caused by the actual final-submission operation.
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
    await page.screenshot({ path: `${EVIDENCE_DIR}/03-authoritative-result.png`, fullPage: true });
    await page.waitForTimeout(750);

    const manifest = {
      result: 'PASS', acceptanceItem: 'R11', target, executionSurface: 'branch-checkout-localhost', organizationSlug: EXPECTED_ORG,
      attemptId, renderedSubmissionConfirmationObserved: true, renderedAuthoritativeResultObserved: true, rendered,
      requiresIndependentSupabaseComparison: true, productionProtected: true, secretsRecorded: false,
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
