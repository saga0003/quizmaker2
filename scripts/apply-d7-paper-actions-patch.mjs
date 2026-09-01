import fs from 'node:fs';

const target = 'src/components/evidara/live-paper-catalogue-v8.tsx';
let src = fs.readFileSync(target, 'utf8');
const replaceOnce = (from, to, label) => {
  if (!src.includes(from)) throw new Error(`Missing D7 anchor: ${label}`);
  src = src.replace(from, to);
};

replaceOnce(
"type PublishReadiness = { paper_id: string; ready: boolean; checks: PublishReadinessCheck[] };\ntype Builder = {",
"type PublishReadiness = { paper_id: string; ready: boolean; checks: PublishReadinessCheck[] };\ntype PaperAttemptSummary = { id: string; student_id: string; attempt_number: number; status: string; score: number | null; maximum_marks: number | null; percentage: number | null; correct_count: number; incorrect_count: number; unanswered_count: number; started_at: string | null; submitted_at: string | null; created_at: string };\ntype PaperActionMode = 'results' | 'analytics' | null;\ntype Builder = {",
'paper action types');

replaceOnce(
"const [cloningPaperId, setCloningPaperId] = useState('');\nconst [error, setError] = useState('');",
"const [cloningPaperId, setCloningPaperId] = useState('');\nconst [actionPaper, setActionPaper] = useState<PaperListRow | null>(null);\nconst [actionMode, setActionMode] = useState<PaperActionMode>(null);\nconst [paperAttempts, setPaperAttempts] = useState<PaperAttemptSummary[]>([]);\nconst [actionLoading, setActionLoading] = useState(false);\nconst [error, setError] = useState('');",
'action state');

replaceOnce(
"setSelected(loadedItems);\nsetSaving(false);\n}\nuseEffect(() => {",
"setSelected(loadedItems);\nsetSaving(false);\nreturn true;\n}\nuseEffect(() => {",
'openEdit success return');
replaceOnce("if (!supabase) return;\nsetBuilderStep(1);", "if (!supabase) return false;\nsetBuilderStep(1);", 'openEdit no supabase');
replaceOnce("setSaving(false);\nreturn;\n}\nconst row = p.data", "setSaving(false);\nreturn false;\n}\nconst row = p.data", 'openEdit error return');

replaceOnce(
"async function confirmDelete() {",
`async function openPaperPreview(paper: PaperListRow) {
const opened = await openEdit(paper);
if (!opened) return;
setBuilderStep(5);
setBuilderOpen(false);
setPreviewOpen(true);
}
async function fetchPaperAttempts(paper: PaperListRow) {
if (!supabase) return { rows: [] as PaperAttemptSummary[], error: 'Supabase is not configured.' };
const { data, error: attemptsError } = await supabase
.from('exam_attempts')
.select('id,student_id,attempt_number,status,score,maximum_marks,percentage,correct_count,incorrect_count,unanswered_count,started_at,submitted_at,created_at')
.eq('paper_id', paper.id)
.order('created_at', { ascending: false })
.limit(500);
if (attemptsError) return { rows: [] as PaperAttemptSummary[], error: attemptsError.message };
return { rows: (data || []) as PaperAttemptSummary[], error: '' };
}
async function openPaperAction(paper: PaperListRow, mode: Exclude<PaperActionMode, null>) {
setActionPaper(paper);
setActionMode(mode);
setActionLoading(true);
setError('');
const result = await fetchPaperAttempts(paper);
setActionLoading(false);
if (result.error) {
setActionMode(null);
setActionPaper(null);
setError(result.error);
return;
}
setPaperAttempts(result.rows);
}
async function exportPaperResults(paper: PaperListRow) {
setActionLoading(true);
setError('');
const result = await fetchPaperAttempts(paper);
setActionLoading(false);
if (result.error) {
setError(result.error);
return;
}
const escapeCsv = (value: unknown) => \`"\${String(value ?? '').replaceAll('"', '""')}"\`;
const header = ['attempt_id','student_id','attempt_number','status','score','maximum_marks','percentage','correct','incorrect','unanswered','started_at','submitted_at'];
const rows = result.rows.map((attempt) => [attempt.id, attempt.student_id, attempt.attempt_number, attempt.status, attempt.score, attempt.maximum_marks, attempt.percentage, attempt.correct_count, attempt.incorrect_count, attempt.unanswered_count, attempt.started_at, attempt.submitted_at]);
const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\\n');
const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
const url = URL.createObjectURL(blob);
const anchor = document.createElement('a');
anchor.href = url;
anchor.download = \`\${String(paper.code || paper.title || 'paper').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'paper'}-results.csv\`;
document.body.appendChild(anchor);
anchor.click();
anchor.remove();
URL.revokeObjectURL(url);
setMessage(\`Exported \${result.rows.length} attempt\${result.rows.length === 1 ? '' : 's'} for \${paper.title}.\`);
}
async function confirmDelete() {`,
'paper action handlers');

replaceOnce(
"const stats = [",
`const submittedAttempts = paperAttempts.filter((attempt) => Boolean(attempt.submitted_at) || attempt.status === 'submitted' || attempt.status === 'completed');
const scoredAttempts = submittedAttempts.filter((attempt) => attempt.percentage !== null && Number.isFinite(Number(attempt.percentage)));
const averagePercentage = scoredAttempts.length ? scoredAttempts.reduce((sum, attempt) => sum + Number(attempt.percentage || 0), 0) / scoredAttempts.length : 0;
const highestPercentage = scoredAttempts.length ? Math.max(...scoredAttempts.map((attempt) => Number(attempt.percentage || 0))) : 0;
const stats = [`,
'action analytics');

const oldButtons = `<Button variant="ghost" size="icon" title="Clone as new version" disabled={cloningPaperId === paper.id} onClick={() => void cloneAsNewVersion(paper)} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]">{cloningPaperId === paper.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}</Button>
<Button variant="ghost" size="icon" title="Edit paper" onClick={() => void openEdit(paper)} className="h-9 w-9 text-[var(--teal)] hover:bg-[var(--secondary)]"><Edit3 className="h-4 w-4" /></Button>`;
const newButtons = `<Button variant="ghost" size="icon" title="Edit paper" onClick={() => void openEdit(paper)} className="h-9 w-9 text-[var(--teal)] hover:bg-[var(--secondary)]"><Edit3 className="h-4 w-4" /></Button>
<Button variant="ghost" size="icon" title="Preview paper" onClick={() => void openPaperPreview(paper)} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]"><Eye className="h-4 w-4" /></Button>
<Button variant="ghost" size="icon" title="Duplicate paper" disabled={cloningPaperId === paper.id} onClick={() => void cloneAsNewVersion(paper)} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]">{cloningPaperId === paper.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CopyPlus className="h-4 w-4" />}</Button>
<Button variant="ghost" size="icon" title="Test Results" disabled={actionLoading} onClick={() => void openPaperAction(paper, 'results')} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]"><FileQuestion className="h-4 w-4" /></Button>
<Button variant="ghost" size="icon" title="Analytics" disabled={actionLoading} onClick={() => void openPaperAction(paper, 'analytics')} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]"><BookOpenCheck className="h-4 w-4" /></Button>
<Button variant="ghost" size="icon" title="Export" disabled={actionLoading} onClick={() => void exportPaperResults(paper)} className="h-9 w-9 text-[#44545C] hover:bg-[var(--line)]"><Save className="h-4 w-4" /></Button>`;
replaceOnce(oldButtons, newButtons, 'paper card actions');

replaceOnce(
"<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>",
`<Dialog open={Boolean(actionMode && actionPaper)} onOpenChange={(open) => { if (!open) { setActionMode(null); setActionPaper(null); setPaperAttempts([]); } }}>
<DialogContent className="max-h-[90vh] w-[96vw] max-w-4xl overflow-y-auto border-[var(--line)]">
<DialogHeader><DialogTitle>{actionMode === 'analytics' ? 'Paper Analytics' : 'Test Results'} · {actionPaper?.title}</DialogTitle><DialogDescription>{actionMode === 'analytics' ? 'Live attempt analytics from the selected paper.' : 'Latest student attempts for the selected paper.'}</DialogDescription></DialogHeader>
{actionLoading ? <div className="py-10 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading…</div> : actionMode === 'analytics' ? (
<div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
{[{ label: 'Attempts', value: paperAttempts.length }, { label: 'Submitted', value: submittedAttempts.length }, { label: 'Average', value: \`\${averagePercentage.toFixed(1)}%\` }, { label: 'Highest', value: \`\${highestPercentage.toFixed(1)}%\` }].map((item) => <div key={item.label} className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4"><p className="text-xs text-[var(--muted-foreground)]">{item.label}</p><p className="mt-1 text-xl font-bold text-[var(--foreground)]">{item.value}</p></div>)}
</div><p className="text-xs text-[var(--muted-foreground)]">Analytics are calculated from up to the latest 500 attempts visible to your role and institution scope.</p></div>
) : paperAttempts.length ? (
<div className="overflow-x-auto rounded-xl border border-[var(--line)]"><Table><TableHeader><TableRow><TableHead>Attempt</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead><TableHead>Percentage</TableHead><TableHead>Correct</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader><TableBody>{paperAttempts.map((attempt) => <TableRow key={attempt.id}><TableCell>#{attempt.attempt_number}</TableCell><TableCell>{statusLabel(String(attempt.status))}</TableCell><TableCell>{attempt.score ?? '—'} / {attempt.maximum_marks ?? '—'}</TableCell><TableCell>{attempt.percentage === null ? '—' : \`\${Number(attempt.percentage).toFixed(1)}%\`}</TableCell><TableCell>{attempt.correct_count ?? 0}</TableCell><TableCell>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('en-IN') : 'Not submitted'}</TableCell></TableRow>)}</TableBody></Table></div>
) : <div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-8 text-center text-sm text-[var(--muted-foreground)]">No attempts have been recorded for this paper yet.</div>}
</DialogContent>
</Dialog>
<Dialog open={previewOpen} onOpenChange={setPreviewOpen}>`,
'action dialog');

fs.writeFileSync(target, src);

const smoke = `import fs from 'node:fs';
const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const required = [
  'title="Edit paper"', 'title="Preview paper"', 'title="Duplicate paper"', 'title="Test Results"', 'title="Analytics"', 'title="Export"', 'title="Archive paper"',
  ".from('exam_attempts')", ".eq('paper_id', paper.id)", "openPaperAction(paper, 'results')", "openPaperAction(paper, 'analytics')", 'exportPaperResults(paper)', 'openPaperPreview(paper)',
  "replace(/[^a-z0-9_-]+/gi, '-')", "type: 'text/csv;charset=utf-8'", 'limit(500)'
];
const missing = required.filter((token) => !source.includes(token));
if (missing.length) { console.error('D7 paper-card actions regression failed:', missing); process.exit(1); }
const order = ['title="Edit paper"','title="Preview paper"','title="Duplicate paper"','title="Test Results"','title="Analytics"','title="Export"'];
let last = -1; for (const token of order) { const idx = source.indexOf(token); if (idx <= last) { console.error('D7 action order regression:', token); process.exit(1); } last = idx; }
console.log('D7 paper-card actions smoke passed (real preview/results/analytics/export plus edit/duplicate/archive).');
`;
fs.writeFileSync('scripts/d7-paper-card-actions-smoke.mjs', smoke);

const gatePath = '.github/workflows/phase1-release-gate.yml';
let gate = fs.readFileSync(gatePath, 'utf8');
const anchor = "      - name: D7 normalized paper-access checks\n        run: node scripts/d7-normalized-paper-access-smoke.mjs\n";
if (!gate.includes('node scripts/d7-paper-card-actions-smoke.mjs')) {
  if (!gate.includes(anchor)) throw new Error('Missing D7 gate anchor');
  gate = gate.replace(anchor, anchor + "      - name: D7 paper-card action checks\n        run: node scripts/d7-paper-card-actions-smoke.mjs\n");
  fs.writeFileSync(gatePath, gate);
}

console.log('Applied D7 paper-card action implementation and regression gate.');
