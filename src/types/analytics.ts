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
  correct: number;
  incorrect: number;
  unanswered: number;
  time_score?: number | null;
  cohort_size?: number | null;
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
  accuracy: number;
  time_score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  cohort_size?: number | null;
  average_percentage?: number | null;
  highest_percentage?: number | null;
  lowest_percentage?: number | null;
  top5_threshold?: number | null;
  top10_threshold?: number | null;
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
  created_at: string;
  completed_at?: string | null;
};

export type AnalyticsDemoStatus = {
  email: string;
  student_id?: string | null;
  account_found: boolean;
  active_batch?: AnalyticsDemoBatchStatus | null;
};
