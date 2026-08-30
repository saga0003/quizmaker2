"use client";

import { readZip, type ZipEntry } from "@/lib/zipReader";
import { uploadQuestionAsset } from "@/lib/questionAssetUpload";

export type EvidaraLatexPaperMeta = {
  title: string;
  code: string;
  exam_type: string;
  grade_level: string;
  test_type: string;
  duration_minutes: number;
  description: string;
  instructions: string;
  is_previous_year_paper: boolean;
  source_year?: number;
  source_variant?: string;
  source_paper_code?: string;
  pyq_source?: Record<string, unknown>;
};

export type EvidaraLatexPaperImportResult = {
  paper: EvidaraLatexPaperMeta;
  rows: Record<string, unknown>[];
  warnings: string[];
  texFiles: number;
  uploadedAssets: number;
};

type LatexSource = {
  name: string;
  text: string;
  assets: Map<string, ZipEntry>;
};

type ParsedCommand = { name: string; qualifier?: string; args: string[]; start: number; end: number };

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
const LATEX_EXTENSIONS = [".tex", ".latex", ".ltx"];
const MAX_PACKAGE_BYTES = 100 * 1024 * 1024;
const MAX_ENTRY_BYTES = 15 * 1024 * 1024;
const MAX_ZIP_ENTRIES = 1_000;

function normalizedPath(value: string) {
  const parts: string[] = [];
  value.replaceAll("\\", "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/").toLowerCase();
}

function dirname(value: string) {
  const normalized = value.replaceAll("\\", "/");
  const index = normalized.lastIndexOf("/");
  return index < 0 ? "" : normalized.slice(0, index + 1);
}

function isLatexFile(name: string) {
  const lower = name.toLowerCase();
  return LATEX_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function isImageFile(name: string) {
  const lower = name.toLowerCase();
  return IMAGE_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

function stripComments(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/(^|[^\\])%.*$/, "$1"))
    .join("\n");
}

function skipWhitespace(value: string, start: number) {
  let index = start;
  while (index < value.length && /\s/.test(value[index])) index += 1;
  return index;
}

function readBalanced(value: string, start: number, open = "{", close = "}") {
  if (value[start] !== open) return null;
  let depth = 0;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === open) depth += 1;
    else if (char === close) {
      depth -= 1;
      if (depth === 0) return { content: value.slice(start + 1, index), end: index + 1 };
    }
  }
  return null;
}

function parseCommands(value: string): ParsedCommand[] {
  const output: ParsedCommand[] = [];
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== "\\" || !/[A-Za-z]/.test(value[index + 1] || "")) continue;
    let cursor = index + 1;
    while (cursor < value.length && /[A-Za-z0-9_]/.test(value[cursor])) cursor += 1;
    const name = value.slice(index + 1, cursor).toLowerCase();
    cursor = skipWhitespace(value, cursor);
    let qualifier: string | undefined;
    if (value[cursor] === "[") {
      const bracket = readBalanced(value, cursor, "[", "]");
      if (bracket) {
        qualifier = bracket.content.trim();
        cursor = skipWhitespace(value, bracket.end);
      }
    }
    const args: string[] = [];
    while (value[cursor] === "{") {
      const arg = readBalanced(value, cursor);
      if (!arg) break;
      args.push(arg.content.trim());
      cursor = skipWhitespace(value, arg.end);
    }
    output.push({ name, qualifier, args, start: index, end: cursor });
    index = Math.max(index, cursor - 1);
  }
  return output;
}

function command(value: string, names: string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const found = parseCommands(value).find((item) => wanted.has(item.name) && item.args.length);
  return found?.args[0]?.trim() || "";
}

function commandPair(value: string, names: string[]): [string, string] | null {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const found = parseCommands(value).find((item) => wanted.has(item.name) && item.args.length >= 2);
  return found ? [found.args[0].trim(), found.args[1].trim()] : null;
}

function removeNamedCommands(value: string, names: string[]) {
  const wanted = new Set(names.map((name) => name.toLowerCase()));
  const commands = parseCommands(value).filter((item) => wanted.has(item.name));
  if (!commands.length) return value;
  let output = "";
  let cursor = 0;
  for (const item of commands) {
    output += value.slice(cursor, item.start);
    cursor = item.end;
  }
  return output + value.slice(cursor);
}

function extractEnvironment(value: string, environment: string) {
  const escaped = environment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = value.match(new RegExp(`\\\\begin\\{${escaped}\\}([\\s\\S]*?)\\\\end\\{${escaped}\\}`, "i"));
  return match?.[1]?.trim() || "";
}

function removeEnvironments(value: string, environments: string[]) {
  let next = value;
  for (const environment of environments) {
    const escaped = environment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`\\\\begin\\{${escaped}\\}[\\s\\S]*?\\\\end\\{${escaped}\\}`, "gi"), "");
  }
  return next;
}

function splitQuestions(documentText: string) {
  const environments = ["evidaraquestion", "natscixquestion", "question"];
  for (const environment of environments) {
    const escaped = environment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const blocks = [...documentText.matchAll(new RegExp(`\\\\begin\\{${escaped}\\}([\\s\\S]*?)\\\\end\\{${escaped}\\}`, "gi"))]
      .map((match) => match[1]?.trim())
      .filter(Boolean) as string[];
    if (blocks.length) return blocks;
  }

  const questionsEnvironment = extractEnvironment(documentText, "questions");
  const source = questionsEnvironment || documentText;
  const markers = [...source.matchAll(/(?:^|\n)\s*\\question(?:\[[^\]]*\])?\s+(?!\{)/g)];
  if (markers.length) {
    return markers.map((marker, index) => source.slice(
      (marker.index || 0) + marker[0].length,
      markers[index + 1]?.index ?? source.length,
    ).trim()).filter(Boolean);
  }
  return [];
}

function metadataPreamble(documentText: string) {
  const candidates = [
    documentText.search(/\\begin\{(?:evidaraquestion|natscixquestion|question|questions)\}/i),
    documentText.search(/(?:^|\n)\s*\\question(?:\[[^\]]*\])?\s+(?!\{)/m),
  ].filter((value) => value >= 0);
  return candidates.length ? documentText.slice(0, Math.min(...candidates)) : documentText;
}

function cleanPlainLatex(value: string) {
  return value
    .replace(/\\(?:textbf|textit|emph|underline)\s*\{([^{}]*)\}/g, "$1")
    .replace(/\\(?:smallskip|medskip|bigskip|newline|par)\b/g, " ")
    .replace(/~+/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function extractImageRefs(value: string) {
  return [...value.matchAll(/\\includegraphics(?:\[[^\]]*\])?\{([^}]+)\}/gi)].map((match) => match[1].trim());
}

function stripImageCommands(value: string) {
  return value.replace(/\\includegraphics(?:\[[^\]]*\])?\{[^}]+\}/gi, " ").trim();
}

function unwrapPureMath(value: string) {
  const trimmed = value.trim();
  const patterns = [
    /^\\\[([\s\S]*)\\\]$/,
    /^\$\$([\s\S]*)\$\$$/,
    /^\\\(([\s\S]*)\\\)$/,
    /^\$([^$\n]+)\$$/,
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

function parseOptions(block: string) {
  const choices = extractEnvironment(block, "choices") || extractEnvironment(block, "oneparchoices") || extractEnvironment(block, "evidarachoices") || extractEnvironment(block, "natscixchoices");
  const source = choices || block;
  const commands = parseCommands(source);
  const options: Array<{ key: string; content: string; correct: boolean }> = [];
  let sequentialIndex = 0;
  for (const item of commands) {
    if (item.name === "option") {
      if (item.args.length >= 2 && /^[A-H]$/i.test(item.args[0])) {
        options.push({ key: item.args[0].toUpperCase(), content: item.args[1], correct: false });
      } else if (item.args.length >= 1) {
        options.push({ key: String.fromCharCode(65 + sequentialIndex), content: item.args[0], correct: false });
        sequentialIndex += 1;
      }
    }
  }
  if (options.length) return options;

  const choiceRegex = /\\(CorrectChoice|choice)\s+([\s\S]*?)(?=\\(?:CorrectChoice|choice)\b|$)/gi;
  for (const match of source.matchAll(choiceRegex)) {
    options.push({
      key: String.fromCharCode(65 + options.length),
      content: match[2].trim(),
      correct: match[1].toLowerCase() === "correctchoice",
    });
  }
  return options;
}

function normalizeQuestionType(value: string, optionCount: number, numericalAnswer: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (["multiple", "multiple_correct", "msq", "multi_correct"].includes(normalized)) return "multiple_correct";
  if (["numerical", "numeric"].includes(normalized) || numericalAnswer) return "numerical";
  if (["integer", "integer_answer"].includes(normalized)) return "integer";
  if (["assertion_reason", "assertion_and_reason", "assertion"].includes(normalized)) return "assertion_reason";
  if (["image", "image_based"].includes(normalized)) return "image_based";
  if (["passage", "comprehension"].includes(normalized)) return "passage";
  return optionCount ? "single_correct" : "numerical";
}

function findAsset(source: LatexSource, reference: string) {
  const base = dirname(source.name);
  const candidates = [normalizedPath(`${base}${reference}`), normalizedPath(reference)];
  const hasExtension = IMAGE_EXTENSIONS.some((extension) => reference.toLowerCase().endsWith(extension));
  if (!hasExtension) {
    for (const extension of IMAGE_EXTENSIONS) {
      candidates.push(normalizedPath(`${base}${reference}${extension}`));
      candidates.push(normalizedPath(`${reference}${extension}`));
    }
  }
  for (const candidate of candidates) {
    const asset = source.assets.get(candidate);
    if (asset) return asset;
  }
  const basename = normalizedPath(reference).split("/").pop()?.replace(/\.[^.]+$/, "");
  return [...source.assets.values()].find((entry) => normalizedPath(entry.name).split("/").pop()?.replace(/\.[^.]+$/, "") === basename);
}

async function loadSources(file: File): Promise<LatexSource[]> {
  if (file.size > MAX_PACKAGE_BYTES) throw new Error("The LaTeX package is larger than 100 MB. Split it paper-by-paper.");
  if (!file.name.toLowerCase().endsWith(".zip")) {
    if (!isLatexFile(file.name)) throw new Error("Upload one .tex/.latex/.ltx paper or a ZIP containing that paper and its images.");
    const text = await file.text();
    if (new Blob([text]).size > MAX_ENTRY_BYTES) throw new Error("The LaTeX file is larger than 15 MB. Split it paper-by-paper.");
    return [{ name: file.name, text, assets: new Map() }];
  }

  const zip = await readZip(await file.arrayBuffer());
  if (zip.size > MAX_ZIP_ENTRIES) throw new Error("The ZIP contains more than 1,000 entries. Split it paper-by-paper.");
  let expanded = 0;
  const assets = new Map<string, ZipEntry>();
  for (const entry of zip.values()) {
    expanded += entry.bytes.byteLength;
    if (entry.bytes.byteLength > MAX_ENTRY_BYTES) throw new Error(`ZIP entry “${entry.name}” is larger than 15 MB.`);
    if (expanded > MAX_PACKAGE_BYTES) throw new Error("The expanded ZIP exceeds 100 MB. Split it paper-by-paper.");
    if (isImageFile(entry.name)) assets.set(normalizedPath(entry.name), entry);
  }
  const sources: LatexSource[] = [];
  for (const entry of zip.values()) {
    if (isLatexFile(entry.name)) sources.push({ name: entry.name, text: await entry.text(), assets });
  }
  return sources;
}

function paperMetaFromPreamble(preamble: string, fileName: string): EvidaraLatexPaperMeta {
  const year = Number(command(preamble, ["year", "sourceyear"])) || undefined;
  const exam = command(preamble, ["exam", "examtype"]) || "Custom";
  const variant = command(preamble, ["variant", "phase", "set"]) || "Main";
  const code = command(preamble, ["code", "papercode"]);
  const title = command(preamble, ["paper", "papertitle", "title"]) || `${exam}${year ? ` ${year}` : ""}${variant !== "Main" ? ` ${variant}` : ""}` || fileName.replace(/\.[^.]+$/, "");
  const explicitPyq = command(preamble, ["pyq", "previousyearpaper"]);
  const isPyq = /^(1|true|yes|pyq)$/i.test(explicitPyq) || Boolean(year && /neet|jee|aipmt|cet|kcet/i.test(exam));
  const sourceKey = command(preamble, ["sourcekey"]);
  const paperKey = command(preamble, ["paperkey"]) || [exam, year, variant, code].filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return {
    title: title || fileName.replace(/\.[^.]+$/, ""),
    code,
    exam_type: exam,
    grade_level: command(preamble, ["grade", "classlevel", "level"]) || "Grade 11-12",
    test_type: isPyq ? "previous_year_paper" : "custom_test",
    duration_minutes: Number(command(preamble, ["duration", "durationminutes"])) || 180,
    description: command(preamble, ["description"]),
    instructions: command(preamble, ["instructions"]),
    is_previous_year_paper: isPyq,
    source_year: year,
    source_variant: isPyq ? variant : undefined,
    source_paper_code: isPyq ? code || undefined : undefined,
    pyq_source: isPyq && year ? {
      exam_type: exam,
      year,
      variant,
      paper_code: code || undefined,
      paper_key: paperKey || undefined,
      source_key: sourceKey || undefined,
      display_name: title,
    } : undefined,
  };
}

export async function parseEvidaraLatexPaperPackage(file: File): Promise<EvidaraLatexPaperImportResult> {
  const sources = await loadSources(file);
  if (!sources.length) throw new Error("No LaTeX source was found in this package.");
  if (sources.length > 1) throw new Error("This package contains multiple .tex files. Evidara imports one paper at a time; keep exactly one paper source in each ZIP.");

  const source = sources[0];
  const documentText = stripComments(source.text);
  const preamble = metadataPreamble(documentText);
  const paper = paperMetaFromPreamble(preamble, source.name);
  const blocks = splitQuestions(documentText);
  if (!blocks.length) throw new Error("No question blocks were found. Use \\begin{question} ... \\end{question} for each question.");

  const warnings: string[] = [];
  const rows: Record<string, unknown>[] = [];
  const uploaded = new Map<string, string>();

  const resolveImage = async (reference?: string) => {
    if (!reference) return "";
    if (/^https?:\/\//i.test(reference)) return reference;
    const asset = findAsset(source, reference);
    if (!asset) {
      warnings.push(`Image “${reference}” was referenced but not found in ${file.name}.`);
      return "";
    }
    const key = normalizedPath(asset.name);
    if (uploaded.has(key)) return uploaded.get(key)!;
    const originalName = asset.name.split("/").pop() || "question-image.png";
    const extension = originalName.split(".").pop()?.toLowerCase() || "png";
    const mime = extension === "svg" ? "image/svg+xml" : extension === "jpg" || extension === "jpeg" ? "image/jpeg" : extension === "webp" ? "image/webp" : extension === "gif" ? "image/gif" : "image/png";
    const typedBlob = new Blob([asset.bytes as BlobPart], { type: mime });
    const result = await uploadQuestionAsset(typedBlob, originalName, "latex-paper-imports");
    uploaded.set(key, result.publicUrl);
    return result.publicUrl;
  };

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const options = parseOptions(block);
    const markedCorrect = options.filter((option) => option.correct).map((option) => option.key);
    const numericalAnswer = command(block, ["numericalanswer", "numericanswer"]);
    const answer = command(block, ["correct", "correctanswer", "answer"]).toUpperCase() || markedCorrect.join(",") || numericalAnswer;
    const questionType = normalizeQuestionType(command(block, ["questiontype", "type"]), options.length, numericalAnswer);
    const marksPair = commandPair(block, ["marks", "marking"]);
    const questionNumber = Number(command(block, ["number", "questionnumber", "qno"])) || index + 1;
    const subject = command(block, ["subject"]);
    const chapter = command(block, ["chapter"]);
    const topic = command(block, ["topic"]);
    const section = command(block, ["section", "sectiontitle"]) || subject || "General";
    const explicitQuestion = command(block, ["stem", "questiontext", "prompt"]);
    const explicitLatex = command(block, ["latex", "questionlatex", "stemlatex"]);
    const solution = command(block, ["solution", "explanation"]) || extractEnvironment(block, "solution");

    let body = removeEnvironments(block, ["choices", "oneparchoices", "evidarachoices", "natscixchoices", "solution"]);
    body = removeNamedCommands(body, [
      "id", "externalid", "number", "questionnumber", "qno", "section", "sectiontitle", "subject", "chapter", "topic",
      "biologydivision", "questiontype", "type", "difficulty", "correct", "correctanswer", "answer", "numericalanswer", "numericanswer",
      "solution", "solutionlatex", "explanation", "marks", "marking", "positive", "negative", "estimatedseconds", "language", "tags", "status", "source",
      "stem", "questiontext", "prompt", "latex", "questionlatex", "stemlatex",
    ]);
    body = body.replace(/\\marks\s*\{[^}]*\}\s*\{[^}]*\}/gi, "");
    const questionImageRef = extractImageRefs(explicitQuestion || body)[0];
    const questionImage = await resolveImage(questionImageRef);
    const bodyWithoutImage = stripImageCommands(explicitQuestion || body).replace(/^\s*\\(?:question|item)\b/, "").trim();
    const pureBodyMath = unwrapPureMath(bodyWithoutImage);
    const questionText = explicitQuestion
      ? cleanPlainLatex(stripImageCommands(explicitQuestion))
      : pureBodyMath
        ? "Mathematical expression"
        : cleanPlainLatex(bodyWithoutImage);
    const questionLatex = explicitLatex || pureBodyMath;

    const optionFields: Record<string, unknown> = {};
    for (let optionIndex = 0; optionIndex < options.length; optionIndex += 1) {
      const option = options[optionIndex];
      const imageRef = extractImageRefs(option.content)[0];
      const image = await resolveImage(imageRef);
      const cleanContent = cleanPlainLatex(stripImageCommands(option.content));
      const pureMath = unwrapPureMath(cleanContent);
      const letter = option.key.toLowerCase();
      optionFields[`option_${letter}`] = pureMath ? "" : cleanContent;
      optionFields[`option_${letter}_latex`] = pureMath || "";
      optionFields[`option_${letter}_image`] = image;
    }

    const solutionImageRef = extractImageRefs(solution)[0];
    const solutionImageUrl = await resolveImage(solutionImageRef);
    const solutionWithoutImage = cleanPlainLatex(stripImageCommands(solution));
    const pureSolutionMath = unwrapPureMath(solutionWithoutImage);
    const sourceYear = paper.source_year;

    if (!subject) warnings.push(`Question ${questionNumber}: subject is missing.`);
    if (!answer) warnings.push(`Question ${questionNumber}: correct answer is missing.`);
    if (questionText.length < 5 && !questionLatex && !questionImage) warnings.push(`Question ${questionNumber}: question content is very short.`);

    rows.push({
      external_id: command(block, ["externalid", "id"]) || `${paper.exam_type}-${paper.source_year || "paper"}-${paper.source_variant || "main"}-Q${String(questionNumber).padStart(3, "0")}`,
      question_number: questionNumber,
      section,
      subject,
      biology_division: command(block, ["biologydivision"]),
      chapter,
      topic,
      question_type: questionType,
      difficulty: command(block, ["difficulty"]) || "moderate",
      question: questionText || (questionLatex ? "Mathematical expression" : "Question image"),
      question_latex: questionLatex,
      question_image: questionImage,
      ...optionFields,
      correct_answer: answer,
      solution: pureSolutionMath ? "" : solutionWithoutImage,
      solution_latex: pureSolutionMath || command(block, ["solutionlatex"]),
      marks: marksPair?.[0] || command(block, ["positive"]) || 4,
      negative_marks: marksPair?.[1] || command(block, ["negative"]) || 1,
      estimated_seconds: command(block, ["estimatedseconds"]),
      language: command(block, ["language"]) || "English",
      source: command(block, ["source"]) || (paper.is_previous_year_paper ? "Previous Year Question" : "LaTeX Paper Import"),
      source_year: sourceYear,
      tags: command(block, ["tags"]) || (paper.is_previous_year_paper ? `PYQ,${sourceYear || ""}` : "LaTeX Import"),
      status: "in_review",
      solution_image_url: solutionImageUrl || undefined,
      import_file: file.name,
      import_format: file.name.toLowerCase().endsWith(".zip") ? "latex_zip" : "latex",
    });
  }

  return { paper, rows, warnings, texFiles: sources.length, uploadedAssets: uploaded.size };
}
