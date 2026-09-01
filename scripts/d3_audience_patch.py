from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

assignment_path = Path('src/components/evidara/paper-assignment-center.tsx')
assignment = assignment_path.read_text()
assignment = replace_once(
    assignment,
    "export function PaperAssignmentCenter() {",
    "export function PaperAssignmentCenter({ paperId: fixedPaperId, embedded = false }: { paperId?: string; embedded?: boolean } = {}) {",
    'assignment props',
)
assignment = replace_once(
    assignment,
    "  const [paperId, setPaperId] = useState('');",
    "  const [paperId, setPaperId] = useState(fixedPaperId || '');",
    'fixed paper initial state',
)
assignment = replace_once(
    assignment,
    "      setPaperId((current) => current || loadedPapers[0]?.id || '');",
    "      setPaperId((current) => fixedPaperId || current || loadedPapers[0]?.id || '');",
    'fixed paper load state',
)
assignment = replace_once(
    assignment,
    "  }, [configured, organizationId]);\n\n  useEffect(() => { void load(); }, [load]);",
    "  }, [configured, fixedPaperId, organizationId]);\n\n  useEffect(() => { if (fixedPaperId) setPaperId(fixedPaperId); }, [fixedPaperId]);\n  useEffect(() => { void load(); }, [load]);",
    'fixed paper synchronization',
)
assignment = replace_once(
    assignment,
    "          <h2 className=\"mt-1 text-xl font-bold text-[var(--foreground)]\">Assign a test to the right students</h2>\n          <p className=\"mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]\">Choose an institutional paper, define the audience, preview the exact eligible count, then materialize the cohort. {organizationName}</p>",
    "          <h2 className=\"mt-1 text-xl font-bold text-[var(--foreground)]\">{embedded ? 'Choose the audience for this paper' : 'Assign a test to the right students'}</h2>\n          <p className=\"mt-1 max-w-3xl text-sm leading-6 text-[var(--muted-foreground)]\">{embedded ? 'Define the audience, preview the exact eligible count, then materialize the cohort before publishing.' : 'Choose an institutional paper, define the audience, preview the exact eligible count, then materialize the cohort.'} {organizationName}</p>",
    'embedded assignment heading',
)
assignment = replace_once(
    assignment,
    "          <div>\n            <Label htmlFor=\"assignment-paper\">Paper / Test</Label>\n            <select id=\"assignment-paper\" className=\"mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm\" value={paperId} onChange={(event) => setPaperId(event.target.value)}>\n              {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title} · {paper.status.replaceAll('_', ' ')}</option>)}\n            </select>\n          </div>",
    "          {!fixedPaperId && <div>\n            <Label htmlFor=\"assignment-paper\">Paper / Test</Label>\n            <select id=\"assignment-paper\" className=\"mt-1 min-h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm\" value={paperId} onChange={(event) => setPaperId(event.target.value)}>\n              {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title} · {paper.status.replaceAll('_', ' ')}</option>)}\n            </select>\n          </div>}",
    'fixed paper selector hiding',
)
assignment_path.write_text(assignment)

paper_path = Path('src/components/evidara/live-paper-catalogue-v8.tsx')
paper = paper_path.read_text()
paper = replace_once(
    paper,
    "import { PaperFileImportDialog } from '@/components/evidara/paper-file-import-dialog';",
    "import { PaperFileImportDialog } from '@/components/evidara/paper-file-import-dialog';\nimport { PaperAssignmentCenter } from '@/components/evidara/paper-assignment-center';",
    'assignment import',
)
paper = replace_once(
    paper,
    "{ step: 1 as const, label: 'Basics' },\n{ step: 2 as const, label: 'Questions' },\n{ step: 3 as const, label: 'Settings' },\n{ step: 4 as const, label: 'Preview' },\n{ step: 5 as const, label: 'Publish' },",
    "{ step: 1 as const, label: 'Details' },\n{ step: 2 as const, label: 'Questions' },\n{ step: 3 as const, label: 'Audience' },\n{ step: 4 as const, label: 'Settings' },\n{ step: 5 as const, label: 'Preview & Publish' },",
    'five-step labels',
)
old_settings_start = "{builderStep === 3 && (\n<Card className=\"gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl\">\n<CardContent className=\"space-y-5 p-4 sm:p-5\">\n<SectionHeading number=\"3\" title=\"Delivery and student experience\" description=\"Set time, attempts and result visibility. Institution assignment and publishing rules control access outside this builder.\" />"
audience_then_settings = "{builderStep === 3 && (\n<div className=\"space-y-4\">\n<SectionHeading number=\"3\" title=\"Audience\" description=\"Choose the students who can take this institutional test and preview the exact eligible cohort before publishing.\" />\n{kind === 'school' ? (builder.id ? <PaperAssignmentCenter paperId={builder.id} embedded /> : <Card className=\"gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl\"><CardContent className=\"space-y-3 p-5\"><p className=\"text-sm font-semibold text-[var(--foreground)]\">Save this paper draft before choosing its audience.</p><p className=\"text-sm text-[var(--muted-foreground)]\">Audience eligibility is server-validated against the saved paper, active student memberships and the institution licence.</p><Button type=\"button\" variant=\"outline\" disabled={saving} onClick={() => void savePaper('draft')} className=\"border-[var(--teal)]/30 text-[var(--teal)]\">{saving ? <LoaderCircle className=\"mr-2 h-4 w-4 animate-spin\" /> : <Save className=\"mr-2 h-4 w-4\" />}Save draft to configure audience</Button></CardContent></Card>) : <Card className=\"gap-0 border border-[var(--line)] bg-white shadow-sm rounded-xl\"><CardContent className=\"p-5 text-sm text-[var(--muted-foreground)]\">Platform papers do not use an institution student audience. Continue to Settings.</CardContent></Card>}\n</div>\n)}\n{builderStep === 4 && (\n<Card className=\"gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl\">\n<CardContent className=\"space-y-5 p-4 sm:p-5\">\n<SectionHeading number=\"4\" title=\"Delivery and student experience\" description=\"Set time, attempts, schedule, shuffle and result visibility for the assigned test.\" />"
paper = replace_once(paper, old_settings_start, audience_then_settings, 'audience insertion and settings move')
old_preview_start = "{builderStep === 4 && (\n<Card className=\"gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl\">\n<CardContent className=\"space-y-5 p-4 sm:p-5\">\n<SectionHeading number=\"4\" title=\"Preview\" description=\"Review the learner-facing paper before moving to the final publish step.\" />"
new_preview_start = "{builderStep === 5 && (\n<Card className=\"gap-0 border-[var(--line)] bg-white shadow-sm rounded-xl\">\n<CardContent className=\"space-y-5 p-4 sm:p-5\">\n<SectionHeading number=\"5\" title=\"Preview & Publish\" description=\"Review the learner-facing paper and final summary before publishing or submitting for approval.\" />"
paper = replace_once(paper, old_preview_start, new_preview_start, 'preview merge into final step')
paper_path.write_text(paper)

smoke_path = Path('scripts/d3-paper-builder-wizard-smoke.mjs')
smoke_path.write_text(r'''import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const assignment = fs.readFileSync('src/components/evidara/paper-assignment-center.tsx', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('builder has explicit five-step state', () => {
  assert.ok(source.includes('const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4 | 5>(1);'));
});
check('wizard exposes Phase 1 labels in required order', () => {
  const navStart = source.indexOf("{ step: 1 as const, label: 'Details' }");
  const navEnd = source.indexOf(']).map((item)', navStart);
  assert.ok(navStart >= 0 && navEnd > navStart);
  const nav = source.slice(navStart, navEnd);
  const labels = ["label: 'Details'", "label: 'Questions'", "label: 'Audience'", "label: 'Settings'", "label: 'Preview & Publish'"];
  const positions = labels.map((label) => nav.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
check('new and edit flows start at Details', () => {
  assert.ok(source.includes('function resetBuilder() {\nsetBuilderStep(1);'));
  assert.ok(source.includes('async function openEdit(paper: PaperListRow) {\nif (!supabase) return;\nsetBuilderStep(1);'));
});
check('Questions remains the dedicated selection step', () => {
  assert.ok(source.includes('{builderStep === 2 && ('));
  assert.ok(source.includes('title="Sections and selection strategy"'));
  assert.ok(source.includes('title="Matching question bank"'));
  assert.ok(source.includes('title="Paper questions"'));
});
check('Audience is an explicit third step using the hardened assignment engine', () => {
  assert.ok(source.includes('{builderStep === 3 && ('));
  assert.ok(source.includes('title="Audience"'));
  assert.ok(source.includes('<PaperAssignmentCenter paperId={builder.id} embedded />'));
  assert.ok(source.includes('Save draft to configure audience'));
  assert.ok(assignment.includes('preview_paper_assignment_v19'));
  assert.ok(assignment.includes('assign_paper_audience_v19'));
});
check('embedded audience is locked to the current paper', () => {
  assert.ok(assignment.includes('paperId: fixedPaperId'));
  assert.ok(assignment.includes('fixedPaperId || current'));
  assert.ok(assignment.includes('{!fixedPaperId && <div>'));
});
check('Settings is step four', () => {
  assert.ok(source.includes('{builderStep === 4 && ('));
  assert.ok(source.includes('<SectionHeading number="4" title="Delivery and student experience"'));
});
check('Preview and publish share the final step', () => {
  assert.ok(source.includes('{builderStep === 5 && ('));
  assert.ok(source.includes('title="Preview & Publish"'));
  assert.ok(source.includes('Open learner preview'));
  assert.ok(source.includes('title="Publish"'));
});
check('wizard provides Back and Next navigation', () => {
  assert.ok(source.includes('Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5'));
  assert.ok(source.includes('Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5'));
});
check('draft saving remains available throughout the guided flow', () => {
  assert.ok(source.includes("onClick={() => void savePaper('draft')}"));
  assert.ok(source.includes('Save Draft'));
});
check('final publish or submit action is gated to step 5', () => {
  assert.ok(source.includes('{builderStep === 5 && (<Button type="button" disabled={saving} onClick={() => void savePaper(submitStatus)}'));
});

console.log(`D3 paper builder wizard smoke: ${checks.length}/${checks.length} checks passed`);
''')

checklist_path = Path('PHASE1_RELEASE_CHECKLIST.md')
checklist = checklist_path.read_text()
checklist = replace_once(
    checklist,
    '- [ ] C11 Duplicate detection is server-authoritative across appropriate institution scope.',
    '- [x] **C11 Server-authoritative duplicate detection** — verified 1 Sep 2026. A canonical v2 SHA-256 fingerprint covers question type, text/LaTeX prompt, passage, images and option content while intentionally excluding mutable taxonomy/source/correct-answer metadata. All 2,840 live questions are backfilled, the scoped unique index has zero duplicate groups and prevents concurrent exact duplicates independently within each institution and the platform bank, and deferred question/option triggers recompute the fingerprint across every write path. Internal SECURITY DEFINER hash/trigger helpers are service-role-only. The permanent 14-point `c11-question-duplicate-prevention-smoke.mjs` is wired into every complete release gate; current hardening head passed the complete release gate after the C11 privilege hardening. Permanent production web deployment was not promoted.',
    'C11 checklist reconciliation',
)
checklist_path.write_text(checklist)
