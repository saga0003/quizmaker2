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
