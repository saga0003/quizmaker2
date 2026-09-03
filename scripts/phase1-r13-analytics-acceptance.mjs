#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const ORG_SLUG = 'evidara-school-acceptance';
const ORG_ID = '4effce90-bccb-4263-9f5a-a75b6df301f2';
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

function shareBootstrap(origin) {
  const raw = (process.env.EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL || '').trim();
  if (!raw) return null;
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.origin !== origin || !url.searchParams.get('_vercel_share')) {
    throw new Error('R13 protected-preview share URL mismatch');
  }
  return url.toString();
}

function serviceClient() {
  const key = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!key) throw new Error('Missing server-side Supabase secret for guarded R13 release-mode transition');
  return createClient(env('NEXT_PUBLIC_SUPABASE_URL'), key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function assertAndSetMode(service, nextMode) {
  const { data: org, error: orgError } = await service.from('organizations').select('id,slug,name').eq('slug', ORG_SLUG).single();
  if (orgError) throw orgError;
  if (org.id !== ORG_ID || org.slug !== ORG_SLUG || org.name !== 'Evidara School') throw new Error('R13 isolated tenant identity mismatch');

  const { data: before, error: beforeError } = await service.from('question_papers').select('id,organization_id,title,result_mode').eq('id', PAPER_ID).single();
  if (beforeError) throw beforeError;
  if (before.organization_id !== ORG_ID || before.title !== PAPER_TITLE) throw new Error('R13 synthetic paper tenant/title mismatch');

  const { data: updated, error: updateError } = await service
    .from('question_papers')
    .update({ result_mode: nextMode })
    .eq('id', PAPER_ID)
    .eq('organization_id', ORG_ID)
    .select('id,organization_id,result_mode');
  if (updateError) throw updateError;
  if (!Array.isArray(updated) || updated.length !== 1 || updated[0].result_mode !== nextMode || updated[0].organization_id !== ORG_ID) {
    throw new Error(`R13 guarded result-mode transition failed: ${nextMode}`);
  }
}

async function studentContract(email, password) {
  const client = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: signIn, error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError) throw authError;
  const studentId = signIn.user?.id;
  if (!studentId) throw new Error('R13 synthetic student sign-in returned no user id');
  try {
    const { data: results, error: resultsError } = await client.rpc('list_my_attempt_results');
    if (resultsError) throw resultsError;
    const attempt = (results || []).find((row) => row.attempt_id === ATTEMPT_ID);
    if (!attempt || attempt.paper_id !== PAPER_ID || attempt.paper_title !== PAPER_TITLE) throw new Error('R13 synthetic attempt missing');
    const expectedAttempt = {
      result_mode: 'in_depth_analytics', result_release_level: 'analytics', result_released: true,
      score: 8, maximum_marks: 80, percentage: 10, correct_count: 2, incorrect_count: 0,
      unanswered_count: 18, answers_released: true, analytics_released: true,
    };
    for (const [key, value] of Object.entries(expectedAttempt)) {
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
      if (Number(row.questions) !== 20 || Number(row.correct) !== 2 || Number(row.incorrect) !== 0 || Number(row.unanswered) !== 18 || Number(row.accuracy) !== 100 || Number(row.average_percentage) !== 10) {
        throw new Error(`R13 ${label} analytics mismatch: ${JSON.stringify({questions:row.questions,correct:row.correct,incorrect:row.incorrect,unanswered:row.unanswered,accuracy:row.accuracy,average_percentage:row.average_percentage})}`);
      }
    }
    const evidence = (payload?.question_evidence || []).filter((row) => row.attempt_id === ATTEMPT_ID && row.topic_name === TOPIC);
    if (evidence.length !== 20) throw new Error(`R13 question evidence count mismatch: ${evidence.length}`);
    const correct = evidence.filter((row) => row.outcome === 'correct');
    const unanswered = evidence.filter((row) => row.outcome === 'unanswered');
    if (correct.length !== 2 || unanswered.length !== 18) throw new Error(`R13 question outcomes mismatch: ${correct.length} correct / ${unanswered.length} unanswered`);
    for (const q of [1, 2]) {
      const row = evidence.find((item) => Number(item.question_no) === q);
      if (!row || row.outcome !== 'correct' || Number(row.marks_awarded) !== 4 || row.subject_name !== SUBJECT || row.chapter_name !== CHAPTER || row.topic_name !== TOPIC) {
        throw new Error(`R13 Q${q} evidence mismatch`);
      }
    }
    return { attempt, payload, studentId };
  } finally {
    await client.auth.signOut().catch(() => {});
  }
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== ACK || (process.env.EVIDARA_ACCEPTANCE_ORG_SLUG || '').trim() !== ORG_SLUG) {
    throw new Error('R13 synthetic acceptance guard failed');
  }
  const origin = previewOrigin(env('EVIDARA_ACCEPTANCE_URL'));
  const share = shareBootstrap(origin);
  const email = env('EVIDARA_ACCEPTANCE_STUDENT_EMAIL');
  const password = env('EVIDARA_ACCEPTANCE_STUDENT_PASSWORD');
  const service = serviceClient();
  await mkdir(DIR, { recursive: true });

  let browser;
  let context;
  let page;
  const consoleErrors = [];
  const pageErrors = [];
  const failedResponses = [];
  let baseline = false;
  let switched = false;
  let contract;
  try {
    const { data: initialPaper, error: initialError } = await service.from('question_papers').select('result_mode,organization_id').eq('id', PAPER_ID).single();
    if (initialError) throw initialError;
    if (initialPaper.organization_id !== ORG_ID || initialPaper.result_mode !== 'score_only') throw new Error(`R13 requires synthetic paper at score_only baseline, found ${initialPaper.result_mode}`);

    await assertAndSetMode(service, 'in_depth_analytics');
    switched = true;
    contract = await studentContract(email, password);

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    page = await context.newPage();
    page.on('console', (message) => { if (baseline && message.type() === 'error') consoleErrors.push(message.text().slice(0, 500)); });
    page.on('pageerror', (error) => { if (baseline) pageErrors.push(String(error.message || error).slice(0, 500)); });
    page.on('response', (response) => {
      if (baseline && response.status() >= 400) {
        const url = new URL(response.url());
        failedResponses.push({ status: response.status(), method: response.request().method(), url: `${url.origin}${url.pathname}` });
      }
    });

    if (share) {
      await page.goto(share, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(500);
    }
    await page.goto(`${origin}/?view=login`, { waitUntil: 'networkidle', timeout: 45000 });
    if (new URL(page.url()).hostname === 'vercel.com') throw new Error('R13 protected preview bootstrap failed');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: /^Sign In$/ }).click();
    await page.waitForFunction(() => !document.body.innerText.includes('Sign in to Evidara') && new URL(location.href).searchParams.get('view')?.startsWith('student-'), null, { timeout: 30000 });

    baseline = true;
    await page.goto(`${origin}/?view=student-analytics-overview`, { waitUntil: 'networkidle', timeout: 45000 });
    await page.getByRole('heading', { name: 'How you performed' }).waitFor({ state: 'visible', timeout: 20000 });
    await page.getByText(SUBJECT, { exact: true }).first().waitFor({ state: 'visible', timeout: 20000 });
    let body = await page.locator('body').innerText();
    for (const token of ['10%', SUBJECT]) if (!body.includes(token)) throw new Error(`R13 overview missing ${token}`);
    await page.screenshot({ path: `${DIR}/01-overview.png`, fullPage: true });

    const subjectButton = page.locator('.analytics-v12-overview-subject-row').filter({ hasText: SUBJECT });
    if (await subjectButton.count() !== 1) throw new Error('R13 rendered Physics subject drill-down target missing');
    await subjectButton.click();
    await page.getByRole('heading', { name: 'Subject analysis' }).waitFor({ state: 'visible', timeout: 10000 });
    const chapterButton = page.locator('.analytics-v12-mastery-row').filter({ hasText: CHAPTER });
    await chapterButton.waitFor({ state: 'visible', timeout: 10000 });
    body = await page.locator('body').innerText();
    for (const token of [CHAPTER, '20', '2', '18', '100%', '10%']) if (!body.includes(token)) throw new Error(`R13 subject analytics missing ${token}`);
    await page.screenshot({ path: `${DIR}/02-subject.png`, fullPage: true });

    await chapterButton.click();
    await page.getByRole('heading', { name: 'Chapter analysis' }).waitFor({ state: 'visible', timeout: 10000 });
    const topicButton = page.locator('.analytics-v12-topic-mastery-detailed button').filter({ hasText: TOPIC });
    await topicButton.waitFor({ state: 'visible', timeout: 10000 });
    body = await page.locator('body').innerText();
    for (const token of [CHAPTER, TOPIC, '2 correct · 0 incorrect', '2 of 20 questions attempted']) if (!body.includes(token)) throw new Error(`R13 chapter analytics missing ${token}`);
    await page.screenshot({ path: `${DIR}/03-chapter.png`, fullPage: true });

    await topicButton.click();
    await page.getByRole('heading', { name: 'Topic analysis' }).waitFor({ state: 'visible', timeout: 10000 });
    body = await page.locator('body').innerText();
    for (const token of [SUBJECT, CHAPTER, TOPIC, '2 correct · 0 incorrect', 'Building evidence · n=2/5 answered']) if (!body.includes(token)) throw new Error(`R13 topic analytics missing ${token}`);
    await page.screenshot({ path: `${DIR}/04-topic.png`, fullPage: true });

    await page.getByRole('button', { name: /Open question intelligence/ }).click();
    await page.getByRole('heading', { name: 'Question intelligence' }).waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('heading', { name: TOPIC }).waitFor({ state: 'visible', timeout: 10000 });
    const evidence = page.locator('[data-f4-question-evidence]');
    await evidence.waitFor({ state: 'visible', timeout: 10000 });
    const evidenceText = await evidence.innerText();
    const renderedCorrect = (evidenceText.match(/\bCorrect\b/g) || []).length;
    const renderedUnanswered = (evidenceText.match(/\bUnanswered\b/g) || []).length;
    if (renderedCorrect !== 2 || renderedUnanswered !== 18) throw new Error(`R13 rendered question outcomes mismatch: ${renderedCorrect} correct / ${renderedUnanswered} unanswered`);
    for (const token of [`${PAPER_TITLE} · Q1`, `${PAPER_TITLE} · Q2`, '+4 marks', `${SUBJECT} · ${CHAPTER} · ${TOPIC}`]) {
      if (!evidenceText.includes(token)) throw new Error(`R13 question intelligence missing ${token}`);
    }
    body = await page.locator('body').innerText();
    if (!body.includes('20 outcomes')) throw new Error('R13 question intelligence missing 20-outcome reconciliation');
    await page.screenshot({ path: `${DIR}/05-question-intelligence.png`, fullPage: true });

    if (consoleErrors.length || pageErrors.length || failedResponses.length) {
      throw new Error(`Rendered errors ${consoleErrors.length}/${pageErrors.length}/${failedResponses.length}`);
    }

    const output = {
      result: 'PASS', acceptanceItem: 'R13', organizationSlug: ORG_SLUG, target: origin,
      paperId: PAPER_ID, attemptId: ATTEMPT_ID, releaseModeDuringProof: 'in_depth_analytics',
      baseline: { score: 8, maximumMarks: 80, percentage: 10, correct: 2, incorrect: 0, unanswered: 18 },
      taxonomy: { subject: SUBJECT, chapter: CHAPTER, topic: TOPIC, exposure: 20, attempted: 2, accuracy: 100, scorePercentage: 10 },
      questionEvidence: { outcomes: 20, correct: 2, unanswered: 18, q1Marks: 4, q2Marks: 4 },
      renderedDrilldownVerified: true, productionProtected: true, secretsRecorded: false,
      unexpectedConsoleErrorCount: 0, pageErrorCount: 0, failedResponseCount: 0, capturedAt: new Date().toISOString(),
    };
    await writeFile(`${DIR}/r13-analytics-results.json`, JSON.stringify(output, null, 2) + '\n');
    console.log(JSON.stringify(output, null, 2));
  } catch (error) {
    if (page) await page.screenshot({ path: `${DIR}/failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${DIR}/r13-analytics-results.json`, JSON.stringify({
      result: 'FAIL', error: String(error?.message || error), url: page?.url?.() || null,
      consoleErrors: consoleErrors.slice(0, 5), pageErrors: pageErrors.slice(0, 5), failedResponses: failedResponses.slice(0, 5),
      productionProtected: true, secretsRecorded: false,
    }, null, 2) + '\n');
    throw error;
  } finally {
    if (switched) {
      await assertAndSetMode(service, 'score_only');
      const { data: restored, error: restoreError } = await service.from('question_papers').select('result_mode,organization_id').eq('id', PAPER_ID).single();
      if (restoreError || restored?.organization_id !== ORG_ID || restored?.result_mode !== 'score_only') {
        throw new Error(`CRITICAL R13 restore verification failed: ${restoreError?.message || restored?.result_mode}`);
      }
      console.log('R13 restore verified: isolated synthetic paper returned to score_only.');
    }
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`R13 ANALYTICS ACCEPTANCE FAILED: ${error?.message || error}`);
  process.exit(1);
});
