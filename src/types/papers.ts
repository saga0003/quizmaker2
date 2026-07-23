import type { QuestionDifficulty, QuestionOptionInput, QuestionType } from "./questions";

export type PaperStatus =
  | "draft"
  | "under_review"
  | "approved"
  | "published"
  | "paused"
  | "closed"
  | "archived"
  | "rejected";

export type PaperAccessMode = "public" | "organization" | "code";
export type ResultMode = "score_only" | "score_and_answers" | "in_depth_analytics" | "after_close" | "hidden";
export type AttemptStatus = "in_progress" | "submitted" | "expired";
export type PaperSelectionMode = "manual" | "automatic" | "hybrid";
export type BiologyDivision = "combined" | "botany" | "zoology";
export type PaperTestType =
  | "full_length_mock"
  | "subject_test"
  | "chapter_test"
  | "topic_test"
  | "unit_test"
  | "diagnostic_test"
  | "scholarship_test"
  | "previous_year_paper"
  | "practice_test"
  | "foundation_test"
  | "school_test"
  | "custom_test";

export type DifficultyDistribution = Record<QuestionDifficulty, number>;

export type PaperSectionInput = {
  client_id: string;
  id?: string;
  title: string;
  subject_id?: string;
  subject_key?: string;
  biology_division?: BiologyDivision;
  instructions?: string;
  questions_to_attempt?: number;
  selection_mode?: PaperSelectionMode;
  question_target?: number;
  difficulty_distribution?: DifficultyDistribution;
  chapter_ids?: string[];
  topic_ids?: string[];
  display_order: number;
};

export type PaperQuestionInput = {
  question_id: string;
  section_client_id: string;
  display_order: number;
  marks: number;
  negative_marks: number;
  is_mandatory: boolean;
};

export type PaperPayload = {
  title: string;
  code?: string;
  description?: string;
  exam_type: string;
  grade_level?: string;
  test_type: PaperTestType;
  custom_test_type?: string;
  status: PaperStatus;
  duration_minutes: number;
  instructions?: string;
  access_mode: PaperAccessMode;
  access_code?: string;
  available_from?: string;
  available_until?: string;
  open_forever?: boolean;
  attempt_limit: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  result_mode: ResultMode;
  settings?: Record<string, unknown>;
  sections: PaperSectionInput[];
  questions: PaperQuestionInput[];
};

export type PaperListRow = {
  id: string;
  organization_id: string | null;
  created_by?: string;
  updated_by?: string | null;
  title: string;
  code: string | null;
  description: string | null;
  exam_type: string;
  grade_level?: string | null;
  test_type?: PaperTestType | null;
  custom_test_type?: string | null;
  status: PaperStatus;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
  access_mode: PaperAccessMode;
  available_from: string | null;
  available_until: string | null;
  open_forever?: boolean;
  attempt_limit: number;
  result_mode: ResultMode;
  settings?: Record<string, unknown> | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
};

export type PaperQuestionSnapshot = {
  id: string;
  stem_text: string;
  stem_latex?: string | null;
  question_image_url?: string | null;
  passage_text?: string | null;
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  marks: number;
  negative_marks: number;
  subject_name?: string | null;
  chapter_name?: string | null;
  options: QuestionOptionInput[];
};

export type StudentPaperSummary = {
  id: string;
  title: string;
  description?: string | null;
  exam_type: string;
  grade_level?: string | null;
  test_type?: PaperTestType | null;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
  available_from?: string | null;
  available_until?: string | null;
  attempt_limit: number;
  attempts_used: number;
  result_mode: ResultMode;
  access_mode: PaperAccessMode;
  access_label?: "free" | "complimentary" | "included" | "paid";
  is_previous_year_paper?: boolean;
};

export type AttemptPayload = {
  attempt_id: string;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  paper: {
    id: string;
    title: string;
    description?: string | null;
    exam_type: string;
    grade_level?: string | null;
    test_type?: PaperTestType | null;
    duration_minutes: number;
    total_marks: number;
    total_questions: number;
    instructions?: string | null;
    shuffle_options: boolean;
    result_mode: ResultMode;
  };
  sections: Array<{
    id: string;
    title: string;
    instructions?: string | null;
    questions_to_attempt?: number | null;
    display_order: number;
  }>;
  questions: Array<PaperQuestionSnapshot & {
    paper_question_id: string;
    section_id: string;
    display_order: number;
    is_mandatory: boolean;
  }>;
  responses: Array<{
    paper_question_id: string;
    response: string[] | string | number | null;
    marked_for_review: boolean;
    visited: boolean;
  }>;
};

export type AttemptResult = {
  attempt_id: string;
  paper_id: string;
  paper_title: string;
  status: AttemptStatus;
  score: number;
  maximum_marks: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  started_at: string;
  submitted_at: string | null;
  result_mode: ResultMode;
};
