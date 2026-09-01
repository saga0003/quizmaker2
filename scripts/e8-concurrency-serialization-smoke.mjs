import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260901044500_phase1_e8_exam_concurrency_serialization.sql', 'utf8');
const e6 = fs.readFileSync('supabase/migrations/20260901043000_phase1_e6_submission_receipt.sql', 'utf8');
const checks = [
  ['start requests serialize by learner + paper', /pg_advisory_xact_lock\(hashtextextended\(p_paper_id::text \|\| ':' \|\| v_user::text, 0\)\)/.test(migration)],
  ['start lock is injected immediately after authenticated-user validation', /v_needle := 'if v_user is null then raise exception ''Login required\.''; end if;'[\s\S]*?v_needle \|\| E'\\n  -- Serialize starts[\s\S]*?pg_advisory_xact_lock/.test(migration)],
  ['save locks the owning attempt before status validation', /student_id=auth\.uid\(\) for update;/.test(migration)],
  ['save stays authenticated-only', /revoke all on function public\.save_exam_response[\s\S]*?from anon;[\s\S]*?grant execute[\s\S]*?to authenticated;/.test(migration)],
  ['start stays authenticated-only', /revoke all on function public\.start_exam_attempt[\s\S]*?from anon;[\s\S]*?grant execute[\s\S]*?to authenticated;/.test(migration)],
  ['submit already locks attempt row', /student_id = auth\.uid\(\)[\s\S]*?for update;/.test(e6)],
  ['submit already skips repeat scoring', /if v_attempt\.status <> 'submitted' then/.test(e6)],
  ['submit already returns stable receipt on replay', /submission_receipt_id/.test(e6)],
];
const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
if (failed.length) {
  console.error(`E8 concurrency serialization smoke failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`E8 concurrency serialization smoke passed (${checks.length}/${checks.length}). Real concurrent load acceptance is still required before E8 may be checked.`);
