import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831141000_phase1_correct_answer_authority.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');

const checks = [
  ['defines canonical validator', /create or replace function public\.validate_question_correct_answer_v1\(p_question_id uuid\)/i],
  ['documents questions.correct_answer as canonical', /questions\.correct_answer is canonical/i],
  ['validates approved questions only', /status is distinct from 'approved'/i],
  ['requires non-empty JSON array', /canonical correct_answer must be a non-empty JSON array/i],
  ['rejects blank or duplicate answers', /contains blank or duplicate values/i],
  ['single-answer types require exactly one answer', /requires exactly one canonical correct answer/i],
  ['canonical answer keys must exist as options', /references an option key that does not exist/i],
  ['option correctness must exactly match canonical answer', /is_correct flags must exactly match canonical correct_answer/i],
  ['option-based approved questions require options', /option-based question has no options/i],
  ['question trigger is deferred', /create constraint trigger trg_question_correct_answer_v1[\s\S]*deferrable initially deferred/i],
  ['option trigger is deferred', /create constraint trigger trg_question_option_correct_answer_v1[\s\S]*deferrable initially deferred/i],
  ['option trigger covers insert update delete', /after insert or update of question_id, option_key, is_correct or delete on public\.question_options/i],
  ['validator browser execution denied', /revoke all on function public\.validate_question_correct_answer_v1\(uuid\) from public, anon, authenticated;/i],
  ['question trigger helper browser execution denied', /revoke all on function public\.enforce_question_correct_answer_v1\(\) from public, anon, authenticated;/i],
  ['option trigger helper browser execution denied', /revoke all on function public\.enforce_question_option_correct_answer_v1\(\) from public, anon, authenticated;/i],
  ['C6 is wired into release gate', /C6 correct-answer authority checks[\s\S]*node scripts\/c6-correct-answer-authority-smoke\.mjs/i],
];

let failed = 0;
for (const [name, pattern] of checks) {
  const ok = pattern.test(name === 'C6 is wired into release gate' ? workflow : migration);
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`C6 correct-answer authority smoke failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`C6 correct-answer authority smoke passed: ${checks.length}/${checks.length}.`);
