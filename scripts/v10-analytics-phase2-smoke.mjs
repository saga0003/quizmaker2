import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/36_v10_analytics_phase_2.sql');
const safety = read('supabase/36a_v10_analytics_phase_2_safety.sql');
const workspace = read('src/components/analytics/AnalyticsWorkspace.tsx');
const teacher = read('src/components/analytics/TeacherAnalyticsDashboard.tsx');
const demo = read('src/components/analytics/DemoAnalyticsDataLab.tsx');
const types = read('src/types/analytics.ts');

const checks = [
  [migration.includes('analytics_demo_batches'), 'demo batch ledger'],
  [migration.includes('generate_analytics_demo_data_v10'), 'demo generator RPC'],
  [migration.includes('reset_analytics_demo_data_v10'), 'demo reset RPC'],
  [migration.includes("p_confirmation<>'RESET DEMO ANALYTICS'"), 'backend reset phrase'],
  [migration.includes('get_teacher_analytics_overview_v10'), 'teacher aggregate RPC'],
  [migration.includes('requested_evidence_rows between 10000 and 50000'), 'evidence row limits'],
  [migration.includes("'Demo NEET Incomplete Series'"), 'incomplete percentile test product'],
  [migration.includes('delete from public.exam_attempts'), 'generated attempt cleanup'],
  [migration.includes("commerce_settings->>'demo_batch_id'"), 'generated product cleanup'],
  [safety.includes('analytics_demo_section_identity_v10'), 'batch-unique section trigger'],
  [safety.includes('get_teacher_analytics_overview_base_v10'), 'distinct teacher count wrapper'],
  [workspace.includes('TeacherAnalyticsDashboard'), 'teacher workspace routing'],
  [workspace.includes('DemoAnalyticsDataLab'), 'Super Admin demo lab routing'],
  [teacher.includes("supabase.rpc('get_teacher_analytics_overview_v10'"), 'live teacher RPC usage'],
  [demo.includes('First confirmation'), 'first reset confirmation'],
  [demo.includes('Second and final confirmation'), 'second reset confirmation'],
  [demo.includes('sales.student@demo.evidara.app'), 'requested demo student email'],
  [types.includes('TeacherAnalyticsPayload'), 'teacher payload types'],
  [types.includes('AnalyticsDemoStatus'), 'demo status types'],
];

const failed = checks.filter(([ok]) => !ok);
if (failed.length) {
  for (const [, label] of failed) console.error(`Missing: ${label}`);
  process.exit(1);
}
console.log(`V10 analytics Phase 2 smoke checks passed (${checks.length} checks).`);
