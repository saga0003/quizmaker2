#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const EVIDENCE_DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/auth-readiness';
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

function assertSafePreview(rawTarget) {
  const url = new URL(rawTarget);
  if (url.protocol !== 'https:') throw new Error('Acceptance target must use HTTPS.');
  const host = url.hostname.toLowerCase();
  if (KNOWN_PRODUCTION_HOSTS.has(host) || host.includes('git-main')) {
    throw new Error(`Permanent/production-like host is forbidden: ${host}`);
  }
  if (!host.endsWith('.vercel.app') || !host.includes('quizmaker2')) {
    throw new Error(`Acceptance target must be an Evidara Vercel preview: ${host}`);
  }
  return url.origin;
}

function optionalProtectedPreviewBootstrap(target) {
  const raw = (process.env.EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL || '').trim();
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.origin !== target) {
    throw new Error('Protected-preview bootstrap URL must use HTTPS and exactly match the acceptance preview origin.');
  }
  if (!url.searchParams.get('_vercel_share')) {
    throw new Error('Protected-preview bootstrap URL is missing the Vercel share token parameter.');
  }
  return url.toString();
}

function roleConfig() {
  return [
    {
      role: 'school_admin',
      email: requireEnv('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_EMAIL'),
      password: requireEnv('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_PASSWORD'),
      expectedWorkspace: 'school',
      expectedViews: ['school-dashboard', 'school-analytics-overview', 'school-students'],
    },
    {
      role: 'school_teacher',
      email: requireEnv('EVIDARA_ACCEPTANCE_TEACHER_EMAIL'),
      password: requireEnv('EVIDARA_ACCEPTANCE_TEACHER_PASSWORD'),
      expectedWorkspace: 'school',
      expectedViews: ['school-dashboard', 'school-analytics-overview', 'school-questions'],
    },
    {
      role: 'student',
      email: requireEnv('EVIDARA_ACCEPTANCE_STUDENT_EMAIL'),
      password: requireEnv('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD'),
      expectedWorkspace: 'student',
      expectedViews: ['student-dashboard', 'student-tests', 'student-results'],
    },
  ];
}

function urlShowsWorkspace(rawUrl, config) {
  const url = new URL(rawUrl);
  const view = url.searchParams.get('view') || '';
  return url.pathname.startsWith(`/${config.expectedWorkspace}`) || config.expectedViews.includes(view) || view.startsWith(`${config.expectedWorkspace}-`);
}

async function waitForAuthenticatedWorkspace(page, config) {
  await page.waitForFunction(
    ({ expectedWorkspace, expectedViews }) => {
      const url = new URL(window.location.href);
      const view = url.searchParams.get('view') || '';
      const loginVisible = document.body.innerText.includes('Sign in to Evidara');
      const workspaceVisible = url.pathname.startsWith(`/${expectedWorkspace}`)
        || expectedViews.includes(view)
        || view.startsWith(`${expectedWorkspace}-`);
      return !loginVisible && workspaceVisible;
    },
    { expectedWorkspace: config.expectedWorkspace, expectedViews: config.expectedViews },
    { timeout: 30_000 },
  );
}

async function verifyRole(browser, target, protectedPreviewBootstrap, config) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', (error) => pageErrors.push(String(error.message || error).slice(0, 500)));

  try {
    if (protectedPreviewBootstrap) {
      await page.goto(protectedPreviewBootstrap, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.waitForTimeout(500);
    }
    await page.goto(`${target}/?view=login`, { waitUntil: 'networkidle', timeout: 45_000 });
    if (new URL(page.url()).hostname === 'vercel.com') {
      throw new Error('Acceptance preview is protected by Vercel SSO; configure EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL as a GitHub Actions secret.');
    }
    await page.locator('#email').waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('#password').waitFor({ state: 'visible', timeout: 20_000 });
    await page.locator('#email').fill(config.email);
    await page.locator('#password').fill(config.password);
    await page.getByRole('button', { name: /^Sign In$/ }).click();
    await waitForAuthenticatedWorkspace(page, config);

    const finalUrl = page.url();
    if (!urlShowsWorkspace(finalUrl, config)) {
      throw new Error(`${config.role} did not land in the expected ${config.expectedWorkspace} workspace.`);
    }

    const screenshot = `${EVIDENCE_DIR}/${config.role}.png`;
    await page.screenshot({ path: screenshot, fullPage: true });

    return {
      role: config.role,
      result: 'PASS',
      expectedWorkspace: config.expectedWorkspace,
      finalPath: new URL(finalUrl).pathname,
      finalView: new URL(finalUrl).searchParams.get('view'),
      screenshot,
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    const screenshot = `${EVIDENCE_DIR}/${config.role}-failure.png`;
    await page.screenshot({ path: screenshot, fullPage: true }).catch(() => {});
    return {
      role: config.role,
      result: 'FAIL',
      expectedWorkspace: config.expectedWorkspace,
      finalPath: (() => { try { return new URL(page.url()).pathname; } catch { return null; } })(),
      finalView: (() => { try { return new URL(page.url()).searchParams.get('view'); } catch { return null; } })(),
      screenshot,
      error: error instanceof Error ? error.message : String(error),
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await context.close();
  }
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== REQUIRED_ACK) {
    throw new Error(`Set EVIDARA_LOAD_ACCEPTANCE=${REQUIRED_ACK} before authenticated acceptance checks.`);
  }

  const target = assertSafePreview(requireEnv('EVIDARA_ACCEPTANCE_URL'));
  const protectedPreviewBootstrap = optionalProtectedPreviewBootstrap(target);
  const configs = roleConfig();
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let results;
  try {
    results = [];
    for (const config of configs) results.push(await verifyRole(browser, target, protectedPreviewBootstrap, config));
  } finally {
    await browser.close();
  }

  const manifest = {
    target,
    productionProtected: true,
    protectedPreviewBootstrapUsed: Boolean(protectedPreviewBootstrap),
    secretsRecorded: false,
    purpose: 'R1-R18 authenticated rendered-browser readiness only; this does not satisfy an R item.',
    results,
  };
  await writeFile(`${EVIDENCE_DIR}/readiness-results.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(manifest, null, 2));

  const failures = results.filter((result) => result.result !== 'PASS');
  if (failures.length) {
    throw new Error(`${failures.length}/${results.length} acceptance roles failed authenticated rendered-browser readiness.`);
  }
}

main().catch((error) => {
  console.error(`AUTHENTICATED ACCEPTANCE READINESS FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
