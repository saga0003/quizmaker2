#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const ORG_SLUG = 'evidara-school-acceptance';
const PAPER_ID = 'e5801a88-1e7f-4b4f-a715-ad44ce2b3c43';
const PAPER_TITLE = 'Phase 1 R8 Physics Acceptance Test';
const ATTEMPT_ID = '134ddbe2-bc9f-4863-9aba-3b9def08d69e';
const SUBJECT = 'Physics';
const CHAPTER = 'Kinematics';
const TOPIC = 'Motion in One Dimension';
const DIR = process.env.EVIDARA_ACCEPTANCE_EVIDENCE_DIR || 'acceptance-evidence/r13-analytics';
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
    throw new Error(`R13 protected-preview guard failed: ${host}`);
  }
  return url.origin;
}

function publicClient() {
  return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function reconcileStudentContract(email, password) {
  const client = publicClient();
  const { data: signIn, error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const studentId = signIn.user?.id;
  if (!studentId) throw new Error('R13 synthetic student sign-in returned no user id');
  try {
    const { data: results, error: resultsError } = await client.rpc('list_my_attempt_results');
    if (resultsError) throw resultsError;
    const attempt = (results || []).find((row) => row.attempt_id === ATTEMPT_ID);
    if (!attempt || attempt.paper_id !== PAPER_ID || attempt.paper_title !== PAPER_TITLE) throw new Error('R13 synthetic attempt missing');
    const expected = {
      result_mode: 'in_depth_analytics', result_release_level: 'analytics', result_released: true,
      score: 8, maximum_marks: 80, percentage: 10, correct_count: 2, incorrect_count: 0,
      unanswered_count: 18, answers_released: true, analytics_released: true,
    };
    for (const [key, value] of Object.entries(expected)) {
      if (attempt[key] !== value) throw new Error(`R13 result contract mismatch for ${key}: ${JSON.stringify(attempt[key])}`);
    }

    const { data: payload, error: analyticsError } = await client.rpc('get_student_analytics_v12', {
      p_student_id: studentId, p_product_id: null, p_date_from: null, p_date_to: null,
    });
    if (analyticsError) throw analyticsError;
    const history = (payload?.history || []).find((row) => row.attempt_id === ATTEMPT_ID);
    if (!history || Number(history.score) !== 8 || Number(history.maximum_marks) !== 80 || Number(history.percentage) !== 10 || Number(history.correct) !== 2 || Number(history.incorrect) !== 0 || Number(history.unanswered) !== 18) {
      throw new Error('R13 analytics history does not reconcile to authoritative attempt baseline');
    }
    const subject = (payload?.subjects || []).find((row) => row.name === SUBJECT);
    const chapter = (payload?.chapters || []).find((row) => row.name === CHAPTER);
    const topic = (payload?.topics || []).find((row) => row.name === TOPIC);
    for (const [label, row] of [['subject', subject], ['chapter', chapter], ['topic', topic]]) {
      if (!row) throw new Error(`R13 ${label} taxonomy analytics missing`);
      const actual = { questions: Number(row.questions), correct: Number(row.correct), incorrect: Number(row.incorrect), unanswered: Number(row.unanswered), accuracy: Number(row.accuracy), average_percentage: Number(row.average_percentage) };
      const wanted = { questions: 60, correct: 5, incorrect: 0, unanswered: 55, accuracy: 100, average_percentage: 8.3 };
      for (const [key, value] of Object.entries(wanted)) if (actual[key] !== value) throw new Error(`R13 ${label} ${key} mismatch: ${actual[key]} != ${value}`);
    }
  } finally {
    await client.auth.signOut().catch(() => {});
  }
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== ACK || env('EVIDARA_ACCEPTANCE_ORG_SLUG') !== ORG_SLUG) throw new Error('R13 synthetic acceptance guard failed');
  const origin = previewOrigin(env('EVIDARA_ACCEPTANCE_URL'));
  const bypass = env('VERCEL_AUTOMATION_BYPASS_SECRET');
  const email = env('EVIDARA_ACCEPTANCE_STUDENT_EMAIL');
  const password = env('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD');
  await mkdir(DIR, { recursive: true });

  let browser;
  let context;
  let page;
  let baseline = false;
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  try {
    await reconcileStudentContract(email, password);
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      extraHTTPHeaders: { 'x-vercel-protection-bypass': bypass },
    });
    page = await context.newPage();
    page.on('console', (message) => { if (baseline && message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });
    page.on('pageerror', (error) => { if (baseline) pageErrors.push(String(error.message || error).slice(0, 500)); });
    page.on('response', (response) => { if (baseline && response.status() >= 400) { const url = new URL(response.url()); failedResponses.push({ status: response.status(), method: response.request().method(), url: `${url.origin}${url.pathname}` }); } });

    await page.goto(`${origin}/?view=login`, { waitUntil: 'networkidle', timeout: 45000 });
    if (new URL(page.url()).hostname === 'vercel.com') throw new Error('R13 protected preview automation bypass failed');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /^Sign In$/ }).click();
    await page.waitForFunction(() => !document.body.innerText.includes('Sign in to Evidara') && new URL(location.href).searchParams.get('view')?.startsWith('student-'), null, { timeout: 30000 });

    baseline = true;
    await page.goto(`${origin}/?view=student-analytics-overview`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.getByRole('heading', { name: 'How you performed' }).waitFor({ state: 'visible', timeout: 20000 });
    const physics = page.locator('.analytics-v12-overview-subject-row').filter({ hasText: SUBJECT });
    await physics.waitFor({ state: 'visible', timeout: 20000 });
    let body = await page.locator('body').innerText();
    if (!body.includes(SUBJECT) || (!body.includes('10 / 100') && !body.includes('10%'))) throw new Error('R13 overview rendered baseline missing');
    await page.screenshot({ path: `${DIR}/01-overview.png`, fullPage: true });

    await physics.click();
    await page.getByRole('heading', { name: 'Subject analysis' }).waitFor({ state: 'visible', timeout: 10000 });
    const chapter = page.getByRole('button', { name: new RegExp(CHAPTER, 'i') }).first();
    await chapter.waitFor({ state: 'visible', timeout: 10000 });
    body = await page.locator('body').innerText();
    for (const token of [SUBJECT, CHAPTER, '5 correct', '100%']) if (!body.includes(token)) throw new Error(`R13 subject analytics missing ${token}`);
    await page.screenshot({ path: `${DIR}/02-subject.png`, fullPage: true });

    await chapter.click();
    await page.getByRole('heading', { name: 'Chapter analysis' }).waitFor({ state: 'visible', timeout: 10000 });
    const topic = page.locator('.analytics-v12-topic-mastery-detailed button').filter({ hasText: TOPIC });
    await topic.waitFor({ state: 'visible', timeout: 10000 });
    body = await page.locator('body').innerText();
    for (const token of [CHAPTER, TOPIC, '5 correct · 0 incorrect', '5 of 60 questions attempted', 'n=5 answered']) if (!body.includes(token)) throw new Error(`R13 chapter analytics missing ${token}`);
    await page.screenshot({ path: `${DIR}/03-chapter.png`, fullPage: true });

    await topic.click();
    await page.getByRole('heading', { name: 'Topic analysis' }).waitFor({ state: 'visible', timeout: 10000 });
    body = await page.locator('body').innerText();
    for (const token of [SUBJECT, CHAPTER, TOPIC, '5 correct · 0 incorrect', 'n=5 answered · 60 exposed']) if (!body.includes(token)) throw new Error(`R13 topic analytics missing ${token}`);
    await page.screenshot({ path: `${DIR}/04-topic.png`, fullPage: true });

    await page.getByRole('button', { name: /Open question intelligence/ }).click();
    await page.getByRole('heading', { name: 'Question intelligence' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('heading', { name: TOPIC }).waitFor({ state: 'visible', timeout: 10000 });
    const evidence = page.locator('[data-f4-question-evidence]');
    await evidence.waitFor({ state: 'visible', timeout: 10000 });
    const evidenceText = await evidence.innerText();
    const renderedCorrect = (evidenceText.match(/\bCorrect\b/g) || []).length;
    const renderedUnanswered = (evidenceText.match(/\bUnanswered\b/g) || []).length;
    if (renderedCorrect !== 5 || renderedUnanswered !== 55) throw new Error(`R13 rendered question outcomes mismatch: ${renderedCorrect} correct / ${renderedUnanswered} unanswered`);
    for (const token of [`${PAPER_TITLE} · Q1`, `${PAPER_TITLE} · Q2`, '+4 marks', `${SUBJECT} · ${CHAPTER} · ${TOPIC}`]) if (!evidenceText.includes(token)) throw new Error(`R13 question intelligence missing ${token}`);
    body = await page.locator('body').innerText();
    if (!body.includes('60 outcomes')) throw new Error('R13 question intelligence missing 60-outcome reconciliation');
    await page.screenshot({ path: `${DIR}/05-question-intelligence.png`, fullPage: true });

    if (consoleErrors.length || pageErrors.length || failedResponses.length) throw new Error(`Rendered errors ${consoleErrors.length}/${pageErrors.length}/${failedResponses.length}`);
    const output = {
      result: 'PASS', acceptanceItem: 'R13', organizationSlug: ORG_SLUG, target: origin,
      paperId: PAPER_ID, attemptId: ATTEMPT_ID, releaseModeDuringProof: 'in_depth_analytics',
      baseline: { score: 8, maximumMarks: 80, percentage: 10, correct: 2, incorrect: 0, unanswered: 18 },
      taxonomy: { subject: SUBJECT, chapter: CHAPTER, topic: TOPIC, exposure: 60, attempted: 5, accuracy: 100, scorePercentage: 8.3 },
      questionEvidence: { aggregateOutcomes: 60, aggregateCorrect: 5, aggregateUnanswered: 55 },
      renderedDrilldownVerified: true, authoritativeDatabaseReconciliationPerformedExternally: true,
      productionProtected: true, secretsRecorded: false,
      unexpectedConsoleErrorCount: 0, pageErrorCount: 0, failedResponseCount: 0, capturedAt: new Date().toISOString(),
    };
    await writeFile(`${DIR}/r13-analytics-results.json`, JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    if (page) await page.screenshot({ path: `${DIR}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${DIR}/r13-analytics-results.json`, JSON.stringify({ result: 'FAIL', error: String(error?.message || error), url: page?.url?.() || null, consoleErrors: consoleErrors.slice(0, 5), pageErrors: pageErrors.slice(0, 5), failedResponses: failedResponses.slice(0, 5), productionProtected: true, secretsRecorded: false }, null, 2) + '\n');
    throw error;
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`R13 RENDERED ACCEPTANCE FAILED: ${error?.message || error}`);
  process.exit(1);
});
