from pathlib import Path

path = Path('src/components/evidara/live-paper-catalogue-v8.tsx')
text = path.read_text()

old = "type Selected = PaperQuestionInput & { question: QuestionRow };\ntype Builder = {"
new = """type Selected = PaperQuestionInput & { question: QuestionRow };
type PublishReadinessCheck = { code: string; label: string; ok: boolean; message: string };
type PublishReadiness = { paper_id: string; ready: boolean; checks: PublishReadinessCheck[] };
type Builder = {"""
assert old in text, 'type insertion anchor missing'
text = text.replace(old, new, 1)

old = "const [saving, setSaving] = useState(false);\nconst [cloningPaperId, setCloningPaperId] = useState('');"
new = """const [saving, setSaving] = useState(false);
const [readinessLoading, setReadinessLoading] = useState(false);
const [publishReadiness, setPublishReadiness] = useState<PublishReadiness | null>(null);
const [readinessFingerprint, setReadinessFingerprint] = useState('');
const [readinessPaperId, setReadinessPaperId] = useState('');
const [cloningPaperId, setCloningPaperId] = useState('');"""
assert old in text, 'state insertion anchor missing'
text = text.replace(old, new, 1)

old = "const selectedInActive = selected.filter((item) => item.section_client_id === active?.client_id).length;\nconst distributionTotal = active"
new = """const selectedInActive = selected.filter((item) => item.section_client_id === active?.client_id).length;
const publishFingerprint = useMemo(() => JSON.stringify({
  builder: { ...builder, id: undefined },
  sections: sections.map(({ id: _id, ...section }) => section),
  questions: selected.map(({ question: _question, ...item }) => item),
}), [builder, sections, selected]);
const releaseCheckCurrent = Boolean(publishReadiness?.ready && readinessFingerprint === publishFingerprint && readinessPaperId);
const distributionTotal = active"""
assert old in text, 'fingerprint anchor missing'
text = text.replace(old, new, 1)

old = "setAutosave('Autosave ready');\n}"
new = """setAutosave('Autosave ready');
setPublishReadiness(null);
setReadinessFingerprint('');
setReadinessPaperId('');
}"""
assert old in text, 'reset anchor missing'
text = text.replace(old, new, 1)

old = "async function savePaper(status: PaperStatus) {"
new = "async function savePaper(status: PaperStatus, paperIdOverride?: string) {"
assert old in text, 'save signature anchor missing'
text = text.replace(old, new, 1)

old = "const wasNew = !builder.id;\nconst key = draftKey;"
new = "const wasNew = !(paperIdOverride || builder.id);\nconst key = draftKey;"
assert old in text, 'wasNew anchor missing'
text = text.replace(old, new, 1)

old = "p_paper_id: builder.id,\np_organization_id: kind === 'admin' ? null : organizationId,"
new = "p_paper_id: paperIdOverride || builder.id,\np_organization_id: kind === 'admin' ? null : organizationId,"
assert old in text, 'rpc paper id anchor missing'
text = text.replace(old, new, 1)

old = "if (!saveError && kind === 'admin' && role === 'super_admin') {\n  const savedPaperId = String(data || builder.id || '');"
new = "if (!saveError && kind === 'admin' && role === 'super_admin') {\n  const savedPaperId = String(data || paperIdOverride || builder.id || '');"
assert old in text, 'pyq saved id anchor missing'
text = text.replace(old, new, 1)

old = "setMessage(status === 'draft' ? 'Draft saved.' : status === 'under_review' ? 'Paper submitted for approval.' : 'Paper published.');\nawait load();\n}\nasync function setStatus"
new = """setMessage(status === 'draft' ? 'Draft saved.' : status === 'under_review' ? 'Paper submitted for approval.' : 'Paper published.');
await load();
return String(data || paperIdOverride || builder.id || '');
}
async function runPublishPreflight() {
if (!supabase) return;
setReadinessLoading(true);
setError('');
setPublishReadiness(null);
const paperId = await savePaper('draft');
if (!paperId) {
setReadinessLoading(false);
return;
}
const { data, error: readinessError } = await supabase.rpc('get_paper_publish_readiness_v1', { p_paper_id: paperId });
setReadinessLoading(false);
if (readinessError) {
setError(`Release check failed: ${readinessError.message}`);
return;
}
const readiness = data as PublishReadiness;
setPublishReadiness(readiness);
setReadinessFingerprint(publishFingerprint);
setReadinessPaperId(paperId);
if (!readiness.ready) {
const failed = (readiness.checks || []).filter((item) => !item.ok).map((item) => item.label).join(', ');
setError(`Not ready to publish. Fix: ${failed || 'release checklist'}.`);
} else {
setMessage('Release check passed. Publish is unlocked for this exact paper state.');
}
}
async function publishCheckedPaper() {
if (!releaseCheckCurrent || !readinessPaperId) {
setError('Run the release check again before publishing this paper state.');
return;
}
await savePaper('published', readinessPaperId);
}
async function setStatus"""
assert old in text, 'preflight insertion anchor missing'
text = text.replace(old, new, 1)

old = "<SectionHeading number=\"5\" title=\"Publish\" description=\"Ready to publish or submit? Review the paper summary, then use the final action below.\" />\n<div className=\"grid gap-3 sm:grid-cols-2 lg:grid-cols-4\">"
new = """<SectionHeading number=\"5\" title=\"Release check\" description=\"Verify every server-authoritative publishing requirement before the final action is unlocked.\" />
<div className=\"grid gap-3 sm:grid-cols-2 lg:grid-cols-3\">
{(['Approved questions','Duration','Marks','Audience','Schedule','Result policy'] as const).map((label) => {
const check = publishReadiness?.checks?.find((item) => item.label === label);
const current = readinessFingerprint === publishFingerprint;
return <div key={label} className={`rounded-xl border p-4 ${check && current ? (check.ok ? 'border-[#237A57]/20 bg-[#237A57]/5' : 'border-[var(--destructive)]/20 bg-[var(--destructive)]/5') : 'border-[var(--line)] bg-[var(--canvas)]'}`}><div className=\"flex items-center gap-2\">{check && current ? (check.ok ? <CheckCircle2 className=\"h-4 w-4 text-[#237A57]\" /> : <XCircle className=\"h-4 w-4 text-[var(--destructive)]\" />) : <ShieldCheck className=\"h-4 w-4 text-[var(--muted-foreground)]\" />}<p className=\"text-sm font-semibold text-[var(--foreground)]\">{label}</p></div><p className=\"mt-2 text-xs leading-relaxed text-[var(--muted-foreground)]\">{check && current ? check.message : 'Run release check to verify this requirement against the saved paper.'}</p></div>;
})}
</div>
<div className=\"flex flex-wrap items-center gap-3\"><Button type=\"button\" variant=\"outline\" disabled={saving || readinessLoading} onClick={() => void runPublishPreflight()} className=\"h-10 border-[var(--teal)]/30 text-[var(--teal)]\">{readinessLoading ? <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" /> : <ShieldCheck className=\"mr-2 h-4 w-4\" />}Run release check</Button><span className={`text-xs font-medium ${releaseCheckCurrent ? 'text-[#237A57]' : 'text-[var(--muted-foreground)]'}`}>{releaseCheckCurrent ? 'All six checks passed for the current paper state.' : publishReadiness && readinessFingerprint !== publishFingerprint ? 'Paper changed after the last check. Run it again.' : 'Publish stays locked until all six checks pass.'}</span></div>
<SectionHeading number=\"5\" title=\"Publish\" description=\"Ready to publish or submit? Review the paper summary, then use the final action below.\" />
<div className=\"grid gap-3 sm:grid-cols-2 lg:grid-cols-4\">"""
assert old in text, 'step 5 card anchor missing'
text = text.replace(old, new, 1)

old = "{builderStep === 5 && (<Button type=\"button\" disabled={saving} onClick={() => void savePaper(submitStatus)} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\">{submitStatus === 'published' ? <Check className=\"mr-2 h-4 w-4\" /> : <Send className=\"mr-2 h-4 w-4\" />}{submitStatus === 'published' ? 'Save and Publish' : 'Submit for Approval'}</Button>)}"
new = """{builderStep === 5 && submitStatus === 'published' && (<Button type=\"button\" disabled={saving || readinessLoading || !releaseCheckCurrent} onClick={() => void publishCheckedPaper()} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\"><Check className=\"mr-2 h-4 w-4\" />Save and Publish</Button>)}
{builderStep === 5 && submitStatus !== 'published' && (<Button type=\"button\" disabled={saving} onClick={() => void savePaper(submitStatus)} className=\"h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]\"><Send className=\"mr-2 h-4 w-4\" />Submit for Approval</Button>)}"""
assert old in text, 'final action anchor missing'
text = text.replace(old, new, 1)

path.write_text(text)

smoke = Path('scripts/d6-paper-publish-readiness-smoke.mjs')
s = smoke.read_text()
old = "const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');\nconst checks = [];"
new = "const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');\nconst builderUi = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');\nconst checks = [];"
assert old in s, 'smoke setup anchor missing'
s = s.replace(old, new, 1)
old = "check('D6 publish-readiness regression is permanent in release gate', () => {"
new = """check('Preview & Publish renders the six server-authoritative readiness dimensions', () => {
  assert.ok(builderUi.includes("supabase.rpc('get_paper_publish_readiness_v1'"));
  for (const label of ['Approved questions','Duration','Marks','Audience','Schedule','Result policy']) assert.ok(builderUi.includes(label));
  assert.ok(builderUi.includes('Run release check'));
});
check('publish remains locked until the current paper fingerprint has a passing release check', () => {
  assert.ok(builderUi.includes('releaseCheckCurrent'));
  assert.ok(builderUi.includes('readinessFingerprint === publishFingerprint'));
  assert.ok(builderUi.includes('disabled={saving || readinessLoading || !releaseCheckCurrent}'));
  assert.ok(builderUi.includes('publishCheckedPaper'));
});
check('D6 publish-readiness regression is permanent in release gate', () => {"""
assert old in s, 'smoke insertion anchor missing'
s = s.replace(old, new, 1)
smoke.write_text(s)
