import type { ParsedQuestionRow, QuestionOptionInput, QuestionPayload, QuestionType } from "@/types/questions";

const acceptedTypes = new Set<QuestionType>([
  "single_correct", "multiple_correct", "numerical", "integer",
  "assertion_reason", "match_following", "passage", "image_based",
]);

const normalize = (value: unknown) => String(value ?? "").trim();
const splitList = (value: unknown) => normalize(value).split(/[|,]/).map((x) => x.trim()).filter(Boolean);
const numberValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

function answerKeys(answer: string, type: QuestionType) {
  if (type === "numerical" || type === "integer") return answer;
  return answer.toUpperCase().split(/[|,;]/).map((x) => x.trim()).filter(Boolean);
}

export function parseQuestionRows(rows: Record<string, unknown>[]): ParsedQuestionRow[] {
  return rows.map((raw, index) => {
    const errors: string[] = [];
    const stem = normalize(raw.question || raw.stem_text);
    const subject = normalize(raw.subject);
    const questionType = (normalize(raw.question_type || "single_correct").toLowerCase().replaceAll(" ", "_") || "single_correct") as QuestionType;
    const answer = normalize(raw.correct_answer);

    if (stem.length < 5) errors.push("Question text is missing or too short.");
    if (!subject) errors.push("Subject is required.");
    if (!acceptedTypes.has(questionType)) errors.push(`Unsupported question_type: ${questionType}`);
    if (!answer) errors.push("Correct answer is required.");

    const optionKeys = ["A", "B", "C", "D", "E", "F"];
    const correctKeys = new Set(Array.isArray(answerKeys(answer, questionType)) ? answerKeys(answer, questionType) as string[] : []);
    const options: QuestionOptionInput[] = optionKeys.map((key, display_order) => ({
      option_key: key,
      content_text: normalize(raw[`option_${key.toLowerCase()}`]),
      content_latex: normalize(raw[`option_${key.toLowerCase()}_latex`]),
      image_url: normalize(raw[`option_${key.toLowerCase()}_image`]),
      is_correct: correctKeys.has(key),
      display_order,
    })).filter((option) => option.content_text || option.content_latex || option.image_url);

    if (["single_correct", "multiple_correct", "assertion_reason", "image_based", "match_following"].includes(questionType) && options.length < 2) {
      errors.push("At least two answer options are required.");
    }
    if (questionType === "single_correct" && correctKeys.size !== 1) errors.push("Single-correct questions must have exactly one correct option.");
    if (questionType === "multiple_correct" && correctKeys.size < 1) errors.push("Multiple-correct questions need at least one correct option.");
    if (correctKeys.size && [...correctKeys].some((key) => !options.some((option) => option.option_key === key))) errors.push("Correct answer refers to a missing option.");

    const payload: QuestionPayload = {
      question_type: questionType,
      status: normalize(raw.status).toLowerCase() === "approved" ? "approved" : normalize(raw.status).toLowerCase() === "in_review" ? "in_review" : "draft",
      difficulty: (normalize(raw.difficulty).toLowerCase().replaceAll(" ", "_") || "moderate") as QuestionPayload["difficulty"],
      stem_text: stem,
      stem_latex: normalize(raw.question_latex || raw.stem_latex),
      question_image_url: normalize(raw.question_image),
      passage_text: normalize(raw.passage_text),
      solution_text: normalize(raw.solution || raw.solution_text),
      solution_latex: normalize(raw.solution_latex),
      marks: numberValue(raw.marks, 4),
      negative_marks: numberValue(raw.negative_marks, 1),
      estimated_seconds: numberValue(raw.estimated_seconds, 0) || undefined,
      correct_answer: answerKeys(answer, questionType),
      exam_types: splitList(raw.exam_types || raw.exam_type),
      class_level: normalize(raw.class_level),
      source: normalize(raw.source),
      source_year: numberValue(raw.source_year, 0) || undefined,
      language: normalize(raw.language) || "English",
      tags: splitList(raw.tags),
      metadata: {
        import_subject: subject,
        import_chapter: normalize(raw.chapter),
        import_topic: normalize(raw.topic),
        question_image_filename: normalize(raw.question_image_filename || raw.question_image),
      },
      options,
    };

    return { rowNumber: index + 2, raw, payload: errors.length ? undefined : payload, errors };
  });
}

export const questionTemplateHeaders = [
  "exam_types", "class_level", "subject", "chapter", "topic", "question_type", "difficulty",
  "question", "question_latex", "question_image", "option_a", "option_a_latex", "option_a_image",
  "option_b", "option_b_latex", "option_b_image", "option_c", "option_c_latex", "option_c_image",
  "option_d", "option_d_latex", "option_d_image", "correct_answer", "solution", "solution_latex",
  "marks", "negative_marks", "estimated_seconds", "language", "source", "source_year", "tags", "status",
];
