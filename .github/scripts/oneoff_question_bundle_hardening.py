from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# Shared bulk importer: direct ZIP bundles + safer image resolution + paper-context mode.
path = Path("src/components/evidara/question-bulk-import-dialog-core.tsx")
text = path.read_text()

text = replace_once(
    text,
    "const baseName = (value: string) => value.trim().split(/[\\\\/]/).pop()?.toLocaleLowerCase() || '';",
    "const baseName = (value: string) => value.trim().split(/[\\\\/]/).pop()?.toLocaleLowerCase() || '';\nconst archivePath = (value: string) => value.trim().replace(/\\\\/g, '/').replace(/^\\.\\//, '').replace(/^\\/+/, '').toLocaleLowerCase();",
    "archive path helper",
)

text = replace_once(
    text,
    "  topics,\n  onImported,\n}: {\n  open: boolean;\n  onOpenChange: (open: boolean) => void;\n  kind: 'admin' | 'school';\n  organizationId: string | null;\n  subjects: TaxonomySubject[];\n  chapters: TaxonomyChapter[];\n  topics: TaxonomyTopic[];\n  onImported: () => Promise<void> | void;\n}) {",
    "  topics,\n  onImported,\n  embeddedPaperMode = false,\n}: {\n  open: boolean;\n  onOpenChange: (open: boolean) => void;\n  kind: 'admin' | 'school';\n  organizationId: string | null;\n  subjects: TaxonomySubject[];\n  chapters: TaxonomyChapter[];\n  topics: TaxonomyTopic[];\n  onImported: () => Promise<void> | void;\n  embeddedPaperMode?: boolean;\n}) {",
    "embedded paper prop",
)

text = replace_once(text, "  const [createPaper, setCreatePaper] = useState(kind === 'school');", "  const [createPaper, setCreatePaper] = useState(false);", "create paper default")
text = replace_once(text, "  useEffect(() => { setCreatePaper(kind === 'school'); }, [kind]);", "  useEffect(() => { setCreatePaper(false); }, [kind, embeddedPaperMode, open]);", "create paper reset")

start = text.index("  async function parse(file: File) {")
end = text.index("\n  async function attachImageZip", start)
text = text[:start] + r'''  async function parse(file: File) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    let sourceFile = file;
    setQuestionFile(file);
    setRawRows([]);
    setResult(null);
    setError('');
    setNotice('');
    clearEditHistory();
    setBusy(true);
    setStage(`Reading ${file.name}…`);
    try {
      if (extension === 'zip') {
        setStage(`Opening ${file.name}…`);
        const zip = await readZip(await file.arrayBuffer());
        const entries = [...zip.values()].filter((entry) => !entry.name.endsWith('/') && !entry.name.startsWith('__MACOSX/'));
        const candidates = entries.filter((entry) => /\.(tex|csv|xlsx|xls|json|docx|pdf|txt)$/i.test(entry.name) && !/(^|\/)readme\.txt$/i.test(entry.name));
        const preferred = candidates.filter((entry) => !/\.txt$/i.test(entry.name));
        const sourceCandidates = preferred.length ? preferred : candidates;
        if (!sourceCandidates.length) throw new Error('This ZIP has no supported question source. Add exactly one TEX, XLSX, XLS, CSV, JSON, DOCX, text PDF or TXT question file.');
        if (sourceCandidates.length > 1) throw new Error(`This ZIP contains multiple question sources (${sourceCandidates.map((entry) => entry.name).join(', ')}). Keep exactly one source file so Evidara cannot choose the wrong paper.`);
        const sourceEntry = sourceCandidates[0];
        const sourceName = sourceEntry.name.split('/').pop() || 'questions.tex';
        sourceFile = new File([sourceEntry.blob], sourceName);

        const nameCounts = new Map<string, number>();
        for (const entry of entries) {
          const name = baseName(entry.name);
          nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        }
        const names = new Set<string>();
        for (const entry of entries) {
          names.add(archivePath(entry.name));
          const name = baseName(entry.name);
          if ((nameCounts.get(name) || 0) === 1) names.add(name);
        }
        setImageZip(file);
        setZipNames(names);
        setNotice(`ZIP bundle opened: ${sourceName} plus ${Math.max(0, entries.length - 1)} bundled asset${entries.length - 1 === 1 ? '' : 's'}. Evidara will match local image references automatically.`);
      } else {
        setImageZip(null);
        setZipNames(null);
      }

      const document = await readQuestionDocument(sourceFile);
      if (document.rows.length > 2000) throw new Error('This file contains more than 2,000 questions. Split it into smaller batches.');
      setRawRows(document.rows);
      setFormat(document.format);
      setCurrentIndex(0);
      setSummaryRequested(true);
    } catch (caught) {
      setQuestionFile(null);
      if (extension === 'zip') {
        setImageZip(null);
        setZipNames(null);
      }
      setError(caught instanceof Error ? caught.message : 'Evidara could not read this question file or ZIP bundle.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }
''' + text[end:]

old_attach = """      const zip = await readZip(await file.arrayBuffer());
      const names = new Set([...zip.values()].filter((entry) => !entry.name.endsWith('/')).map((entry) => baseName(entry.name)));
      if (!names.size) throw new Error('The selected ZIP does not contain any files.');
      setZipNames(names);
      setNotice(`${names.size} image file${names.size === 1 ? '' : 's'} found in ${file.name}.`);"""
new_attach = """      const zip = await readZip(await file.arrayBuffer());
      const entries = [...zip.values()].filter((entry) => !entry.name.endsWith('/'));
      if (!entries.length) throw new Error('The selected ZIP does not contain any files.');
      const nameCounts = new Map<string, number>();
      for (const entry of entries) {
        const name = baseName(entry.name);
        nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
      }
      const names = new Set<string>();
      for (const entry of entries) {
        names.add(archivePath(entry.name));
        const name = baseName(entry.name);
        if ((nameCounts.get(name) || 0) === 1) names.add(name);
      }
      setZipNames(names);
      setNotice(`${entries.length} bundled file${entries.length === 1 ? '' : 's'} found in ${file.name}.`);"""
text = replace_once(text, old_attach, new_attach, "separate image ZIP")

text = replace_once(
    text,
    "    return [...new Set(localImageReferences.map(baseName).filter(Boolean))].filter((name) => !zipNames.has(name));",
    "    return [...new Set(localImageReferences.filter(Boolean))].filter((value) => !zipNames.has(archivePath(value)) && !zipNames.has(baseName(value)));",
    "missing image matching",
)

prep_start = text.index("  async function prepareImages(payloads: QuestionPayload[]) {")
prep_end = text.index("\n  async function runImport()", prep_start)
text = text[:prep_start] + r'''  async function prepareImages(payloads: QuestionPayload[]) {
    const localReferences = payloads.flatMap((payload) => [payload.question_image_url || '', ...payload.options.map((option) => option.image_url || '')])
      .filter((value) => value && !isRemoteUrl(value));
    if (!localReferences.length) return payloads;
    if (!imageZip) throw new Error(`${localReferences.length} local image reference${localReferences.length === 1 ? '' : 's'} found. Choose the matching image ZIP or a complete question ZIP bundle before importing.`);
    if (!supabase || !user) throw new Error('Sign in again before uploading question images.');

    const zip = await readZip(await imageZip.arrayBuffer());
    const entries = [...zip.values()].filter((entry) => !entry.name.endsWith('/'));
    const byPath = new Map(entries.map((entry) => [archivePath(entry.name), entry]));
    const byBase = new Map<string, typeof entries>();
    for (const entry of entries) {
      const key = baseName(entry.name);
      byBase.set(key, [...(byBase.get(key) || []), entry]);
    }
    const uploaded = new Map<string, string>();

    async function resolve(value: string) {
      if (!value || isRemoteUrl(value)) return value.trim();
      const pathKey = archivePath(value);
      if (uploaded.has(pathKey)) return uploaded.get(pathKey)!;
      const name = baseName(value);
      const basenameMatches = byBase.get(name) || [];
      const entry = byPath.get(pathKey) || (basenameMatches.length === 1 ? basenameMatches[0] : undefined);
      if (!entry && basenameMatches.length > 1) throw new Error(`Image '${value}' is ambiguous because ${imageZip?.name} contains more than one file named '${name}'. Use the relative path from the ZIP, for example assets/${name}.`);
      if (!entry) throw new Error(`Image '${value}' is referenced by a question but is missing from ${imageZip?.name}.`);
      const { blob } = normalizeImageBytes(entry.bytes, name, 4 * 1024 * 1024);
      setStage(`Uploading ${name}…`);
      const result = await uploadQuestionAsset(blob, safeImageFileName(name), 'imports');
      uploaded.set(pathKey, result.publicUrl);
      return result.publicUrl;
    }

    for (const payload of payloads) {
      payload.question_image_url = await resolve(payload.question_image_url || '');
      for (const option of payload.options) option.image_url = await resolve(option.image_url || '');
    }
    return payloads;
  }
''' + text[prep_end:]

text = replace_once(
    text,
    "        if (platformImport && publishMaster) payload.status = 'approved';\n        if (payload.status === 'approved') payload.metadata.published_at = payload.metadata.published_at || new Date().toISOString();",
    "        if (platformImport && publishMaster) payload.status = 'approved';\n        if (embeddedPaperMode && canPublish) payload.status = 'approved';\n        if (payload.status === 'approved') payload.metadata.published_at = payload.metadata.published_at || new Date().toISOString();",
    "paper import approval",
)
text = replace_once(
    text,
    "  if (/question-assets|bucket|r2/i.test(message)) return 'Question image storage is not ready. Check the Cloudflare R2 environment values, bucket token and public URL.';",
    "  if (/question-assets|bucket|r2/i.test(message)) return 'Question image storage is not ready. Ask an administrator to check Evidara image storage and retry.';",
    "provider-neutral error",
)
text = replace_once(text, '<DialogTitle className="mt-1 text-xl text-[#14232B]">Excel, CSV or LaTeX import</DialogTitle>', '<DialogTitle className="mt-1 text-xl text-[#14232B]">Excel, CSV, LaTeX or ZIP import</DialogTitle>', "dialog title")
text = replace_once(text, 'accept=".csv,.xlsx,.xls,.docx,.pdf,.tex,.txt,.json"', 'accept=".csv,.xlsx,.xls,.docx,.pdf,.tex,.txt,.json,.zip"', "picker ZIP support")
text = replace_once(text, "{questionFile ? questionFile.name : 'Choose an Excel, CSV or LaTeX question file'}", "{questionFile ? questionFile.name : 'Choose a question file or complete ZIP bundle'}", "picker heading")
text = replace_once(text, 'XLSX is recommended. Evidara also supports CSV, XLS, DOCX, text PDF, TEX, TXT and JSON, then shows a validation review before saving anything.', 'XLSX is recommended. Evidara also supports CSV, XLS, DOCX, text PDF, TEX, TXT, JSON and a ZIP containing one question source plus its images.', "picker description")
text = replace_once(text, 'Use a TEX question source and attach the matching image ZIP only when the imported rows refer to local image filenames.', 'Upload one ZIP containing a TEX/Excel/CSV question source plus its images, or choose a question file first and attach a separate image ZIP. Relative paths such as assets/q17.png are matched automatically.', "ZIP description")
text = replace_once(
    text,
    "{kind === 'school' && <div className=\"mt-4 rounded-2xl border border-[#DCE9E7] bg-white p-4\"><div className=\"flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between\"><div><strong className=\"text-sm text-[#14232B]\">Create a paper from this import</strong>",
    "{kind === 'school' && !embeddedPaperMode && <div className=\"mt-4 rounded-2xl border border-[#DCE9E7] bg-white p-4\"><div className=\"flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between\"><div><strong className=\"text-sm text-[#14232B]\">Create a paper from this import</strong>",
    "hide new-paper panel inside paper builder",
)
text = replace_once(
    text,
    "{createPaper && kind === 'school' ? `Import ${valid.length} & Create Paper` : canPublish ? `Import ${valid.length} Ready Question${valid.length === 1 ? '' : 's'}` : `Import ${valid.length} Draft/Review Question${valid.length === 1 ? '' : 's'}`}",
    "{embeddedPaperMode ? `Import ${valid.length} & Add to Paper` : createPaper && kind === 'school' ? `Import ${valid.length} & Create Paper` : canPublish ? `Import ${valid.length} Ready Question${valid.length === 1 ? '' : 's'}` : `Import ${valid.length} Draft/Review Question${valid.length === 1 ? '' : 's'}`}",
    "paper import action label",
)
path.write_text(text)


# Structured LaTeX parser: explicit question/option image placement and common field aliases.
path = Path("src/lib/questionDocumentReader.ts")
text = path.read_text()
start = text.index("function parseLatexQuestionBlocks")
end = text.index("\nfunction parseLabelledBlock", start)
text = text[:start] + r'''function parseLatexQuestionBlocks(text: string): Record<string, unknown>[] {
  const blocks = [...text.matchAll(/\\begin\{question\}([\s\S]*?)\\end\{question\}/gi)].map((match) => match[1]);
  if (!blocks.length) return [];

  return blocks.map((block) => {
    const row: Record<string, unknown> = {};
    let imageTarget = 'question_image';
    const commands = [...block.matchAll(/\\([a-zA-Z][a-zA-Z0-9_]*)\s*(?:\[([^\]]+)\])?\s*\{([\s\S]*?)\}(?=\s*\\[a-zA-Z]|\s*$)/g)];
    for (const command of commands) {
      const name = normalizeKey(command[1]);
      const qualifier = clean(command[2] || '');
      const value = clean(command[3]);
      if (name === 'question' || name === 'stem') {
        row.question = value;
        imageTarget = 'question_image';
      } else if (name === 'option' && qualifier) {
        const option = qualifier.toLowerCase();
        row[`option_${option}`] = value;
        imageTarget = `option_${option}_image`;
      } else if ((name === 'questionimage' || name === 'question_image') && value) row.question_image = value;
      else if ((name === 'optionimage' || name === 'option_image') && qualifier && value) row[`option_${qualifier.toLowerCase()}_image`] = value;
      else if (name === 'includegraphics' && value) row[imageTarget] = value;
      else if (name === 'answer') row.correct_answer = value;
      else if (name === 'solution') row.solution = value;
      else if (name === 'exam' || name === 'exam_type' || name === 'exam_types') row.exam_types = value;
      else if (name === 'negative' || name === 'negative_marks') row.negative_marks = value;
      else if (name === 'latex' || name === 'question_latex') row.question_latex = value;
      else row[name] = value;
    }
    return row;
  });
}
''' + text[end:]
path.write_text(text)


# AI helper: generate the exact syntax Evidara can import.
path = Path("src/components/evidara/ai-import-helper.tsx")
text = path.read_text()
start = text.index("const latexPrompt = `")
end = text.index("\n\nexport function AiImportHelper", start)
prompts = r'''const latexPrompt = `You are preparing a question bank for Evidara. I will upload a question paper/document. Convert EVERY question faithfully into the structured LaTeX below. Do not solve, rewrite, simplify or invent content. Preserve equations, option order and supplied answers. If taxonomy is unknown, leave it blank rather than guessing.\n\nUse exactly one block per question:\n\\begin{question}\n\\exam{NEET}\n\\grade{Grade 12}\n\\subject{Physics}\n\\chapter{Laws of Motion}\n\\topic{Friction}\n\\difficulty{moderate}\n\\marks{4}\n\\negative_marks{1}\n\\question{Question text here}\n\\questionimage{assets/q001.png}\n\\option[A]{Option A}\n\\optionimage[A]{assets/q001-a.png}\n\\option[B]{Option B}\n\\option[C]{Option C}\n\\option[D]{Option D}\n\\answer{A}\n\\solution{Solution only if supplied in the source}\n\\end{question}\n\nOmit questionimage/optionimage when there is no image. Keep every referenced image filename exactly consistent with the ZIP. Evidara also accepts \\includegraphics{assets/file.png} immediately after a question or option, but questionimage/optionimage is preferred because placement is explicit. At the end, report uncertain answer keys, missing images or unreadable questions.`;

const excelPrompt = `I will upload a question paper/document. Convert it into an Evidara-ready spreadsheet. Do not rewrite or solve questions. Preserve the answer key exactly as supplied. Create one row per question using these columns:\nexam_types, grade, subject, chapter, topic, question_type, difficulty, question, question_latex, question_image, option_a, option_a_latex, option_a_image, option_b, option_b_latex, option_b_image, option_c, option_c_latex, option_c_image, option_d, option_d_latex, option_d_image, correct_answer, solution, solution_latex, marks, negative_marks, estimated_seconds, language, status, source, source_year, tags\n\nFor images, put relative ZIP paths such as assets/q017.png or assets/q017-a.png in the corresponding question_image/option image column. Use single_correct unless the source clearly indicates another type. If subject/chapter/topic are unknown, leave them blank rather than guessing. Return an XLSX/CSV-compatible table and separately list uncertain rows.`;

const zipPrompt = `I will upload a question paper/document and its images. Prepare ONE Evidara-ready ZIP bundle. The ZIP must contain exactly one question source file named questions.tex and an assets/ folder with every referenced image. Do not add a second CSV, Excel, TXT, PDF or DOCX question source. Preserve question order, wording, equations, options and supplied answer keys; do not solve or invent content.\n\nFor each question use Evidara blocks such as:\n\\begin{question}\n\\exam{NEET}\n\\grade{Grade 12}\n\\subject{Physics}\n\\chapter{}\n\\topic{}\n\\difficulty{moderate}\n\\marks{4}\n\\negative_marks{1}\n\\question{Question text}\n\\questionimage{assets/q001.png}\n\\option[A]{Option A}\n\\optionimage[A]{assets/q001-a.png}\n\\option[B]{Option B}\n\\option[C]{Option C}\n\\option[D]{Option D}\n\\answer{A}\n\\solution{Only the supplied solution}\n\\end{question}\n\nOmit image commands when no image exists. Keep paths exact and case-consistent. Use unique image filenames. Before finalising the ZIP, report missing/ambiguous images or unreadable questions.`;'''
text = text[:start] + prompts + text[end:]
path.write_text(text)


# Downloadable guide/template: direct ZIP workflow and provider-neutral wording.
path = Path("src/lib/questionTemplateWorkbook.ts")
text = path.read_text()
start = text.index("export async function downloadQuestionImageZipTemplate()")
text = text[:start] + r'''export async function downloadQuestionImageZipTemplate() {
  const guide = [
    'EVIDARA QUESTION + IMAGE ZIP BUNDLE TEMPLATE',
    '',
    'Upload this ZIP directly from Choose file.',
    '1. Keep exactly one question source in the ZIP (questions.tex is recommended).',
    '2. Put question/option images inside assets/ and use unique filenames.',
    '3. Reference exact relative paths such as assets/q001.png.',
    '4. In LaTeX, use \\questionimage{assets/q001.png} and \\optionimage[A]{assets/q001-a.png}.',
    '5. Evidara also accepts \\includegraphics{assets/q001.png} immediately after a question or option.',
    '6. Evidara validates the source, matches images, uploads them, and shows review before saving.',
    '7. You may still upload Excel/CSV/TEX first and attach a separate image ZIP if you prefer.',
  ].join('\n');
  const latex = String.raw`\\begin{question}
\\exam{NEET}
\\grade{Grade 12}
\\subject{Physics}
\\chapter{Example Chapter}
\\topic{Example Topic}
\\difficulty{moderate}
\\marks{4}
\\negative_marks{1}
\\question{Replace this with the original question text.}
\\questionimage{assets/q001.png}
\\option[A]{Option A}
\\optionimage[A]{assets/q001-a.png}
\\option[B]{Option B}
\\option[C]{Option C}
\\option[D]{Option D}
\\answer{A}
\\solution{Replace with the supplied solution, or leave blank.}
\\end{question}`;
  downloadBlob(await createZipBlob([
    { name: 'README.txt', data: guide },
    { name: 'questions.tex', data: latex },
    { name: 'assets/REPLACE_WITH_REAL_IMAGES.txt', data: 'Delete this placeholder and place the images referenced by questions.tex in this folder.' },
  ]), 'evidara-question-image-bundle-template.zip');
}

export function downloadQuestionImportGuide() {
  const guide = guideRows.map(([column, requirement, how, note]) => `${column}\nRequirement: ${requirement}\nHow: ${how}\nNote: ${note}\n`).join('\n');
  const bundle = [
    'ZIP BUNDLE IMPORT',
    '• You can upload one ZIP directly from Choose file.',
    '• Keep exactly one supported question source in the ZIP; questions.tex is recommended.',
    '• Put images in assets/ (or another folder) and reference their relative paths.',
    '• Preferred LaTeX image commands: \\questionimage{assets/q001.png} and \\optionimage[A]{assets/q001-a.png}.',
    '• \\includegraphics{assets/file.png} is accepted immediately after the question/option it belongs to.',
    '• Evidara matches the exact relative path first. A filename-only fallback is used only when that filename is unique.',
    '• The separate Image ZIP workflow remains supported for Excel/CSV/TEX imports.',
  ].join('\n');
  downloadBlob(new Blob([`EVIDARA BULK QUESTION IMPORT GUIDE\n\n${bundle}\n\n${guide}`], { type: 'text/plain;charset=utf-8' }), 'evidara-question-import-guide.txt');
}
'''
path.write_text(text)


# Paper-builder import uses existing paper instead of creating a second draft paper.
path = Path("src/components/evidara/live-paper-catalogue-v8.tsx")
text = path.read_text()
text = replace_once(text, "<QuestionBulkImportDialog\nopen={importOpen}\nonOpenChange=", "<QuestionBulkImportDialog\nopen={importOpen}\nembeddedPaperMode\nonOpenChange=", "paper builder embedded mode")
path.write_text(text)


# Assertions before the build.
core = Path("src/components/evidara/question-bulk-import-dialog-core.tsx").read_text()
reader = Path("src/lib/questionDocumentReader.ts").read_text()
paper = Path("src/components/evidara/live-paper-catalogue-v8.tsx").read_text()
assert 'accept=".csv,.xlsx,.xls,.docx,.pdf,.tex,.txt,.json,.zip"' in core
assert "extension === 'zip'" in core
assert "embeddedPaperMode" in core and "embeddedPaperMode" in paper
assert "name === 'includegraphics'" in reader
assert "name === 'questionimage'" in reader
