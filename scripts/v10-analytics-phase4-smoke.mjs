import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const migration = read('supabase/38_v10_analytics_phase_4.sql');
const engine = read('supabase/38a_v10_analytics_phase_4_engine.sql');
const hardening = read('supabase/38b_v10_analytics_phase_4_hardening.sql');
const studentPanel = read('src/components/analytics/StudentTaxonomyAnalyticsPanel.tsx');
const studentV4 = read('src/components/analytics/StudentAnalyticsDashboardV4.tsx');
const platform = read('src/components/analytics/PlatformAdminAnalyticsDashboard.tsx');
const workspace = read('src/components/analytics/AnalyticsWorkspacePhase4.tsx');
const page = read('src/app/page.tsx');
const types = read('src/types/analytics-phase4.ts');
const docs = read('docs/EVIDARA_V10_ANALYTICS_PHASE_4.md');

const checks = [
  [migration.includes('analytics_time_management_score_v12'), 'simple time-management function'],
  [migration.includes('0.50*v_completion') && migration.includes('0.30*v_accuracy') && migration.includes('0.20*v_time_control'), '50/30/20 time formula'],
  [migration.includes('v_actual<0.50*v_duration_seconds') && migration.includes('v_accuracy<0.60'), 'rushing penalty'],
  [migration.includes('p_ended_automatically') && migration.includes('v_attempted<v_total'), 'automatic timeout penalty'],
  [migration.includes("'Needs Improvement'") && migration.includes("'Excellent'"), 'time rating labels'],
  [migration.includes('analytics_demo_chapters_v12'), 'generated chapter table'],
  [migration.includes('analytics_demo_topics_v12'), 'generated topic table'],
  [migration.includes('analytics_demo_topic_results_v12'), 'topic result evidence table'],
  [migration.includes("'phase4_chapters',16") && migration.includes("'phase4_topics',48"), '16 chapter and 48 topic demo metadata'],
  [migration.includes('get_student_taxonomy_analytics_v12'), 'student taxonomy RPC'],
  [migration.includes('reset_analytics_demo_data_base_v12'), 'Phase 4 reset wrapper'],
  [engine.includes('analytics_attempt_time_snapshot_v12'), 'real and demo time snapshot'],
  [engine.includes('get_platform_analytics_overview_v12'), 'platform command centre RPC'],
  [engine.includes('anonymous_benchmarks'), 'anonymous platform benchmarks'],
  [hardening.includes("array['student_time_score'"), 'subject time completion lock'],
  [studentPanel.includes('Simple time-management indicator'), 'student time methodology panel'],
  [studentPanel.includes('Chapter and topic analytics'), 'student chapter topic UI'],
  [studentPanel.includes('Export chapter') || studentPanel.includes('Export {level} CSV'), 'student taxonomy export'],
  [studentV4.includes('StudentTaxonomyAnalyticsPanel'), 'Phase 4 student composition'],
  [platform.includes('Evidara analytics command centre'), 'platform dashboard UI'],
  [platform.includes('Chapters & topics'), 'platform taxonomy tab'],
  [platform.includes('Data quality'), 'platform data-quality tab'],
  [platform.includes('Governance'), 'platform governance tab'],
  [workspace.includes('PlatformAdminAnalyticsDashboard'), 'platform role routing'],
  [workspace.includes('Back to platform overview'), 'school drill-down return'],
  [page.includes('AnalyticsWorkspacePhase4'), 'application routes Phase 4'],
  [types.includes('PlatformAnalyticsPayload') && types.includes('StudentTaxonomyAnalyticsPayload'), 'Phase 4 payload types'],
  [docs.includes('No target time is assigned to individual questions') || docs.includes('no individual-question target time'), 'no question target-time claim'],
];

const failed = checks.filter(([passed]) => !passed);
for (const [passed, label] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
if (failed.length) {
  console.error(`\n${failed.length} Analytics Phase 4 smoke checks failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} Analytics Phase 4 smoke checks passed.`);
