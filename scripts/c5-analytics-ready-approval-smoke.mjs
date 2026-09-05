import fs from 'node:fs';

const original = fs.readFileSync('supabase/migrations/20260831120500_phase1_analytics_ready_question_approval.sql', 'utf8');
const fix = fs.readFileSync('supabase/migrations/20260901050000_fix_c5_question_content_fields.sql', 'utf8');
const migration = `${original}\n${fix}`;

const checks = [
  ['defines server approval validator', /create or replace function public\.validate_question_analytics_ready_v1\(\)/i],
  ['runs only for approved state', /if new\.status is distinct from 'approved' then\s+return new;/i],
  ['hotfix uses current stem text field', /new\.stem_text/i],
  ['hotfix accepts LaTeX-only content', /new\.stem_latex/i],
  ['hotfix accepts primary image content', /new\.question_image_url/i],
  ['hotfix accepts multi-image content', /cardinality\(new\.question_image_urls\)/i],
  ['hotfix does not reference removed question_text field', !/new\.question_text/i.test(fix)],
  ['requires subject chapter topic', /subject, chapter and topic are required for analytics/i],
  ['requires positive marks', /marks must be greater than zero/i],
  ['requires nonnegative negative marks', /negative marks must be zero or greater/i],
  ['rejects negative marks above marks', /negative marks cannot exceed marks/i],
  ['requires difficulty', /difficulty is required/i],
  ['requires active subject', /from public\.subjects[\s\S]*is_active = true/i],
  ['requires active chapter and matching subject', /from public\.chapters[\s\S]*v_chapter_subject is distinct from new\.subject_id/i],
  ['requires active topic and matching chapter', /from public\.topics[\s\S]*v_topic_chapter is distinct from new\.chapter_id/i],
  ['blocks cross-institution taxonomy', /taxonomy belongs to a different institution/i],
  ['blocks school taxonomy on platform questions', /platform questions may only use global taxonomy/i],
  ['original migration installs before-write trigger', /create trigger trg_question_analytics_ready_v1\s+before insert or update on public\.questions/i.test(original)],
  ['denies browser execution of validator', /revoke all on function public\.validate_question_analytics_ready_v1\(\) from public, anon, authenticated;/i],
];

let failed = 0;
for (const [name, matcher] of checks) {
  const ok = typeof matcher === 'boolean' ? matcher : matcher.test(migration);
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`C5 analytics-ready approval smoke failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`C5 analytics-ready approval smoke passed: ${checks.length}/${checks.length}.`);
