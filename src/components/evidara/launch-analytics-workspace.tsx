'use client';

import { InstitutionAnalyticsWorkspace } from '@/components/institution-analytics/institution-analytics-workspace';

/**
 * Phase 1 analytics entry point.
 *
 * The platform used to open a Sales Demo-only summary first and required a
 * second click to reach the real institution analytics. That made legitimate
 * schools look as if they were missing. The analytics navigation now opens the
 * live, tenant-aware institution hierarchy directly for both platform and
 * school users. Demo/acceptance institutions, when present in the live tenant
 * data, appear in the same school list instead of through a separate screen.
 */
export function LaunchAnalyticsWorkspace({ mode }: { mode: 'platform' | 'school' }) {
  return <InstitutionAnalyticsWorkspace mode={mode} />;
}
