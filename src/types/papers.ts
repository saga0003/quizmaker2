import type { QuestionDifficulty, QuestionOptionInput, QuestionType } from "./questions";

export type PaperStatus = "draft" | "published" | "archived";
export type PaperAccessMode = "public" | "organization" | "code";
export type ResultMode = "score_only" | "score_and_answers" | "after_close" | "hidden";
export type AttemptStatus = "in_progress" | "submitted" | "expired";

export type PaperSectionInput = {
  client_id: string;
  id?: string;
  title: string;
  subject_id?: string;
  instructions?: string;
  questions_to_attempt?: number;
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

export type PaperListRow = {
  id: string;
  organization_id: string | null;
  title: string;
  code: string | null;
  description: string | null;
  exam_type: string;
  status: PaperStatus;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
  access_mode: PaperAccessMode;
  available_from: string | null;
  available_until: string | null;
  attempt_limit: number;
  result_mode: ResultMode;
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
