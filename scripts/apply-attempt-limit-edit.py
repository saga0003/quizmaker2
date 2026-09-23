from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly 1 match, found {count}")
    return text.replace(old, new, 1)


paper_path = Path('src/components/evidara/live-paper-catalogue-v8.tsx')
text = paper_path.read_text()

text = replace_once(
    text,
    "const [paperAttempts, setPaperAttempts] = useState<PaperAttemptSummary[]>([]);\nconst [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);",
    "const [paperAttempts, setPaperAttempts] = useState<PaperAttemptSummary[]>([]);\nconst [editingPaperHasAttempts, setEditingPaperHasAttempts] = useState(false);\nconst [originalAttemptLimit, setOriginalAttemptLimit] = useState(1);\nconst [integrityEvents, setIntegrityEvents] = useState<IntegrityEvent[]>([]);",
    'state insertion',
)

text = replace_once(
    text,
    "setSelected([]);\nsetQuestionSearch('');",
    "setSelected([]);\nsetEditingPaperHasAttempts(false);\nsetOriginalAttemptLimit(1);\nsetQuestionSearch('');",
    'reset attempt edit state',
)

text = replace_once(
    text,
    "const [p, s, i] = await Promise.all([\nsupabase.from('question_papers').select('*').eq('id', paper.id).single(),\nsupabase.from('paper_sections').select('*').eq('paper_id', paper.id).order('display_order'),\nsupabase.from('paper_questions').select('question_id,section_id,display_order,marks,negative_marks,is_mandatory').eq('paper_id', paper.id).order('display_order'),\n]);\nif (p.error || s.error || i.error || !p.data) {\nsetError(p.error?.message || s.error?.message || i.error?.message || 'Unable to open paper.');",
    "const [p, s, i, a] = await Promise.all([\nsupabase.from('question_papers').select('*').eq('id', paper.id).single(),\nsupabase.from('paper_sections').select('*').eq('paper_id', paper.id).order('display_order'),\nsupabase.from('paper_questions').select('question_id,section_id,display_order,marks,negative_marks,is_mandatory').eq('paper_id', paper.id).order('display_order'),\nsupabase.from('exam_attempts').select('id').eq('paper_id', paper.id).limit(1),\n]);\nif (p.error || s.error || i.error || a.error || !p.data) {\nsetError(p.error?.message || s.error?.message || i.error?.message || a.error?.message || 'Unable to open paper.');",
    'load attempt existence',
)

text = replace_once(
    text,
    "const row = p.data as Record<string, any>;\nconst loadedSections =",
    "const row = p.data as Record<string, any>;\nconst hasAttempts = Boolean((a.data || []).length);\nsetEditingPaperHasAttempts(hasAttempts);\nsetOriginalAttemptLimit(Number(row.attempt_limit || 1));\nif (hasAttempts) setBuilderStep(4);\nconst loadedSections =",
    'hydrate attempt edit state',
)

save_attempt_limit = """async function saveAttemptLimit() {
if (!supabase || !builder.id) return;
const nextLimit = Math.floor(Number(builder.attempts));
if (!Number.isFinite(nextLimit) || nextLimit < 1) {
setError('Attempts allowed must be at least 1.');
return;
}
setSaving(true);
setError('');
const { data, error: updateError } = await supabase.rpc('update_question_paper_attempt_limit_v1', {
p_paper_id: builder.id,
p_attempt_limit: nextLimit,
});
setSaving(false);
if (updateError) {
setError(updateError.message);
return;
}
const savedLimit = Number(data || nextLimit);
setOriginalAttemptLimit(savedLimit);
setBuilder((current) => ({ ...current, attempts: savedLimit }));
setMessage(`Attempts allowed updated to ${savedLimit}. Existing student attempts, scores and analytics were not changed.`);
setBuilderOpen(false);
await load();
}

"""
text = replace_once(text, "async function savePaper(status: PaperStatus, paperIdOverride?: string) {", save_attempt_limit + "async function savePaper(status: PaperStatus, paperIdOverride?: string) {", 'add dedicated attempt-limit save')

text = replace_once(
    text,
    "{error && <div className=\"mb-4 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]\">{error}</div>}\n<div className=\"mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4\">",
    "{error && <div className=\"mb-4 rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]\">{error}</div>}\n{editingPaperHasAttempts && <div className=\"mb-4 rounded-xl border border-[var(--amber)]/30 bg-[var(--amber)]/10 px-4 py-3 text-sm leading-6 text-[#6F5600]\"><strong>Student attempts already exist.</strong> Questions, marks, duration, result history and analytics stay locked. You can safely change only <strong>Attempts allowed</strong>. Existing attempts are preserved, so a student who has used one attempt will show 1/{builder.attempts} after you update the limit.</div>}\n<div className=\"mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4\">",
    'attempt edit info banner',
)

text = replace_once(
    text,
    "<button key={item.step} type=\"button\" onClick={() => setBuilderStep(item.step)} className={`rounded-lg px-3 py-2 text-left transition ${builderStep === item.step ? 'bg-[var(--teal)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--canvas)]'}`}>",
    "<button key={item.step} type=\"button\" disabled={editingPaperHasAttempts && item.step !== 4} onClick={() => setBuilderStep(item.step)} className={`rounded-lg px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-40 ${builderStep === item.step ? 'bg-[var(--teal)] text-white' : 'text-[var(--muted-foreground)] hover:bg-[var(--canvas)]'}`}>",
    'lock non-settings steps after attempts',
)

text = replace_once(
    text,
    "<div className=\"space-y-2\"><Label>Duration (minutes)</Label><Input type=\"number\" min={1} value={builder.duration} onChange={(event) => setBuilder((current) => ({ ...current, duration: Number(event.target.value) }))} className=\"h-11 border-[var(--line)]\" /></div>",
    "<div className=\"space-y-2\"><Label>Duration (minutes)</Label><Input type=\"number\" min={1} disabled={editingPaperHasAttempts} value={builder.duration} onChange={(event) => setBuilder((current) => ({ ...current, duration: Number(event.target.value) }))} className=\"h-11 border-[var(--line)]\" /></div>",
    'lock duration',
)

text = replace_once(
    text,
    "<div className=\"space-y-2\"><Label>Attempts allowed</Label><Input type=\"number\" min={1} value={builder.attempts} onChange={(event) => setBuilder((current) => ({ ...current, attempts: Number(event.target.value) }))} className=\"h-11 border-[var(--line)]\" /></div>",
    "<div className=\"space-y-2\"><Label>Attempts allowed</Label><Input type=\"number\" min={1} value={builder.attempts} onChange={(event) => setBuilder((current) => ({ ...current, attempts: Number(event.target.value) }))} className=\"h-11 border-[var(--line)]\" />{editingPaperHasAttempts && <p className=\"text-xs leading-5 text-[var(--muted-foreground)]\">This changes only the allowed-attempt count. Existing attempts and analytics remain unchanged.</p>}</div>",
    'attempt limit helper',
)

text = replace_once(
    text,
    "<div className=\"space-y-2\"><Label>Result display</Label><Select value={builder.resultMode} onValueChange={(resultMode) => setBuilder((current) => ({ ...current, resultMode: resultMode as ResultMode }))}>",
    "<div className=\"space-y-2\"><Label>Result display</Label><Select disabled={editingPaperHasAttempts} value={builder.resultMode} onValueChange={(resultMode) => setBuilder((current) => ({ ...current, resultMode: resultMode as ResultMode }))}>",
    'lock result display',
)

text = replace_once(
    text,
    "<div className=\"flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3\"><div><Label>Open forever</Label><p className=\"mt-1 text-xs text-[var(--muted-foreground)]\">No opening or closing date</p></div><Switch checked={builder.openForever} onCheckedChange={(openForever) => setBuilder((current) => ({ ...current, openForever }))} /></div>",
    "<div className=\"flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3\"><div><Label>Open forever</Label><p className=\"mt-1 text-xs text-[var(--muted-foreground)]\">No opening or closing date</p></div><Switch disabled={editingPaperHasAttempts} checked={builder.openForever} onCheckedChange={(openForever) => setBuilder((current) => ({ ...current, openForever }))} /></div>",
    'lock open forever',
)

text = replace_once(
    text,
    "{!builder.openForever && <><div className=\"space-y-2\"><Label>Opens at</Label><Input type=\"datetime-local\" value={builder.from} onChange={(event) => setBuilder((current) => ({ ...current, from: event.target.value }))} className=\"h-11 border-[var(--line)]\" /></div><div className=\"space-y-2\"><Label>Closes at</Label><Input type=\"datetime-local\" value={builder.until} onChange={(event) => setBuilder((current) => ({ ...current, until: event.target.value }))} className=\"h-11 border-[var(--line)]\" /></div></>}",
    "{!builder.openForever && <><div className=\"space-y-2\"><Label>Opens at</Label><Input type=\"datetime-local\" disabled={editingPaperHasAttempts} value={builder.from} onChange={(event) => setBuilder((current) => ({ ...current, from: event.target.value }))} className=\"h-11 border-[var(--line)]\" /></div><div className=\"space-y-2\"><Label>Closes at</Label><Input type=\"datetime-local\" disabled={editingPaperHasAttempts} value={builder.until} onChange={(event) => setBuilder((current) => ({ ...current, until: event.target.value }))} className=\"h-11 border-[var(--line)]\" /></div></>}",
    'lock schedule',
)

text = replace_once(
    text,
    "<div className=\"flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3\"><div><Label>Shuffle questions</Label><p className=\"mt-1 text-xs text-[var(--muted-foreground)]\">Change order per attempt</p></div><Switch checked={builder.shuffleQuestions} onCheckedChange={(shuffleQuestions) => setBuilder((current) => ({ ...current, shuffleQuestions }))} /></div>",
    "<div className=\"flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3\"><div><Label>Shuffle questions</Label><p className=\"mt-1 text-xs text-[var(--muted-foreground)]\">Change order per attempt</p></div><Switch disabled={editingPaperHasAttempts} checked={builder.shuffleQuestions} onCheckedChange={(shuffleQuestions) => setBuilder((current) => ({ ...current, shuffleQuestions }))} /></div>",
    'lock question shuffle',
)

text = replace_once(
    text,
    "<div className=\"flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3\"><div><Label>Shuffle options</Label><p className=\"mt-1 text-xs text-[var(--muted-foreground)]\">Randomise MCQ choices</p></div><Switch checked={builder.shuffleOptions} onCheckedChange={(shuffleOptions) => setBuilder((current) => ({ ...current, shuffleOptions }))} /></div>",
    "<div className=\"flex min-h-20 items-center justify-between rounded-xl border border-[var(--line)] px-4 py-3\"><div><Label>Shuffle options</Label><p className=\"mt-1 text-xs text-[var(--muted-foreground)]\">Randomise MCQ choices</p></div><Switch disabled={editingPaperHasAttempts} checked={builder.shuffleOptions} onCheckedChange={(shuffleOptions) => setBuilder((current) => ({ ...current, shuffleOptions }))} /></div>",
    'lock option shuffle',
)

text = replace_once(
    text,
    "{builderStep > 1 && <Button type=\"button\" variant=\"outline\" disabled={saving} onClick={() => setBuilderStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5)} className=\"h-11 border-[var(--line)]\">Back</Button>}",
    "{!editingPaperHasAttempts && builderStep > 1 && <Button type=\"button\" variant=\"outline\" disabled={saving} onClick={() => setBuilderStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5)} className=\"h-11 border-[var(--line)]\">Back</Button>}",
    'hide back in attempt-only edit',
)

text = replace_once(
    text,
    "<Button type=\"button\" variant=\"outline\" disabled={saving} onClick={() => void savePaper('draft')} className=\"h-11 border-[var(--teal)]/30 text-[var(--teal)]\">{saving ? <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" /> : <Save className=\"mr-2 h-4 w-4\" />}Save Draft</Button>",
    "{!editingPaperHasAttempts && <Button type=\"button\" variant=\"outline\" disabled={saving} onClick={() => void savePaper('draft')} className=\"h-11 border-[var(--teal)]/30 text-[var(--teal)]\">{saving ? <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" /> : <Save className=\"mr-2 h-4 w-4\" />}Save Draft</Button>}\n{editingPaperHasAttempts && <Button type=\"button\" disabled={saving || builder.attempts === originalAttemptLimit || builder.attempts < 1} onClick={() => void saveAttemptLimit()} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\">{saving ? <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" /> : <Save className=\"mr-2 h-4 w-4\" />}Update Attempts</Button>}",
    'attempt-only footer action',
)

text = replace_once(
    text,
    "{builderStep < 5 && <Button type=\"button\" disabled={saving} onClick={() => setBuilderStep((current) => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5)} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\">Next</Button>}",
    "{!editingPaperHasAttempts && builderStep < 5 && <Button type=\"button\" disabled={saving} onClick={() => setBuilderStep((current) => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5)} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\">Next</Button>}",
    'hide next in attempt-only edit',
)

text = replace_once(
    text,
    "{builderStep === 5 && submitStatus === 'published' && (<Button type=\"button\" disabled={saving || readinessLoading || !releaseCheckCurrent} onClick={() => void publishCheckedPaper()} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\"><Check className=\"mr-2 h-4 w-4\" />Save and Publish</Button>)}",
    "{!editingPaperHasAttempts && builderStep === 5 && submitStatus === 'published' && (<Button type=\"button\" disabled={saving || readinessLoading || !releaseCheckCurrent} onClick={() => void publishCheckedPaper()} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\"><Check className=\"mr-2 h-4 w-4\" />Save and Publish</Button>)}",
    'hide publish in attempt-only edit',
)

text = replace_once(
    text,
    "{builderStep === 5 && submitStatus !== 'published' && (<Button type=\"button\" disabled={saving} onClick={() => void savePaper(submitStatus)} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\"><Send className=\"mr-2 h-4 w-4\" />Submit for Approval</Button>)}",
    "{!editingPaperHasAttempts && builderStep === 5 && submitStatus !== 'published' && (<Button type=\"button\" disabled={saving} onClick={() => void savePaper(submitStatus)} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\"><Send className=\"mr-2 h-4 w-4\" />Submit for Approval</Button>)}",
    'hide approval in attempt-only edit',
)

paper_path.write_text(text)

student_path = Path('src/components/evidara/live-student-tests.tsx')
student = student_path.read_text()
student = replace_once(
    student,
    '<span className="text-xs text-[var(--muted-foreground)]">Attempts {paper.attempts_used}/{paper.attempt_limit}</span>',
    '<span className="text-xs text-[var(--muted-foreground)]">Attempts used {paper.attempts_used}/{paper.attempt_limit}</span>',
    'student attempts narrative',
)
student_path.write_text(student)

print('Applied attempt-limit-only editing patch.')
