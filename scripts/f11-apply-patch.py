from pathlib import Path

p = Path('src/components/evidara/live-paper-catalogue-v8.tsx')
s = p.read_text()
old_type = "type PaperAttemptSummary = { id: string; student_id: string; attempt_number: number; status: string; score: number | null; maximum_marks: number | null; percentage: number | null; correct_count: number; incorrect_count: number; unanswered_count: number; started_at: string | null; submitted_at: string | null; created_at: string };"
new_type = "type PaperAttemptSummary = { id: string; student_id: string; student_name: string; rank: number | null; attempt_number: number; status: string; score: number | null; maximum_marks: number | null; percentage: number | null; accuracy: number | null; duration_seconds: number | null; correct_count: number; incorrect_count: number; unanswered_count: number; started_at: string | null; submitted_at: string | null; created_at: string };"
assert old_type in s
s = s.replace(old_type, new_type)

helper = """function formatAttemptDuration(seconds: number | null) {
if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return '—';
const roundedSeconds = Math.round(seconds);
const hours = Math.floor(roundedSeconds / 3600);
const minutes = Math.floor((roundedSeconds % 3600) / 60);
const remaining = roundedSeconds % 60;
if (hours) return `${hours}h ${minutes}m`;
if (minutes) return `${minutes}m ${remaining}s`;
return `${remaining}s`;
}
"""
assert "const sanitize = (value: string) => value\n" in s
s = s.replace("const sanitize = (value: string) => value\n", helper + "const sanitize = (value: string) => value\n", 1)

old_fetch = """async function fetchPaperAttempts(paper: PaperListRow) {
if (!supabase) return { rows: [] as PaperAttemptSummary[], error: 'Supabase is not configured.' };
const { data, error: attemptsError } = await supabase
.from('exam_attempts')
.select('id,student_id,attempt_number,status,score,maximum_marks,percentage,correct_count,incorrect_count,unanswered_count,started_at,submitted_at,created_at')
.eq('paper_id', paper.id)
.order('created_at', { ascending: false })
.limit(500);
if (attemptsError) return { rows: [] as PaperAttemptSummary[], error: attemptsError.message };
return { rows: (data || []) as PaperAttemptSummary[], error: '' };
}"""
new_fetch = """async function fetchPaperAttempts(paper: PaperListRow) {
if (!supabase) return { rows: [] as PaperAttemptSummary[], error: 'Supabase is not configured.' };
const { data, error: attemptsError } = await supabase
.from('exam_attempts')
.select('id,student_id,attempt_number,status,score,maximum_marks,percentage,correct_count,incorrect_count,unanswered_count,started_at,submitted_at,created_at')
.eq('paper_id', paper.id)
.order('created_at', { ascending: false })
.limit(500);
if (attemptsError) return { rows: [] as PaperAttemptSummary[], error: attemptsError.message };
const raw = data || [];
const studentIds = [...new Set(raw.map((attempt) => String(attempt.student_id || '')).filter(Boolean))];
const names = new Map<string, string>();
for (let start = 0; start < studentIds.length; start += 200) {
const { data: profileRows, error: profileError } = await supabase.from('profiles').select('id,full_name').in('id', studentIds.slice(start, start + 200));
if (profileError) return { rows: [] as PaperAttemptSummary[], error: profileError.message };
for (const profileRow of profileRows || []) names.set(String(profileRow.id), String(profileRow.full_name || 'Student'));
}
const hydrated = raw.map((attempt) => {
const correct = Number(attempt.correct_count || 0);
const incorrect = Number(attempt.incorrect_count || 0);
const answered = correct + incorrect;
const started = attempt.started_at ? new Date(attempt.started_at).getTime() : NaN;
const submitted = attempt.submitted_at ? new Date(attempt.submitted_at).getTime() : NaN;
return {
...attempt,
student_name: names.get(String(attempt.student_id)) || `Student …${String(attempt.student_id).slice(-6)}`,
rank: null,
accuracy: answered > 0 ? Number(((correct / answered) * 100).toFixed(1)) : null,
duration_seconds: Number.isFinite(started) && Number.isFinite(submitted) && submitted >= started ? Math.round((submitted - started) / 1000) : null,
} as PaperAttemptSummary;
});
const ranked = hydrated.filter((attempt) => attempt.status === 'submitted' && attempt.percentage != null)
.sort((a, b) => Number(b.percentage) - Number(a.percentage) || Number(b.score || 0) - Number(a.score || 0) || String(a.submitted_at || '').localeCompare(String(b.submitted_at || '')));
let previousPercentage: number | null = null;
let previousRank = 0;
ranked.forEach((attempt, index) => {
const percentage = Number(attempt.percentage);
const rank = previousPercentage !== null && percentage === previousPercentage ? previousRank : index + 1;
attempt.rank = rank;
previousPercentage = percentage;
previousRank = rank;
});
return { rows: hydrated, error: '' };
}"""
assert old_fetch in s
s = s.replace(old_fetch, new_fetch)

old_table = """<div className=\"overflow-x-auto rounded-xl border border-[var(--line)]\"><Table><TableHeader><TableRow><TableHead>Attempt</TableHead><TableHead>Status</TableHead><TableHead>Score</TableHead><TableHead>Percentage</TableHead><TableHead>Correct</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader><TableBody>{paperAttempts.map((attempt) => <TableRow key={attempt.id}><TableCell>#{attempt.attempt_number}</TableCell><TableCell>{statusLabel(String(attempt.status))}</TableCell><TableCell>{attempt.score ?? '—'} / {attempt.maximum_marks ?? '—'}</TableCell><TableCell>{attempt.percentage === null ? '—' : `${Number(attempt.percentage).toFixed(1)}%`}</TableCell><TableCell>{attempt.correct_count ?? 0}</TableCell><TableCell>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('en-IN') : 'Not submitted'}</TableCell></TableRow>)}</TableBody></Table></div>"""
new_table = """<div className=\"space-y-3\"><div className=\"rounded-xl border border-[var(--line)] bg-[var(--canvas)] px-4 py-3\"><p className=\"text-sm font-semibold text-[var(--foreground)]\">Traditional result sheet</p><p className=\"mt-1 text-xs text-[var(--muted-foreground)]\">Rank is based on submitted percentage for this paper. Equal percentages share the same rank. Accuracy uses Correct ÷ (Correct + Incorrect); time is the recorded start-to-submit duration.</p></div><div className=\"overflow-x-auto rounded-xl border border-[var(--line)]\"><Table><TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Student</TableHead><TableHead>Attempt</TableHead><TableHead>Score</TableHead><TableHead>Accuracy</TableHead><TableHead>Time</TableHead><TableHead>Submitted</TableHead></TableRow></TableHeader><TableBody>{paperAttempts.map((attempt) => <TableRow key={attempt.id}><TableCell className=\"font-semibold\">{attempt.rank ?? '—'}</TableCell><TableCell><span className=\"font-medium\">{attempt.student_name}</span></TableCell><TableCell>#{attempt.attempt_number}</TableCell><TableCell>{attempt.score ?? '—'} / {attempt.maximum_marks ?? '—'}{attempt.percentage === null ? '' : <span className=\"ml-1 text-xs text-[var(--muted-foreground)]\">({Number(attempt.percentage).toFixed(1)}%)</span>}</TableCell><TableCell>{attempt.accuracy == null ? '—' : `${attempt.accuracy.toFixed(1)}%`}</TableCell><TableCell>{formatAttemptDuration(attempt.duration_seconds)}</TableCell><TableCell>{attempt.submitted_at ? new Date(attempt.submitted_at).toLocaleString('en-IN') : 'Not submitted'}</TableCell></TableRow>)}</TableBody></Table></div></div>"""
assert old_table in s
s = s.replace(old_table, new_table)
p.write_text(s)

Path('scripts/f11-traditional-result-sheet-smoke.mjs').write_text(r"""import fs from 'node:fs';
import assert from 'node:assert/strict';
const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const checks = [
  ['traditional result sheet is explicitly labelled', source.includes('Traditional result sheet')],
  ['result sheet exposes Rank', source.includes('<TableHead>Rank</TableHead>')],
  ['result sheet exposes Student', source.includes('<TableHead>Student</TableHead>')],
  ['result sheet exposes Score', source.includes('<TableHead>Score</TableHead>')],
  ['result sheet exposes Accuracy', source.includes('<TableHead>Accuracy</TableHead>')],
  ['result sheet exposes Time', source.includes('<TableHead>Time</TableHead>')],
  ['student names are hydrated from authorized profiles', source.includes("from('profiles').select('id,full_name')")],
  ['profile hydration is bounded', source.includes('start += 200')],
  ['attempt list remains bounded', source.includes(".eq('paper_id', paper.id)") && source.includes('.limit(500)')],
  ['accuracy uses answered denominator', source.includes('correct + incorrect') && source.includes('(correct / answered) * 100')],
  ['missing accuracy remains unassessed', source.includes("attempt.accuracy == null ? '—'")],
  ['time uses authoritative attempt timestamps', source.includes('attempt.started_at') && source.includes('attempt.submitted_at') && source.includes('duration_seconds')],
  ['rank uses submitted attempts only', source.includes("attempt.status === 'submitted'")],
  ['rank orders by paper percentage', source.includes('Number(b.percentage) - Number(a.percentage)')],
  ['equal percentages share rank', source.includes('percentage === previousPercentage ? previousRank : index + 1')],
  ['rank definition is explained in UI', source.includes('Equal percentages share the same rank')],
  ['accuracy definition is explained in UI', source.includes('Accuracy uses Correct ÷ (Correct + Incorrect)')],
  ['time definition is explained in UI', source.includes('start-to-submit duration')],
];
for (const [name, ok] of checks) { assert.ok(ok, `F11 result sheet check failed: ${name}`); console.log(`PASS: ${name}`); }
console.log(`F11 traditional result sheet checks passed: ${checks.length}/${checks.length}`);
""")
