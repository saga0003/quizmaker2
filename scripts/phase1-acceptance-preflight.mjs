#!/usr/bin/env node

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const SAME_PROJECT_MODE = 'same-project-isolated-tenant';
const DEDICATED_PROJECT_MODE = 'dedicated-project';
const EVIDARA_SUPABASE_REF = 'xzfozpnzvznqrvcsoail';
const ACCEPTANCE_ORG_SLUG = 'evidara-school-acceptance';
const SAME_PROJECT_MAX_DATABASE_BYTES = 450 * 1024 * 1024;
const KNOWN_PRODUCTION_HOSTS = new Set([
  'quizmaker2-saga0003s-projects.vercel.app',
  'quizmaker2-git-main-saga0003s-projects.vercel.app',
]);

function fail(message) {
  console.error(`ACCEPTANCE PREFLIGHT REFUSED: ${message}`);
  process.exitCode = 2;
}

function parseArgs(argv) {
  const args = { target: process.env.EVIDARA_ACCEPTANCE_URL ?? '', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--target') args.target = argv[++i] ?? '';
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return args;
}

function assertNonProductionTarget(rawTarget) {
  if (!rawTarget) throw new Error('target is required via --target or EVIDARA_ACCEPTANCE_URL');
  const url = new URL(rawTarget);
  if (url.protocol !== 'https:') throw new Error('target must use HTTPS');
  const host = url.hostname.toLowerCase();

  if (KNOWN_PRODUCTION_HOSTS.has(host)) {
    throw new Error(`known permanent production host is forbidden: ${host}`);
  }
  if (host.includes('git-main') || host === 'evidara.in' || host === 'www.evidara.in') {
    throw new Error(`production-like host is forbidden: ${host}`);
  }
  if (!host.endsWith('.vercel.app')) {
    throw new Error('target must be an explicitly identified Vercel preview/acceptance host');
  }
  if (!host.includes('quizmaker2')) {
    throw new Error('target hostname does not identify the Evidara project');
  }
  return url;
}

function assertAcceptanceEnvironment() {
  const mode = (process.env.EVIDARA_ACCEPTANCE_MODE || DEDICATED_PROJECT_MODE).trim();
  if (![DEDICATED_PROJECT_MODE, SAME_PROJECT_MODE].includes(mode)) {
    throw new Error(`EVIDARA_ACCEPTANCE_MODE must be ${DEDICATED_PROJECT_MODE} or ${SAME_PROJECT_MODE}`);
  }

  if (mode === DEDICATED_PROJECT_MODE) {
    return { mode, sharedBackend: false };
  }

  const supabaseRef = (process.env.EVIDARA_ACCEPTANCE_SUPABASE_REF || '').trim();
  const organizationSlug = (process.env.EVIDARA_ACCEPTANCE_ORG_SLUG || '').trim();
  const measuredDatabaseBytes = Number(process.env.EVIDARA_ACCEPTANCE_DB_BYTES || '');

  if (supabaseRef !== EVIDARA_SUPABASE_REF) {
    throw new Error(`same-project mode requires EVIDARA_ACCEPTANCE_SUPABASE_REF=${EVIDARA_SUPABASE_REF}`);
  }
  if (organizationSlug !== ACCEPTANCE_ORG_SLUG) {
    throw new Error(`same-project mode requires EVIDARA_ACCEPTANCE_ORG_SLUG=${ACCEPTANCE_ORG_SLUG}`);
  }
  if (!Number.isSafeInteger(measuredDatabaseBytes) || measuredDatabaseBytes <= 0) {
    throw new Error('same-project mode requires a fresh positive EVIDARA_ACCEPTANCE_DB_BYTES measurement');
  }
  if (measuredDatabaseBytes >= SAME_PROJECT_MAX_DATABASE_BYTES) {
    throw new Error(
      `same-project database is already ${measuredDatabaseBytes} bytes; hard acceptance ceiling is ${SAME_PROJECT_MAX_DATABASE_BYTES}`,
    );
  }

  return {
    mode,
    sharedBackend: true,
    supabaseRef,
    organizationSlug,
    measuredDatabaseBytes,
    hardDatabaseCeilingBytes: SAME_PROJECT_MAX_DATABASE_BYTES,
  };
}

async function probe(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'evidara-phase1-acceptance-preflight/2' },
    });
    if (response.status >= 500) throw new Error(`target returned ${response.status}`);
    return { status: response.status, location: response.headers.get('location') };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: EVIDARA_LOAD_ACCEPTANCE=YES_I_UNDERSTAND_NON_PRODUCTION_ONLY node scripts/phase1-acceptance-preflight.mjs --target https://<preview>.vercel.app [--dry-run]');
    console.log('Dedicated-project mode is the default. The owner-approved Free-plan fallback is EVIDARA_ACCEPTANCE_MODE=same-project-isolated-tenant with the exact Evidara acceptance tenant/ref and a fresh database-size measurement.');
    console.log('This command only verifies the safety envelope. It does not create data or generate load.');
    return;
  }

  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== REQUIRED_ACK) {
    fail(`set EVIDARA_LOAD_ACCEPTANCE=${REQUIRED_ACK} to acknowledge guarded acceptance execution`);
    return;
  }

  let target;
  let acceptanceEnvironment;
  try {
    target = assertNonProductionTarget(args.target);
    acceptanceEnvironment = assertAcceptanceEnvironment();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const result = {
    ok: true,
    mode: 'preflight-only',
    target: target.origin,
    productionProtected: true,
    destructiveActionsPerformed: false,
    acknowledgement: 'present',
    acceptanceEnvironment,
  };

  if (!args.dryRun) {
    try {
      result.httpProbe = await probe(target);
    } catch (error) {
      fail(`target probe failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  } else {
    result.httpProbe = 'skipped (--dry-run)';
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});