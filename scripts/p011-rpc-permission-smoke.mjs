import fs from 'node:fs';

const path = 'supabase/migrations/20260830203500_phase1_rpc_permission_allowlist.sql';
const sql = fs.readFileSync(path, 'utf8');

const requiredFragments = [
  "revoke execute on function %s from public, anon, authenticated",
  "grant execute on function %s to authenticated",
  "'create_institute'",
  "'is_username_available'",
  "'get_public_paper_v15'",
  "'get_public_product_v15'",
  "'get_public_question_v15'",
  "'get_store_products'",
  "'list_public_papers_v15'",
  "'list_public_products_v15'",
  "'list_public_seo_questions_v15'",
];

for (const fragment of requiredFragments) {
  if (!sql.includes(fragment)) throw new Error(`P0.11 migration is missing required permission rule: ${fragment}`);
}

const privateRpcNames = [
  'assign_paper_audience_v19',
  'preview_paper_assignment_v19',
  'search_assignment_students_v19',
  'save_exam_response',
  'record_exam_event',
  'get_exam_attempt_payload',
  'save_question',
  'save_question_paper',
  'get_student_analytics_v12',
  'get_student_analytics_scoped_v20',
];

const allowlistMatch = sql.match(/p\.proname = any\(array\[([\s\S]*?)\]::text\[\]\)/);
if (!allowlistMatch) throw new Error('P0.11 anonymous allowlist could not be parsed.');
const allowlist = allowlistMatch[1];

for (const name of privateRpcNames) {
  if (allowlist.includes(`'${name}'`)) throw new Error(`Private RPC ${name} must not be anonymous.`);
}

console.log('P0.11 RPC permission allowlist checks passed.');
