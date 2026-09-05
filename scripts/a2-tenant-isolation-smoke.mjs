import { readFileSync } from 'node:fs';

const audit = readFileSync('supabase/tests/tenant_isolation_policy_audit.sql', 'utf8');
const schoolPlatform = readFileSync('src/app/api/school-platform/route.ts', 'utf8');
const institutionAnalytics = readFileSync('src/app/api/institution-analytics/route.ts', 'utf8');
const assignment = readFileSync('src/components/evidara/paper-assignment-center.tsx', 'utf8');

const checks = [
  ['membership audit covers student self access', /student_id = auth\.uid\(\)/.test(audit)],
  ['membership audit covers organization manager scope', /is_evidara_school_manager\(organization_id\)/.test(audit)],
  ['membership audit covers teacher section scope', /is_evidara_teacher_for_section\(organization_id, section_id\)/.test(audit)],
  ['question audit covers organization manager boundary', /question RLS[\s\S]*is_evidara_school_manager\(organization_id\)/i.test(audit)],
  ['paper audit ties student membership to paper organization', /m\.organization_id = question_papers\.organization_id/.test(audit)],
  ['assignment audit covers staff organization boundary', /is_evidara_school_staff\(organization_id\)/.test(audit)],
  ['attempt audit traverses paper organization', /is_paper_manager\(p\.organization_id\)/.test(audit)],
  ['analytics audit covers institution and section authorization', /analytics_can_view_student_v12/.test(audit) && /teacher_section_assignments/.test(audit)],
  ['school platform membership mutations scope by organization', /\.eq\("organization_id", organizationId\)/.test(schoolPlatform)],
  ['institution analytics rejects another school', /You cannot view analytics for another school/.test(institutionAnalytics)],
  ['institution analytics attempts can be organization filtered', /query = query\.eq\('organization_id', organizationId\)/.test(institutionAnalytics)],
  ['teacher analytics checks assigned sections', /allowedSectionIds/.test(institutionAnalytics) && /This class is not assigned to the signed-in teacher/.test(institutionAnalytics)],
  ['assignment UI sends current organization context', /organizationId/.test(assignment)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`A2 tenant-isolation smoke failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`A2 tenant-isolation smoke passed: ${checks.length}/${checks.length}.`);
