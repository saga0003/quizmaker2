export type DemoCohortStudent = {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  roll_number: string;
  track: 'PCM' | 'PCB';
  section_label: string;
  completed_tests: number;
  average_percentage?: number | null;
  average_accuracy?: number | null;
  average_time_score?: number | null;
  strongest_subject?: string | null;
  weakest_subject?: string | null;
};

export type DemoCohortProduct = {
  id: string;
  name: string;
  exam_type?: string | null;
  papers: number;
  students: number;
};

export type DemoQuestionBlueprintRow = {
  name: string;
  questions: number;
};

export type DemoCohortStudioPayload = {
  ready: boolean;
  email: string;
  batch?: {
    id: string;
    status: string;
    students: number;
    products: number;
    papers: number;
    questions: number;
    chapters: number;
    topics: number;
    test_results: number;
    subject_results: number;
    created_at: string;
    completed_at?: string | null;
  } | null;
  students: DemoCohortStudent[];
  products: DemoCohortProduct[];
  difficulty_blueprint: DemoQuestionBlueprintRow[];
  type_blueprint: DemoQuestionBlueprintRow[];
  generated_at: string;
};

export type DemoStudentSubjectRow = {
  subject_name: string;
  questions: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  marks: number;
  maximum_marks: number;
  percentage: number;
  accuracy: number;
};

export type DemoStudentChapterRow = DemoStudentSubjectRow & {
  chapter_id: string;
  chapter_name: string;
};

export type DemoStudentTopicRow = DemoStudentChapterRow & {
  topic_id: string;
  topic_name: string;
};

export type DemoStudentTestRow = {
  paper_id: string;
  paper_title: string;
  product_id: string;
  product_name: string;
  submitted_at: string;
  percentage: number;
  accuracy: number;
  time_score: number;
  correct: number;
  incorrect: number;
  unanswered: number;
};

export type DemoStudentDrilldownPayload = {
  student: {
    id: string;
    auth_user_id?: string | null;
    full_name: string;
    roll_number: string;
    track: 'PCM' | 'PCB';
    section_label: string;
  };
  summary: {
    completed_tests: number;
    average_percentage?: number | null;
    average_accuracy?: number | null;
    average_time_score?: number | null;
    correct: number;
    incorrect: number;
    unanswered: number;
  };
  subjects: DemoStudentSubjectRow[];
  chapters: DemoStudentChapterRow[];
  topics: DemoStudentTopicRow[];
  tests: DemoStudentTestRow[];
  generated_at: string;
};
