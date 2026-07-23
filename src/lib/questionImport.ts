import type {
  MatchFollowingPair,
  ParsedQuestionRow,
  QuestionDifficulty,
  QuestionOptionInput,
  QuestionPayload,
  QuestionStatus,
  QuestionType,
} from "@/types/questions";

const acceptedTypes = new Set<QuestionType>([
  "single_correct", "multiple_correct", "numerical", "integer",
  "assertion_reason", "match_following", "passage", "image_based",
]);
const acceptedDifficulties = new Set<QuestionDifficulty>([
  "very_easy", "easy", "moderate", "difficult", "very_difficult",
]);
const acceptedStatuses = new Set<QuestionStatus>(["draft", "in_review", "approved"]);
const acceptedLanguages = new Set(["english", "kannada", "hindi", "bilingual"]);

const normalize = (value: unknown) => String(value ?? "").trim();
const splitList = (value: unknown) => normalize(value).split(/[|,]/).map((x) => x.trim()).filter(Boolean);
const numberValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const slugValue = (value: unknown) => normalize(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

function normalizedQuestionType(value: unknown) {
  const raw = slugValue(value || "single_correct");
  const aliases: Record<string, QuestionType> = {
    mcq: "single_correct",
    single_mcq: "single_correct",
    single_correct_mcq: "single_correct",
    multiple_mcq: "multiple_correct",
    multi_correct: "multiple_correct",
    numeric: "numerical",
    assertion_and_reason: "assertion_reason",
    image: "image_based",
  };
  return (aliases[raw] || raw || "single_correct") as QuestionType;
}

function normalizedDifficulty(value: unknown) {
  const raw = slugValue(value || "moderate");
  const aliases: Record<string, QuestionDifficulty> = {
    medium: "moderate",
    hard: "difficult",
    very_hard: "very_difficult",
  };
  return (aliases[raw] || raw || "moderate") as QuestionDifficulty;
}

function normalizedStatus(value: unknown) {
  const raw = slugValue(value || "draft");
  const aliases: Record<string, QuestionStatus> = {
    review: "in_review",
    pending_review: "in_review",
    publish: "approved",
    published: "approved",
  };
  return (aliases[raw] || raw || "draft") as QuestionStatus;
}

function normalizedLanguage(value: unknown) {
  const raw = normalize(value || "English");
  if (!raw) return "English";
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function answerKeys(answer: string, type: QuestionType) {
  if (type === "numerical" || type === "integer") return answer;
  return answer.toUpperCase().split(/[|,;]/).map((x) => x.trim()).filter(Boolean);
}

function parseMatchPairs(raw: Record<string, unknown>, answer: string): MatchFollowingPair[] {
  const mappings = new Map<string, string>();
  answer.toUpperCase().split(/[|,;]/).map((value) => value.trim()).filter(Boolean).forEach((value) => {
    const match = value.match(/^([A-F])\s*[-:=]\s*([1-6])$/);
    if (match) mappings.set(match[1], match[2]);
  });

  const pairs: MatchFollowingPair[] = [];
  for (let index = 0; index < 6; index += 1) {
    const leftKey = String.fromCharCode(65 + index);
    const defaultRightKey = String(index + 1);
    const rightKey = mappings.get(leftKey) || defaultRightKey;
    const leftText = normalize(raw[`match_left_${leftKey.toLowerCase()}`] || raw[`left_${leftKey.toLowerCase()}`]);
    const leftLatex = normalize(raw[`match_left_${leftKey.toLowerCase()}_latex`]);
    const leftImage = normalize(raw[`match_left_${leftKey.toLowerCase()}_image`]);
    const rightText = normalize(raw[`match_right_${rightKey}`] || raw[`right_${rightKey}`]);
    const rightLatex = normalize(raw[`match_right_${rightKey}_latex`]);
    const rightImage = normalize(raw[`match_right_${rightKey}_image`]);
    if (!leftText && !leftLatex && !leftImage && !rightText && !rightLatex && !rightImage) continue;
    pairs.push({
      id: `import-${index + 1}`,
      left_key: leftKey,
      left_text: leftText,
      left_latex: leftLatex,
      left_image_url: leftImage,
      right_key: rightKey,
      right_text: rightText,
      right_latex: rightLatex,
      right_image_url: rightImage,
    });
  }
  return pairs;
}

export function parseQuestionRows(rows: Record<string, unknown>[]): ParsedQuestionRow[] {
  return rows.map((raw, index) => {
    const errors: string[] = [];
    const stem = normalize(raw.question || raw.stem_text);
    const subject = normalize(raw.subject);
    const questionType = normalizedQuestionType(raw.question_type);
    const difficulty = normalizedDifficulty(raw.difficulty);
    const status = normalizedStatus(raw.status);
    const language = normalizedLanguage(raw.language);
    const answer = normalize(raw.correct_answer);
    const exams = splitList(raw.exam_types || raw.exam_type);

    if (stem.length < 5) errors.push("Question text is missing or too short.");
    if (!subject) errors.push("Subject is required.");
    if (!acceptedTypes.has(questionType)) errors.push(`Unsupported question_type '${normalize(raw.question_type)}'.`);
    if (!acceptedDifficulties.has(difficulty)) errors.push(`Unsupported difficulty '${normalize(raw.difficulty)}'.`);
    if (!acceptedStatuses.has(status)) errors.push(`Unsupported status '${normalize(raw.status)}'. Use draft, in_review or approved.`);
    if (!acceptedLanguages.has(language.toLowerCase())) errors.push(`Unsupported language '${normalize(raw.language)}'.`);
    if (!answer) errors.push("Correct answer is required.");
    if (!exams.length) errors.push("At least one exam type is required.");

    const optionKeys = ["A", "B", "C", "D", "E", "F"];
    const parsedAnswer = answerKeys(answer, questionType);
    const correctKeys = new Set(Array.isArray(parsedAnswer) ? parsedAnswer as string[] : []);
    let options: QuestionOptionInput[] = optionKeys.map((key, display_order) => ({
      option_key: key,
      content_text: normalize(raw[`option_${key.toLowerCase()}`]),
      content_latex: normalize(raw[`option_${key.toLowerCase()}_latex`]),
      image_url: normalize(raw[`option_${key.toLowerCase()}_image`]),
      is_correct: correctKeys.has(key),
      display_order,
    })).filter((option) => option.content_text || option.content_latex || option.image_url);

    const matchPairs = questionType === "match_following" ? parseMatchPairs(raw, answer) : [];
    if (questionType === "match_following") {
      options = matchPairs.map((pair, display_order) => ({
        option_key: pair.right_key,
        content_text: pair.right_text,
        content_latex: pair.right_latex,
        image_url: pair.right_image_url,
        is_correct: false,
        display_order,
      }));
      if (matchPairs.length < 2) errors.push("Match-the-following questions require at least two left and right pairs.");
      if (matchPairs.some((pair) => !pair.left_text && !pair.left_latex && !pair.left_image_url)) errors.push("Every match row needs left-side content.");
      if (matchPairs.some((pair) => !pair.right_text && !pair.right_latex && !pair.right_image_url)) errors.push("Every match row needs right-side content.");
      if ((parsedAnswer as string[]).some((value) => !/^[A-F]\s*[-:=]\s*[1-6]$/i.test(value))) errors.push("Match answers must use mappings such as A-1|B-2|C-3.");
    }

    if (["single_correct", "multiple_correct", "assertion_reason", "image_based", "passage"].includes(questionType) && options.length < 2) errors.push("At least two answer options are required.");
    if (["single_correct", "assertion_reason", "image_based", "passage"].includes(questionType) && correctKeys.size !== 1) errors.push("This question type must have exactly one correct option.");
    if (questionType === "multiple_correct" && correctKeys.size < 1) errors.push("Multiple-correct questions need at least one correct option.");
    if (questionType !== "match_following" && correctKeys.size && [...correctKeys].some((key) => !options.some((option) => option.option_key === key))) errors.push("Correct answer refers to a missing option.");
    if ((questionType === "numerical" || questionType === "integer") && !Number.isFinite(Number(answer))) errors.push("Numerical and integer answers must contain a valid number.");
    if (questionType === "integer" && Number.isFinite(Number(answer)) && !Number.isInteger(Number(answer))) errors.push("Integer questions require a whole-number answer.");

    const marks = numberValue(raw.marks, 4);
    const negativeMarks = numberValue(raw.negative_marks, 1);
    const expectedSeconds = numberValue(raw.estimated_seconds, 0);
    if (marks < 0) errors.push("Marks cannot be negative.");
    if (negativeMarks < 0) errors.push("Negative marks must be zero or positive.");
    if (expectedSeconds < 0) errors.push("Expected seconds must be zero or positive.");

    const payload: QuestionPayload = {
      question_type: acceptedTypes.has(questionType) ? questionType : "single_correct",
      status: acceptedStatuses.has(status) ? status : "draft",
      difficulty: acceptedDifficulties.has(difficulty) ? difficulty : "moderate",
      stem_text: stem,
      stem_latex: normalize(raw.question_latex || raw.stem_latex),
      question_image_url: normalize(raw.question_image),
      passage_text: normalize(raw.passage_text || raw.passage),
      solution_text: normalize(raw.solution || raw.solution_text),
      solution_latex: normalize(raw.solution_latex),
      marks,
      negative_marks: negativeMarks,
      estimated_seconds: expectedSeconds || undefined,
      correct_answer: parsedAnswer,
      exam_types: exams,
      class_level: normalize(raw.class_level || raw.grade),
      source: normalize(raw.source),
      source_year: numberValue(raw.source_year, 0) || undefined,
      language: acceptedLanguages.has(language.toLowerCase()) ? language : "English",
      tags: splitList(raw.tags),
      metadata: {
        import_subject: subject,
        import_chapter: normalize(raw.chapter),
        import_topic: normalize(raw.topic),
        question_image_filename: normalize(raw.question_image_filename || raw.question_image),
        match_pairs: matchPairs.length ? matchPairs : undefined,
      },
      options,
    };

    return { rowNumber: index + 2, raw, payload, errors };
  });
}

// Questions remain reusable. Test/series classification is selected later while
// creating a paper or test series, so it is deliberately excluded here.
export const bulkQuestionTemplateHeaders = [
  "exam_types", "class_level", "subject", "chapter", "topic", "question_type", "difficulty",
  "question", "question_latex", "question_image",
  "option_a", "option_a_latex", "option_a_image",
  "option_b", "option_b_latex", "option_b_image",
  "option_c", "option_c_latex", "option_c_image",
  "option_d", "option_d_latex", "option_d_image",
  "correct_answer", "solution", "solution_latex",
  "marks", "negative_marks", "estimated_seconds", "language", "source", "source_year", "tags", "status",
];

export const questionTemplateHeaders = bulkQuestionTemplateHeaders;
