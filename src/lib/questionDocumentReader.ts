import { parseCsv } from "@/lib/csvReader";
import { parseXlsx } from "@/lib/xlsxReader";
import { readZip } from "@/lib/zipReader";

const clean = (value: string) => value.replace(/\r/g, "").replace(/[\t ]+/g, " ").trim();

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function optionKey(value: string) {
  const match = value.match(/^option[_\s-]*([a-f])$/i);
  return match ? `option_${match[1].toLowerCase()}` : "";
}

function parseLatexQuestionBlocks(text: string): Record<string, unknown>[] {
  const blocks = [...text.matchAll(/\\begin\{question\}([\s\S]*?)\\end\{question\}/gi)].map((match) => match[1]);
  if (!blocks.length) return [];

  return blocks.map((block) => {
    const row: Record<string, unknown> = {};
    const commands = [...block.matchAll(/\\([a-zA-Z][a-zA-Z0-9_]*)\s*(?:\[([^\]]+)\])?\s*\{([\s\S]*?)\}(?=\s*\\[a-zA-Z]|\s*$)/g)];
    for (const command of commands) {
      const name = normalizeKey(command[1]);
      const qualifier = clean(command[2] || "");
      const value = clean(command[3]);
      if (name === "question" || name === "stem") row.question = value;
      else if (name === "option" && qualifier) row[`option_${qualifier.toLowerCase()}`] = value;
      else if (name === "answer") row.correct_answer = value;
      else if (name === "solution") row.solution = value;
      else if (name === "latex" || name === "question_latex") row.question_latex = value;
      else row[name] = value;
    }
    return row;
  });
}

function parseLabelledBlock(block: string): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  let currentKey = "";
  const append = (key: string, value: string) => {
    if (!value) return;
    row[key] = row[key] ? `${row[key]}\n${value}` : value;
  };

  for (const originalLine of block.split("\n")) {
    const line = originalLine.trim();
    if (!line) continue;

    const option = line.match(/^([A-F])\s*[\).:-]\s*(.+)$/i);
    if (option) {
      currentKey = `option_${option[1].toLowerCase()}`;
      append(currentKey, option[2]);
      continue;
    }

    const numberedQuestion = line.match(/^(?:Q(?:uestion)?\s*)?\d+\s*[\).:-]\s*(.+)$/i);
    if (numberedQuestion && !row.question) {
      currentKey = "question";
      append(currentKey, numberedQuestion[1]);
      continue;
    }

    const label = line.match(/^([A-Za-z][A-Za-z0-9 _/-]{1,35})\s*:\s*(.*)$/);
    if (label) {
      const normalized = normalizeKey(label[1]);
      const mappedOption = optionKey(normalized);
      const key = mappedOption || ({
        q: "question",
        question_text: "question",
        stem: "question",
        answer: "correct_answer",
        correct: "correct_answer",
        correct_option: "correct_answer",
        explanation: "solution",
        grade: "grade",
        exam: "exam_types",
        exam_type: "exam_types",
      } as Record<string, string>)[normalized] || normalized;
      currentKey = key;
      append(currentKey, label[2]);
      continue;
    }

    if (!currentKey && !row.question) currentKey = "question";
    append(currentKey || "question", line);
  }

  return row;
}

export function parseStructuredQuestionText(text: string): Record<string, unknown>[] {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\r/g, "");
  const latexRows = parseLatexQuestionBlocks(normalized);
  if (latexRows.length) return latexRows;

  const explicitBlocks = normalized
    .split(/(?:^|\n)\s*(?:---+\s*question\s*---+|={3,}\s*question\s*={3,})\s*(?:\n|$)/i)
    .map(clean)
    .filter(Boolean);
  if (explicitBlocks.length > 1) return explicitBlocks.map(parseLabelledBlock);

  const numberedStarts = [...normalized.matchAll(/(?:^|\n)\s*(?:Q(?:uestion)?\s*)?(\d+)\s*[\).:-]\s+/gi)];
  if (numberedStarts.length > 1) {
    return numberedStarts.map((start, index) => {
      const from = (start.index || 0) + (start[0].startsWith("\n") ? 1 : 0);
      const to = numberedStarts[index + 1]?.index ?? normalized.length;
      return parseLabelledBlock(normalized.slice(from, to));
    });
  }

  const paragraphBlocks = normalized.split(/\n\s*\n(?=\s*(?:Q(?:uestion)?\s*)?\d+\s*[\).:-])/i).map(clean).filter(Boolean);
  if (paragraphBlocks.length > 1) return paragraphBlocks.map(parseLabelledBlock);

  return [parseLabelledBlock(normalized)].filter((row) => Object.keys(row).length > 0);
}

async function readDocx(input: ArrayBuffer) {
  const zip = await readZip(input);
  const document = zip.get("word/document.xml");
  if (!document) throw new Error("The Word file has no readable word/document.xml content.");
  const xml = await document.text();
  const paragraphs = xml
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<w:br\s*\/>/g, "\n")
    .split(/<\/w:p>/i)
    .map((paragraph) => decodeXml([...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/gi)].map((match) => match[1]).join("")))
    .map(clean)
    .filter(Boolean);
  if (!paragraphs.length) throw new Error("No readable text was found in the Word document.");
  return paragraphs.join("\n");
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\([nrtbf])/g, (_match, code: string) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[code] || code))
    .replace(/\\([()\\])/g, "$1")
    .replace(/\\([0-7]{1,3})/g, (_match, octal: string) => String.fromCharCode(parseInt(octal, 8)));
}

function textFromPdfOperators(value: string) {
  const output: string[] = [];
  for (const match of value.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)) output.push(decodePdfLiteral(match[1]));
  for (const arrayMatch of value.matchAll(/\[([\s\S]*?)\]\s*TJ/g)) {
    const parts = [...arrayMatch[1].matchAll(/\(((?:\\.|[^\\)])*)\)/g)].map((match) => decodePdfLiteral(match[1]));
    if (parts.length) output.push(parts.join(""));
  }
  for (const hexMatch of value.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    const hex = hexMatch[1].replace(/\s/g, "");
    const bytes = new Uint8Array(Math.floor(hex.length / 2));
    for (let index = 0; index < bytes.length; index += 1) bytes[index] = parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    output.push(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
  }
  return output.join("\n");
}

async function inflatePdfStream(bytes: Uint8Array) {
  if (typeof DecompressionStream === "undefined") return "";
  try {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new TextDecoder("latin1").decode(await new Response(stream).arrayBuffer());
  } catch {
    return "";
  }
}

async function readTextPdf(input: ArrayBuffer) {
  const bytes = new Uint8Array(input);
  const latin = new TextDecoder("latin1").decode(bytes);
  const candidates = [latin];
  const streamPattern = /([\s\S]{0,500})stream\r?\n([\s\S]*?)\r?\nendstream/g;
  for (const match of latin.matchAll(streamPattern)) {
    if (!/\/FlateDecode/.test(match[1])) continue;
    const full = match[0];
    const streamMarker = full.indexOf("stream") + 6;
    let start = (match.index || 0) + streamMarker;
    if (latin[start] === "\r") start += 1;
    if (latin[start] === "\n") start += 1;
    const end = latin.indexOf("endstream", start);
    if (end <= start) continue;
    const inflated = await inflatePdfStream(bytes.slice(start, end).filter((_value, index, source) => !(index === source.length - 1 && (_value === 10 || _value === 13))));
    if (inflated) candidates.push(inflated);
  }
  const text = candidates.map(textFromPdfOperators).filter(Boolean).join("\n");
  if (text.trim().length < 20) {
    throw new Error("No selectable text could be extracted from this PDF. Scanned PDFs must first be converted to text or Excel; Evidara does not silently OCR or invent question content.");
  }
  return text;
}

function rowsFromJson(value: unknown): Record<string, unknown>[] {
  const candidate = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { questions?: unknown[] }).questions)
      ? (value as { questions: unknown[] }).questions
      : [];
  return candidate.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object" && !Array.isArray(row)));
}

export async function readQuestionDocument(file: File): Promise<{ rows: Record<string, unknown>[]; format: string; extractedText?: string }> {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "csv") return { rows: parseCsv(await file.text()), format: "csv" };
  if (extension === "xlsx" || extension === "xls") return { rows: await parseXlsx(await file.arrayBuffer()), format: extension };
  if (extension === "json") {
    const rows = rowsFromJson(JSON.parse(await file.text()));
    if (!rows.length) throw new Error("JSON must be an array of question objects or an object with a questions array.");
    return { rows, format: "json" };
  }
  if (extension === "docx") {
    const extractedText = await readDocx(await file.arrayBuffer());
    return { rows: parseStructuredQuestionText(extractedText), format: "docx", extractedText };
  }
  if (extension === "pdf") {
    const extractedText = await readTextPdf(await file.arrayBuffer());
    return { rows: parseStructuredQuestionText(extractedText), format: "pdf", extractedText };
  }
  if (extension === "tex" || extension === "txt") {
    const extractedText = await file.text();
    return { rows: parseStructuredQuestionText(extractedText), format: extension, extractedText };
  }
  throw new Error("Supported question files are CSV, XLSX, XLS, DOCX, text-based PDF, TEX, TXT and JSON.");
}
