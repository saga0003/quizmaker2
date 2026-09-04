#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const ORG_SLUG = 'evidara-school-acceptance';
const ORG_ID = '4effce90-bccb-4263-9f5a-a75b6df301f2';
const PROGRAMME = 'NEET';
const GRADE = 'Grade 11';
const SECTION = 'Section A';
const SUBJECT = 'Physics';
const CHAPTER = 'Kinematics';
const TOPIC = 'Motion in One Dimension';
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
  if (url.protocol !== 'https:' || PROD_HOSTS.has(host) || host.includes('git-main') || !host.endsWith('.vercel.app') || !host.includes('quizmaker2')) throw new Error(`R14 preview guard failed: ${host}`);
  return url.origin;
}

async function login(page, email, password) {
  await page.goto(`${page._r14Origin}/?view=login`, { waitUntil: 'networkidle', timeout: 45000 });
  if (new URL(page.url()).hostname === 'vercel.com') throw new Error('R14 protected preview bootstrap failed');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Sign in to Evidara') && new URL(location.href).searchParams.get('view')?.startsWith('school-'), null, { timeout: 30000 });
}

async function openNamedButton(page, label, expectedHeading) {
  const button = page.getByRole('button', { name: new RegExp(label, 'i') }).first();
  await button.waitFor({ state: 'visible', timeout: 15000 });
  await button.click();
  if (expectedHeading) await page.getByRole('heading', { name: expectedHeading }).waitFor({ state: 'visible', timeout: 15000 });
}

async function verifyRole(browser, origin, bypassSecret, role, email, password) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'x-vercel-protection-bypass': bypassSecret },
  });
  const page = await context.newPage();
  page._r14Origin = origin;
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  const analyticsPayloads = [];
  let baseline = false;
  page.on('console', (m) => { if (baseline && m.type() === 'error') consoleErrors.push(m.text().slice(0, 500)); });
  page.on('pageerror', (e) => { if (baseline) pageErrors.push(String(e.message || e).slice(0, 500)); });
  page.on('response', async (response) => {
    if (!baseline) return;
    const u = new URL(response.url());
    if (response.status() >= 400) failedResponses.push({ status: response.status(), path: u.pathname });
    if (u.pathname === '/api/institution-analytics' && response.ok()) {
      try { analyticsPayloads.push(await response.json()); } catch {}
    }
  });

  try {
    await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (new URL(page.url()).hostname === 'vercel.com') throw new Error('R14 protected preview bootstrap failed');
    await login(page, email, password);
    baseline = true;
    await page.goto(`${origin}/?view=school-analytics-overview`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.getByRole('heading', { name: /Evidara School programmes/i }).waitFor({ state: 'visible', timeout: 20000 });
    let body = await page.locator('body').innerText();
    for (const token of ['Drill down from school to programme, grade, section, subject, chapter, topic and individual student evidence.', PROGRAMME]) if (!body.includes(token)) throw new Error(`R14 ${role} school view missing ${token}`);
    await page.screenshot({ path: `${DIR}/${role}-01-school.png`, fullPage: true });

    await openNamedButton(page, PROGRAMME, new RegExp(`${PROGRAMME} grades`, 'i'));
    body = await page.locator('body').innerText();
    if (!body.includes(GRADE)) throw new Error(`R14 ${role} programme view missing ${GRADE}`);
    await openNamedButton(page, GRADE, /Grade 11 sections/i);
    body = await page.locator('body').innerText();
    if (!body.includes(SECTION)) throw new Error(`R14 ${role} grade view missing ${SECTION}`);
    await openNamedButton(page, SECTION, /Section A performance/i);
    body = await page.locator('body').innerText();
    if (!body.includes(SUBJECT)) throw new Error(`R14 ${role} section view missing ${SUBJECT}`);
    await page.screenshot({ path: `${DIR}/${role}-02-section.png`, fullPage: true });

    await openNamedButton(page, SUBJECT, /Physics chapter analysis/i);
    body = await page.locator('body').innerText();
    if (!body.includes(CHAPTER)) throw new Error(`R14 ${role} subject view missing ${CHAPTER}`);
    await openNamedButton(page, CHAPTER, /Kinematics topic analysis/i);
    body = await page.locator('body').innerText();
    if (!body.includes(TOPIC)) throw new Error(`R14 ${role} chapter view missing ${TOPIC}`);
    await openNamedButton(page, TOPIC, /Motion in One Dimension student evidence/i);
    await page.screenshot({ path: `${DIR}/${role}-03-topic.png`, fullPage: true });

    const scoped = analyticsPayloads.filter((p) => p?.school?.id === ORG_ID || p?.actor?.organizationId === ORG_ID);
    if (scoped.length < 6) throw new Error(`R14 ${role} captured only ${scoped.length} scoped analytics payloads`);
    if (scoped.some((p) => p?.school?.id && p.school.id !== ORG_ID)) throw new Error(`R14 ${role} received cross-school analytics payload`);
    const actor = scoped.find((p) => p?.actor)?.actor;
    const expectedActor = role === 'teacher' ? 'school_teacher' : 'school_admin';
    if (!actor || actor.role !== expectedActor || actor.organizationId !== ORG_ID) throw new Error(`R14 ${role} actor scope mismatch`);
    if (role === 'teacher') {
      if (!Array.isArray(actor.allowedSectionIds) || actor.allowedSectionIds.length < 1) throw new Error('R14 teacher missing assigned-section scope');
      if (!Array.isArray(actor.allowedSubjectLabels) || !actor.allowedSubjectLabels.some((x) => String(x).toLowerCase() === SUBJECT.toLowerCase())) throw new Error('R14 teacher missing Physics subject scope');
    }
    if (consoleErrors.length || pageErrors.length || failedResponses.length) throw new Error(`R14 ${role} rendered errors ${consoleErrors.length}/${pageErrors.length}/${failedResponses.length}`);
    return { role, result: 'PASS', actorRole: actor.role, organizationId: actor.organizationId, capturedPayloads: analyticsPayloads.length, scopedPayloads: scoped.length, hierarchy: [PROGRAMME, GRADE, SECTION, SUBJECT, CHAPTER, TOPIC], consoleErrorCount: 0, pageErrorCount: 0, failedResponseCount: 0 };
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
    const admin = await verifyRole(browser, origin, bypassSecret, 'school_admin', env('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_EMAIL'), env('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_PASSWORD'));
    const teacher = await verifyRole(browser, origin, bypassSecret, 'teacher', env('EVIDARA_ACCEPTANCE_TEACHER_EMAIL'), env('EVIDARA_ACCEPTANCE_TEACHER_PASSWORD'));
    const output = { result: 'PASS', acceptanceItem: 'R14', organizationSlug: ORG_SLUG, organizationId: ORG_ID, target: origin, schoolAdmin: admin, teacher, productionProtected: true, secretsRecorded: false, capturedAt: new Date().toISOString() };
    await writeFile(`${DIR}/r14-drilldown-results.json`, JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    await writeFile(`${DIR}/r14-drilldown-results.json`, JSON.stringify({ result: 'FAIL', error: String(error?.message || error), productionProtected: true, secretsRecorded: false }, null, 2) + '\n');
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch((error) => { console.error(`R14 ACCEPTANCE FAILED: ${error instanceof Error ? error.message : String(error)}`); process.exit(1); });
