from pathlib import Path


def must_replace(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing expected snippet: {label}')
    return text.replace(old, new, 1)

# 1) Audience assignment: preview must be optional, not a hidden prerequisite.
path = Path('src/components/evidara/paper-assignment-center.tsx')
text = path.read_text()
text = must_replace(
    text,
    "  const selectedPaper = papers.find((paper) => paper.id === paperId) || null;\n",
    "  const selectedPaper = papers.find((paper) => paper.id === paperId) || null;\n  const canAssign = Boolean(paperId) && (mode !== 'students' || studentIds.length > 0);\n",
    'audience canAssign state',
)
old_assign = """  async function assign() {
    if (!supabase || !paperId) return;
    setBusy('assign'); setError(''); setMessage('');
    const { data, error: assignError } = await supabase.rpc('assign_paper_audience_v19', {
      p_paper_id: paperId,
      p_audience: audience(),
    });
    if (assignError) setError(assignError.message);
    else {
      const result = (data || null) as AssignmentPreview | null;
      setPreview(result);
      setMessage(`${Number(result?.assigned_count || 0).toLocaleString('en-IN')} students are now assigned to this test. The cohort will be frozen once the first attempt starts.`);
    }
    setBusy('');
  }
"""
new_assign = """  async function assign() {
    if (!supabase || !canAssign) return;
    setBusy('assign'); setError(''); setMessage('');
    const requestedAudience = audience();

    // Preview internally so teachers can click Assign immediately after selecting
    // students. Preview remains available as an optional confidence check.
    const { data: previewData, error: previewError } = await supabase.rpc('preview_paper_assignment_v19', {
      p_paper_id: paperId,
      p_audience: requestedAudience,
    });
    if (previewError) {
      setError(previewError.message);
      setBusy('');
      return;
    }
    const prepared = (previewData || null) as AssignmentPreview | null;
    setPreview(prepared);
    const blocking = prepared?.warnings?.filter((warning) => warning.severity === 'blocking') || [];
    if (!prepared?.assigned_count) {
      setError('No eligible students match this audience. Check the selected students or class filters and try again.');
      setBusy('');
      return;
    }
    if (blocking.length) {
      setError(blocking.map((warning) => warning.message).join(' '));
      setBusy('');
      return;
    }

    const { data, error: assignError } = await supabase.rpc('assign_paper_audience_v19', {
      p_paper_id: paperId,
      p_audience: requestedAudience,
    });
    if (assignError) setError(assignError.message);
    else {
      const result = (data || null) as AssignmentPreview | null;
      setPreview(result);
      setMessage(`${Number(result?.assigned_count || 0).toLocaleString('en-IN')} student${Number(result?.assigned_count || 0) === 1 ? '' : 's'} assigned. You can continue to the release check.`);
    }
    setBusy('');
  }
"""
text = must_replace(text, old_assign, new_assign, 'direct audience assign handler')
text = text.replace(
    "Define the audience, preview the exact eligible count, then materialize the cohort before publishing.",
    "Choose the audience and assign it. Preview is optional and can be used to check the eligible count first.",
)
old_buttons = """          <Button type=\"button\" variant=\"outline\" disabled={busy !== '' || !paperId || (mode === 'students' && !studentIds.length)} onClick={() => void previewAssignment()}>{busy === 'preview' && <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" />}Preview audience</Button>
          <Button type=\"button\" disabled={busy !== '' || !preview?.assigned_count || preview?.warnings?.some((warning) => warning.severity === 'blocking')} onClick={() => void assign()}>{busy === 'assign' && <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" />}Assign {preview?.assigned_count ? preview.assigned_count.toLocaleString('en-IN') : ''} students</Button>
"""
new_buttons = """          <Button type=\"button\" variant=\"outline\" disabled={busy !== '' || !canAssign} onClick={() => void previewAssignment()}>{busy === 'preview' && <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" />}Preview audience</Button>
          <Button type=\"button\" disabled={busy !== '' || !canAssign} onClick={() => void assign()}>{busy === 'assign' && <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" />}{mode === 'students' && studentIds.length ? `Assign ${studentIds.length.toLocaleString('en-IN')} selected` : 'Assign students'}</Button>
"""
text = must_replace(text, old_buttons, new_buttons, 'audience action buttons')
path.write_text(text)

# 2) AI helper: subject/section planning must be explicit for LaTeX/ZIP.
path = Path('src/components/evidara/ai-import-helper.tsx')
text = path.read_text()
needle = "8. For images, support question, option and solution images, including multiple images in one solution. Use only the exact path inside the ZIP. If anything is genuinely missing, report it as Question N — question/option/solution — exact/path.png. Never include surrounding prose as part of an image filename."
replacement = needle + "\\n9. PLAN THE PAPER SECTIONS BEFORE converting. Detect every subject present in the source and assign each question the correct canonical subject. For a mixed NEET paper, use Physics, Chemistry and Biology as separate subject groups; do NOT label the whole paper Biology just because the last/current question is Biology. For JEE, normally use Physics, Chemistry and Mathematics. Preserve explicit source sections when they exist.\\n10. The final conversion report MUST include a Section plan with each detected subject/section and its question count. Evidara uses the per-question subject field to create subject sections automatically, so subject names must be consistent across all questions (for example exactly Physics, Chemistry, Biology)."
text = must_replace(text, needle, replacement, 'AI section planning rules')
text = text.replace(
    "Never output \\\\grade{}, \\\\subject{}, \\\\chapter{}, \\\\topic{} or \\\\difficulty{} in a final ready file.",
    "Never output \\\\grade{}, \\\\subject{}, \\\\chapter{}, \\\\topic{} or \\\\difficulty{} in a final ready file. Before the question blocks, report the detected section plan (for example Physics 45, Chemistry 45, Biology 90). Every question's \\\\subject{...} must match that plan so Evidara can create and populate the sections automatically.",
)
text = text.replace(
    "Alongside the final ZIP, report: questions converted; grades detected; subjects detected; classification completed; image references found; image files packaged; missing images (must be zero unless I explicitly accept an incomplete source); and answer-key/source anomalies.",
    "Alongside the final ZIP, report: questions converted; grades detected; subjects detected; Section plan with per-subject question counts; classification completed; image references found; image files packaged; missing images (must be zero unless I explicitly accept an incomplete source); and answer-key/source anomalies. For a mixed paper, never collapse all questions into one subject/section.",
)
path.write_text(text)

# 3) Paper builder: auto-create subject sections on embedded import + bulk section editing.
path = Path('src/components/evidara/live-paper-catalogue-v8.tsx')
text = path.read_text()

# Canonical subject detector used by import organization and the manual organizer.
marker = "function subjectMatches(question: QuestionRow, section: PaperSectionInput) {"
helper = """const PAPER_SUBJECT_ORDER = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'Logical Reasoning'];
function canonicalPaperSubject(question: QuestionRow) {
const values = [question.subjects?.name, question.subjects?.code, ...(question.tags || [])].map(normal).filter(Boolean);
const contains = (tokens: string[]) => values.some((value) => tokens.some((token) => value === token || value.includes(token)));
if (contains(['physics', 'phy'])) return 'Physics';
if (contains(['chemistry', 'chem'])) return 'Chemistry';
if (contains(['mathematics', 'maths', 'math'])) return 'Mathematics';
if (contains(['biology', 'botany', 'zoology'])) return 'Biology';
if (contains(['logicalreasoning', 'reasoning', 'aptitude', 'mentalability'])) return 'Logical Reasoning';
return question.subjects?.name?.trim() || 'General';
}
function orderedPaperSubjects(values: string[]) {
return [...new Set(values.filter(Boolean))].sort((a, b) => {
const ai = PAPER_SUBJECT_ORDER.indexOf(a); const bi = PAPER_SUBJECT_ORDER.indexOf(b);
if (ai < 0 && bi < 0) return a.localeCompare(b);
if (ai < 0) return 1; if (bi < 0) return -1; return ai - bi;
});
}
""" + marker
text = must_replace(text, marker, helper, 'canonical paper subject helper')

text = must_replace(
    text,
    "const [selected, setSelected] = useState<Selected[]>([]);\n",
    "const [selected, setSelected] = useState<Selected[]>([]);\nconst [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set());\n",
    'bulk question selection state',
)

start = "useEffect(() => {\nif (!importBefore) return;\nconst added = questions.filter((item) => !importBefore.has(item.id));"
start_i = text.find(start)
if start_i < 0:
    raise SystemExit('Missing expected snippet: embedded import effect start')
end_marker = "}, [activeSection, importBefore, importSection, questions, sections]);"
end_i = text.find(end_marker, start_i)
if end_i < 0:
    raise SystemExit('Missing expected snippet: embedded import effect end')
end_i += len(end_marker)
new_effect = """useEffect(() => {
if (!importBefore) return;
const added = questions.filter((item) => !importBefore.has(item.id));
if (!added.length) return;
const subjectsInImport = orderedPaperSubjects(added.map(canonicalPaperSubject));
const splitBySubject = subjectsInImport.length > 1;
let plannedSections = [...sections];
const sectionBySubject = new Map<string, string>();

if (splitBySubject) {
const alreadyHasPaperQuestions = selected.length > 0;
if (!alreadyHasPaperQuestions) plannedSections = [];
for (const subject of subjectsInImport) {
let section = plannedSections.find((candidate) => normal(candidate.subject_key) === normal(subject));
if (!section) {
section = { ...emptySection(plannedSections.length, builder.defaultMode, subjectNames), title: subject, subject_key: subject, display_order: plannedSections.length };
plannedSections.push(section);
} else if (!alreadyHasPaperQuestions || /^Section [A-Z]$/i.test(section.title)) {
section = { ...section, title: subject, subject_key: subject };
plannedSections = plannedSections.map((candidate) => candidate.client_id === section!.client_id ? section! : candidate);
}
sectionBySubject.set(subject, section.client_id);
}
plannedSections = plannedSections.map((section, index) => ({ ...section, display_order: index }));
setSections(plannedSections);
setActiveSection(sectionBySubject.get(subjectsInImport[0]) || plannedSections[0]?.client_id || '');
}

const fallbackSectionId = importSection || activeSection || plannedSections[0]?.client_id;
if (!fallbackSectionId) return;
setSelected((current) => {
const existing = new Set(current.map((item) => item.question_id));
const fresh = added.filter((question) => !existing.has(question.id));
return [
...current,
...fresh.map((question, index) => ({
question_id: question.id,
section_client_id: splitBySubject ? (sectionBySubject.get(canonicalPaperSubject(question)) || fallbackSectionId) : fallbackSectionId,
display_order: current.length + index,
marks: Number(question.marks),
negative_marks: Number(question.negative_marks),
is_mandatory: true,
question,
})),
];
});
setMessage(splitBySubject
? `${added.length} imported questions organized automatically into ${subjectsInImport.length} subject sections: ${subjectsInImport.join(', ')}.`
: `${added.length} newly imported approved question${added.length === 1 ? '' : 's'} added.`);
setImportBefore(null);
setImportSection('');
}, [activeSection, builder.defaultMode, importBefore, importSection, questions, sections, selected.length, subjectNames]);"""
text = text[:start_i] + new_effect + text[end_i:]

# Add bulk move + one-click subject organization before validation functions.
validate_marker = "function validate(status: PaperStatus) {"
controls = """function toggleBulkQuestion(questionId: string) {
setBulkSelectedIds((current) => { const next = new Set(current); if (next.has(questionId)) next.delete(questionId); else next.add(questionId); return next; });
}
function selectActiveSectionQuestions() {
if (!active) return;
const ids = selected.filter((item) => item.section_client_id === active.client_id).map((item) => item.question_id);
setBulkSelectedIds(new Set(ids));
}
function moveBulkQuestions(sectionId: string) {
if (!sectionId || !bulkSelectedIds.size) return;
const count = bulkSelectedIds.size;
setSelected((current) => current.map((item) => bulkSelectedIds.has(item.question_id) ? { ...item, section_client_id: sectionId } : item));
setBulkSelectedIds(new Set());
const title = sections.find((section) => section.client_id === sectionId)?.title || 'selected section';
setMessage(`${count} question${count === 1 ? '' : 's'} moved to ${title}.`);
}
function organizeQuestionsBySubject() {
const subjectsInPaper = orderedPaperSubjects(selected.map((item) => canonicalPaperSubject(item.question)));
if (subjectsInPaper.length < 2) { setMessage('This paper currently contains one detected subject, so no subject split is needed.'); return; }
const nextSections = subjectsInPaper.map((subject, index) => {
const existing = sections.find((section) => normal(section.subject_key) === normal(subject));
return existing
? { ...existing, title: subject, subject_key: subject, display_order: index }
: { ...emptySection(index, builder.defaultMode, subjectNames), title: subject, subject_key: subject, display_order: index };
});
const sectionBySubject = new Map(nextSections.map((section) => [section.subject_key, section.client_id]));
setSections(nextSections);
setSelected((current) => current.map((item, index) => ({
...item,
section_client_id: sectionBySubject.get(canonicalPaperSubject(item.question)) || nextSections[0].client_id,
display_order: index,
})));
setActiveSection(nextSections[0].client_id);
setBulkSelectedIds(new Set());
setMessage(`${selected.length} questions organized into ${subjectsInPaper.length} subject sections: ${subjectsInPaper.join(', ')}.`);
}
""" + validate_marker
text = must_replace(text, validate_marker, controls, 'bulk section controls')

# Insert teacher-friendly bulk toolbar above paper question list.
list_marker = '<div className="mt-4 max-h-[590px] space-y-2 overflow-y-auto pr-1">\n{selected.map((item, index) => ('
toolbar = """<div className=\"mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-2\">
<Button type=\"button\" variant=\"outline\" size=\"sm\" disabled={!selected.length} onClick={selectActiveSectionQuestions}>Select all in {active?.title || 'section'}</Button>
<Button type=\"button\" variant=\"outline\" size=\"sm\" disabled={selected.length < 2} onClick={organizeQuestionsBySubject}>Organize by subject</Button>
{bulkSelectedIds.size > 0 && <><Select onValueChange={moveBulkQuestions}><SelectTrigger className=\"h-9 w-[190px] border-[var(--line)] text-xs\"><SelectValue placeholder={`Move ${bulkSelectedIds.size} to section…`} /></SelectTrigger><SelectContent>{sections.map((section) => <SelectItem key={section.client_id} value={section.client_id}>{section.title}</SelectItem>)}</SelectContent></Select><Button type=\"button\" variant=\"ghost\" size=\"sm\" onClick={() => setBulkSelectedIds(new Set())}>Clear selection</Button></>}
<span className=\"ml-auto text-xs text-[var(--muted-foreground)]\">{bulkSelectedIds.size ? `${bulkSelectedIds.size} selected` : 'Tick questions to move them in bulk'}</span>
</div>
<div className=\"mt-3 max-h-[590px] space-y-2 overflow-y-auto pr-1\">
{selected.map((item, index) => ("""
text = must_replace(text, list_marker, toolbar, 'bulk toolbar')

row_marker = '<div className="flex items-start gap-2">\n<div className="flex shrink-0 flex-col gap-1">'
row_replacement = '<div className="flex items-start gap-2">\n<input type="checkbox" aria-label={`Select question ${index + 1}`} checked={bulkSelectedIds.has(item.question_id)} onChange={() => toggleBulkQuestion(item.question_id)} className="mt-2 h-4 w-4 shrink-0 accent-[var(--teal)]" />\n<div className="flex shrink-0 flex-col gap-1">'
text = must_replace(text, row_marker, row_replacement, 'question bulk checkbox')

# Removing an item should also remove it from bulk selection.
remove_old = "function removeQuestion(questionId: string) {\nsetSelected((current) => current.filter((item) => item.question_id !== questionId).map((item, index) => ({ ...item, display_order: index })));\n}"
remove_new = "function removeQuestion(questionId: string) {\nsetSelected((current) => current.filter((item) => item.question_id !== questionId).map((item, index) => ({ ...item, display_order: index })));\nsetBulkSelectedIds((current) => { const next = new Set(current); next.delete(questionId); return next; });\n}"
text = must_replace(text, remove_old, remove_new, 'bulk selection cleanup')
path.write_text(text)

print('Applied paper audience + section UX fixes.')
