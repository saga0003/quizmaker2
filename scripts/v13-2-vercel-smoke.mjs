import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const failures = [];
let passed = 0;
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
function check(label, condition) { if (condition) { passed++; console.log(`✓ ${label}`); } else { failures.push(label); console.error(`✗ ${label}`); } }
const pkg = JSON.parse(read('package.json'));
const vercel = JSON.parse(read('vercel.json'));
check('release version is 19.1.0', pkg.version === '19.1.0');
check('Next.js framework is selected', vercel.framework === 'nextjs');
check('Git automatic deployment is not blocked', vercel.git?.deploymentEnabled !== false);
check('Vercel build uses npm run build', vercel.buildCommand === 'npm run build');
check('Cloudflare build script is removed', !pkg.scripts?.['cf:build'] && !pkg.scripts?.['cf:deploy']);
check('Vercel production command exists', pkg.scripts?.['vercel:prod'] === 'vercel deploy --prod');
check('local environment validator exists', exists('scripts/check-local-env.mjs'));
check('environment template exists', exists('.env.example'));
check('server secret is not public', !read('.env.example').includes('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY'));
check('V13.2 analytics smoke exists', exists('scripts/v13-2-analytics-smoke.mjs'));
check('obsolete release installer is absent', !exists('scripts/install-v13-2-release.mjs'));
check('Cloudflare configuration is absent', !exists('wrangler.jsonc') && !exists('open-next.config.ts'));
if (failures.length) { console.error(`\nVercel smoke failed: ${failures.length} failed, ${passed} passed.`); process.exit(1); }
console.log(`\nEvidara V19 Vercel checks passed (${passed} checks).`);
