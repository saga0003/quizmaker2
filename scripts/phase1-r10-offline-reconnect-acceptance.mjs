#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const EXPECTED_ORG = 'evidara-school-acceptance';
const LOCAL_ACK = 'YES_LOCAL_SYNTHETIC_ACCEPTANCE_ONLY';
const PAPER_TITLE = 'Phase 1 R8 Physics Acceptance Test';
const EVIDENCE_DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/r10-offline-reconnect';
const KNOWN_PRODUCTION_HOSTS = new Set([
  'quizmaker2-saga0003s-projects.vercel.app',
  'quizmaker2-git-main-saga0003s-projects.vercel.app',
  'evidara.in',
  'www.evidara.in',
]);

function requireEnv(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function assertSafeTarget(rawTarget) {
  const url = new URL(rawTarget);
  const host = url.hostname.toLowerCase();
  const isLocal = (host === '127.0.0.1' || host === 'localhost') && url.protocol === 'http:';
  if (isLocal) {
    if (process.env.EVIDARA_ACCEPTANCE_LOCALHOST !== LOCAL_ACK) {
      throw new Error('Local R10 acceptance requires the explicit synthetic-local acknowledgement.');
    }
    return { origin: url.origin, local: true };
  }
  if (url.protocol !== 'https:' || KNOWN_PRODUCTION_HOSTS.has(host) || host.includes('git-main')) {
    throw new Error(`R10 acceptance refuses production-like target: ${url.origin}`);
  }
  if (!host.endsWith('.vercel.app') || !host.includes('quizmaker2')) {
    throw new Error(`R10 target must be an Evidara Vercel preview or explicit localhost acceptance server: ${url.origin}`);
  }
  return { origin: url.origin, local: false };
}

function protectedBootstrap(target) {
  const raw = requireEnv('EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL');
  const url = new URL(raw);
  if (url.origin !== target || !url.searchParams.get('_vercel_share')) {
    throw new Error('Protected preview bootstrap must match the exact R10 preview origin and include _vercel_share.');
  }
  return url.toString();
}

function isExpectedOfflineConsoleError(text) {
  const normalized = text.toLowerCase();
  return (
    normalized.includes('err_internet_disconnected') ||
    normalized.includes('err_network_changed') ||
    normalized.includes('err_network_access_denied') ||
    normalized.includes('networkerror when attempting to fetch resource') ||
    normalized.includes('typeerror: failed to fetch')
  );
}

async function waitForStudentWorkspace(page) {
  await page.waitForFunction(() => {
    const url = new URL(window.location.href);
    const view = url.searchParams.get('view') || '';
    return !document.body.innerText.includes('Sign in to Evidara') && (view === 'student-dashboard' || view.startsWith('student-'));
  }, null, { timeout: 30_000 });
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== REQUIRED_ACK) throw new Error('R10 acceptance acknowledgement missing.');
  if ((process.env.EVIDARA_ACCEPTANCE_ORG_SLUG || '').trim() !== EXPECTED_ORG) {
    throw new Error(`R10 is restricted to ${EXPECTED_ORG}.`);
  }

  const safeTarget = assertSafeTarget(requireEnv('EVIDARA_ACCEPTANCE_URL'));
  const target = safeTarget.origin;
  const bootstrap = safeTarget.local ? null : protectedBootstrap(target);
  const email = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_EMAIL');
  const password = requireEnv('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD');
  const attemptId = requireEnv('EVIDARA_ACCEPTANCE_ATTEMPT_ID');
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const expectedOfflineConsoleErrors = [];
  const pageErrors = [];
  let deliberateOffline = false;
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text().slice(0, 500);
    // Chromium may emit the console event for a request that failed while offline only
    // after connectivity has already been restored. Classify those deterministic browser
    // network signatures by content as well as by the deliberate-offline window, while
    // leaving every other console error as a hard acceptance failure.
    if (deliberateOffline || isExpectedOfflineConsoleError(text)) expectedOfflineConsoleErrors.push(text);
    else consoleErrors.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(String(error.message || error).slice(0, 500)));

  let paperQuestionId = null;
  let localPendingObserved = false;
  let reconnectClearedLocalQueue = false;

  try {
    if (bootstrap) {
      await page.goto(bootstrap, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(500);
    }
    await page.goto(`${target}/?view=login`, { waitUntil: 'networkidle', timeout: 45_000 });
    if (!safeTarget.local && new URL(page.url()).hostname === 'vercel.com') {
      throw new Error('Vercel protected preview bootstrap did not establish access.');
    }
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /^Sign In$/ }).click();
    await waitForStudentWorkspace(page);

    // Local acceptance intentionally lacks the server-only account-security secret. The
    // dashboard starts two security probes that settle as expected 503s after login. Wait
    // for those shell-only requests to finish before clearing diagnostics so delayed
    // console delivery cannot contaminate the standalone exam acceptance surface.
    if (safeTarget.local) {
      await page.waitForTimeout(4_500);
      consoleErrors.length = 0;
      expectedOfflineConsoleErrors.length = 0;
      pageErrors.length = 0;
    }

    // R9 already proved assignment discovery + canonical start. R10 deliberately reuses
    // that preserved synthetic attempt so the acceptance exercise measures only the
    // required physical network disconnect -> local queue -> reconnect -> server sync.
    await page.goto(`${target}/student/tests/take/?attempt=${encodeURIComponent(attemptId)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });
    await page.getByText(/Question 1 of \d+/).waitFor({ state: 'visible', timeout: 30_000 });
    await page.getByText('All answers saved').first().waitFor({ state: 'visible', timeout: 20_000 });
    await page.screenshot({ path: `${EVIDENCE_DIR}/01-online-before-disconnect.png`, fullPage: true });

    deliberateOffline = true;
    await context.setOffline(true);
    await page.getByText(/Internet disconnected/).waitFor({ state: 'visible', timeout: 10_000 });
    const optionButton = page.locator('main.rm-card button:not([class])').first();
    await optionButton.click();
    await page.getByText(/Offline · 1 waiting/).first().waitFor({ state: 'visible', timeout: 10_000 });

    const offlineState = await page.evaluate((id) => {
      const key = `evidara-exam-pending:${id}`;
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : {};
      const items = Object.values(parsed);
      return { key, count: items.length, questionId: items[0]?.questionId || null };
    }, attemptId);
    localPendingObserved = offlineState.count === 1;
    paperQuestionId = offlineState.questionId;
    if (!localPendingObserved || !paperQuestionId) throw new Error('Offline answer was not preserved in the attempt-scoped local queue.');
    await page.screenshot({ path: `${EVIDENCE_DIR}/02-offline-answer-queued.png`, fullPage: true });

    await context.setOffline(false);
    deliberateOffline = false;
    await page.getByText('All answers saved').first().waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForFunction((id) => !localStorage.getItem(`evidara-exam-pending:${id}`), attemptId, { timeout: 20_000 });
    reconnectClearedLocalQueue = true;
    // Give delayed Chromium console events from the deliberate offline request a brief
    // chance to arrive before final classification/evidence is frozen.
    await page.waitForTimeout(750);
    await page.screenshot({ path: `${EVIDENCE_DIR}/03-reconnected-server-confirmed.png`, fullPage: true });

    const manifest = {
      result: 'PASS',
      acceptanceItem: 'R10',
      target,
      executionSurface: safeTarget.local ? 'branch-checkout-localhost' : 'protected-preview',
      organizationSlug: EXPECTED_ORG,
      paperTitle: PAPER_TITLE,
      attemptId,
      paperQuestionId,
      localPendingObserved,
      reconnectClearedLocalQueue,
      renderedOfflineBannerObserved: true,
      renderedServerConfirmationObserved: true,
      serverPersistenceRequiresSupabaseVerification: true,
      productionProtected: true,
      secretsRecorded: false,
      unexpectedConsoleErrorCount: consoleErrors.length,
      expectedOfflineConsoleErrorCount: expectedOfflineConsoleErrors.length,
      unexpectedConsoleErrorSamples: consoleErrors.slice(0, 5),
      expectedOfflineConsoleErrorSamples: expectedOfflineConsoleErrors.slice(0, 5),
      pageErrorCount: pageErrors.length,
      pageErrorSamples: pageErrors.slice(0, 5),
      capturedAt: new Date().toISOString(),
    };
    await writeFile(`${EVIDENCE_DIR}/r10-results.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(manifest, null, 2));
    if (consoleErrors.length || pageErrors.length) {
      throw new Error(`R10 rendered flow captured ${consoleErrors.length} unexpected console and ${pageErrors.length} page errors.`);
    }
  } catch (error) {
    const failure = {
      result: 'FAIL', acceptanceItem: 'R10', target,
      executionSurface: safeTarget.local ? 'branch-checkout-localhost' : 'protected-preview',
      organizationSlug: EXPECTED_ORG,
      attemptId, paperQuestionId, localPendingObserved, reconnectClearedLocalQueue,
      productionProtected: true, secretsRecorded: false,
      error: error instanceof Error ? error.message : String(error),
      unexpectedConsoleErrorCount: consoleErrors.length,
      expectedOfflineConsoleErrorCount: expectedOfflineConsoleErrors.length,
      unexpectedConsoleErrorSamples: consoleErrors.slice(0, 5),
      expectedOfflineConsoleErrorSamples: expectedOfflineConsoleErrors.slice(0, 5),
      pageErrorCount: pageErrors.length,
      pageErrorSamples: pageErrors.slice(0, 5),
      capturedAt: new Date().toISOString(),
    };
    await page.screenshot({ path: `${EVIDENCE_DIR}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${EVIDENCE_DIR}/r10-results.json`, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
    console.error(JSON.stringify(failure, null, 2));
    throw error;
  } finally {
    deliberateOffline = false;
    await context.setOffline(false).catch(() => {});
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`R10 OFFLINE/RECONNECT ACCEPTANCE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
