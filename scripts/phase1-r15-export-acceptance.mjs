#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import ExcelJS from 'exceljs';
import { chromium } from 'playwright';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const ORG_SLUG = 'evidara-school-acceptance';
const ORG_ID = '4effce90-bccb-4263-9f5a-a75b6df301f2';
const HIERARCHY = ['NEET', 'Grade 11', 'A'];
const EXPECTED_SHEETS = ['Results', 'Test Results', 'Subject Analytics', 'Chapter Analytics', 'Topic Analytics'];
const DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/r15-export';
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
    throw new Error(`R15 preview guard failed: ${host}`);
  }
  return url.origin;
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = String(value || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
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

async function satisfyMfaIfRequired(page, state) {
  const body = await page.locator('body').innerText().catch(() => '');
  if (!body.includes('Multi-factor verification required')) return false;
  const match = body.match(/setup key:\s*([A-Z2-7\s]+)/i);
  if (match?.[1]) state.secret = match[1].replace(/\s+/g, '');
  if (!state.secret) throw new Error('R15 synthetic MFA challenge has no in-memory setup key');
  const input = page.getByLabel(/6-digit authenticator code/i).or(page.locator('input[inputmode="numeric"]')).first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(totp(state.secret));
  await page.getByRole('button', { name: /Verify and unlock Evidara/i }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Multi-factor verification required'), null, { timeout: 20000 });
  return true;
}

async function login(page, origin, email, password, mfaState) {
  await page.goto(`${origin}/?view=login`, { waitUntil: 'networkidle', timeout: 45000 });
  if (new URL(page.url()).hostname === 'vercel.com') throw new Error('R15 protected preview bootstrap failed');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await page.waitForFunction(() => !document.body.innerText.includes('Sign in to Evidara') && new URL(location.href).searchParams.get('view')?.startsWith('school-'), null, { timeout: 30000 });
  await satisfyMfaIfRequired(page, mfaState);
}

async function waitForExactVisible(page, token, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const loading = await page.getByText('Calculating analytics…', { exact: true }).isVisible().catch(() => false);
    if (!loading) {
      const target = token === 'A' ? page.getByRole('cell', { name: 'A', exact: true }) : page.getByText(token, { exact: true });
      const count = await target.count();
      for (let i = 0; i < count; i += 1) if (await target.nth(i).isVisible().catch(() => false)) return true;
    }
    await page.waitForTimeout(100);
  }
  return false;
}

async function openHierarchyRow(page, label, nextToken) {
  const cell = page.getByRole('cell', { name: label, exact: true });
  const rows = page.getByRole('row').filter({ has: cell });
  for (let i = 0; i < await rows.count(); i += 1) {
    const row = rows.nth(i);
    if (!(await row.isVisible().catch(() => false))) continue;
    await row.click();
    if (!nextToken || await waitForExactVisible(page, nextToken)) return;
  }
  const text = page.getByText(label, { exact: true });
  for (let i = 0; i < await text.count(); i += 1) {
    if (!(await text.nth(i).isVisible().catch(() => false))) continue;
    const button = text.nth(i).locator('xpath=ancestor::button[1]');
    if (await button.count()) {
      await button.first().click();
      if (!nextToken || await waitForExactVisible(page, nextToken)) return;
    }
  }
  throw new Error(`R15 hierarchy control ${label} failed to render ${nextToken || 'section analytics'}`);
}

function sheetRows(sheet) {
  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row) => rows.push(row.values.slice(1).map((v) => String(v ?? ''))));
  return rows;
}

function includesToken(rows, token) {
  return rows.some((row) => row.some((cell) => cell.toLowerCase().includes(token.toLowerCase())));
}

async function main() {
  if (env('EVIDARA_LOAD_ACCEPTANCE') !== ACK) throw new Error('R15 non-production acknowledgement missing');
  if (env('EVIDARA_ACCEPTANCE_MODE') !== 'same-project-isolated-tenant') throw new Error('R15 acceptance mode mismatch');
  if (env('EVIDARA_ACCEPTANCE_ORG_SLUG') !== ORG_SLUG) throw new Error('R15 tenant guard mismatch');
  if (env('EVIDARA_ACCEPTANCE_SUPABASE_REF') !== 'xzfozpnzvznqrvcsoail') throw new Error('R15 Supabase project guard mismatch');
  const bytes = Number(env('EVIDARA_ACCEPTANCE_DB_BYTES'));
  if (!Number.isFinite(bytes) || bytes >= 450 * 1024 * 1024) throw new Error(`R15 database-size guard failed: ${bytes}`);

  const origin = previewOrigin(env('EVIDARA_ACCEPTANCE_URL'));
  const bypass = env('VERCEL_AUTOMATION_BYPASS_SECRET');
  const email = env('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_EMAIL');
  const password = env('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_PASSWORD');
  await mkdir(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });
  await context.route(`${origin}/**`, async (route) => route.continue({ headers: { ...route.request().headers(), 'x-vercel-protection-bypass': bypass } }));
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  let baseline = false;
  page.on('console', (m) => { if (baseline && m.type() === 'error') consoleErrors.push(m.text().slice(0, 500)); });
  page.on('pageerror', (e) => { if (baseline) pageErrors.push(String(e.message || e).slice(0, 500)); });
  page.on('response', (r) => { if (baseline && r.status() >= 400) failedResponses.push({ status: r.status(), path: new URL(r.url()).pathname }); });

  const mfaState = { secret: null };
  try {
    await login(page, origin, email, password, mfaState);
    await page.goto(`${origin}/?view=school-analytics-overview`, { waitUntil: 'networkidle', timeout: 45000 });
    await satisfyMfaIfRequired(page, mfaState);
    if (!await waitForExactVisible(page, HIERARCHY[0], 30000)) throw new Error('R15 School Admin analytics hierarchy did not render NEET');
    baseline = true;

    await openHierarchyRow(page, HIERARCHY[0], HIERARCHY[1]);
    await openHierarchyRow(page, HIERARCHY[1], HIERARCHY[2]);
    await openHierarchyRow(page, HIERARCHY[2], null);
    await page.getByText('Student performance', { exact: true }).waitFor({ state: 'visible', timeout: 30000 });
    await page.getByRole('button', { name: /Download Excel/i }).waitFor({ state: 'visible', timeout: 10000 });
    await page.screenshot({ path: `${DIR}/r15-section-before-export.png`, fullPage: true });

    const downloadPromise = page.waitForEvent('download', { timeout: 150000 });
    await page.getByRole('button', { name: /Download Excel/i }).click();
    const download = await downloadPromise;
    const filename = download.suggestedFilename();
    if (!filename.toLowerCase().endsWith('.xlsx')) throw new Error(`R15 expected .xlsx, got ${filename}`);
    const path = `${DIR}/${filename}`;
    await download.saveAs(path);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(path);
    const names = workbook.worksheets.map((sheet) => sheet.name);
    for (const expected of EXPECTED_SHEETS) if (!names.includes(expected)) throw new Error(`R15 workbook missing sheet: ${expected}`);

    const results = sheetRows(workbook.getWorksheet('Results'));
    const tests = sheetRows(workbook.getWorksheet('Test Results'));
    const subjects = sheetRows(workbook.getWorksheet('Subject Analytics'));
    const chapters = sheetRows(workbook.getWorksheet('Chapter Analytics'));
    const topics = sheetRows(workbook.getWorksheet('Topic Analytics'));

    if (results.length < 2) throw new Error('R15 Results sheet contains no student data rows');
    if (tests.length < 2) throw new Error('R15 Test Results sheet contains no submitted test row');
    if (!includesToken(tests, 'Phase 1 R8 Physics Acceptance Test')) throw new Error('R15 Test Results missing acceptance test');
    if (!includesToken(subjects, 'Physics')) throw new Error('R15 Subject Analytics missing Physics');
    if (!includesToken(chapters, 'Kinematics')) throw new Error('R15 Chapter Analytics missing Kinematics');
    if (!includesToken(topics, 'Motion in One Dimension')) throw new Error('R15 Topic Analytics missing Motion in One Dimension');
    if (!includesToken(results, 'A')) throw new Error('R15 Results missing Section A evidence');

    if (consoleErrors.length || pageErrors.length || failedResponses.length) {
      throw new Error(`R15 browser errors: console=${consoleErrors.length}, page=${pageErrors.length}, http=${failedResponses.length}`);
    }

    const evidence = {
      status: 'PASS', tenant: ORG_SLUG, organizationId: ORG_ID, origin, filename,
      sheets: names,
      rowCounts: { results: results.length - 1, testResults: tests.length - 1, subjects: subjects.length - 1, chapters: chapters.length - 1, topics: topics.length - 1 },
      assertions: ['xlsx downloaded', 'workbook opened', 'Results populated', 'Test Results populated', 'Physics present', 'Kinematics present', 'Motion in One Dimension present'],
      browser: { consoleErrors: 0, pageErrors: 0, failedResponses: 0 },
    };
    await writeFile(`${DIR}/r15-evidence.json`, JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
  } catch (error) {
    await page.screenshot({ path: `${DIR}/r15-failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${DIR}/r15-failure.json`, JSON.stringify({ status: 'FAIL', message: String(error?.message || error), url: page.url(), consoleErrors, pageErrors, failedResponses }, null, 2)).catch(() => {});
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

await main();
