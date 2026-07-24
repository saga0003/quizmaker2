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
