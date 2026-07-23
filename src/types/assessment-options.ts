export type AssessmentOptionGroup = 'grade' | 'exam_type' | 'test_type';

export type AssessmentOption = {
  id: string;
  organization_id: string | null;
  option_group: AssessmentOptionGroup;
  value: string;
  label: string;
  code: string | null;
  display_order: number;
  is_active: boolean;
  metadata?: Record<string, unknown> | null;
};

export const FALLBACK_ASSESSMENT_OPTIONS: Record<AssessmentOptionGroup, AssessmentOption[]> = {
  grade: [
    'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12',
    'NEET Long Term', 'JEE Long Term',
  ].map((label, display_order) => ({ id: `fallback-grade-${display_order}`, organization_id: null, option_group: 'grade' as const, value: label, label, code: null, display_order, is_active: true })),
  exam_type: [
    'NEET', 'JEE Main', 'JEE Advanced', 'KCET', 'School MCQ', 'Olympiad',
    'Foundation', 'Scholarship Exam', 'Board',
  ].map((label, display_order) => ({ id: `fallback-exam-${display_order}`, organization_id: null, option_group: 'exam_type' as const, value: label, label, code: null, display_order, is_active: true })),
  test_type: [
    ['full_length_mock', 'Full-length mock test'],
    ['subject_test', 'Subject test'],
    ['chapter_test', 'Chapter test'],
    ['topic_test', 'Topic test'],
    ['unit_test', 'Unit test'],
    ['diagnostic_test', 'Diagnostic test'],
    ['scholarship_test', 'Scholarship test'],
    ['previous_year_paper', 'Previous-year paper'],
    ['practice_test', 'Practice test'],
    ['foundation_test', 'Foundation test'],
    ['school_test', 'School test'],
    ['custom_test', 'Custom test'],
  ].map(([value, label], display_order) => ({ id: `fallback-test-${display_order}`, organization_id: null, option_group: 'test_type' as const, value, label, code: null, display_order, is_active: true })),
};
