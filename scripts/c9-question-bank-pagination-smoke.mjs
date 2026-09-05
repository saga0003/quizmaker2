import fs from 'node:fs';
import assert from 'node:assert/strict';

const component = fs.readFileSync('src/components/evidara/live-question-bank.tsx', 'utf8');
const migrations = fs.readdirSync('supabase/migrations')
  .filter((name) => name.endsWith('.sql'))
  .map((name) => fs.readFileSync(`supabase/migrations/${name}`, 'utf8'))
  .join('\n');

const checks = [];
const check = (name, fn) => {
  fn();
  checks.push(name);
};

check('server search RPC exists in migration history', () => {
  assert.match(migrations, /search_question_bank_v1/i);
});
check('question bank client uses server search RPC', () => {
  assert.match(component, /\.rpc\(['"]search_question_bank_v1['"]/);
});
check('legacy thousand-row full-bank batching is removed', () => {
  assert.doesNotMatch(component, /batchSize\s*=\s*1000/);
  assert.doesNotMatch(component, /for\s*\(let\s+from\s*=\s*0[\s\S]{0,800}\.range\(from,/);
});
check('page size is explicitly bounded to 100 or less', () => {
  const match = component.match(/const\s+PAGE_SIZE\s*=\s*(\d+)/);
  assert.ok(match, 'PAGE_SIZE constant missing');
  assert.ok(Number(match[1]) > 0 && Number(match[1]) <= 100, `PAGE_SIZE must be 1..100, got ${match[1]}`);
});
check('server request carries page information', () => {
  assert.match(component, /p_page(_size)?|p_limit|p_offset/i);
});
check('server request carries search/filter state', () => {
  assert.match(component, /p_search|p_query/i);
  assert.match(component, /p_subject|p_status|p_difficulty/i);
});
check('client does not slice an all-bank filtered array for paging', () => {
  assert.doesNotMatch(component, /filtered\.slice\(\(safePage\s*-\s*1\)\s*\*\s*PAGE_SIZE/);
});
check('select-all is page-bounded rather than selecting every matching bank row', () => {
  assert.doesNotMatch(component, /new Set\(filtered\.map\(\(question\)\s*=>\s*question\.id\)\)/);
});
check('review navigation does not depend on an all-bank filtered array', () => {
  assert.doesNotMatch(component, /filtered\.findIndex\(\(question\)\s*=>\s*question\.id\s*===\s*reviewQuestion\.id\)/);
});
check('export is not fed the entire locally filtered bank', () => {
  assert.doesNotMatch(component, /exportSchoolQuestionBank\(\{\s*questions:\s*filtered/);
});

console.log(`C9 question-bank pagination smoke: ${checks.length}/${checks.length} checks passed`);
