import type { AnalyticsOrganization, AnalyticsProduct, StudentTestComparison } from './analytics';

export type AnalyticsQuestionOption = {
  option_key: string;
  content_text?: string | null;
  is_correct?: boolean;
  display_order?: number;
};

export type AnalyticsQuestionReviewRow = {
  question_number: number;
  paper_question_id: string;
  subject_name: string;
  question_text: string;
  question_type?: string | null;
  difficulty?: string | null;
  selected_keys: string[];
  selected_answer: string;
  correct_keys: string[];
  correct_answer: string;
  status: 'correct' | 'incorrect' | 'unanswered';
  marks_awarded: number;
  maximum_marks: number;
  negative_marks: number;
  time_spent_seconds: number;
  marked_for_review: boolean;
  options: AnalyticsQuestionOption[];
  solution_text?: string | null;
};

export type StudentTestReview = StudentTestComparison & {
  attempt_id?: string | null;
  questions: AnalyticsQuestionReviewRow[];
  question_count: number;
  review_generated_at: string;
};

export type SchoolAnalyticsSummary = {
  total_students: number;
  active_students: number;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  time_score?: number | null;
  participation?: number | null;
  needs_attention: number;
  strong_students: number;
  improving_students: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
};

export type SchoolAnalyticsGradeRow = {
  grade: number;
  students: number;
  active_students: number;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  participation?: number | null;
};

export type SchoolAnalyticsSectionRow = {
  section_id?: string | null;
  grade: number;
  section_name: string;
  students: number;
  active_students: number;
  completed_tests: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  participation?: number | null;
};

export type SchoolAnalyticsSubjectRow = {
  subject_name: string;
  students: number;
  average_percentage?: number | null;
  accuracy?: number | null;
  time_score?: number | null;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
};

export type SchoolAnalyticsTestRow = {
  paper_id: string;
  paper_title: string;
  product_id?: string | null;
  product_name?: string | null;
  test_takers: number;
  average_percentage?: number | null;
  lowest_percentage?: number | null;
  highest_percentage?: number | null;
  top10_threshold?: number | null;
  top5_threshold?: number | null;
  accuracy?: number | null;
  time_score?: number | null;
  latest_submission?: string | null;
};

export type SchoolAnalyticsTeacherRow = {
  teacher_id: string;
  teacher_name: string;
  subject_label: string;
  section_id: string;
  grade: number;
  section_name: string;
  students: number;
  active_students: number;
  average_percentage?: number | null;
  accuracy?: number | null;
};

export type SchoolAnalyticsDistributionRow = {
  bucket: string;
  students: number;
};

export type SchoolAnalyticsSubjectValue = {
  marks: number;
  maximum_marks: number;
  percentage: number;
  accuracy: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  time_score?: number | null;
};

export type SchoolAnalyticsStudentRow = {
  participant_key: string;
  student_id?: string | null;
  demo_student_id?: string | null;
  full_name: string;
  academic_year: string;
  grade: number;
  section_id?: string | null;
  section_name: string;
  tracks: string[];
  completed_tests: number;
  total_marks?: number | null;
  maximum_marks?: number | null;
  percentage?: number | null;
  accuracy?: number | null;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  time_score?: number | null;
  first_test_at?: string | null;
  latest_test_at?: string | null;
  first_percentage?: number | null;
  latest_percentage?: number | null;
  improvement: number;
  status: 'not_started' | 'needs_attention' | 'improving' | 'strong' | 'steady';
  subjects: Record<string, SchoolAnalyticsSubjectValue>;
};

export type AnalyticsIntervention = {
  id: string;
  student_id?: string | null;
  demo_student_id?: string | null;
  title: string;
  note?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'dismissed';
  due_date?: string | null;
  assigned_to?: string | null;
  created_at: string;
};

export type SchoolAnalyticsPayload = {
  organization: AnalyticsOrganization;
  filters: {
    academic_year?: string | null;
    grade?: number | null;
    section_id?: string | null;
    product_id?: string | null;
  };
  academic_years: string[];
  products: Array<Pick<AnalyticsProduct, 'id' | 'name' | 'exam_type' | 'total_tests'>>;
  summary: SchoolAnalyticsSummary;
  grades: SchoolAnalyticsGradeRow[];
  sections: SchoolAnalyticsSectionRow[];
  subjects: SchoolAnalyticsSubjectRow[];
  tests: SchoolAnalyticsTestRow[];
  teachers: SchoolAnalyticsTeacherRow[];
  distribution: SchoolAnalyticsDistributionRow[];
  students: SchoolAnalyticsStudentRow[];
  interventions: AnalyticsIntervention[];
  generated_at: string;
};
