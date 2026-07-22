import type {
  MatchFollowingPair,
  ParsedQuestionRow,
  QuestionOptionInput,
  QuestionPayload,
  QuestionTestType,
  QuestionType,
} from "@/types/questions";

const acceptedTypes = new Set<QuestionType>([
  "single_correct", "multiple_correct", "numerical", "integer",
  "assertion_reason", "match_following", "passage", "image_based",
]);

const acceptedTestTypes = new Set<QuestionTestType>([
  "full_length", "part_test", "chapter_test", "topic_test", "custom",
]);

const normalize = (value: unknown) => String(value ?? "").trim();
const splitList = (value: unknown) => normalize(value).split(/[|,]/).map((x) => x.trim()).filter(Boolean);
const numberValue = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const slugValue = (value: unknown) => normalize(value).toLowerCase().replace(/[\s-]+/g, "_");

function answerKeys(answer: string, type: QuestionType) {
  if (type === "numerical" || type === "integer") return answer;
  if (type === "match_following") {
    return answer.toUpperCase().split(/[|,;]/).map((x) => x.trim()).filter(Boolean);
  }
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
    const questionType = (slugValue(raw.question_type || "single_correct") || "single_correct") as QuestionType;
    const answer = normalize(raw.correct_answer);
    const rawTestType = slugValue(raw.test_type || "custom") || "custom";
    const testType = (acceptedTestTypes.has(rawTestType as QuestionTestType) ? rawTestType : "custom") as QuestionTestType;
    const customTestType = normalize(raw.custom_test_type || (testType === "custom" && rawTestType !== "custom" ? raw.test_type : ""));

    if (stem.length < 5) errors.push("Question text is missing or too short.");
    if (!subject) errors.push("Subject is required.");
    if (!acceptedTypes.has(questionType)) errors.push(`Unsupported question_type: ${questionType}`);
    if (!answer) errors.push("Correct answer is required.");
    if (testType === "custom" && !customTestType) errors.push("custom_test_type is required when test_type is custom.");

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
      if ((parsedAnswer as string[]).some((value) => !/^[A-F]\s*[-:=]\s*[1-6]$/i.test(value))) {
        errors.push("Match answers must use mappings such as A-1|B-2|C-3.");
      }
    }

    if (["single_correct", "multiple_correct", "assertion_reason", "image_based", "passage"].includes(questionType) && options.length < 2) {
      errors.push("At least two answer options are required.");
    }
    if (["single_correct", "assertion_reason", "image_based", "passage"].includes(questionType) && correctKeys.size !== 1) {
      errors.push("This question type must have exactly one correct option.");
    }
    if (questionType === "multiple_correct" && correctKeys.size < 1) errors.push("Multiple-correct questions need at least one correct option.");
    if (questionType !== "match_following" && correctKeys.size && [...correctKeys].some((key) => !options.some((option) => option.option_key === key))) {
      errors.push("Correct answer refers to a missing option.");
    }

    const payload: QuestionPayload = {
      question_type: questionType,
      status: normalize(raw.status).toLowerCase() === "approved" ? "approved" : normalize(raw.status).toLowerCase() === "in_review" ? "in_review" : "draft",
      difficulty: (slugValue(raw.difficulty) || "moderate") as QuestionPayload["difficulty"],
      stem_text: stem,
      stem_latex: normalize(raw.question_latex || raw.stem_latex),
      question_image_url: normalize(raw.question_image),
      passage_text: normalize(raw.passage_text),
      solution_text: normalize(raw.solution || raw.solution_text),
      solution_latex: normalize(raw.solution_latex),
      marks: numberValue(raw.marks, 4),
      negative_marks: numberValue(raw.negative_marks, 1),
      estimated_seconds: numberValue(raw.estimated_seconds, 0) || undefined,
      correct_answer: parsedAnswer,
      exam_types: splitList(raw.exam_types || raw.exam_type),
      class_level: normalize(raw.class_level || raw.grade),
      source: normalize(raw.source),
      source_year: numberValue(raw.source_year, 0) || undefined,
      language: normalize(raw.language) || "English",
      tags: splitList(raw.tags),
      metadata: {
        import_subject: subject,
        import_chapter: normalize(raw.chapter),
        import_topic: normalize(raw.topic),
        question_image_filename: normalize(raw.question_image_filename || raw.question_image),
        test_type: testType,
        custom_test_type: customTestType || undefined,
        match_pairs: matchPairs.length ? matchPairs : undefined,
      },
      options,
    };

    return { rowNumber: index + 2, raw, payload: errors.length ? undefined : payload, errors };
  });
}

export const questionTemplateHeaders = [
  "exam_types", "test_type", "custom_test_type", "class_level", "subject", "chapter", "topic", "question_type", "difficulty",
  "question", "question_latex", "question_image", "option_a", "option_a_latex", "option_a_image",
  "option_b", "option_b_latex", "option_b_image", "option_c", "option_c_latex", "option_c_image",
  "option_d", "option_d_latex", "option_d_image", "correct_answer", "solution", "solution_latex",
  "match_left_a", "match_left_a_latex", "match_left_a_image", "match_right_1", "match_right_1_latex", "match_right_1_image",
  "match_left_b", "match_left_b_latex", "match_left_b_image", "match_right_2", "match_right_2_latex", "match_right_2_image",
  "match_left_c", "match_left_c_latex", "match_left_c_image", "match_right_3", "match_right_3_latex", "match_right_3_image",
  "match_left_d", "match_left_d_latex", "match_left_d_image", "match_right_4", "match_right_4_latex", "match_right_4_image",
  "marks", "negative_marks", "estimated_seconds", "language", "source", "source_year", "tags", "status",
];
