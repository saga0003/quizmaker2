import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260901043000_phase1_e6_submission_receipt.sql', 'utf8');
const exam = fs.readFileSync('src/components/papers/LiveExam.tsx', 'utf8');

const checks = [
  ['submission RPC is replaced in the migration', /create or replace function public\.submit_exam_attempt\(p_attempt_id uuid\)/i.test(migration)],
  ['attempt row is locked to serialize concurrent submits', /where id = p_attempt_id and student_id = auth\.uid\(\)[\s\S]*?for update;/i.test(migration)],
  ['already-submitted attempts do not re-score', /if v_attempt\.status <> 'submitted' then/i.test(migration)],
  ['first submission generates one receipt identity', /v_receipt_id := gen_random_uuid\(\);/i.test(migration)],
  ['receipt identity is persisted in attempt metadata', /'submission_receipt_id', v_receipt_id::text/i.test(migration)],
  ['replay reads the persisted receipt identity', /v_attempt\.metadata->>'submission_receipt_id'/i.test(migration)],
  ['legacy submitted attempts are backfilled once under lock', /Legacy submitted attempts receive one durable receipt on first replay/i.test(migration)],
  ['receipt object is returned to the client', /'submission_receipt',[\s\S]*?'receipt_id', v_receipt_id/i.test(migration)],
  ['receipt includes authoritative submitted timestamp', /'submitted_at', v_attempt\.submitted_at/i.test(migration)],
  ['anonymous/public execution is revoked', /revoke all on function public\.submit_exam_attempt\(uuid\) from (?:public|anon);/i.test(migration)],
  ['authenticated execution is explicitly granted', /grant execute on function public\.submit_exam_attempt\(uuid\) to authenticated;/i.test(migration)],
  ['client flushes pending answers before final submit', /const synced = await flushPending\(payload\.attempt_id\);/i.test(exam)],
  ['client calls authoritative submit RPC', /rpc\('submit_exam_attempt'/i.test(exam)],
  ['client only enters result state from server response', /setResult\(data as AttemptResult\);/i.test(exam)],
  ['student receives clear confirmed-submission screen', /<h1>Test submitted<\/h1>[\s\S]*?authoritative result have been stored/i.test(exam)],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}: ${name}`);
if (failed.length) {
  console.error(`E6 idempotent submission smoke failed: ${failed.map(([name]) => name).join(', ')}`);
  process.exit(1);
}
console.log(`E6 idempotent submission smoke passed (${checks.length}/${checks.length}).`);
