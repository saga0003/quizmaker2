#!/usr/bin/env node

const REQUIRED_ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
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

async function probe(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'evidara-phase1-acceptance-preflight/1' },
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
    console.log('This command only verifies the safety envelope. It does not create data or generate load.');
    return;
  }

  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== REQUIRED_ACK) {
    fail(`set EVIDARA_LOAD_ACCEPTANCE=${REQUIRED_ACK} to acknowledge non-production-only execution`);
    return;
  }

  let target;
  try {
    target = assertNonProductionTarget(args.target);
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
