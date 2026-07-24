import type { QuestionDifficulty, QuestionType } from './questions';

export type QuestionCollectionVisibility = 'private' | 'school' | 'platform';
export type QuestionCollectionStatus = 'draft' | 'active' | 'archived';

export type QuestionCollectionSummary = {
  id: string;
  organization_id?: string | null;
  owner_id: string;
  name: string;
  description?: string | null;
  exam_types: string[];
  class_levels: string[];
  subject_id?: string | null;
  chapter_ids: string[];
  topic_ids: string[];
  difficulties: QuestionDifficulty[];
  question_types: QuestionType[];
  visibility: QuestionCollectionVisibility;
  status: QuestionCollectionStatus;
  linked_paper_id?: string | null;
  metadata?: Record<string, unknown>;
  question_count: number;
  total_marks: number;
  subjects: string[];
  can_manage: boolean;
  created_at: string;
  updated_at: string;
};

export type QuestionCollectionItem = {
  id: string;
  question_id: string;
  display_order: number;
  note?: string | null;
  stem_text: string;
  question_type: QuestionType;
  difficulty: QuestionDifficulty;
  marks: number;
  negative_marks: number;
  class_level?: string | null;
  exam_types: string[];
  status: string;
  subject_id?: string | null;
  subject_name?: string | null;
  chapter_id?: string | null;
  chapter_name?: string | null;
  topic_id?: string | null;
  topic_name?: string | null;
  tags: string[];
};

export type QuestionCollectionDetail = QuestionCollectionSummary & {
  items: QuestionCollectionItem[];
};

export type QuestionCollectionListPayload = {
  collections: QuestionCollectionSummary[];
  generated_at: string;
};

export type ReferenceDifficultyRow = {
  subject_name: string;
  difficulty: string;
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
  average_time_seconds: number;
};

export type ReferenceQuestionTypeRow = {
  subject_name: string;
  question_type: string;
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
  average_time_seconds: number;
};

export type ReferenceTagRow = {
  subject_name: string;
  chapter_name?: string | null;
  topic_name?: string | null;
  name: string;
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  percentage: number;
};

export type ReferenceIncorrectQuestion = {
  paper_id: string;
  question_id?: string | null;
  subject_name: string;
  chapter_name?: string | null;
  topic_name?: string | null;
  question_text: string;
  difficulty: string;
  question_type: string;
  time_spent_seconds: number;
};

export type StudentAnalyticsGoal = {
  id: string;
  student_id: string;
  product_id?: string | null;
  subject_name?: string | null;
  chapter_id?: string | null;
  topic_id?: string | null;
  title: string;
  metric: 'percentage' | 'accuracy' | 'time_score' | 'tests_completed';
  target_value: number;
  current_value?: number | null;
  due_date?: string | null;
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type StudentPracticeCollection = {
  id: string;
  name: string;
  description?: string | null;
  exam_types: string[];
  class_levels: string[];
  visibility: QuestionCollectionVisibility;
  linked_paper_id?: string | null;
  paper_status?: string | null;
  paper_title?: string | null;
  question_count: number;
  subjects: string[];
};

export type StudentReferenceBreakdowns = {
  difficulty: ReferenceDifficultyRow[];
  question_types: ReferenceQuestionTypeRow[];
  tags: ReferenceTagRow[];
  incorrect_questions: ReferenceIncorrectQuestion[];
  goals: StudentAnalyticsGoal[];
  practice_collections: StudentPracticeCollection[];
  supported_evidence: {
    semantic_error_types: boolean;
    confidence_score: boolean;
    question_target_time: boolean;
  };
  generated_at: string;
};

export type ReferenceTaxonomyDetailRow = {
  id: string;
  subject_name: string;
  chapter_id?: string | null;
  chapter_name: string;
  topic_id?: string | null;
  topic_name?: string | null;
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  marks_awarded: number;
  maximum_marks: number;
  percentage: number;
  accuracy: number;
  attempt_rate: number;
  average_time_seconds: number;
};

export type ReferenceTaxonomyDetailPayload = {
  chapters: ReferenceTaxonomyDetailRow[];
  topics: ReferenceTaxonomyDetailRow[];
  generated_at: string;
};
