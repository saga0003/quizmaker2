#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const SCENARIOS = new Set(['start', 'save', 'submit']);
const PRODUCTION_HOSTS = new Set([
  'quizmaker2-saga0003s-projects.vercel.app',
  'quizmaker2-git-main-saga0003s-projects.vercel.app',
  'evidara.in',
  'www.evidara.in',
]);
const FORBIDDEN_OPERATION_HEADERS = new Set([
  'authorization',
  'cookie',
  'host',
  'content-type',
  'content-length',
  'transfer-encoding',
  'connection',
  'user-agent',
  'x-forwarded-host',
  'x-forwarded-proto',
]);

function fail(message) {
  console.error(`LOAD ACCEPTANCE REFUSED: ${message}`);
  process.exitCode = 2;
}

function parseArgs(argv) {
  const args = { scenario: '', config: '', out: '', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--scenario') args.scenario = argv[++i] ?? '';
    else if (arg === '--config') args.config = argv[++i] ?? '';
    else if (arg === '--out') args.out = argv[++i] ?? '';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--help') args.help = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return args;
}

function assertSafeTarget(raw) {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:') throw new Error('target must use HTTPS');
  if (PRODUCTION_HOSTS.has(host) || host.includes('git-main')) throw new Error(`production target forbidden: ${host}`);
  if (!host.endsWith('.vercel.app') || !host.includes('quizmaker2')) throw new Error('target must be an Evidara Vercel preview/acceptance deployment');
  return url.origin;
}

function validateOperationHeaders(headers, index) {
  if (headers === undefined) return;
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) throw new Error(`operation ${index} headers must be an object`);
  const entries = Object.entries(headers);
  if (entries.length > 20) throw new Error(`operation ${index} may contain at most 20 custom headers`);
  for (const [rawName, value] of entries) {
    const name = rawName.trim().toLowerCase();
    if (!name || name !== rawName.toLowerCase()) throw new Error(`operation ${index} contains an invalid header name`);
    if (FORBIDDEN_OPERATION_HEADERS.has(name)) throw new Error(`operation ${index} may not override protected header: ${name}`);
    if (typeof value !== 'string' || value.length > 2048 || /[\r\n]/.test(value)) throw new Error(`operation ${index} contains an invalid header value for ${name}`);
  }
}

function validateConfig(config, scenario) {
  if (!config || typeof config !== 'object') throw new Error('config must be a JSON object');
  const target = assertSafeTarget(config.target);
  if (config.syntheticOnly !== true) throw new Error('config must declare syntheticOnly=true');
  if (config.containsPersonalData !== false) throw new Error('config must declare containsPersonalData=false');
  if (config.scenario !== scenario) throw new Error('config scenario must match --scenario');
  if (!Array.isArray(config.operations) || config.operations.length !== 500) throw new Error('acceptance scenario must contain exactly 500 operations');
  const actorIds = new Set();
  for (const [index, op] of config.operations.entries()) {
    if (!op || typeof op !== 'object') throw new Error(`operation ${index} is invalid`);
    if (typeof op.actorId !== 'string' || !op.actorId.startsWith('synthetic-')) throw new Error(`operation ${index} actorId must be visibly synthetic`);
    if (actorIds.has(op.actorId)) throw new Error(`duplicate actorId: ${op.actorId}`);
    actorIds.add(op.actorId);
    if (typeof op.path !== 'string' || !op.path.startsWith('/') || op.path.startsWith('//') || op.path.includes('\\')) throw new Error(`operation ${index} path must be a safe relative path`);
    const resolved = new URL(op.path, `${target}/`);
    if (resolved.origin !== target) throw new Error(`operation ${index} path may not change target origin`);
    if (!['POST', 'PUT', 'PATCH'].includes(op.method)) throw new Error(`operation ${index} method must be POST/PUT/PATCH`);
    if (typeof op.authorization !== 'string' || !op.authorization.startsWith('Bearer ')) throw new Error(`operation ${index} must carry its own bearer session`);
    if (op.authorization.includes('service_role')) throw new Error(`operation ${index} may not use a service-role token`);
    validateOperationHeaders(op.headers, index);
  }
  const concurrency = Number(config.concurrency ?? 50);
  const rampMs = Number(config.rampMs ?? 30_000);
  const timeoutMs = Number(config.timeoutMs ?? 15_000);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 500) throw new Error('concurrency must be 1..500');
  if (!Number.isFinite(rampMs) || rampMs < 1_000 || rampMs > 120_000) throw new Error('rampMs must be 1000..120000');
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 60_000) throw new Error('timeoutMs must be 1000..60000');
  return { target, concurrency, rampMs, timeoutMs };
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Math.round(sorted[Math.max(0, index)] * 100) / 100;
}

async function executeOperation(target, op, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${target}${op.path}`, {
      method: op.method,
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        ...(op.headers ?? {}),
        'content-type': 'application/json',
        authorization: op.authorization,
        'user-agent': 'evidara-phase1-load-acceptance/1',
      },
      body: op.body === undefined ? undefined : JSON.stringify(op.body),
    });
    const latencyMs = performance.now() - started;
    const text = await response.text();
    return { actorId: op.actorId, status: response.status, ok: response.ok, latencyMs, responseBytes: Buffer.byteLength(text), error: null };
  } catch (error) {
    return { actorId: op.actorId, status: 0, ok: false, latencyMs: performance.now() - started, responseBytes: 0, error: error instanceof Error ? error.name : 'UnknownError' };
  } finally {
    clearTimeout(timer);
  }
}

async function run(config, safe) {
  const operations = config.operations;
  const results = new Array(operations.length);
  let cursor = 0;
  const epoch = performance.now();
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= operations.length) return;
      const due = (safe.rampMs * index) / Math.max(1, operations.length - 1);
      const wait = epoch + due - performance.now();
      if (wait > 0) await new Promise((resolveWait) => setTimeout(resolveWait, wait));
      results[index] = await executeOperation(safe.target, operations[index], safe.timeoutMs);
    }
  }
  await Promise.all(Array.from({ length: safe.concurrency }, () => worker()));
  return results;
}

function summarize(scenario, target, results) {
  const latencies = results.map((r) => r.latencyMs);
  const statuses = {};
  for (const result of results) statuses[String(result.status)] = (statuses[String(result.status)] ?? 0) + 1;
  return {
    schemaVersion: 1,
    scenario,
    target,
    attempted: results.length,
    successful: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    statusDistribution: statuses,
    latencyMs: { p50: percentile(latencies, 50), p95: percentile(latencies, 95), p99: percentile(latencies, 99), max: percentile(latencies, 100) },
    responseBytes: results.reduce((sum, r) => sum + r.responseBytes, 0),
    errors: results.reduce((acc, r) => { if (r.error) acc[r.error] = (acc[r.error] ?? 0) + 1; return acc; }, {}),
    secretsIncluded: false,
    bodiesIncluded: false,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: EVIDARA_LOAD_ACCEPTANCE=YES_I_UNDERSTAND_NON_PRODUCTION_ONLY node scripts/phase1-run-load-scenario.mjs --scenario start|save|submit --config <private.json> --out <aggregate.json> [--dry-run]');
    console.log('The private config must contain exactly 500 synthetic per-actor authenticated operations. Output contains aggregates only.');
    return;
  }
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== ACK) return fail(`set EVIDARA_LOAD_ACCEPTANCE=${ACK}`);
  if (!SCENARIOS.has(args.scenario)) return fail('--scenario must be start, save or submit');
  if (!args.config) return fail('--config is required');
  let config;
  let safe;
  try {
    config = JSON.parse(readFileSync(resolve(args.config), 'utf8'));
    safe = validateConfig(config, args.scenario);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  if (args.dryRun) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', scenario: args.scenario, target: safe.target, operations: 500, concurrency: safe.concurrency, rampMs: safe.rampMs, productionProtected: true, requestsSent: 0 }, null, 2));
    return;
  }
  if (!args.out) return fail('--out is required for executed load so aggregate evidence is not lost');
  const results = await run(config, safe);
  const summary = summarize(args.scenario, safe.target, results);
  writeFileSync(resolve(args.out), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
