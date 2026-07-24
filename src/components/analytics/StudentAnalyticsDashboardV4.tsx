'use client';

import { StudentAnalyticsDashboardV3 } from './StudentAnalyticsDashboardV3';
import { StudentTaxonomyAnalyticsPanel } from './StudentTaxonomyAnalyticsPanel';

export function StudentAnalyticsDashboardV4({ studentId, onBack }: { studentId: string; onBack?: () => void }) {
  return <div className="phase4-student-analytics space-y-6">
    <StudentAnalyticsDashboardV3 studentId={studentId} onBack={onBack} />
    <StudentTaxonomyAnalyticsPanel studentId={studentId} />
  </div>;
}
