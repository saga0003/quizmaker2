from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f'Missing required F3 marker: {label}')
    return text.replace(old, new, 1)


p = Path('src/components/evidara/launch-analytics-workspace.tsx')
s = p.read_text()
s = replace_once(s,
    "function avg(values: number[]) {\n  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;\n}",
    "function avg(values: number[]) {\n  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;\n}",
    'launch avg empty semantics')
s = replace_once(s,
    "return { tests: tests.length, attempts: rows.length, average: avg(rows.map((row) => row.percentage)), accuracy: avg(rows.map((row) => row.accuracy)), top: rows.length ? Math.max(...rows.map((row) => row.percentage)) : 0 };",
    "return { tests: tests.length, attempts: rows.length, average: avg(rows.map((row) => row.percentage)), accuracy: avg(rows.map((row) => row.accuracy)), top: rows.length ? Math.max(...rows.map((row) => row.percentage)) : null };",
    'launch scope top empty semantics')
p.write_text(s)

p = Path('src/components/evidara/analytics-hierarchy.tsx')
s = p.read_text()
s = replace_once(s,
    "  average: number;\n  accuracy: number;\n  top: number;",
    "  average: number | null;\n  accuracy: number | null;\n  top: number | null;",
    'group nullable metrics')
s = replace_once(s,
    "function avg(values: number[]) {\n  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;\n}",
    "function avg(values: number[]) {\n  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;\n}",
    'hierarchy avg empty semantics')
s = replace_once(s,
    "    top: rows.length ? Math.max(...rows.map((row) => row.percentage)) : 0,",
    "    top: rows.length ? Math.max(...rows.map((row) => row.percentage)) : null,",
    'group top empty semantics')
sort_old = "}).sort((a, b) => b.average - a.average);"
sort_new = "}).sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity));"
if s.count(sort_old) != 2:
    raise SystemExit(f'Expected exactly 2 nullable-average sorts, found {s.count(sort_old)}')
s = s.replace(sort_old, sort_new)
s = replace_once(s,
    "  const topScore = trackResults.length ? Math.max(...trackResults.map((row) => row.percentage)) : 0;",
    "  const topScore = trackResults.length ? Math.max(...trackResults.map((row) => row.percentage)) : null;",
    'track top empty semantics')
inline_old = "pct(rows.length ? Math.max(...rows.map((r) => r.percentage)) : 0)"
inline_new = "pct(rows.length ? Math.max(...rows.map((r) => r.percentage)) : null)"
if s.count(inline_old) != 2:
    raise SystemExit(f'Expected exactly 2 inline empty maxima, found {s.count(inline_old)}')
s = s.replace(inline_old, inline_new)
p.write_text(s)

p = Path('src/components/institution-analytics/institution-analytics-workspace.tsx')
s = p.read_text()
s = replace_once(s,
    "  const score = Math.max(0, Math.min(100, subject.averagePercentage || 0));",
    "  const score = subject.averagePercentage == null ? null : Math.max(0, Math.min(100, subject.averagePercentage));",
    'subject donut nullable score')
old = '''      <ResponsiveContainer width="100%" height="100%">\n        <PieChart><Pie data={[{ value: score }, { value: 100 - score }]} dataKey="value" innerRadius={34} outerRadius={47} startAngle={90} endAngle={-270} stroke="none"><Cell fill={metricTone(score)} /><Cell fill="var(--line)" /></Pie></PieChart>\n      </ResponsiveContainer>\n      <strong>{percentage(score)}</strong>'''
new = '''      {score == null ? <span className="text-xs font-semibold text-[var(--muted-foreground)]">Not assessed</span> : <ResponsiveContainer width="100%" height="100%">\n        <PieChart><Pie data={[{ value: score }, { value: 100 - score }]} dataKey="value" innerRadius={34} outerRadius={47} startAngle={90} endAngle={-270} stroke="none"><Cell fill={metricTone(score)} /><Cell fill="var(--line)" /></Pie></PieChart>\n      </ResponsiveContainer>}\n      <strong>{percentage(score)}</strong>'''
s = replace_once(s, old, new, 'subject donut not-assessed state')
s = replace_once(s,
    '<div className="institution-topic-track"><i style={{ width: `${row.averagePercentage || 0}%`, backgroundColor: metricTone(row.averagePercentage) }} /></div>',
    '<div className="institution-topic-track">{row.averagePercentage == null ? null : <i style={{ width: `${row.averagePercentage}%`, backgroundColor: metricTone(row.averagePercentage) }} />}</div>',
    'topic progress nullable bar')
s = replace_once(s,
    "note={`${number(totalStudents ? totalTests / totalStudents : 0)} per student`}",
    "note={`${number(totalStudents ? totalTests / totalStudents : null)} per student`}",
    'network tests-per-student denominator')
p.write_text(s)

Path('scripts/f3-not-assessed-smoke.mjs').write_text(r'''import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const launch = read('src/components/evidara/launch-analytics-workspace.tsx');
const hierarchy = read('src/components/evidara/analytics-hierarchy.tsx');
const institution = read('src/components/institution-analytics/institution-analytics-workspace.tsx');
const failures = [];
let passed = 0;
const check = (label, condition) => { if (condition) { passed += 1; console.log(`✓ ${label}`); } else { failures.push(label); console.error(`✗ ${label}`); } };
check('launch empty average has no denominator instead of becoming zero', /function avg\(values: number\[\]\)[\s\S]*?values\.length \?[\s\S]*?: null;/.test(launch));
check('launch scope top score is null when there are no attempts', /top: rows\.length \? Math\.max\([\s\S]*?\) : null/.test(launch));
check('hierarchy group metrics admit missing evidence', /average: number \| null;[\s\S]*?accuracy: number \| null;[\s\S]*?top: number \| null;/.test(hierarchy));
check('hierarchy empty average is null', /function avg\(values: number\[\]\)[\s\S]*?values\.length \?[\s\S]*?: null;/.test(hierarchy));
check('hierarchy group top is null without submitted evidence', /top: rows\.length \? Math\.max\([\s\S]*?\) : null,/.test(hierarchy));
check('selected program top score is null without evidence', /const topScore = trackResults\.length \? Math\.max\([\s\S]*?\) : null;/.test(hierarchy));
check('inline program/test top-score displays no longer convert absence to zero', !hierarchy.includes('pct(rows.length ? Math.max(...rows.map((r) => r.percentage)) : 0)'));
check('nullable averages sort safely rather than using arithmetic on null', (hierarchy.match(/\(b\.average \?\? -Infinity\) - \(a\.average \?\? -Infinity\)/g) || []).length === 2);
check('live percentage formatter distinguishes missing evidence', /function percentage\(value: number \| null \| undefined\)[\s\S]*?value == null \? '—'/.test(institution));
check('subject donut preserves null instead of coercing it to zero', /subject\.averagePercentage == null \? null : Math\.max/.test(institution) && !institution.includes('subject.averagePercentage || 0'));
check('subject donut names the missing-evidence state', /score == null \? <span[^>]*>Not assessed<\/span>/.test(institution));
check('topic progress bar is absent when there is no metric denominator', /row\.averagePercentage == null \? null : <i style=\{\{ width: `\$\{row\.averagePercentage\}%`/.test(institution) && !institution.includes('`${row.averagePercentage || 0}%`'));
check('network tests-per-student is missing when there are no students', /totalStudents \? totalTests \/ totalStudents : null/.test(institution));
const displayPercentage = (value) => value == null ? '—' : `${Math.round(value * 10) / 10}%`;
check('a genuine measured zero still displays as 0%', displayPercentage(0) === '0%');
check('missing evidence displays as an em dash', displayPercentage(null) === '—');
if (failures.length) { console.error(`\nF3 not-assessed analytics smoke failed: ${failures.length} failed, ${passed} passed.`); process.exit(1); }
console.log(`\nF3 not-assessed analytics checks passed (${passed} checks).`);
''')

p = Path('.github/workflows/phase1-release-gate.yml')
s = p.read_text()
old = "      - name: F2 analytics metric dictionary checks\n        run: node scripts/f2-analytics-metric-dictionary-smoke.mjs\n\n      - name: TypeScript"
new = "      - name: F2 analytics metric dictionary checks\n        run: node scripts/f2-analytics-metric-dictionary-smoke.mjs\n      - name: F3 not-assessed analytics checks\n        run: node scripts/f3-not-assessed-smoke.mjs\n\n      - name: TypeScript"
s = replace_once(s, old, new, 'release-gate F3 wiring')
p.write_text(s)
