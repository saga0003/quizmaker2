import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const auth = read('src/context/AuthProvider.tsx');
const schoolHook = read('src/components/school/useSchoolPlatform.ts');
const schoolRoute = read('src/app/api/school-platform/route.ts');
const analyticsRoute = read('src/app/api/institution-analytics/route.ts');

const checks = [];
function check(label, condition) {
  if (!condition) throw new Error(`A9 regression failed: ${label}`);
  checks.push(label);
}

check('auth loads every active organization membership', auth.includes('.from("organization_members")') && auth.includes('.eq("is_active", true)') && !/from\("organization_members"\)[\s\S]{0,240}\.limit\(1\)/.test(auth));
check('active institution storage is user-specific', auth.includes('evidara:active-organization:${userId}'));
check('single membership may auto-select', auth.includes('memberships.length === 1'));
check('multi-membership accounts do not silently select first', auth.includes('Multi-institution staff must make an explicit choice') && auth.includes('setActiveOrganizationIdState(null)'));
check('stored selection is revalidated against current memberships', auth.includes('storedIsValid') && auth.includes('memberships.some((membership) => membership.organizationId === stored)'));
check('selection setter rejects organizations outside current memberships', auth.includes('if (!institutionMemberships.some((membership) => membership.organizationId === organizationId)) return;'));
check('blocking active-institution selector exists for ambiguous staff', auth.includes('evidara-active-institution') && auth.includes('Choose the school you are working in') && auth.includes('requiresInstitutionSelection'));
check('selected organization is propagated to same-origin Evidara APIs', auth.includes('X-Evidara-Organization-Id') && auth.includes('target.pathname.startsWith("/api/")'));
check('school client fails closed while selection is required', schoolHook.includes('requiresInstitutionSelection') && schoolHook.includes('Choose an active institution before opening school data.'));
check('school client sends selected organization header', schoolHook.includes('"X-Evidara-Organization-Id": activeOrganizationId'));
check('school API reads explicit active institution header', schoolRoute.includes('request.headers.get("x-evidara-organization-id")'));
check('school API rejects ambiguous multi-institution access', schoolRoute.includes('activeMembers.length > 1') && schoolRoute.includes('status: 409'));
check('school API validates selected membership instead of trusting client input', schoolRoute.includes('activeMembers.find((member) => member.organization_id === requestedOrg)') && schoolRoute.includes('status: 403'));
check('analytics API enforces the same explicit institution boundary', analyticsRoute.includes("request.headers.get('x-evidara-organization-id')") && analyticsRoute.includes('activeMemberships.length > 1') && analyticsRoute.includes('selected institution is not an active membership'));
check('analytics API no longer silently takes the first organization membership', !/from\('organization_members'\)[\s\S]{0,260}\.limit\(1\)/.test(analyticsRoute));

console.log(`A9 active-institution checks passed (${checks.length}):`);
for (const label of checks) console.log(` - ${label}`);
