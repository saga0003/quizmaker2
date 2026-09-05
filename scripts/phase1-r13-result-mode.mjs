#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const ACK = 'YES_I_UNDERSTAND_NON_PRODUCTION_ONLY';
const ORG_SLUG = 'evidara-school-acceptance';
const PAPER_ID = 'e5801a88-1e7f-4b4f-a715-ad44ce2b3c43';
const PAPER_TITLE = 'Phase 1 R8 Physics Acceptance Test';
const ALLOWED = new Set(['in_depth_analytics', 'score_only']);

function env(name) {
  const value = (process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function main() {
  if (process.env.EVIDARA_LOAD_ACCEPTANCE !== ACK || env('EVIDARA_ACCEPTANCE_ORG_SLUG') !== ORG_SLUG) {
    throw new Error('R13 result-mode synthetic tenant guard failed');
  }
  const target = process.argv[2];
  if (!ALLOWED.has(target)) throw new Error('Usage: phase1-r13-result-mode.mjs in_depth_analytics|score_only');

  const client = createClient(env('NEXT_PUBLIC_SUPABASE_URL'), env('SUPABASE_SECRET_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: org, error: orgError } = await client.from('organizations').select('id,slug').eq('slug', ORG_SLUG).single();
  if (orgError) throw orgError;
  if (!org || org.slug !== ORG_SLUG) throw new Error('R13 isolated organization missing');

  const { data: paper, error: paperError } = await client.from('question_papers')
    .select('id,title,organization_id,result_mode')
    .eq('id', PAPER_ID).eq('organization_id', org.id).single();
  if (paperError) throw paperError;
  if (!paper || paper.title !== PAPER_TITLE || paper.organization_id !== org.id) throw new Error('R13 guarded synthetic paper mismatch');

  const { data: updated, error: updateError } = await client.from('question_papers')
    .update({ result_mode: target, updated_at: new Date().toISOString() })
    .eq('id', PAPER_ID).eq('organization_id', org.id).eq('title', PAPER_TITLE)
    .select('id,title,result_mode').single();
  if (updateError) throw updateError;
  if (!updated || updated.result_mode !== target) throw new Error(`R13 result mode failed to become ${target}`);

  console.log(JSON.stringify({ organizationSlug: ORG_SLUG, paperId: PAPER_ID, resultMode: updated.result_mode, isolatedSyntheticOnly: true }));
}

main().catch((error) => {
  console.error(`R13 RESULT MODE FAILED: ${error?.message || error}`);
  process.exit(1);
});
