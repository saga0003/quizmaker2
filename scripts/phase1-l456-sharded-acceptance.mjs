#!/usr/bin/env node

import { writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';

const ORIGIN = 'https://xzfozpnzvznqrvcsoail.supabase.co';
const TENANT = 'evidara-school-acceptance';
const ORG_ID = '4effce90-bccb-4263-9f5a-a75b6df301f2';
const PAPER_ID = 'e5801a88-1e7f-4b4f-a715-ad44ce2b3c43';
const SHARDS = 20;
const PER_SHARD = 25;
const TOTAL = SHARDS * PER_SHARD;
const OLD_START = 101;
const RETRY_SAMPLE = 2;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const ACCEPTANCE_RPC_CONCURRENCY = 2;
const BUDGETS = Object.freeze({
  start: { maxFailureRate: 0.01, maxP95Ms: 5000, maxP99Ms: 10000 },
  save: { maxFailureRate: 0.01, maxP95Ms: 3000, maxP99Ms: 6000 },
  submit: { maxFailureRate: 0.01, maxP95Ms: 8000, maxP99Ms: 15000 },
});

const shard = Number.parseInt(process.env.SHARD_INDEX ?? '', 10);
const barrierEpochMs = Number.parseInt(process.env.BARRIER_EPOCH_MS ?? '', 10);
const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
const studentPassword = process.env.EVIDARA_ACCEPTANCE_STUDENT_PASSWORD ?? '';
const adminEmail = process.env.EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_EMAIL ?? '';
const adminPassword = process.env.EVIDARA_ACCEPTANCE_SCHOOL_ADMIN_PASSWORD ?? '';
const candidateSha = process.env.CANDIDATE_SHA ?? '';
const outPath = process.env.EVIDENCE_OUT ?? `phase1-l456-shard-${String(shard).padStart(2, '0')}.json`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const percentile = (values, p) => {
  const s = [...values].sort((a, b) => a - b);
  return s.length ? Math.round(s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)] * 100) / 100 : null;
};

async function mapWithConcurrency(items, limit, fn) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('invalid concurrency limit');
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function guards() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY') throw new Error('non-production load acknowledgement missing');
  if (process.env.EVIDARA_ACCEPTANCE_TENANT !== TENANT) throw new Error('wrong tenant');
  if (process.env.GITHUB_REF_NAME && process.env.GITHUB_REF_NAME !== 'phase1-hardening') throw new Error('wrong branch');
  if (!Number.isInteger(shard) || shard < 0 || shard >= SHARDS) throw new Error('invalid shard index');
  if (!Number.isFinite(barrierEpochMs) || barrierEpochMs < Date.now() - 30_000) throw new Error('invalid or stale barrier');
  if (!/^[0-9a-f]{40}$/.test(candidateSha)) throw new Error('candidate SHA invalid');
  if (!key || !studentPassword || !adminEmail || !adminPassword) throw new Error('acceptance credentials/key missing');
  if (studentPassword.length < 8) throw new Error('acceptance password too short');
}

async function measured(url, init) {
  const started = performance.now();
  try {
    const res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const text = await res.text();
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > MAX_RESPONSE_BYTES) throw new Error('ResponseTooLarge');
    return { ok: res.ok, status: res.status, latencyMs: performance.now() - started, text, bytes, error: null };
  } catch (e) {
    return { ok: false, status: 0, latencyMs: performance.now() - started, text: '', bytes: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

const headers = (token) => ({ apikey: key, authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'evidara-phase1-l456-sharded/1' });
const rpc = (token, name, body) => measured(`${ORIGIN}/rest/v1/rpc/${name}`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });

async function passwordSignIn(email, password) {
  const r = await measured(`${ORIGIN}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: key, 'content-type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  if (!r.ok) throw new Error(`sign-in failed (${r.status})`);
  const body = JSON.parse(r.text);
  if (!body.access_token || body.user?.email !== email) throw new Error('sign-in identity mismatch');
  return { token: body.access_token, userId: body.user.id };
}

async function signupSynthetic(index) {
  const local = `phase1-l456-student-${String(index).padStart(4, '0')}`;
  const email = `${local}@evidara.invalid`;
  const r = await measured(`${ORIGIN}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: JSON.stringify({
      email,
      password: studentPassword,
      data: { full_name: local, username: `${local}-${candidateSha.slice(0, 6)}`, phase1_load: true, phase1_l456: true, acceptance_org: TENANT, synthetic_index: index },
    }),
  });
  if (r.ok) {
    const body = JSON.parse(r.text);
    if (body.access_token && body.user?.id) return { actorIndex: index, userId: body.user.id, token: body.access_token };
  }
  // Idempotent retry path for an already-created synthetic identity from a prior interrupted run.
  const signed = await passwordSignIn(email, studentPassword);
  return { actorIndex: index, ...signed };
}

async function main() {
  guards();
  const admin = await passwordSignIn(adminEmail, adminPassword);
  const rosterResult = await rpc(admin.token, 'list_school_student_lifecycle_v13', { p_organization_id: ORG_ID });
  if (!rosterResult.ok) throw new Error(`roster preflight failed (${rosterResult.status})`);
  const roster = JSON.parse(rosterResult.text);
  if (roster.organizationId !== ORG_ID || roster.manager !== true) throw new Error('admin roster scope mismatch');

  const oldIndices = Array.from({ length: PER_SHARD }, (_, i) => OLD_START + shard * PER_SHARD + i);
  const oldNames = new Set(oldIndices.map((i) => `phase1-load-student-${String(i).padStart(4, '0')}`));
  const oldMemberships = (roster.students ?? []).filter((s) => oldNames.has(s.name));
  if (oldMemberships.length !== PER_SHARD || oldMemberships.some((s) => s.status !== 'active')) throw new Error(`expected ${PER_SHARD} active old synthetic memberships`);

  const newIndices = Array.from({ length: PER_SHARD }, (_, i) => 1 + shard * PER_SHARD + i);
  const actors = [];
  let oldSuspended = false;
  let newMembershipsAdded = false;
  let workloadError = null;
  let cleanupError = null;
  const evidence = {
    schemaVersion: 2, candidateSha, tenant: TENANT, shard, shardCount: SHARDS, perShard: PER_SHARD,
    actorRange: [newIndices[0], newIndices.at(-1)], startedAt: new Date().toISOString(), barrierEpochMs,
    startLatenciesMs: [], saveLatenciesMs: [], submitLatenciesMs: [],
    startStatuses: [], saveStatuses: [], submitStatuses: [],
    startFailures: 0, saveFailures: 0, submitFailures: 0,
    readbackMatched: 0, startRetryMatched: 0, submitRetryPassed: 0,
    cleanupRestoredOriginalMemberships: false, secretsIncluded: false, bodiesIncluded: false, productionProtected: true,
  };

  try {
    // Free exactly this shard's 25 synthetic seats through the real School Admin lifecycle RPC.
    const suspends = await Promise.all(oldMemberships.map((m) => rpc(admin.token, 'set_school_student_lifecycle_status_v14', {
      p_membership_id: m.id, p_status: 'suspended', p_reason: `Phase 1 L4-L6 synthetic shard ${shard} seat swap`,
    })));
    if (suspends.some((r) => !r.ok)) throw new Error('failed to suspend exact old synthetic shard memberships');
    oldSuspended = true;

    // Create 25 fresh Supabase Auth-issued student sessions on this independent runner/IP.
    for (const index of newIndices) {
      const actor = await signupSynthetic(index);
      actors.push(actor);
      await sleep(250);
    }
    if (actors.length !== PER_SHARD || new Set(actors.map((a) => a.userId)).size !== PER_SHARD || new Set(actors.map((a) => a.token)).size !== PER_SHARD) throw new Error('distinct session assertion failed');

    // Enrol each fresh synthetic identity. Interrupted prior runs leave these exact
    // acceptance memberships suspended/promotion-locked, so reactivate those through the
    // lifecycle RPC instead of incorrectly sending them back through the add RPC.
    const currentRosterResult = await rpc(admin.token, 'list_school_student_lifecycle_v13', { p_organization_id: ORG_ID });
    if (!currentRosterResult.ok) throw new Error(`current roster failed (${currentRosterResult.status})`);
    const currentRoster = JSON.parse(currentRosterResult.text);
    const membershipByName = new Map((currentRoster.students ?? []).map((m) => [m.name, m]));
    for (const actor of actors) {
      const actorName = `phase1-l456-student-${String(actor.actorIndex).padStart(4, '0')}`;
      const existing = membershipByName.get(actorName);
      const r = existing
        ? await rpc(admin.token, 'set_school_student_lifecycle_status_v14', {
            p_membership_id: existing.id, p_status: 'active', p_reason: `Phase 1 L4-L6 synthetic shard ${shard} seat swap`,
          })
        : await rpc(admin.token, 'add_school_student_membership_v13', {
            p_organization_id: ORG_ID, p_student_id: actor.userId, p_academic_year: '2026-27', p_grade: 11,
            p_section: 'A', p_board: 'ISC', p_tracks: ['NEET'], p_parent_name: null, p_parent_phone: null,
          });
      if (!r.ok) throw new Error(`membership activate failed for synthetic actor ${actor.actorIndex} (${r.status})`);
    }
    newMembershipsAdded = true;

    const lateBy = Date.now() - barrierEpochMs;
    if (lateBy > 30_000) throw new Error(`shared load barrier missed by ${lateBy}ms`);
    if (Date.now() < barrierEpochMs) await sleep(barrierEpochMs - Date.now());

    // Admit at most two acceptance RPCs per shard before starting each request's latency
    // timer. This preserves the 20-runner/500-actor shared load window (up to 40 live RPCs)
    // while preventing local semaphore queue time from being misreported as database latency.
    const starts = await mapWithConcurrency(actors, ACCEPTANCE_RPC_CONCURRENCY, (a) => rpc(a.token, 'start_exam_attempt', { p_paper_id: PAPER_ID, p_access_code: null }));
    evidence.startLatenciesMs = starts.map((r) => Math.round(r.latencyMs * 100) / 100);
    evidence.startStatuses = starts.map((r) => r.status);
    evidence.startFailures = starts.filter((r) => !r.ok).length;
    for (let i = 0; i < actors.length; i++) {
      if (!starts[i].ok) continue;
      try { actors[i].attemptId = JSON.parse(starts[i].text); } catch { throw new Error('invalid start response'); }
    }
    if (evidence.startFailures > 0 || actors.some((a) => !a.attemptId)) throw new Error(`L4 shard start failures=${evidence.startFailures}`);

    for (const actor of actors.slice(0, RETRY_SAMPLE)) {
      const r = await rpc(actor.token, 'start_exam_attempt', { p_paper_id: PAPER_ID, p_access_code: null });
      if (r.ok && JSON.parse(r.text) === actor.attemptId) evidence.startRetryMatched += 1;
    }
    if (evidence.startRetryMatched !== RETRY_SAMPLE) throw new Error('start idempotency sample failed');

    for (const actor of actors) {
      const r = await rpc(actor.token, 'get_exam_attempt_payload', { p_attempt_id: actor.attemptId });
      if (!r.ok) throw new Error(`payload failed (${r.status})`);
      const body = JSON.parse(r.text);
      const q = body.questions?.[0];
      if (!q?.paper_question_id) throw new Error('payload missing question');
      actor.questionId = q.paper_question_id;
      actor.expectedResponse = { selected_option_index: actor.actorIndex % 4 };
    }

    const saves = await mapWithConcurrency(actors, ACCEPTANCE_RPC_CONCURRENCY, (a) => rpc(a.token, 'save_exam_response', {
      p_attempt_id: a.attemptId, p_paper_question_id: a.questionId, p_response: a.expectedResponse, p_marked_for_review: false, p_time_spent_seconds: 7,
    }));
    evidence.saveLatenciesMs = saves.map((r) => Math.round(r.latencyMs * 100) / 100);
    evidence.saveStatuses = saves.map((r) => r.status);
    evidence.saveFailures = saves.filter((r) => !r.ok).length;
    if (evidence.saveFailures > 0) throw new Error(`L5 shard save failures=${evidence.saveFailures}`);

    for (const actor of actors.slice(0, RETRY_SAMPLE)) {
      actor.expectedResponse = { selected_option_index: (actor.expectedResponse.selected_option_index + 1) % 4 };
      const r = await rpc(actor.token, 'save_exam_response', {
        p_attempt_id: actor.attemptId, p_paper_question_id: actor.questionId, p_response: actor.expectedResponse, p_marked_for_review: true, p_time_spent_seconds: 11,
      });
      if (!r.ok) throw new Error('changed-answer retry sample failed');
    }

    for (const actor of actors) {
      const r = await rpc(actor.token, 'get_exam_attempt_payload', { p_attempt_id: actor.attemptId });
      if (!r.ok) continue;
      const body = JSON.parse(r.text);
      const row = body.responses?.find((x) => x.paper_question_id === actor.questionId);
      if (JSON.stringify(row?.response) === JSON.stringify(actor.expectedResponse)) evidence.readbackMatched += 1;
    }
    if (evidence.readbackMatched !== PER_SHARD) throw new Error(`authoritative readback mismatch count=${PER_SHARD - evidence.readbackMatched}`);

    const submits = await mapWithConcurrency(actors, ACCEPTANCE_RPC_CONCURRENCY, (a) => rpc(a.token, 'submit_exam_attempt', { p_attempt_id: a.attemptId }));
    evidence.submitLatenciesMs = submits.map((r) => Math.round(r.latencyMs * 100) / 100);
    evidence.submitStatuses = submits.map((r) => r.status);
    evidence.submitFailures = submits.filter((r) => !r.ok).length;
    if (evidence.submitFailures > 0) throw new Error(`L6 shard submit failures=${evidence.submitFailures}`);

    for (const actor of actors.slice(0, RETRY_SAMPLE)) {
      const r = await rpc(actor.token, 'submit_exam_attempt', { p_attempt_id: actor.attemptId });
      if (r.ok) evidence.submitRetryPassed += 1;
    }
    if (evidence.submitRetryPassed !== RETRY_SAMPLE) throw new Error('submit retry sample failed');
  } catch (e) {
    workloadError = e instanceof Error ? e.message : String(e);
  } finally {
    // Restore the original verified L1 active-membership set. New synthetic users stay auth-backed but their memberships are suspended after evidence.
    try {
      if (newMembershipsAdded) {
        const latestRosterResult = await rpc(admin.token, 'list_school_student_lifecycle_v13', { p_organization_id: ORG_ID });
        if (!latestRosterResult.ok) throw new Error('cleanup roster failed');
        const latestRoster = JSON.parse(latestRosterResult.text);
        const newNames = new Set(newIndices.map((i) => `phase1-l456-student-${String(i).padStart(4, '0')}`));
        const newMemberships = (latestRoster.students ?? []).filter((s) => newNames.has(s.name));
        if (newMemberships.length !== PER_SHARD) throw new Error('cleanup exact new-membership guard failed');
        const suspendedNew = await Promise.all(newMemberships.map((m) => rpc(admin.token, 'set_school_student_lifecycle_status_v14', {
          p_membership_id: m.id, p_status: 'suspended', p_reason: `Phase 1 L4-L6 shard ${shard} completed; restore original L1 set`,
        })));
        if (suspendedNew.some((r) => !r.ok)) throw new Error('cleanup failed to suspend new synthetic memberships');
      }
      if (oldSuspended) {
        const restored = await Promise.all(oldMemberships.map((m) => rpc(admin.token, 'set_school_student_lifecycle_status_v14', {
          p_membership_id: m.id, p_status: 'active', p_reason: `Phase 1 L4-L6 shard ${shard} restore original L1 set`,
        })));
        if (restored.some((r) => !r.ok)) throw new Error('cleanup failed to restore old synthetic memberships');
        evidence.cleanupRestoredOriginalMemberships = true;
      }
    } catch (e) {
      cleanupError = e instanceof Error ? e.message : String(e);
    }
  }

  evidence.finishedAt = new Date().toISOString();
  evidence.workloadPassed = workloadError === null;
  evidence.cleanupPassed = cleanupError === null && evidence.cleanupRestoredOriginalMemberships;
  evidence.error = workloadError;
  evidence.cleanupError = cleanupError;
  writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'w' });
  console.log(JSON.stringify({ shard, workloadPassed: evidence.workloadPassed, cleanupPassed: evidence.cleanupPassed, actorRange: evidence.actorRange }, null, 2));
  if (workloadError || cleanupError) throw new Error(`shard ${shard} failed: workload=${workloadError ?? 'ok'} cleanup=${cleanupError ?? 'ok'}`);
}

main().catch((e) => { console.error(`L456 SHARD FAILED: ${e instanceof Error ? e.message : String(e)}`); process.exitCode = 1; });
