#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
let assertions = 0;

function assert(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(`Assertion ${assertions} failed: ${message}`);
}

function runNode(script, args = [], env = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

function lineCount(path) {
  const content = readFileSync(path, 'utf8');
  return content.endsWith('\n') ? content.split('\n').length - 1 : content.split('\n').length;
}

const root = process.cwd();
const generator = join(root, 'scripts', 'phase1-generate-load-fixtures.mjs');
const preflight = join(root, 'scripts', 'phase1-acceptance-preflight.mjs');
const temp = mkdtempSync(join(tmpdir(), 'evidara-acceptance-tooling-'));
const runA = join(temp, 'run-a');
const runB = join(temp, 'run-b');

try {
  const missingAck = runNode(preflight, ['--target', 'https://quizmaker2-git-phase1-hardening-example.vercel.app', '--dry-run']);
  assert(missingAck.status === 2, 'preflight must fail closed without explicit non-production acknowledgement');
  assert(missingAck.stderr.includes('ACCEPTANCE PREFLIGHT REFUSED'), 'missing acknowledgement must produce an explicit refusal');

  const prodTarget = runNode(
    preflight,
    ['--target', 'https://quizmaker2-saga0003s-projects.vercel.app', '--dry-run'],
    { EVIDARA_LOAD_ACCEPTANCE: ACK },
  );
  assert(prodTarget.status === 2, 'known permanent production host must be refused');
  assert(prodTarget.stderr.includes('permanent production host is forbidden'), 'production refusal must name the safety reason');

  const mainTarget = runNode(
    preflight,
    ['--target', 'https://quizmaker2-git-main-saga0003s-projects.vercel.app', '--dry-run'],
    { EVIDARA_LOAD_ACCEPTANCE: ACK },
  );
  assert(mainTarget.status === 2, 'main-branch deployment host must be refused');

  const nonVercel = runNode(
    preflight,
    ['--target', 'https://acceptance.example.com', '--dry-run'],
    { EVIDARA_LOAD_ACCEPTANCE: ACK },
  );
  assert(nonVercel.status === 2, 'unidentified external targets must fail closed');

  const safePreview = runNode(
    preflight,
    ['--target', 'https://quizmaker2-git-phase1-hardening-example.vercel.app', '--dry-run'],
    { EVIDARA_LOAD_ACCEPTANCE: ACK },
  );
  assert(safePreview.status === 0, `explicit Evidara preview must pass dry preflight: ${safePreview.stderr}`);
  const safePayload = JSON.parse(safePreview.stdout);
  assert(safePayload.productionProtected === true, 'safe preflight must report production protection');
  assert(safePayload.destructiveActionsPerformed === false, 'preflight must remain non-destructive');
  assert(safePayload.mode === 'preflight-only', 'preflight must not masquerade as load execution');

  execFileSync(process.execPath, [generator, '--out', runA, '--seed', '424242'], { stdio: 'pipe' });
  execFileSync(process.execPath, [generator, '--out', runB, '--seed', '424242'], { stdio: 'pipe' });

  const manifestA = JSON.parse(readFileSync(join(runA, 'manifest.json'), 'utf8'));
  const manifestB = JSON.parse(readFileSync(join(runB, 'manifest.json'), 'utf8'));

  assert(manifestA.syntheticOnly === true, 'fixture manifest must declare synthetic-only data');
  assert(manifestA.containsPersonalData === false, 'fixture manifest must declare no personal data');
  assert(manifestA.counts.students === 2000, 'L1 fixture count must be exactly 2,000 students');
  assert(manifestA.counts.questions === 50000, 'L2 fixture count must be exactly 50,000 questions');
  assert(manifestA.counts.papers === 1000, 'L3 fixture count must be exactly 1,000 papers');

  assert(lineCount(join(runA, 'students-2000.csv')) === 2001, 'student CSV must contain header + exactly 2,000 rows');
  assert(lineCount(join(runA, 'questions-50000.csv')) === 50001, 'question CSV must contain header + exactly 50,000 rows');
  assert(lineCount(join(runA, 'papers-1000.csv')) === 1001, 'paper CSV must contain header + exactly 1,000 rows');

  for (const file of ['students-2000.csv', 'questions-50000.csv', 'papers-1000.csv']) {
    assertions += 1;
    if (manifestA.files[file].sha256 !== manifestB.files[file].sha256) {
      throw new Error(`Assertion ${assertions} failed: ${file} hash must be deterministic for the same seed`);
    }
  }

  const students = readFileSync(join(runA, 'students-2000.csv'), 'utf8');
  assert(students.includes('Synthetic Student 0001'), 'student fixtures must be visibly synthetic');
  assert(!students.includes('@'), 'student fixture file must not contain email-like personal identifiers');

  console.log(`Phase 1 acceptance tooling smoke passed (${assertions} assertions).`);
} finally {
  rmSync(temp, { recursive: true, force: true });
}
