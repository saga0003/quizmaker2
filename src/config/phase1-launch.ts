/**
 * Evidara Phase 1 launch policy.
 *
 * IMPORTANT: Advanced product engines are intentionally retained in source and database.
 * These flags only control launch visibility/access so the modules can be restored later.
 */
export const PHASE1_LAUNCH = {
  label: 'Evidara Phase 1',
  studentPriceInrPerYear: 199,
  pricingUnit: 'active_student' as const,
  teacherMaintainedQuestionBank: true,
  unlimitedStudents: false,
  unlimitedTests: true,

  // Public/direct-student growth engines are parked for the college-first launch.
  publicPractice: false,
  publicQuestionPages: false,
  publicQuestionPapers: false,
  publicTestSeries: false,
  publicProducts: false,
  directStudentCommerce: false,
  referrals: false,
  selfAssessment: false,
  schoolCommerce: false,
  publicSeoLibrary: false,

  // Requested exception: resources remain live in their existing workspaces.
  studyResources: true,

  // Advanced engines stay available to the owner for future development/testing.
  advancedModulesSuperAdminOnly: true,
  pyqToolsSuperAdminOnly: true,
  readinessSuperAdminOnly: true,
} as const;

export const PHASE1_STUDENT_HIDDEN_VIEWS = new Set<string>([
  'student-store',
  'student-purchases',
  'student-referrals',
  'student-self-assessment',
]);

export const PHASE1_SCHOOL_HIDDEN_VIEWS = new Set<string>([
  'school-store',
  'school-entitlements',
  'school-product-seats',
]);

export const PHASE1_SUPER_ADMIN_ONLY_VIEWS = new Set<string>([
  'admin-products',
  'admin-referrals',
  'admin-self-assessment',
]);

export function phase1AllowsWorkspaceView(accessRole: string | null | undefined, view: string) {
  if (PHASE1_STUDENT_HIDDEN_VIEWS.has(view)) return false;
  if (PHASE1_SCHOOL_HIDDEN_VIEWS.has(view)) return false;
  if (PHASE1_SUPER_ADMIN_ONLY_VIEWS.has(view)) return accessRole === 'super_admin';
  return true;
}
