import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260901053000_phase1_question_duplicate_prevention.sql', 'utf8');
const privilegeMigration = fs.readFileSync('supabase/migrations/20260901054500_phase1_question_duplicate_trigger_privileges.sql', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('v2 fingerprint covers rich question body', () => {
  assert.match(migration, /question_duplicate_hash_v2_payload/);
  assert.match(migration, /p_stem_text/);
  assert.match(migration, /p_stem_latex/);
  assert.match(migration, /p_passage_text/);
  assert.match(migration, /p_question_image_url/);
  assert.match(migration, /p_question_image_urls/);
});
check('v2 fingerprint includes option content', () => {
  assert.match(migration, /content_text/);
  assert.match(migration, /content_latex/);
  assert.match(migration, /image_url/);
  assert.match(migration, /option_key/);
});
check('fingerprint is independent of taxonomy and source identity', () => {
  const payloadFn = migration.match(/create or replace function public\.question_duplicate_hash_v2_payload[\s\S]*?\$\$;/i)?.[0] ?? '';
  assert.doesNotMatch(payloadFn, /subject_id|chapter_id|topic_id|source_key|source_year/);
});
check('legacy supplied hashes are cleared before canonical recompute', () => {
  assert.match(migration, /new\.duplicate_hash\s*:=\s*null/);
  assert.match(migration, /trg_question_duplicate_prepare_v2/);
});
check('question changes finalize fingerprint at transaction end', () => {
  assert.match(migration, /create constraint trigger trg_question_duplicate_finalize_v2/);
  assert.match(migration, /deferrable initially deferred/);
});
check('option changes finalize parent fingerprint at transaction end', () => {
  assert.match(migration, /create constraint trigger trg_question_option_duplicate_finalize_v2/);
  assert.match(migration, /after insert or delete or update of question_id, option_key, content_text, content_latex, image_url, display_order/);
});
check('all write paths are protected by table triggers rather than one RPC', () => {
  assert.match(migration, /on public\.questions/);
  assert.match(migration, /on public\.question_options/);
  assert.match(migration, /finalize_question_duplicate_hash_v2/);
});
check('platform and institution banks have scoped uniqueness', () => {
  assert.match(migration, /questions_duplicate_scope_hash_uidx/);
  assert.match(migration, /coalesce\(organization_id, '00000000-0000-0000-0000-000000000000'::uuid\)/);
  assert.match(migration, /where duplicate_hash is not null/);
});
check('migration refuses unsafe pre-existing duplicates', () => {
  assert.match(migration, /C11 preflight found % exact duplicate group/);
  assert.match(migration, /having count\(\*\) > 1/);
});
check('backfill does not rewrite question audit/update history', () => {
  assert.match(migration, /disable trigger user/);
  assert.match(migration, /enable trigger user/);
});
check('preview duplicate detection uses canonical v2 fingerprint', () => {
  assert.match(migration, /preview_paper_import_duplicates_service_v18/);
  assert.match(migration, /v_hash := public\.question_duplicate_hash_v2_payload/);
});
check('blank text does not invoke fuzzy blank-vs-blank matching', () => {
  assert.match(migration, /if nullif\(btrim\(v_stem\), ''\) is null then/);
  assert.match(migration, /nullif\(btrim\(q\.stem_text\), ''\) is not null/);
});
check('internal row hash helper is not browser executable', () => {
  assert.match(migration, /revoke all on function public\.question_duplicate_hash_v2\(uuid\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.question_duplicate_hash_v2\(uuid\) to service_role/);
});
check('trigger helpers are not exposed as browser-callable SECURITY DEFINER RPCs', () => {
  assert.match(privilegeMigration, /revoke all on function public\.prepare_question_duplicate_hash_v2\(\) from public, anon, authenticated/);
  assert.match(privilegeMigration, /revoke all on function public\.finalize_question_duplicate_hash_v2\(\) from public, anon, authenticated/);
});

console.log(`C11 question duplicate prevention smoke: ${checks.length}/${checks.length} checks passed`);
