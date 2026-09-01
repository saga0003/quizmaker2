from pathlib import Path

api_path = Path('src/app/api/institution-analytics/route.ts')
api = api_path.read_text()
old = "averageSeconds: average(group.responses.map((row) => number(row.time_spent_seconds))),"
new = "averageSeconds: average(group.responses.map((row) => row.time_spent_seconds == null ? null : number(row.time_spent_seconds))),"
if old not in api:
    raise SystemExit('F7 average time anchor not found')
api = api.replace(old, new, 1)
api_path.write_text(api)

ui_path = Path('src/components/institution-analytics/institution-analytics-workspace.tsx')
ui = ui_path.read_text()
anchor = """function shortDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}
"""
replacement = anchor + """
function evidenceTime(value: number | null | undefined) {
  if (value == null) return '—';
  const seconds = Math.max(0, Math.round(value));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
}
"""
if anchor not in ui:
    raise SystemExit('F7 time formatter anchor not found')
ui = ui.replace(anchor, replacement, 1)

old_chapter = """<div className=\"institution-compact-list\">{chapters.map((row) => <button key={row.id} type=\"button\" onClick={() => onChapter(row)}><span><strong>{row.name}</strong><small>{row.responseCount} responses · {row.studentCount} students</small></span><b style={{ color: metricTone(row.averagePercentage) }}>{percentage(row.averagePercentage)}</b><ChevronRight /></button>)}</div>"""
new_chapter = """<div className=\"institution-compact-list\">{chapters.map((row) => <button key={row.id} type=\"button\" onClick={() => onChapter(row)}><span><strong>{row.name}</strong><small>{row.responseCount} responses · {row.studentCount} students · Accuracy {percentage(row.accuracy)} · Avg time {evidenceTime(row.averageSeconds)}</small></span><b style={{ color: metricTone(row.averagePercentage) }}>{percentage(row.averagePercentage)}</b><ChevronRight /></button>)}</div>"""
if old_chapter not in ui:
    raise SystemExit('F7 chapter row anchor not found')
ui = ui.replace(old_chapter, new_chapter, 1)

old_topic = """<div className=\"institution-topic-diagnosis\">{topics.map((row) => <div key={row.id}><div><strong>{row.name}</strong><small>{row.studentCount} students · {row.responseCount} responses</small></div><div className=\"institution-topic-track\">{row.averagePercentage == null ? null : <i style={{ width: `${row.averagePercentage}%`, backgroundColor: metricTone(row.averagePercentage) }} />}</div><b>{percentage(row.averagePercentage)}</b><span>{row.scoreBands.filter((band) => band.max <= 40).reduce((sum, band) => sum + band.students, 0)} below 40%</span></div>)}</div>"""
new_topic = """<div className=\"institution-topic-diagnosis\">{topics.map((row) => <div key={row.id}><div><strong>{row.name}</strong><small>{row.studentCount} students · {row.responseCount} responses · Accuracy {percentage(row.accuracy)} · Avg time {evidenceTime(row.averageSeconds)}</small></div><div className=\"institution-topic-track\">{row.averagePercentage == null ? null : <i style={{ width: `${row.averagePercentage}%`, backgroundColor: metricTone(row.averagePercentage) }} />}</div><b>{percentage(row.averagePercentage)}</b><span>{row.scoreBands.filter((band) => band.max <= 40).reduce((sum, band) => sum + band.students, 0)} below 40%</span></div>)}</div>"""
if old_topic not in ui:
    raise SystemExit('F7 topic row anchor not found')
ui = ui.replace(old_topic, new_topic, 1)
ui_path.write_text(ui)

smoke = r'''import fs from 'node:fs';
import assert from 'node:assert/strict';

const api = fs.readFileSync('src/app/api/institution-analytics/route.ts', 'utf8');
const ui = fs.readFileSync('src/components/institution-analytics/institution-analytics-workspace.tsx', 'utf8');

const checks = [
  ['response evidence selects correctness and time from exam responses', api.includes(".select('attempt_id,is_correct,marks_awarded,time_spent_seconds")],
  ['taxonomy response count derives from response rows', api.includes('responseCount: group.responses.length')],
  ['taxonomy accuracy derives from correct divided by answered evidence', api.includes('accuracy: answered ? rounded(correct / answered * 100) : null')],
  ['unanswered responses are excluded from accuracy denominator', api.includes("row.is_correct === true || row.is_correct === false")],
  ['average time ignores missing time evidence instead of coercing it to zero', api.includes('row.time_spent_seconds == null ? null : number(row.time_spent_seconds)')],
  ['chapter rows expose response count', ui.includes('{row.responseCount} responses · {row.studentCount} students · Accuracy')],
  ['chapter rows expose accuracy', ui.includes('Accuracy {percentage(row.accuracy)} · Avg time')],
  ['chapter rows expose average evidence time', ui.includes('Avg time {evidenceTime(row.averageSeconds)}')],
  ['topic rows expose response count accuracy and time', ui.includes('{row.studentCount} students · {row.responseCount} responses · Accuracy {percentage(row.accuracy)} · Avg time {evidenceTime(row.averageSeconds)}')],
  ['time formatter preserves missing evidence as dash', ui.includes("if (value == null) return '—';")],
  ['time formatter handles seconds and minutes', ui.includes("if (seconds < 60) return `${seconds}s`;") && ui.includes("return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;" )],
];
let passed = 0;
for (const [name, ok] of checks) { assert.ok(ok, `F7 check failed: ${name}`); console.log(`PASS: ${name}`); passed += 1; }
console.log(`F7 taxonomy evidence checks passed: ${passed}/${checks.length}`);
'''
Path('scripts/f7-taxonomy-evidence-smoke.mjs').write_text(smoke)
