import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(path.join(process.cwd(), 'src/components/papers/LiveExam.tsx'), 'utf8');
const failures = [];
const check = (name, condition) => {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
};

check('pending answers use attempt-scoped local persistence', /evidara-exam-pending:\$\{attemptId\}/.test(source));
check('pending queue is restored after reload', /localStorage\.getItem\(pendingStorageKey\(attempt\)\)/.test(source) && /restored/.test(source));
check('offline answers are queued before server sync', /queuePending\(item\)/.test(source) && /navigator\.onLine/.test(source));
check('sync retries use bounded backoff', /retryDelays\s*=\s*\[0,\s*350,\s*1200\]/.test(source));
check('connection restoration automatically flushes pending answers', /addEventListener\('online',\s*connected\)/.test(source) && /flushPending\(payload\.attempt_id\)/.test(source));
check('periodic recovery retries pending answers', /setInterval\([\s\S]*8000\)/.test(source));
check('numeric answers are locally queued on every change', /function setNumeric[\s\S]*queuePending\(item\)/.test(source));
check('numeric answers debounce server synchronization', /numericSyncTimer[\s\S]*500/.test(source));
check('navigation attempts to flush pending answers', /function go[\s\S]*flushPending\(payload\.attempt_id\)/.test(source));
check('final submit flushes queue before authoritative submit', /const synced = await flushPending\(payload\.attempt_id\)[\s\S]*submit_exam_attempt/.test(source));
check('final submit is blocked while pending or offline', /disabled=\{submitting \|\| pendingCount > 0 \|\| !online\}/.test(source) && /Final submission is blocked until the server confirms every answer/.test(source));
check('student sees explicit saved\/waiting\/offline sync states', /All answers saved/.test(source) && /waiting to sync/.test(source) && /Offline/.test(source));

console.log(`\n${12 - failures.length}/12 P0.10 network-reliability checks passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
