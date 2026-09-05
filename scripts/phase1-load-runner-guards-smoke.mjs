#!/usr/bin/env node

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const SHA = '0123456789abcdef0123456789abcdef01234567';
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`Assertion ${assertions} failed: ${message}`);
}

function config() {
  return {
    target: 'https://quizmaker2-git-phase1-hardening-example.vercel.app',
    syntheticOnly: true,
    containsPersonalData: false,
    scenario: 'start',
    candidateSha: SHA,
    workloadId: 'phase1-runner-guard-001',
    budget: { maxFailureRate: 0.01, maxP95Ms: 3000, maxP99Ms: 5000 },
    operations: Array.from({ length: 500 }, (_, i) => ({
      actorId: `synthetic-student-${i + 1}`,
      path: '/api/acceptance/noop',
      method: 'POST',
      authorization: `Bearer synthetic-session-${i + 1}`,
      body: { synthetic: true },
    })),
    concurrency: 50,
    rampMs: 1000,
    timeoutMs: 1000,
  };
}

function run(path) {
  return spawnSync(process.execPath, ['scripts/phase1-run-load-scenario.mjs', '--scenario', 'start', '--config', path, '--dry-run'], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { ...process.env, EVIDARA_LOAD_ACCEPTANCE: ACK },
  });
}

const dir = mkdtempSync(join(tmpdir(), 'evidara-load-runner-guards-'));
try {
  const validPath = join(dir, 'valid.json');
  writeFileSync(validPath, JSON.stringify(config()));
  const valid = run(validPath);
  assert(valid.status === 0, `valid dry-run should pass: ${valid.stderr}`);
  const payload = JSON.parse(valid.stdout);
  assert(payload.requestsSent === 0, 'dry-run must send zero requests');
  assert(payload.maxRequestBodyBytes === 262144, 'runner must enforce 256 KiB request-body cap');
  assert(payload.maxResponseBytesPerOperation === 1048576, 'runner must enforce 1 MiB response-body cap');
  assert(payload.circuitBreaker.minimumCompletions === 50, 'circuit breaker must not react before 50 completions');
  assert(payload.circuitBreaker.failureRate === 0.5, 'circuit breaker must stop on a 50% sustained failure surge');

  const oversized = config();
  oversized.operations[0].body = { blob: 'x'.repeat(300000) };
  const oversizedPath = join(dir, 'oversized.json');
  writeFileSync(oversizedPath, JSON.stringify(oversized));
  const oversizedRun = run(oversizedPath);
  assert(oversizedRun.status === 2, 'oversized request body must be refused before load execution');
  assert(oversizedRun.stderr.includes('request body exceeds'), 'request body refusal must identify the bound');

  const hugeBearer = config();
  hugeBearer.operations[0].authorization = `Bearer ${'x'.repeat(17000)}`;
  const hugeBearerPath = join(dir, 'huge-bearer.json');
  writeFileSync(hugeBearerPath, JSON.stringify(hugeBearer));
  const hugeBearerRun = run(hugeBearerPath);
  assert(hugeBearerRun.status === 2, 'oversized bearer session must be refused');
  assert(hugeBearerRun.stderr.includes('bounded bearer session'), 'bearer refusal must identify the session bound');

  const newlineBearer = config();
  newlineBearer.operations[0].authorization = 'Bearer synthetic\nsecond-line';
  const newlineBearerPath = join(dir, 'newline-bearer.json');
  writeFileSync(newlineBearerPath, JSON.stringify(newlineBearer));
  const newlineBearerRun = run(newlineBearerPath);
  assert(newlineBearerRun.status === 2, 'bearer session containing CR/LF must be refused');

  console.log(`Phase 1 load runner guard smoke passed (${assertions} assertions).`);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
