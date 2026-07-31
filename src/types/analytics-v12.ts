export type AnalyticsV12View = 'overview' | 'subject' | 'chapter' | 'topic' | 'question-intelligence' | 'priorities' | 'history';

export type AnalyticsOutcome = {
  correct: number;
  incorrect: number;
  unanswered: number;
};

export type AnalyticsDifficultyRow = AnalyticsOutcome & {
  difficulty: string;
  questions: number;
  accuracy: number;
  average_seconds: number | null;
};

export type AnalyticsTaxonomyRow = AnalyticsOutcome & {
  id: string;
  name: string;
  parent_id?: string | null;
  parent_name?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  questions: number;
  attempts: number;
  accuracy: number;
  average_percentage?: number | null;
  average_seconds: number | null;
  cohort_median_seconds: number | null;
  pace_ratio: number | null;
  trend_delta: number | null;
  recent_accuracy: number | null;
  previous_accuracy: number | null;
  difficulty?: AnalyticsDifficultyRow[];
};

export type AnalyticsTrendPoint = {
  attempt_id: string;
  paper_id: string;
  paper_title: string;
  submitted_at: string;
  percentage: number;
  accuracy: number;
  cohort_average_percentage?: number | null;
  duration_minutes: number;
  correct: number;
  incorrect: number;
  unanswered: number;
};

export type AnalyticsPriority = {
  rank: number;
  level: 'high' | 'medium' | 'watch';
  subject_id: string | null;
  subject_name: string;
  chapter_id: string | null;
  chapter_name: string | null;
  topic_id: string | null;
  topic_name: string | null;
  questions: number;
  accuracy: number;
  unanswered_rate: number;
  pace_ratio: number | null;
  trend_delta: number | null;
  priority_score: number;
  reasons: string[];
  action: string;
};

export type AnalyticsHistoryRow = {
  attempt_id: string;
  paper_id: string;
  paper_title: string;
  exam_type: string | null;
  grade_level: string | null;
  submitted_at: string;
  score: number;
  maximum_marks: number;
  percentage: number;
  accuracy: number;
  cohort_average_percentage?: number | null;
  duration_minutes: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  result_mode: string | null;
};

export type AnalyticsReviewRow = {
  subject_id: string | null;
  subject_name: string;
  chapter_id: string | null;
  chapter_name: string | null;
  topic_id: string | null;
  topic_name: string | null;
  incorrect: number;
  unanswered: number;
  review_count: number;
  last_seen_at: string | null;
};

export type AnalyticsDirectoryStudent = {
  student_id: string;
  full_name: string;
  organization_id: string | null;
  organization_name: string | null;
  academic_year: string | null;
  grade: number | null;
  section_name: string | null;
};

export type ChapterErrorBreakdownRow = {
  chapter_id: string;
  topic_id: string | null;
  topic_name: string;
  concept_gap: number;
  calculation_error: number;
  careless_error: number;
  guessed: number;
  ran_out_of_time: number;
  other: number;
  unclassified: number;
  total_reviewable: number;
};

export type AnalyticsV12Payload = {
  student: {
    id: string;
    full_name: string;
    organization_id: string | null;
    organization_name: string | null;
    academic_year: string | null;
    grade: number | null;
    section_name: string | null;
  };
  summary: {
    completed_tests: number;
    total_questions: number;
    average_percentage: number;
    accuracy: number;
    percentile: number | null;
    percentile_available: boolean;
    completion_rate: number;
    time_management_score: number | null;
    time_management_label: string;
    average_response_seconds: number | null;
    cohort_median_seconds: number | null;
    pace_ratio: number | null;
    consistency_score: number | null;
    assessed_subjects: number;
    assessed_chapters: number;
    assessed_topics: number;
    trend_delta: number | null;
  };
  trend: AnalyticsTrendPoint[];
  subjects: AnalyticsTaxonomyRow[];
  chapters: AnalyticsTaxonomyRow[];
  topics: AnalyticsTaxonomyRow[];
  priorities: AnalyticsPriority[];
  history: AnalyticsHistoryRow[];
  review_queue: AnalyticsReviewRow[];
  chapter_error_breakdown?: ChapterErrorBreakdownRow[];
  evidence_policy: {
    semantic_error_types: boolean;
    confidence_self_rating: boolean;
    misconception_tags: false;
    automatic_sources: string[];
  };
  generated_at: string;
};
