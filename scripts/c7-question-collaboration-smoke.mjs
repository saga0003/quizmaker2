import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831143000_phase1_question_collaboration_scope.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');

const checks = [
  ['defines collaboration guard', /create or replace function public\.enforce_institution_question_collaboration_v1\(\)/i],
  ['teacher creation is owner-only', /Teachers may create only their own questions/i],
  ['teacher creation limited to draft or review', /Teachers may create a draft or submit it for review only/i],
  ['teacher edits owner-only', /Teachers may edit only their own questions/i],
  ['teacher cannot move institutions', /Question institution cannot be changed by a teacher/i],
  ['submitted and approved teacher rows lock', /Submitted or approved questions are locked for teacher editing/i],
  ['teacher cannot self-review', /Teachers cannot self-approve, archive or otherwise review questions/i],
  ['teacher scope is subject-aware', /is_evidara_teacher_for_scope\(v_org, null::uuid, v_subject\)/i],
  ['school managers retain full institution authority', /is_evidara_school_manager\(v_org\)/i],
  ['reviewers retain review authority', /can_review_org_question\(v_org\)/i],
  ['question insert policy owns teacher drafts', /create policy questions_insert_v15[\s\S]*created_by = auth\.uid\(\)[\s\S]*status in \('draft'::public\.question_status, 'in_review'::public\.question_status\)/i],
  ['question update policy blocks post-submit edits', /create policy questions_update_v15[\s\S]*status in \('draft'::public\.question_status, 'rejected'::public\.question_status\)/i],
  ['legacy broad option manager removed', /drop policy if exists options_manage on public\.question_options/i],
  ['legacy broad option reader removed', /drop policy if exists options_read on public\.question_options/i],
  ['option read policy mirrors approved-or-own visibility', /create policy question_options_read_v15[\s\S]*q\.created_by = auth\.uid\(\) or q\.status = 'approved'/i],
  ['option writes limited to owner draft/rejected', /create policy question_options_manage_v15[\s\S]*q\.created_by = auth\.uid\(\)[\s\S]*q\.status in \('draft'::public\.question_status, 'rejected'::public\.question_status\)/i],
  ['guard browser execution denied', /revoke all on function public\.enforce_institution_question_collaboration_v1\(\) from public, anon, authenticated;/i],
  ['C7 is wired into release gate', /C7 question collaboration checks[\s\S]*node scripts\/c7-question-collaboration-smoke\.mjs/i],
];

let failed = 0;
for (const [name, pattern] of checks) {
  const source = name === 'C7 is wired into release gate' ? workflow : migration;
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`C7 collaboration smoke failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`C7 collaboration smoke passed: ${checks.length}/${checks.length}.`);
