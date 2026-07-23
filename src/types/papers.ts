import type { QuestionDifficulty, QuestionOptionInput, QuestionType } from "./questions";

export type PaperStatus = "draft" | "published" | "archived";
export type PaperWorkflowStatus =
  | "draft"
  | "submitted_for_review"
  | "changes_requested"
  | "approved"
  | "published"
  | "paused"
  | "closed"
  | "archived";
export type PaperCreationMode = "manual" | "automatic" | "hybrid";
export type PaperType =
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
export type PaperCopyScope = "entire" | "settings" | "sections" | "blueprint" | "questions";
export type PaperAccessMode = "public" | "organization" | "code";
export type ResultMode = "score_only" | "score_and_answers" | "after_close" | "hidden";
export type AttemptStatus = "in_progress" | "submitted" | "expired";

export type PaperProgramme = {
  id: string;
  code: string;
  name: string;
  category: "foundation" | "grade" | "entrance" | "olympiad" | "scholarship" | "custom";
  grade_label: string | null;
  allowed_subject_codes: string[];
  sort_order: number;
  is_active: boolean;
};

export type PaperSectionInput = {
  client_id: string;
  id?: string;
  title: string;
  code?: string;
  description?: string;
  subject_id?: string;
  instructions?: string;
  questions_to_attempt?: number;
  minimum_questions_to_attempt?: number;
  total_questions?: number;
  maximum_marks?: number;
  is_optional?: boolean;
  selection_mode?: PaperCreationMode;
  duration_minutes?: number;
  navigation_rules?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  display_order: number;
};

export type PaperQuestionInput = {
  question_id: string;
  section_client_id: string;
  display_order: number;
  marks: number;
  negative_marks: number;
  is_mandatory: boolean;
  is_locked?: boolean;
  generation_source?: "manual" | "automatic" | "hybrid" | "replacement";
  shuffle_restricted?: boolean;
  position_locked?: boolean;
  is_bonus?: boolean;
  is_cancelled?: boolean;
  grace_marks?: number;
  metadata?: Record<string, unknown>;
};

export type PaperPayload = {
  title: string;
  code?: string;
  description?: string;
  exam_type: string;
  status: PaperStatus;
  duration_minutes: number;
  instructions?: string;
  access_mode: PaperAccessMode;
  access_code?: string;
  available_from?: string;
  available_until?: string;
  attempt_limit: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  result_mode: ResultMode;
  sections: PaperSectionInput[];
  questions: PaperQuestionInput[];
};

export type PaperDefinitionPayloadV8 = {
  title: string;
  code?: string;
  slug?: string;
  description?: string;
  detailed_description?: string;
  paper_type: PaperType;
  academic_year?: string;
  language: string;
  tags: string[];
  internal_notes?: string;
  programme_code?: string;
  subject_ids: string[];
  creation_mode: PaperCreationMode;
  duration_minutes: number;
  reading_time_minutes: number;
  grace_time_minutes: number;
  auto_submit: boolean;
  instructions?: string;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  shuffle_mode: "fixed" | "all" | "within_sections" | "sections";
  preserve_locked_positions: boolean;
  default_positive_marks?: number;
  default_negative_marks?: number;
  unanswered_marks: number;
  allow_partial_marking: boolean;
  numerical_tolerance?: number;
  allow_previously_used: boolean;
  prefer_unused: boolean;
  only_unused: boolean;
  exclude_used_within_days?: number;
  exclude_used_more_than?: number;
  builder_settings?: Record<string, unknown>;
  sections: PaperSectionInput[];
  questions: PaperQuestionInput[];
};

export type PaperListRow = {
  id: string;
  organization_id: string | null;
  title: string;
  code: string | null;
  description: string | null;
  exam_type: string;
  paper_type?: PaperType | null;
  programme_code?: string | null;
  workflow_status?: PaperWorkflowStatus | null;
  creation_mode?: PaperCreationMode | null;
  version_number?: number | null;
  status: PaperStatus;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
  access_mode: PaperAccessMode;
  available_from: string | null;
  available_until: string | null;
  attempt_limit: number;
  result_mode: ResultMode;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
};

export type PaperDuplicateResult = {
  paper_id: string;
  code: string;
  title: string;
  workflow_status: "draft";
  legacy_status: "draft";
  copy_scope: PaperCopyScope;
  total_questions: number;
  total_marks: number;
};

export type PaperValidationIssue = {
  code: string;
  message: string;
  [key: string]: unknown;
};

export type PaperValidationResult = {
  validation_id: string;
  valid: boolean;
  critical: PaperValidationIssue[];
  warnings: PaperValidationIssue[];
  summary: {
    sections: number;
    subjects: number;
    questions: number;
    maximum_marks: number;
    configured_duration_minutes: number;
    estimated_solving_minutes: number;
  };
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
