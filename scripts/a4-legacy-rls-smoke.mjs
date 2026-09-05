import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831053000_phase1_legacy_staging_rls_cleanup.sql', 'utf8');

const checks = [
  ['import staging RLS enabled', migration.includes('alter table public.evidara_import_staging_v4 enable row level security')],
  ['recovery audit RLS enabled', migration.includes('alter table public.evidara_batch004_recovery_audit enable row level security')],
  ['import staging browser grants revoked', migration.includes('revoke all on table public.evidara_import_staging_v4 from public, anon, authenticated')],
  ['recovery audit browser grants revoked', migration.includes('revoke all on table public.evidara_batch004_recovery_audit from public, anon, authenticated')],
  ['legacy batch staging browser grants revoked', migration.includes('revoke all on table public.evidara_batch004_staging from public, anon, authenticated')],
  ['migration documents operational-only access', migration.includes('operational artifacts only') && migration.includes('postgres/service_role')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`A4 legacy RLS smoke failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`A4 legacy RLS smoke passed: ${checks.length}/${checks.length}`);
