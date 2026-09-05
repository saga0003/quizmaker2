#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const EVIDENCE_DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/r7-tagging';

function required(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function safeTarget(raw) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || !host.endsWith('.vercel.app') || !host.includes('quizmaker2') || host.includes('git-main')) {
    throw new Error(`R7 acceptance requires an isolated Evidara Vercel preview, received ${url.origin}`);
  }
  return url.origin;
}

function protectedBootstrap(target) {
  const raw = required('EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL');
  const url = new URL(raw);
  if (url.origin !== target || !url.searchParams.get('_vercel_share')) {
    throw new Error('Vercel share URL must exactly match the R7 preview origin and contain _vercel_share.');
  }
  return url.toString();
}

async function login(page, target, bootstrap, email, password) {
  await page.goto(bootstrap, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(500);
  await page.goto(`${target}/?view=login`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /^Sign In$/ }).click();
  await page.waitForFunction(() => {
    const url = new URL(window.location.href);
    return !document.body.innerText.includes('Sign in to Evidara') && (url.searchParams.get('view') || '').startsWith('school-');
  }, null, { timeout: 30_000 });
}

async function openQuestionBank(page, target) {
  await page.goto(`${target}/?view=school-questions`, { waitUntil: 'networkidle', timeout: 45_000 });
  await page.getByPlaceholder('Search question, option, answer, solution, image, school, topic or tag').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByText(/matching question/).waitFor({ state: 'visible', timeout: 30_000 });
}

async function searchQuestion(page, stem) {
  const search = page.getByPlaceholder('Search question, option, answer, solution, image, school, topic or tag');
  await search.fill(stem);
  await page.waitForTimeout(800);
  await page.getByText(stem, { exact: false }).first().waitFor({ state: 'visible', timeout: 20_000 });
}

async function chooseSearchable(page, currentText, nextText) {
  const trigger = page.getByRole('combobox').filter({ hasText: currentText }).first();
  await trigger.click();
  const option = page.getByText(nextText, { exact: true }).last();
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

async function chooseRadix(page, currentText, nextText) {
  const trigger = page.getByRole('combobox').filter({ hasText: currentText }).first();
  await trigger.click();
  const option = page.getByRole('option', { name: nextText, exact: true });
  await option.waitFor({ state: 'visible', timeout: 10_000 });
  await option.click();
}

async function editTagging(page, stem, config) {
  await searchQuestion(page, stem);
  await page.getByTitle('Edit question').first().click();
  await page.getByRole('heading', { name: 'Edit Question' }).waitFor({ state: 'visible', timeout: 20_000 });

  if (config.chapter && config.chapter !== 'Mechanics Fundamentals') {
    await chooseSearchable(page, 'Mechanics Fundamentals', config.chapter);
  }
  if (config.topic && config.topic !== 'Kinematics') {
    const currentTopic = config.chapter === 'Thermodynamics' ? 'Select or search topic' : 'Kinematics';
    await chooseSearchable(page, currentTopic, config.topic);
  }
  if (config.difficulty !== 'Moderate') {
    await chooseRadix(page, 'Moderate', config.difficulty);
  }

  await page.getByRole('button', { name: 'Save Question' }).click();
  await page.getByRole('heading', { name: 'Edit Question' }).waitFor({ state: 'hidden', timeout: 30_000 });
  await page.waitForTimeout(700);
}

async function setFilter(page, currentText, nextText) {
  const trigger = page.getByRole('combobox').filter({ hasText: currentText }).first();
  await trigger.click();
  await page.getByRole('option', { name: nextText, exact: true }).click();
  await page.waitForTimeout(700);
}

async function verifyVisible(page, stem, expectedFragments, name) {
  const row = page.getByRole('row').filter({ hasText: stem }).first();
  await row.waitFor({ state: 'visible', timeout: 20_000 });
  const text = await row.innerText();
  for (const fragment of expectedFragments) {
    if (!text.includes(fragment)) throw new Error(`${name}: expected row to contain ${fragment}`);
  }
  await page.screenshot({ path: `${EVIDENCE_DIR}/${name}.png`, fullPage: true });
  return text.slice(0, 1200);
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== REQUIRED_ACK) throw new Error('R7 safety acknowledgement is missing.');
  if (required('EVIDARA_ACCEPTANCE_ORG_SLUG') !== 'evidara-school-acceptance') throw new Error('R7 may run only against evidara-school-acceptance.');
  const target = safeTarget(required('EVIDARA_ACCEPTANCE_URL'));
  const bootstrap = protectedBootstrap(target);
  await mkdir(EVIDENCE_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });
  page.on('pageerror', (error) => pageErrors.push(String(error.message || error).slice(0, 500)));

  try {
    await login(page, target, bootstrap, required('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_EMAIL'), required('EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_PASSWORD'));
    await openQuestionBank(page, target);

    const rows = page.locator('tbody tr').filter({ has: page.getByTitle('Edit question') });
    await rows.first().waitFor({ state: 'visible', timeout: 30_000 });
    const stems = [];
    for (let index = 0; index < 3; index += 1) {
      const stem = (await rows.nth(index).locator('td').nth(1).locator('p').first().innerText()).trim();
      if (!stem) throw new Error(`Unable to capture synthetic question stem ${index + 1}.`);
      stems.push(stem);
    }

    await editTagging(page, stems[0], { chapter: 'Mechanics Fundamentals', topic: 'Kinematics', difficulty: 'Easy' });
    await page.getByPlaceholder('Search question, option, answer, solution, image, school, topic or tag').fill('');
    await page.waitForTimeout(700);
    await editTagging(page, stems[1], { chapter: 'Mechanics Fundamentals', topic: 'Laws of Motion', difficulty: 'Moderate' });
    await page.getByPlaceholder('Search question, option, answer, solution, image, school, topic or tag').fill('');
    await page.waitForTimeout(700);
    await editTagging(page, stems[2], { chapter: 'Thermodynamics', topic: 'Laws of Thermodynamics', difficulty: 'Difficult' });

    await openQuestionBank(page, target);
    await setFilter(page, 'All subjects', 'Physics');
    await setFilter(page, 'All chapters', 'Mechanics Fundamentals');
    await setFilter(page, 'All topics', 'Laws of Motion');
    const topicEvidence = await verifyVisible(page, stems[1], ['Physics', 'Mechanics Fundamentals', 'Laws of Motion', 'Moderate'], 'topic-filter');

    await openQuestionBank(page, target);
    await setFilter(page, 'All subjects', 'Physics');
    await setFilter(page, 'All chapters', 'Thermodynamics');
    await setFilter(page, 'All topics', 'Laws of Thermodynamics');
    await setFilter(page, 'All difficulty', 'Difficult');
    const difficultyEvidence = await verifyVisible(page, stems[2], ['Physics', 'Thermodynamics', 'Laws of Thermodynamics', 'Difficult'], 'difficulty-filter');

    await openQuestionBank(page, target);
    await setFilter(page, 'All subjects', 'Physics');
    await setFilter(page, 'All difficulty', 'Easy');
    const subjectEvidence = await verifyVisible(page, stems[0], ['Physics', 'Kinematics', 'Easy'], 'subject-filter');

    const result = {
      result: 'PASS',
      item: 'R7',
      target,
      organizationSlug: 'evidara-school-acceptance',
      productionProtected: true,
      mutations: [
        { stem: stems[0], subject: 'Physics', chapter: 'Mechanics Fundamentals', topic: 'Kinematics', difficulty: 'easy' },
        { stem: stems[1], subject: 'Physics', chapter: 'Mechanics Fundamentals', topic: 'Laws of Motion', difficulty: 'moderate' },
        { stem: stems[2], subject: 'Physics', chapter: 'Thermodynamics', topic: 'Laws of Thermodynamics', difficulty: 'difficult' },
      ],
      renderedFilterEvidence: { subjectEvidence, topicEvidence, difficultyEvidence },
      consoleErrorCount: consoleErrors.length,
      pageErrorCount: pageErrors.length,
      capturedAt: new Date().toISOString(),
      secretsRecorded: false,
    };
    if (pageErrors.length) throw new Error(`R7 captured ${pageErrors.length} page error(s).`);
    await writeFile(`${EVIDENCE_DIR}/r7-results.json`, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(async (error) => {
  await mkdir(EVIDENCE_DIR, { recursive: true }).catch(() => {});
  const failure = { result: 'FAIL', item: 'R7', error: error instanceof Error ? error.message : String(error), productionProtected: true, secretsRecorded: false, capturedAt: new Date().toISOString() };
  await writeFile(`${EVIDENCE_DIR}/r7-failure.json`, `${JSON.stringify(failure, null, 2)}\n`, 'utf8').catch(() => {});
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
});
