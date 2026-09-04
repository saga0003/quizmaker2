#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { chromium } from 'playwright';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const ORG_SLUG = 'evidara-school-acceptance';
const ORG_ID = '4effce90-bccb-4263-9f5a-a75b6df301f2';
// The canonical section is "Section A"; the rendered Grade 11 hierarchy row intentionally labels it "A".
const HIERARCHY = ['NEET', 'Grade 11', 'A', 'Physics', 'Kinematics', 'Motion in One Dimension'];
const DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/r14-drilldowns';
const PROD_HOSTS = new Set(['quizmaker2-saga0003s-projects.vercel.app', 'quizmaker2-git-main-saga0003s-projects.vercel.app', 'evidara.in', 'www.evidara.in']);

function env(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function previewOrigin(raw) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || PROD_HOSTS.has(host) || host.includes('git-main') || !host.endsWith('.vercel.app') || !host.includes('quizmaker2')) {
    throw new Error(`R14 preview guard failed: ${host}`);
  }
  return url.origin;
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error('R14 MFA setup key is not valid base32');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret, now = Date.now()) {
  const counter = Math.floor(now / 30000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function satisfyMfaIfRequired(page) {
  const body = await page.locator('body').innerText().catch(() => '');
  if (!body.includes('Multi-factor verification required')) return false;
  const match = body.match(/setup key:\s*([A-Z2-7\s]+)/i);
  if (!match?.[1]) throw new Error('R14 synthetic MFA gate did not expose a setup key');
  const secret = match[1].replace(/\s+/g, '');
  const codeInput = page.getByLabel(/6-digit authenticator code/i).or(page.locator('input[inputmode="numeric"]')).first();
  await codeInput.waitFor({ state: 'visible', timeout: 10000 });
  await codeInput.fill(totp(secret));
  await page.getByRole('button', { name: /Verify and unlock Evidara/i }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Multi-factor verification required'), null, { timeout: 20000 });
  return true;
}

async function login(page, origin, email, password) {
  await page.goto(`${origin}/?view=login`, { waitUntil: 'networkidle', timeout: 45000 });
  if (new URL(page.url()).hostname === 'vercel.com') throw new Error('R14 protected preview bootstrap failed');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Sign in to Evidara') && new URL(location.href).searchParams.get('view')?.startsWith('school-'), null, { timeout: 30000 });
  await satisfyMfaIfRequired(page);
}

async function requireBodyToken(page, token, role, level) {
  await page.waitForFunction((value) => document.body.innerText.includes(value), token, { timeout: 20000 });
  const body = await page.locator('body').innerText();
  if (!body.includes(token)) throw new Error(`R14 ${role} ${level} view missing ${token}`);
  return body;
}

async function clickFirstVisible(locator) {
  const count = await locator.count();
  for (let i = 0; i < count; i += 1) {
    const candidate = locator.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      await candidate.click();
      return true;
    }
  }
  return false;
}

async function openHierarchyRow(page, label) {
  const rows = page.getByRole('row').filter({ hasText: label });
  if (await clickFirstVisible(rows)) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    return;
  }

  const buttons = page.getByRole('button', { name: label, exact: true });
  if (await clickFirstVisible(buttons)) {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    return;
  }

  const exactTexts = page.getByText(label, { exact: true });
  if (!(await clickFirstVisible(exactTexts))) throw new Error(`R14 could not find a visible hierarchy control for ${label}`);
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

async function verifyRole(browser, origin, bypassSecret, role, email, password) {
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await context.route(`${origin}/**`, async (route) => {
    const headers = { ...route.request().headers(), 'x-vercel-protection-bypass': bypassSecret };
    await route.continue({ headers });
  });

  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const analyticsPayloads = [];
  let baseline = false;
  let stage = 'bootstrap';

  page.on('console', (message) => {
    if (baseline && message.type() === 'error') consoleErrors.push(message.text().slice(0, 500));
  });
  page.on('pageerror', (error) => {
    if (baseline) pageErrors.push(String(error.message || error).slice(0, 500));
  });
  page.on('response', async (response) => {
    if (!baseline) return;
    const url = new URL(response.url());
    if (response.status() >= 400) failedResponses.push({ status: response.status(), path: url.pathname });
    if (url.origin === origin && url.pathname === '/api/institution-analytics' && response.ok()) {
      try { analyticsPayloads.push(await response.json()); } catch {}
    }
  });

  try {
    stage = 'preview-bootstrap';
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (new URL(page.url()).hostname === 'vercel.com') throw new Error('R14 protected preview bootstrap failed');

    stage = 'login';
    await login(page, origin, email, password);

    stage = 'school-overview-navigation';
    await page.goto(`${origin}/?view=school-analytics-overview`, { waitUntil: 'networkidle', timeout: 45000 });
    await satisfyMfaIfRequired(page);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    stage = 'school-overview-ready';
    let body = await requireBodyToken(page, HIERARCHY[0], role, 'school');
    if (!body.toLowerCase().includes('programme')) throw new Error(`R14 ${role} school view missing programme context`);
    await page.screenshot({ path: `${DIR}/${role}-01-school.png`, fullPage: true });

    consoleErrors.length = 0;
    pageErrors.length = 0;
    failedResponses.length = 0;
    analyticsPayloads.length = 0;
    baseline = true;

    const levels = ['programme', 'grade', 'section', 'subject', 'chapter', 'topic'];
    for (let i = 0; i < HIERARCHY.length; i += 1) {
      const label = HIERARCHY[i];
      stage = `${levels[i]}-row:${label}`;
      await openHierarchyRow(page, label);
      if (i < HIERARCHY.length - 1) {
        const next = HIERARCHY[i + 1];
        stage = `${levels[i]}-token:${next}`;
        body = await requireBodyToken(page, next, role, levels[i]);
      }
      if (i === 2) await page.screenshot({ path: `${DIR}/${role}-02-section.png`, fullPage: true });
      if (i === 5) await page.screenshot({ path: `${DIR}/${role}-03-topic.png`, fullPage: true });
    }

    stage = 'payload-scope-verification';
    const scoped = analyticsPayloads.filter((payload) => payload?.school?.id === ORG_ID || payload?.actor?.organizationId === ORG_ID);
    if (scoped.length < 5) throw new Error(`R14 ${role} captured only ${scoped.length} scoped analytics payloads`);
    if (scoped.some((payload) => payload?.school?.id && payload.school.id !== ORG_ID)) throw new Error(`R14 ${role} received cross-school analytics payload`);

    const actor = scoped.find((payload) => payload?.actor)?.actor;
    const expectedActor = role === 'teacher' ? 'school_teacher' : 'school_admin';
    if (!actor || actor.role !== expectedActor || actor.organizationId !== ORG_ID) throw new Error(`R14 ${role} actor scope mismatch`);

    if (role === 'teacher') {
      if (!Array.isArray(actor.allowedSectionIds) || actor.allowedSectionIds.length < 1) throw new Error('R14 teacher missing assigned-section scope');
      if (!Array.isArray(actor.allowedSubjectLabels) || !actor.allowedSubjectLabels.some((value) => String(value).toLowerCase() === HIERARCHY[3].toLowerCase())) {
        throw new Error('R14 teacher missing Physics subject scope');
      }
    }

    if (consoleErrors.length || pageErrors.length || failedResponses.length) {
      throw new Error(`R14 ${role} rendered errors ${consoleErrors.length}/${pageErrors.length}/${failedResponses.length}`);
    }

    return {
      role,
      result: 'PASS',
      actorRole: actor.role,
      organizationId: actor.organizationId,
      capturedPayloads: analyticsPayloads.length,
      scopedPayloads: scoped.length,
      hierarchy: ['NEET', 'Grade 11', 'Section A (rendered as A)', 'Physics', 'Kinematics', 'Motion in One Dimension'],
      consoleErrorCount: 0,
      pageErrorCount: 0,
      failedResponseCount: 0,
    };
  } catch (error) {
    const body = await page.locator('body').innerText().catch(() => '');
    await page.screenshot({ path: `${DIR}/${role}-FAIL.png`, fullPage: true }).catch(() => {});
    await writeFile(`${DIR}/${role}-failure.json`, JSON.stringify({
      role,
      stage,
      url: page.url(),
      error: String(error?.message || error),
      bodyExcerpt: body.slice(0, 5000),
      capturedPayloads: analyticsPayloads.length,
      consoleErrors,
      pageErrors,
      failedResponses,
    }, null, 2) + '\n');
    throw new Error(`R14 ${role} failed at ${stage}: ${error?.message || error}`);
  } finally {
    await context.close();
  }
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== ACK || env('EVIDARA_ACCEPTANCE_ORG_SLUG') !== ORG_SLUG) throw new Error('R14 synthetic acceptance guard failed');
  const origin = previewOrigin(env('EVIDARA_ACCEPTANCE_URL'));
  const bypassSecret = env('VERCEL_AUTOMATION_BYPASS_SECRET');
  await mkdir(DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const schoolAdmin = await verifyRole(browser, origin, bypassSecret, 'school_admin', env('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_EMAIL'), env('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_PASSWORD'));
    const teacher = await verifyRole(browser, origin, bypassSecret, 'teacher', env('EVIDARA_ACCEPTANCE_TEACHER_EMAIL'), env('EVIDARA_ACCEPTANCE_TEACHER_PASSWORD'));
    const output = {
      result: 'PASS',
      acceptanceItem: 'R14',
      organizationSlug: ORG_SLUG,
      organizationId: ORG_ID,
      target: origin,
      schoolAdmin,
      teacher,
      productionProtected: true,
      secretsRecorded: false,
      capturedAt: new Date().toISOString(),
    };
    await writeFile(`${DIR}/r14-drilldown-results.json`, JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    await writeFile(`${DIR}/r14-drilldown-results.json`, JSON.stringify({ result: 'FAIL', error: String(error?.message || error), productionProtected: true, secretsRecorded: false }, null, 2) + '\n');
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(`R14 ACCEPTANCE FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
