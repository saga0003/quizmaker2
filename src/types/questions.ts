export type QuestionType =
  | "single_correct"
  | "multiple_correct"
  | "numerical"
  | "integer"
  | "assertion_reason"
  | "match_following"
  | "passage"
  | "image_based";

export type QuestionStatus = "draft" | "in_review" | "approved" | "rejected" | "archived";
export type QuestionDifficulty = "very_easy" | "easy" | "moderate" | "difficult" | "very_difficult";
export type QuestionTestType = "full_length" | "part_test" | "chapter_test" | "topic_test" | "custom";

export type QuestionOptionInput = {
  option_key: string;
  content_text: string;
  content_latex?: string;
  image_url?: string;
  is_correct: boolean;
  display_order: number;
};

export type MatchFollowingPair = {
  id: string;
  left_key: string;
  left_text: string;
  left_latex?: string;
  left_image_url?: string;
  right_key: string;
  right_text: string;
  right_latex?: string;
  right_image_url?: string;
};

export type QuestionMetadata = {
  editor?: string;
  test_type?: QuestionTestType;
  custom_test_type?: string;
  match_pairs?: MatchFollowingPair[];
  import_subject?: string;
  import_chapter?: string;
  import_topic?: string;
  question_image_filename?: string;
  import_format?: string;
  [key: string]: unknown;
};

export type QuestionPayload = {
  subject_id?: string;
  chapter_id?: string;
  topic_id?: string;
  question_type: QuestionType;
  status: QuestionStatus;
  difficulty: QuestionDifficulty;
  stem_text: string;
  stem_latex?: string;
  question_image_url?: string;
  passage_text?: string;
  solution_text?: string;
  solution_latex?: string;
  marks: number;
  negative_marks: number;
  estimated_seconds?: number;
  correct_answer: string[] | number | string;
  exam_types: string[];
  class_level?: string;
  source?: string;
  source_year?: number;
  language: string;
  tags: string[];
  metadata?: QuestionMetadata;
  options: QuestionOptionInput[];
  change_note?: string;
};

export type QuestionRow = {
  id: string;
  organization_id: string | null;
  created_by: string;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  question_type: QuestionType;
  status: QuestionStatus;
  difficulty: QuestionDifficulty;
  stem_text: string;
  stem_latex: string | null;
  question_image_url: string | null;
  passage_text: string | null;
  solution_text: string | null;
  solution_latex: string | null;
  marks: number;
  negative_marks: number;
  estimated_seconds: number | null;
  correct_answer: unknown;
  exam_types: string[];
  class_level: string | null;
  source: string | null;
  source_year: number | null;
  language: string;
  tags: string[];
  metadata?: QuestionMetadata | null;
  version_number: number;
  created_at: string;
  updated_at: string;
  question_options?: QuestionOptionInput[];
  subjects?: { name: string; code: string } | null;
  chapters?: { name: string } | null;
  organizations?: { id: string; name: string } | null;
  profiles?: { full_name: string | null } | null;
};

export type TaxonomySubject = { id: string; name: string; code: string; organization_id: string | null };
export type TaxonomyChapter = { id: string; name: string; subject_id: string; organization_id: string | null };
export type TaxonomyTopic = { id: string; name: string; chapter_id: string; organization_id: string | null };

export type ParsedQuestionRow = {
  rowNumber: number;
  raw: Record<string, unknown>;
  payload?: QuestionPayload;
  errors: string[];
  duplicate?: boolean;
};
