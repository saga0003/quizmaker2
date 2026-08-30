import type { AppUser, AppView } from '@/store/use-app-store';
import type { EvidaraModuleAccess, EvidaraModuleKey } from '@/lib/modules';
import { phase1AllowsWorkspaceView } from '@/config/phase1-launch';

const LEGACY_VIEW_MAP: Record<string, AppView> = {
  'student-analytics': 'student-analytics-overview',
  'school-analytics': 'school-analytics-overview',
};

const MODULE_BY_VIEW: Partial<Record<AppView, EvidaraModuleKey>> = {
  'student-tests': 'papers',
  'student-analytics-overview': 'analytics',
  'student-analytics-subject': 'analytics',
  'student-analytics-chapter': 'analytics',
  'student-analytics-topic': 'analytics',
  'student-analytics-question-intelligence': 'analytics',
  'student-analytics-priorities': 'analytics',
  'student-analytics-history': 'analytics',
  'student-resources': 'resources',
  'student-store': 'subscriptions',
  'student-purchases': 'subscriptions',
  'student-referrals': 'subscriptions',
  'student-self-assessment': 'papers',
  'school-analytics-overview': 'analytics',
  'school-analytics-subject': 'analytics',
  'school-analytics-chapter': 'analytics',
  'school-analytics-topic': 'analytics',
  'school-analytics-question-intelligence': 'analytics',
  'school-analytics-priorities': 'analytics',
  'school-analytics-history': 'analytics',
  'school-questions': 'questions',
  'school-papers': 'papers',
  'school-students': 'students',
  'school-store': 'subscriptions',
  'school-entitlements': 'subscriptions',
  'school-product-seats': 'subscriptions',
  'school-subscription': 'subscriptions',
  'school-resources': 'resources',
  'admin-analytics': 'analytics',
  'admin-questions': 'questions',
  'admin-papers': 'papers',
  'admin-products': 'subscriptions',
  'admin-subscriptions': 'subscriptions',
  'admin-institutions': 'students',
  'admin-resources': 'resources',
  'admin-referrals': 'subscriptions',
  'admin-self-assessment': 'papers',
};

const APP_VIEWS = new Set<AppView>([
  'landing',
  'login',
  'register-school',
  'student-dashboard',
  'student-tests',
  'student-results',
  'student-analytics-overview',
  'student-analytics-subject',
  'student-analytics-chapter',
  'student-analytics-topic',
  'student-analytics-question-intelligence',
  'student-analytics-priorities',
  'student-analytics-history',
  'student-resources',
  'student-store',
  'student-purchases',
  'student-referrals',
  'student-self-assessment',
  'school-dashboard',
  'school-analytics-overview',
  'school-analytics-subject',
  'school-analytics-chapter',
  'school-analytics-topic',
  'school-analytics-question-intelligence',
  'school-analytics-priorities',
  'school-analytics-history',
  'school-questions',
  'school-papers',
  'school-students',
  'school-store',
  'school-entitlements',
  'school-product-seats',
  'school-subscription',
  'school-resources',
  'school-access',
  'admin-dashboard',
  'admin-analytics',
  'admin-questions',
  'admin-papers',
  'admin-products',
  'admin-subscriptions',
  'admin-institutions',
  'admin-resources',
  'admin-referrals',
  'admin-self-assessment',
  'admin-access',
]);

export function parseAppView(value?: string | null): AppView | null {
  if (!value) return null;
  const normalized = LEGACY_VIEW_MAP[value] || value;
  return APP_VIEWS.has(normalized as AppView) ? (normalized as AppView) : null;
}

export function canOpenAppView(
  user: AppUser,
  view: AppView,
  access: EvidaraModuleAccess,
): boolean {
  if (view === 'landing' || view === 'login' || view === 'register-school') return false;
  if (user.role === 'student' && !view.startsWith('student-')) return false;
  if (user.role === 'school' && !view.startsWith('school-')) return false;
  if (user.role === 'admin' && !view.startsWith('admin-')) return false;
  if (!phase1AllowsWorkspaceView(user.accessRole, view)) return false;
  const moduleKey = MODULE_BY_VIEW[view];
  return !moduleKey || access[moduleKey];
}
