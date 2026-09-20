from pathlib import Path


def replace_between(source: str, start_marker: str, end_marker: str, replacement: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[:start] + replacement + source[end:]


reader = Path('src/lib/questionDocumentReader.ts')
source = reader.read_text()
reader_replacement = r'''type ParsedLatexImageReference = {
  path: string;
  location: 'question' | 'option' | 'solution';
  option?: string;
  imageIndex: number;
};

function isEscaped(source: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) slashCount += 1;
  return slashCount % 2 === 1;
}

function readBalancedValue(source: string, start: number, open: string, close: string) {
  if (source[start] !== open) return null;
  let depth = 1;
  let cursor = start + 1;
  while (cursor < source.length) {
    if (!isEscaped(source, cursor)) {
      if (source[cursor] === open) depth += 1;
      else if (source[cursor] === close) {
        depth -= 1;
        if (depth === 0) return { value: source.slice(start + 1, cursor), end: cursor + 1 };
      }
    }
    cursor += 1;
  }
  return null;
}

function parseTopLevelLatexCommands(block: string) {
  const commands: Array<{ name: string; qualifier: string; value: string }> = [];
  let cursor = 0;
  while (cursor < block.length) {
    const slash = block.indexOf('\\', cursor);
    if (slash < 0) break;
    let index = slash + 1;
    if (!/[A-Za-z]/.test(block[index] || '')) {
      cursor = index + 1;
      continue;
    }

    const nameStart = index;
    while (index < block.length && /[A-Za-z0-9_]/.test(block[index])) index += 1;
    const name = block.slice(nameStart, index);
    while (index < block.length && /\s/.test(block[index])) index += 1;

    let qualifier = '';
    if (block[index] === '[') {
      const optional = readBalancedValue(block, index, '[', ']');
      if (!optional) {
        cursor = index + 1;
        continue;
      }
      qualifier = clean(optional.value);
      index = optional.end;
      while (index < block.length && /\s/.test(block[index])) index += 1;
    }

    if (block[index] !== '{') {
      cursor = index + 1;
      continue;
    }
    const body = readBalancedValue(block, index, '{', '}');
    if (!body) {
      cursor = index + 1;
      continue;
    }
    commands.push({ name, qualifier, value: body.value });
    cursor = body.end;
  }
  return commands;
}

function extractImagePaths(value: string) {
  return [...value.matchAll(/\\includegraphics(?:\s*\[[^\]]*\])?\s*\{([^{}]+)\}/gi)]
    .map((match) => clean(match[1]))
    .filter(Boolean);
}

function stripIncludeGraphics(value: string) {
  return clean(value.replace(/\\includegraphics(?:\s*\[[^\]]*\])?\s*\{[^{}]+\}/gi, ' '));
}

function parseLatexQuestionBlocks(text: string): Record<string, unknown>[] {
  const blocks = [...text.matchAll(/\\begin\{question\}([\s\S]*?)\\end\{question\}/gi)].map((match) => match[1]);
  if (!blocks.length) return [];

  return blocks.map((block) => {
    const row: Record<string, unknown> = {};
    const imageReferences: ParsedLatexImageReference[] = [];
    let imageTarget: { location: 'question' | 'option' | 'solution'; option?: string } = { location: 'question' };

    const rememberImages = (paths: string[], location: 'question' | 'option' | 'solution', option?: string) => {
      paths.forEach((path, imageIndex) => {
        imageReferences.push({ path, location, option, imageIndex: imageIndex + 1 });
      });
    };

    for (const command of parseTopLevelLatexCommands(block)) {
      const name = normalizeKey(command.name);
      const qualifier = clean(command.qualifier || '');
      const value = clean(command.value);
      const inlineImages = extractImagePaths(command.value);

      if (name === 'question' || name === 'stem') {
        row.question = stripIncludeGraphics(command.value);
        imageTarget = { location: 'question' };
        if (inlineImages[0]) row.question_image = inlineImages[0];
        rememberImages(inlineImages, 'question');
      } else if (name === 'option' && qualifier) {
        const option = qualifier.toLowerCase();
        row[`option_${option}`] = stripIncludeGraphics(command.value);
        imageTarget = { location: 'option', option };
        if (inlineImages[0]) row[`option_${option}_image`] = inlineImages[0];
        rememberImages(inlineImages, 'option', option);
      } else if ((name === 'questionimage' || name === 'question_image') && value) {
        row.question_image = value;
        imageTarget = { location: 'question' };
        rememberImages([value], 'question');
      } else if ((name === 'optionimage' || name === 'option_image') && qualifier && value) {
        const option = qualifier.toLowerCase();
        row[`option_${option}_image`] = value;
        imageTarget = { location: 'option', option };
        rememberImages([value], 'option', option);
      } else if (name === 'includegraphics' && value) {
        if (imageTarget.location === 'question') row.question_image = value;
        else if (imageTarget.location === 'option' && imageTarget.option) row[`option_${imageTarget.option}_image`] = value;
        rememberImages([value], imageTarget.location, imageTarget.option);
      } else if (name === 'answer') row.correct_answer = value;
      else if (name === 'solution') {
        row.solution = value;
        imageTarget = { location: 'solution' };
        rememberImages(inlineImages, 'solution');
      } else if (name === 'exam' || name === 'exam_type' || name === 'exam_types') row.exam_types = value;
      else if (name === 'negative' || name === 'negative_marks') row.negative_marks = value;
      else if (name === 'latex' || name === 'question_latex') row.question_latex = value;
      else row[name] = value;
    }

    if (imageReferences.length) row.__image_references = imageReferences;
    return row;
  });
}
'''
source = replace_between(source, 'function parseLatexQuestionBlocks', '\nfunction parseLabelledBlock', reader_replacement)
reader.write_text(source)


helper = Path('src/components/evidara/ai-import-helper.tsx')
source = helper.read_text()
prompts = r'''const aiPreflightRules = `IMPORTANT — DO THIS BEFORE YOU CREATE THE FINAL FILE:\n1. Inspect the complete source first and identify the exam/curriculum, subject mix and whether the paper spans more than one grade.\n2. Classification is part of the conversion job. Every question MUST have a non-empty grade, subject, chapter, topic and difficulty. Do not leave taxonomy blank simply because the source paper did not print it.\n3. Infer chapter/topic from the actual question, options and supplied solution. Use the most specific defensible topic and canonical syllabus names. If web/search is available, verify uncertain syllabus mapping against the official/current curriculum before finalising.\n4. For NEET/NCERT papers, classify each question to the appropriate Grade 11 or Grade 12 chapter. NEET commonly mixes both grades, so DO NOT ask me to choose one grade for the whole paper. For JEE, use the corresponding standard Class 11/12 syllabus mapping.\n5. If the board/exam/grade policy truly cannot be inferred with high confidence, ASK ME the minimum clarifying question BEFORE generating the final file. Do not guess silently. Do not ask me to classify chapter/topic question-by-question; that is your job.\n6. Preserve the source wording, equations, option order and supplied answer key. Classification may be inferred; question/answer content must not be invented.\n7. Before delivery, run a preflight: no blank grade/subject/chapter/topic/difficulty fields; question count matches source; all image references resolve to real packaged files.\n8. For images, support question, option and solution images, including multiple images in one solution. Use only the exact path inside the ZIP. If anything is genuinely missing, report it as Question N — question/option/solution — exact/path.png. Never include surrounding prose as part of an image filename.\n\nIf a required clarification is needed, ask it first and STOP. Only produce the final Evidara file after the clarification is resolved.`;

const latexPrompt = `${aiPreflightRules}\n\nConvert EVERY question into Evidara structured LaTeX. Use exactly one block per question:\n\\begin{question}\n\\exam{NEET}\n\\grade{Grade 11}\n\\subject{Physics}\n\\chapter{Laws of Motion}\n\\topic{Friction}\n\\difficulty{moderate}\n\\marks{4}\n\\negative_marks{1}\n\\question{Question text here}\n\\questionimage{assets/q001.png}\n\\option[A]{Option A}\n\\optionimage[A]{assets/q001-a.png}\n\\option[B]{Option B}\n\\option[C]{Option C}\n\\option[D]{Option D}\n\\answer{A}\n\\solution{Solution only if supplied in the source}\n\\end{question}\n\nOmit image commands when no image exists. You may also preserve inline \\includegraphics{assets/file.png}; every referenced file must exist. Never output \\grade{}, \\subject{}, \\chapter{}, \\topic{} or \\difficulty{} in a final ready file.`;

const excelPrompt = `${aiPreflightRules}\n\nConvert the source into an Evidara-ready spreadsheet with one row per question using these columns:\nexam_types, grade, subject, chapter, topic, question_type, difficulty, question, question_latex, question_image, option_a, option_a_latex, option_a_image, option_b, option_b_latex, option_b_image, option_c, option_c_latex, option_c_image, option_d, option_d_latex, option_d_image, correct_answer, solution, solution_latex, marks, negative_marks, estimated_seconds, language, status, source, source_year, tags\n\nUse single_correct unless the source clearly indicates another type. Put relative ZIP paths such as assets/q017.png in image columns. Every final row must contain grade, subject, chapter, topic and difficulty. Return the table plus a short preflight report listing any source errata or unresolved content.`;

const zipPrompt = `${aiPreflightRules}\n\nPrepare ONE Evidara-ready ZIP bundle. The ZIP must contain exactly one question source file named questions.tex and an assets/ folder containing EVERY referenced image. Do not add a second CSV, Excel, TXT, PDF or DOCX question source.\n\nFor every question create an Evidara block with populated exam, grade, subject, chapter, topic, difficulty, marks, negative_marks, question, options, answer and supplied solution. Use explicit questionimage/optionimage commands when appropriate; inline \\includegraphics is also accepted. Multiple images inside a solution are valid and must all be packaged.\n\nFINAL ZIP GATE: do not give me the ZIP if any required classification field is blank, if any image reference is unresolved, or if the converted question count differs from the source. If a clarification is needed, ask me before creating the ZIP. Alongside the final ZIP, report: questions converted; grades detected; subjects detected; classification completed; image references found; image files packaged; missing images (must be zero unless I explicitly accept an incomplete source); and answer-key/source anomalies.`;
'''
source = replace_between(source, 'const latexPrompt', '\nexport function AiImportHelper', prompts)
helper.write_text(source)


core = Path('src/components/evidara/question-bulk-import-dialog-core.tsx')
source = core.read_text()
diagnostics = r'''  type LocalImageIssue = { questionNumber: number; location: string; path: string };
  const localImageIssues = useMemo<LocalImageIssue[]>(() => {
    const parserIssues = rawRows.flatMap((raw, index) => {
      const entries = Array.isArray(raw.__image_references) ? raw.__image_references : [];
      return entries.flatMap((entry) => {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
        const reference = entry as Record<string, unknown>;
        const path = String(reference.path ?? '').trim();
        if (!path || isRemoteUrl(path)) return [];
        const rawLocation = String(reference.location ?? 'image').trim().toLowerCase();
        const option = String(reference.option ?? '').trim().toUpperCase();
        const imageIndex = Math.max(1, Number(reference.imageIndex) || 1);
        const location = rawLocation === 'option'
          ? `option ${option || '?'} image ${imageIndex}`
          : rawLocation === 'solution'
            ? `solution image ${imageIndex}`
            : `question image ${imageIndex}`;
        return [{ questionNumber: index + 1, location, path }];
      });
    });

    const issues = parserIssues.length ? parserIssues : rows.flatMap((row, index) => {
      const payload = row.payload;
      if (!payload) return [];
      const result: LocalImageIssue[] = [];
      if (payload.question_image_url && !isRemoteUrl(payload.question_image_url)) {
        result.push({ questionNumber: index + 1, location: 'question image 1', path: payload.question_image_url });
      }
      payload.options.forEach((option) => {
        if (option.image_url && !isRemoteUrl(option.image_url)) {
          result.push({ questionNumber: index + 1, location: `option ${option.option_key} image 1`, path: option.image_url });
        }
      });
      return result;
    });

    const seen = new Set<string>();
    return issues.filter((issue) => {
      const key = `${issue.questionNumber}|${issue.location}|${archivePath(issue.path)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rawRows, rows]);
  const localImageReferences = useMemo(() => localImageIssues.map((issue) => issue.path), [localImageIssues]);
  const missingZipIssues = useMemo(() => {
    if (!zipNames) return [];
    return localImageIssues.filter((issue) => !zipNames.has(archivePath(issue.path)) && !zipNames.has(baseName(issue.path)));
  }, [localImageIssues, zipNames]);
  const missingZipFiles = useMemo(() => missingZipIssues.map((issue) => issue.path), [missingZipIssues]);
'''
source = replace_between(source, '  const localImageReferences = useMemo(() => rows.flatMap((row) => {', '  const valid = useMemo(', diagnostics)
core.write_text(source)

source = core.read_text()
alert_start = '            {missingZipFiles.length > 0 && <div className="mt-4 rounded-xl'
alert_end = '\n\n            {showLatexWorkspace'
alert = r'''            {missingZipIssues.length > 0 && <div className="mt-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]"><strong>The ZIP does not contain {missingZipIssues.length} referenced image file{missingZipIssues.length === 1 ? '' : 's'}.</strong><div className="mt-2 space-y-1 text-xs">{missingZipIssues.slice(0, 12).map((issue) => <p key={`${issue.questionNumber}-${issue.location}-${issue.path}`}><strong>Question {issue.questionNumber}</strong> — {issue.location}: {issue.path}</p>)}{missingZipIssues.length > 12 && <p>…and {missingZipIssues.length - 12} more.</p>}</div></div>}'''
source = replace_between(source, alert_start, alert_end, alert)
core.write_text(source)

source = core.read_text()
old = """      setError(missingZipFiles.length
        ? `The image ZIP is missing: ${missingZipFiles.slice(0, 8).join(', ')}${missingZipFiles.length > 8 ? '…' : ''}`
        : 'Attach the matching image ZIP before importing.');"""
new = """      setError(missingZipIssues.length
        ? `The image ZIP is missing: ${missingZipIssues.slice(0, 8).map((issue) => `Question ${issue.questionNumber} — ${issue.location}: ${issue.path}`).join('; ')}${missingZipIssues.length > 8 ? '…' : ''}`
        : 'Attach the matching image ZIP before importing.');"""
if old not in source:
    raise SystemExit('Expected image-block error snippet was not found')
core.write_text(source.replace(old, new, 1))


smoke = Path('scripts/v19-1-latex-paper-import-smoke.mjs')
source = smoke.read_text()
marker = "console.log(`\\nEvidara V19.1 LaTeX Paper Import: ${passed} passed, ${failed} failed`);"
if marker not in source:
    raise SystemExit('Expected V19.1 smoke marker was not found')
additions = r'''const docReader=read('src/lib/questionDocumentReader.ts');
check('bulk LaTeX parser uses balanced braces',docReader.includes('readBalancedValue')&&docReader.includes('parseTopLevelLatexCommands'));
check('inline and multiple image references retain context',docReader.includes('__image_references')&&docReader.includes("rememberImages(inlineImages, 'solution')"));
const bulkImport=read('src/components/evidara/question-bulk-import-dialog-core.tsx');
check('missing ZIP images identify question and location',bulkImport.includes('missingZipIssues')&&bulkImport.includes('Question {issue.questionNumber}')&&bulkImport.includes('solution image'));
const aiHelper=read('src/components/evidara/ai-import-helper.tsx');
check('AI helper requires complete classification before output',aiHelper.includes('Every question MUST have a non-empty grade, subject, chapter, topic and difficulty')&&aiHelper.includes('DO NOT ask me to choose one grade for the whole paper'));
check('AI helper preflights exact image references',aiHelper.includes('Question N — question/option/solution')&&aiHelper.includes('all image references resolve to real packaged files'));
'''
smoke.write_text(source.replace(marker, additions + '\n' + marker, 1))

print('Applied Evidara import preflight fix.')
