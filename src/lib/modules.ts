import type { EvidaraRole } from '@/lib/roles';

export const EVIDARA_MODULE_KEYS = [
  'questions',
  'papers',
  'students',
  'analytics',
  'resources',
  'subscriptions',
] as const;

export const EVIDARA_MODULE_SET = new Set<string>(EVIDARA_MODULE_KEYS);

export type EvidaraModuleKey = (typeof EVIDARA_MODULE_KEYS)[number];

export type EvidaraModuleAccess = Record<EvidaraModuleKey, boolean>;

export function isHardLockedModule(role: EvidaraRole, moduleKey: EvidaraModuleKey) {
  if (role === 'student') return ['questions', 'students', 'subscriptions'].includes(moduleKey);
  if (role === 'school_teacher') return ['students', 'subscriptions'].includes(moduleKey);
  return false;
}
