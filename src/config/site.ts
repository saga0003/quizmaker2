export const siteConfig = {
  brandName: 'Evidara',
  legalEntityName: process.env.NEXT_PUBLIC_EVIDARA_LEGAL_ENTITY_NAME?.trim() || 'Evidara',
  supportEmail: process.env.NEXT_PUBLIC_EVIDARA_SUPPORT_EMAIL?.trim() || 'support@evidara.natscix.com',
  supportPhone: process.env.NEXT_PUBLIC_EVIDARA_SUPPORT_PHONE?.trim() || '',
  businessAddress: process.env.NEXT_PUBLIC_EVIDARA_BUSINESS_ADDRESS?.trim() || 'Chikmagalur, Karnataka, India',
  websiteUrl: 'https://evidara.natscix.com',
  effectiveDate: '19 July 2026',
} as const;

// Keep this as an internal readiness signal. Public pages intentionally never
// expose setup instructions or placeholder warnings to visitors.
export const legalDetailsConfigured = Boolean(
  process.env.NEXT_PUBLIC_EVIDARA_LEGAL_ENTITY_NAME?.trim()
  && process.env.NEXT_PUBLIC_EVIDARA_SUPPORT_EMAIL?.trim()
  && process.env.NEXT_PUBLIC_EVIDARA_BUSINESS_ADDRESS?.trim(),
);
