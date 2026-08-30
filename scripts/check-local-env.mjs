import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const envLocalPath = path.join(root, '.env.local');
const envDefaultPath = path.join(root, '.env');
const envPath = fs.existsSync(envLocalPath) ? envLocalPath : envDefaultPath;
const errors = [];

function fail(message) {
  errors.push(message);
}

function isPlaceholder(value) {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  return (
    normalized === '[sensitive]' ||
    normalized.includes('paste_your_') ||
    normalized.includes('paste_the_') ||
    normalized.includes('your_supabase_') ||
    normalized.includes('replace_me') ||
    normalized.includes('example')
  );
}

function parseEnv(text) {
  const values = new Map();
  for (const rawLine of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equalsAt = line.indexOf('=');
    if (equalsAt < 1) continue;
    const key = line.slice(0, equalsAt).trim();
    let value = line.slice(equalsAt + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function validHttpUrl(value, label) {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      fail(`${label} must begin with http:// or https://.`);
      return null;
    }
    return parsed;
  } catch {
    fail(`${label} is not a valid URL.`);
    return null;
  }
}

function decodeJwtPayload(value) {
  try {
    const parts = value.split('.');
    if (parts.length !== 3) return null;
    const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

if (!fs.existsSync(envPath)) {
  console.error('ERROR: No local environment file was found. Add .env or .env.local to the project folder.');
  process.exit(1);
}

const env = parseEnv(fs.readFileSync(envPath, 'utf8'));
const appUrl = env.get('NEXT_PUBLIC_APP_URL') ?? '';
const supabaseUrl = env.get('NEXT_PUBLIC_SUPABASE_URL') ?? '';
const publishableKey = env.get('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY') || env.get('NEXT_PUBLIC_SUPABASE_ANON_KEY') || '';
const serverKey = env.get('SUPABASE_SECRET_KEY') || env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

for (const [key, value] of [
  ['NEXT_PUBLIC_APP_URL', appUrl],
  ['NEXT_PUBLIC_SUPABASE_URL', supabaseUrl],
  ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY)', publishableKey],
  ['SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)', serverKey],
]) {
  if (isPlaceholder(value)) fail(`${key} is missing, masked, or still contains a placeholder.`);
}

if (!isPlaceholder(appUrl)) {
  const parsed = validHttpUrl(appUrl, 'NEXT_PUBLIC_APP_URL');
  if (parsed && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    fail('For local testing, NEXT_PUBLIC_APP_URL should point to localhost or 127.0.0.1.');
  }
}

if (!isPlaceholder(supabaseUrl)) {
  const parsed = validHttpUrl(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL');
  if (parsed) {
    if (parsed.protocol !== 'https:') fail('NEXT_PUBLIC_SUPABASE_URL must use https://.');
    if (parsed.hostname !== 'xzfozpnzvznqrvcsoail.supabase.co') {
      fail('NEXT_PUBLIC_SUPABASE_URL does not point to the Evidara Supabase project.');
    }
  }
}

if (!isPlaceholder(publishableKey)) {
  const publishableJwt = decodeJwtPayload(publishableKey);
  const validPublishable =
    publishableKey.startsWith('sb_publishable_') ||
    publishableJwt?.role === 'anon';
  if (!validPublishable) {
    fail('The Supabase browser key is not a valid publishable/anon key format.');
  }
}

if (!isPlaceholder(serverKey)) {
  const secretJwt = decodeJwtPayload(serverKey);
  const validSecret =
    serverKey.startsWith('sb_secret_') ||
    secretJwt?.role === 'service_role';
  if (!validSecret) {
    fail('The Supabase server key is not a valid sb_secret_ or legacy service_role key format.');
  }
}

if (env.has('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') || env.has('NEXT_PUBLIC_SUPABASE_SECRET_KEY')) {
  fail('A Supabase server secret is using a NEXT_PUBLIC_ name. Remove it immediately because NEXT_PUBLIC_ values are exposed to the browser.');
}

if (publishableKey && serverKey && publishableKey === serverKey) {
  fail('The publishable key and server key cannot be the same value.');
}

const r2Keys = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_ENDPOINT', 'R2_PUBLIC_BASE_URL'];
const r2Values = r2Keys.map((key) => env.get(key) ?? '');
const r2Present = r2Values.filter((value) => !isPlaceholder(value)).length;
if (r2Present > 0 && r2Present < r2Keys.length) {
  fail(`Cloudflare R2 is only partially configured. Provide all six R2 variables or remove the partial values. Missing/placeholder count: ${r2Keys.length - r2Present}.`);
}

if (errors.length > 0) {
  console.error('Evidara local environment validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  console.error('No secret values were printed. Correct .env.local and run TEST_EVIDARA.bat again.');
  process.exit(1);
}

console.log(`Evidara local environment is valid (${path.basename(envPath)}).`);
console.log('✓ localhost application URL');
console.log('✓ Evidara Supabase URL');
console.log('✓ publishable browser key');
console.log('✓ private server key');
console.log(r2Present === r2Keys.length ? '✓ Cloudflare R2 upload configuration' : '• Cloudflare R2 not configured in this local env; file/resource uploads will remain unavailable until its six variables are added.');
console.log('No secret values were displayed.');
