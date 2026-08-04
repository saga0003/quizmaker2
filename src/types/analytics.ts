export type AnalyticsViewerRole = 'student' | 'school_teacher' | 'school_admin' | 'evidara_admin' | 'super_admin';

export type AnalyticsOrganization = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  board?: string | null;
};

export type AnalyticsSection = {
  id: string;
  organization_id: string;
  academic_year: string;
  grade: number;
  name: string;
  code?: string | null;
  is_active: boolean;
};

export type AnalyticsStudent = {
  student_id: string;
  membership_id: string;
  full_name: string;
  organization_id: string;
  academic_year: string;
  grade: number;
  section_id?: string | null;
  section_name: string;
  board: string;
  tracks: string[];
};

export type AnalyticsTeacher = {
  teacher_id: string;
  full_name: string;
  organization_id: string;
  member_role: string;
};

export type TeacherSectionAssignment = {
  id: string;
  section_id: string;
  teacher_id: string;
  subject_label: string;
  is_active: boolean;
};

export type AnalyticsScope = {
  viewer_role: AnalyticsViewerRole;
  organizations: AnalyticsOrganization[];
  sections: AnalyticsSection[];
  students: AnalyticsStudent[];
  teachers: AnalyticsTeacher[];
  teacher_assignments: TeacherSectionAssignment[];
};

export type AnalyticsProduct = {
  id: string;
  name: string;
  exam_type?: string | null;
  total_tests: number;
  completed_tests: number;
  first_completed_date?: string | null;
  last_completed_date?: string | null;
  percentile_available?: boolean;
};

export type StudentAnalyticsIdentity = {
  id: string;
  full_name: string;
  organization_id?: string | null;
  organization_name?: string | null;
  academic_year?: string | null;
  grade?: number | null;
  section_id?: string | null;
  section_name?: string | null;
  board?: string | null;
  tracks?: string[];
};

export type AnalyticsSummary = {
  completed_tests: number;
  average_percentage?: number | null;
  average_percentile?: number | null;
  percentile_available: boolean;
  accuracy?: number | null;
  attempted_accuracy?: number | null;
  correct: number;
  incorrect: number;
  unanswered: number;
  total_questions?: number | null;
  time_score?: number | null;
  cohort_size?: number | null;
  comparison_average_percentage?: number | null;
  top10_threshold?: number | null;
  top5_threshold?: number | null;
  highest_percentage?: number | null;
  from_date?: string | null;
  to_date?: string | null;
};

export type SubjectAnalyticsRow = {
  subject_name: string;
  student_percentage: number;
  student_marks: number;
  maximum_marks: number;
  questions: number;
  correct: number;
  incorrect: number;
  cohort_size?: number | null;
  average_percentage?: number | null;
  highest_percentage?: number | null;
  lowest_percentage?: number | null;
  top5_threshold?: number | null;
  top10_threshold?: number | null;
  student_accuracy?: number | null;
  student_attempted_accuracy?: number | null;
  average_accuracy?: number | null;
  highest_accuracy?: number | null;
  lowest_accuracy?: number | null;
  top5_accuracy?: number | null;
  top10_accuracy?: number | null;
  student_time_score?: number | null;
  average_time_score?: number | null;
  highest_time_score?: number | null;
  lowest_time_score?: number | null;
  top5_time_score?: number | null;
  top10_time_score?: number | null;
};

export type AnalyticsTrendRow = {
  attempt_id: string;
  paper_id: string;
  paper_title: string;
  submitted_at: string;
  score: number;
  maximum_marks: number;
  percentage: number;
  percentile?: number | null;
  student_percentile?: number | null;
  accuracy: number;
  attempted_accuracy?: number | null;
  time_score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  cohort_size?: number | null;
  test_takers?: number | null;
  rank_position?: number | null;
  average_percentage?: number | null;
  highest_percentage?: number | null;
  lowest_percentage?: number | null;
  top5_threshold?: number | null;
  top10_threshold?: number | null;
  percentage_average?: number | null;
  percentage_highest?: number | null;
  percentage_lowest?: number | null;
  percentage_top5?: number | null;
  percentage_top10?: number | null;
  accuracy_average?: number | null;
  accuracy_highest?: number | null;
  accuracy_lowest?: number | null;
  accuracy_top5?: number | null;
  accuracy_top10?: number | null;
  attempted_accuracy_average?: number | null;
  attempted_accuracy_highest?: number | null;
  attempted_accuracy_lowest?: number | null;
  attempted_accuracy_top5?: number | null;
  attempted_accuracy_top10?: number | null;
  time_average?: number | null;
  time_highest?: number | null;
  time_lowest?: number | null;
  time_top5?: number | null;
  time_top10?: number | null;
  percentile_average?: number | null;
  percentile_highest?: number | null;
  percentile_top5?: number | null;
  percentile_top10?: number | null;
};

export type AnalyticsTimelineRow = {
  paper_id: string;
  display_name: string;
  display_order?: number;
  completed: boolean;
  submitted_at?: string | null;
  percentage?: number | null;
};

export type StudentAnalyticsPayload = {
  student: StudentAnalyticsIdentity | null;
  products: AnalyticsProduct[];
  selected_product: AnalyticsProduct | null;
  summary: AnalyticsSummary;
  subjects: SubjectAnalyticsRow[];
  trends: AnalyticsTrendRow[];
  timeline: AnalyticsTimelineRow[];
  generated_at: string;
  comparison_engine?: string;
};

export type MetricComparisonSnapshot = {
  average?: number | null;
  lowest?: number | null;
  highest?: number | null;
  top10?: number | null;
  top5?: number | null;
};

export type StudentTestComparison = {
  paper_id: string;
  paper_title: string;
  product_id?: string | null;
  product_name?: string | null;
  submitted_at?: string | null;
  completed: boolean;
  test_takers: number;
  rank_position?: number | null;
  student_percentile?: number | null;
  student: {
    score?: number | null;
    maximum_marks?: number | null;
    percentage?: number | null;
    correct: number;
    incorrect: number;
    unanswered: number;
    accuracy?: number | null;
    attempted_accuracy?: number | null;
    time_score?: number | null;
  };
  percentage: MetricComparisonSnapshot;
  accuracy: MetricComparisonSnapshot;
  attempted_accuracy: MetricComparisonSnapshot;
  time_score: MetricComparisonSnapshot;
};

export type TeacherAnalyticsSummary = {
  total_students: number;
  active_students: number;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  participation?: number | null;
  needs_attention: number;
  improving: number;
  strong: number;
};

export type TeacherAnalyticsSectionRow = {
  id: string;
  organization_id: string;
  organization_name: string;
  academic_year: string;
  grade: number;
  name: string;
  students: number;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
};

export type TeacherAnalyticsStudentRow = {
  student_id: string;
  membership_id: string;
  section_id: string;
  full_name: string;
  grade: number;
  section_name: string;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  first_test_at?: string | null;
  latest_test_at?: string | null;
  first_percentage?: number | null;
  latest_percentage?: number | null;
  improvement: number;
  performance_status: 'not_started' | 'needs_attention' | 'improving' | 'strong' | 'steady';
};

export type TeacherAnalyticsSubjectRow = {
  subject_name: string;
  responses: number;
  correct: number;
  incorrect: number;
  accuracy?: number | null;
  average_percentage?: number | null;
};

export type TeacherAnalyticsTrendRow = {
  date: string;
  completed_tests: number;
  active_students: number;
  average_percentage?: number | null;
  accuracy?: number | null;
};

export type TeacherAnalyticsPayload = {
  summary: TeacherAnalyticsSummary;
  sections: TeacherAnalyticsSectionRow[];
  students: TeacherAnalyticsStudentRow[];
  subjects: TeacherAnalyticsSubjectRow[];
  trends: TeacherAnalyticsTrendRow[];
  generated_at: string;
};

export type AnalyticsDemoBatchStatus = {
  id: string;
  status: 'generating' | 'ready' | 'resetting' | 'reset' | 'failed';
  requested_evidence_rows: number;
  attempts: number;
  responses: number;
  papers: number;
  products: number;
  students?: number;
  test_results?: number;
  subject_results?: number;
  created_at: string;
  completed_at?: string | null;
};

export type AnalyticsDemoStatus = {
  email: string;
  student_id?: string | null;
  account_found: boolean;
  active_batch?: AnalyticsDemoBatchStatus | null;
};

export type AnalyticsDemoProduct = {
  id: string;
  name: string;
  track: 'PCM' | 'PCB';
  series_number: number;
  total_tests: number;
};

export type AnalyticsDemoStudentRow = {
  id: string;
  auth_user_id?: string | null;
  roll_number: string;
  full_name: string;
  track: 'PCM' | 'PCB';
  section_label: string;
  completed_tests: number;
  total_marks: number;
  maximum_marks: number;
  percentage: number;
  subjects: Record<string, number>;
  completed_series: number;
  available_series: number;
  percentile_unlocked: boolean;
};

export type AnalyticsDemoStudentTablePayload = {
  products: AnalyticsDemoProduct[];
  students: AnalyticsDemoStudentRow[];
  generated_at: string;
};
