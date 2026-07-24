export type TimeManagementCompletion = {
  completed_tests: number;
  total_tests: number;
  time_score_available: boolean;
  overall_time_score?: number | null;
  rating?: string | null;
};

export type TaxonomyAnalyticsProduct = {
  id: string;
  name: string;
  exam_type?: string | null;
  total_tests: number;
  completed_tests: number;
};

export type TaxonomyComparisonRow = {
  id: string;
  subject_name: string;
  chapter_id?: string;
  chapter_name: string;
  topic_name?: string;
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
  accuracy: number;
  average?: number | null;
  top10?: number | null;
  top5?: number | null;
  highest?: number | null;
  students_compared?: number | null;
};

export type StudentTaxonomyAnalyticsPayload = {
  products: TaxonomyAnalyticsProduct[];
  completion?: TimeManagementCompletion | null;
  chapters: TaxonomyComparisonRow[];
  topics: TaxonomyComparisonRow[];
  demo_taxonomy_available: boolean;
  note?: string;
  generated_at?: string;
};

export type PlatformAnalyticsSummary = {
  schools: number;
  students: number;
  active_students: number;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  time_score?: number | null;
  data_quality_warnings: number;
};

export type PlatformSchoolRow = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  board?: string | null;
  total_students: number;
  active_students: number;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  time_score?: number | null;
  last_activity?: string | null;
  section_assigned: number;
  participation: number;
  adoption_score: number;
  data_quality_warnings: number;
};

export type PlatformTaxonomyRow = {
  id: string;
  subject_name: string;
  chapter_name?: string;
  name: string;
  schools_compared: number;
  average?: number | null;
  lowest?: number | null;
  highest?: number | null;
};

export type PlatformDataQualityRow = {
  organization_id: string;
  school_name: string;
  warning_count: number;
  missing_section_assignments: number;
  no_recent_activity: boolean;
  no_completed_tests: boolean;
};

export type PlatformGovernanceRow = {
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export type PlatformAnalyticsPayload = {
  summary: PlatformAnalyticsSummary;
  schools: PlatformSchoolRow[];
  chapters: PlatformTaxonomyRow[];
  topics: PlatformTaxonomyRow[];
  data_quality: PlatformDataQualityRow[];
  recent_governance: PlatformGovernanceRow[];
  generated_at: string;
  anonymous_benchmarks: boolean;
};
