from pathlib import Path

path = Path('src/components/analytics-v12/student-analytics-v12.tsx')
s = path.read_text()

anchor = "const MUTED = '#9cabb7';\n"
insert = """const MUTED = '#9cabb7';
const MIN_TOPIC_INTERPRETATION_EVIDENCE = 5;
const MIN_PERCENTILE_COHORT = 5;

function topicAnsweredEvidence(row: AnalyticsTaxonomyRow) {
  return row.correct + row.incorrect;
}

function topicHasInterpretationEvidence(row: AnalyticsTaxonomyRow) {
  return topicAnsweredEvidence(row) >= MIN_TOPIC_INTERPRETATION_EVIDENCE;
}

function eligiblePriorities(payload: AnalyticsV12Payload) {
  return payload.priorities.filter((priority) => {
    const topic = payload.topics.find((row) => row.id === priority.topic_id);
    return Boolean(topic && topicHasInterpretationEvidence(topic));
  });
}

function percentileCohortCopy(available: boolean, percentile: number | null) {
  return available && percentile !== null
    ? `Same-assessment submitters · cohort threshold ≥ ${MIN_PERCENTILE_COHORT} · ahead of ${round(percentile)}%`
    : `Same-assessment submitters · requires at least ${MIN_PERCENTILE_COHORT} submitted attempts on every comparable product assessment`;
}
"""
if anchor not in s:
    raise SystemExit('constants anchor missing')
s = s.replace(anchor, insert, 1)

old = """      <MetricCard icon={<BarChart3 />} tone="amber" label="Percentile" value={payload.summary.percentile_available ? metricValue(payload.summary.percentile) : '—'} copy={payload.summary.percentile_available ? `You are ahead of ${round(payload.summary.percentile)}% students` : 'Available after enough comparable attempts'} />"""
new = """      <MetricCard icon={<BarChart3 />} tone="amber" label="Percentile · same assessment" value={payload.summary.percentile_available ? metricValue(payload.summary.percentile) : '—'} copy={percentileCohortCopy(payload.summary.percentile_available, payload.summary.percentile)} />"""
if old not in s:
    raise SystemExit('overview percentile card anchor missing')
s = s.replace(old, new, 1)

old = """  const weakestTopic = [...topics].sort((a, b) => a.accuracy - b.accuracy)[0];
  const slowestTopic = [...topics].filter((row) => row.average_seconds !== null).sort((a, b) => (b.average_seconds || 0) - (a.average_seconds || 0))[0];"""
new = """  const interpretableTopics = topics.filter(topicHasInterpretationEvidence);
  const weakestTopic = [...interpretableTopics].sort((a, b) => a.accuracy - b.accuracy)[0];
  const slowestTopic = [...interpretableTopics].filter((row) => row.average_seconds !== null).sort((a, b) => (b.average_seconds || 0) - (a.average_seconds || 0))[0];"""
if old not in s:
    raise SystemExit('weakest topic anchor missing')
s = s.replace(old, new, 1)

old = """{topics.length ? topics.map((row) => <button type="button" key={row.id} onClick={() => openTopic(row)}><span>{row.name}</span><div className="analytics-v12-topic-track"><i style={{ width: `${clamp(row.accuracy)}%`, background: row.accuracy >= 70 ? BRAND : AMBER }} /><b style={{ left: `${clamp(chapter.accuracy)}%` }} /></div><strong>{round(row.accuracy)}%</strong></button>)"""
new = """{topics.length ? topics.map((row) => { const sample = topicAnsweredEvidence(row); const ready = topicHasInterpretationEvidence(row); return <button type="button" key={row.id} onClick={() => openTopic(row)}><span>{row.name}<small>{ready ? `n=${sample} answered` : `Building evidence · n=${sample}/${MIN_TOPIC_INTERPRETATION_EVIDENCE}`}</small></span><div className="analytics-v12-topic-track"><i style={{ width: `${ready ? clamp(row.accuracy) : 0}%`, background: ready ? (row.accuracy >= 70 ? BRAND : AMBER) : MUTED }} /><b style={{ left: `${clamp(chapter.accuracy)}%` }} /></div><strong>{ready ? `${round(row.accuracy)}%` : '—'}</strong></button>; })"""
if old not in s:
    raise SystemExit('topic mastery anchor missing')
s = s.replace(old, new, 1)

old = """<section className="analytics-v12-next-steps"><div className="analytics-v12-next-icon"><ArrowRight /></div><article><span>1</span><div><strong>Strengthen the weakest topic</strong><p>{weakestTopic ? `Begin with ${weakestTopic.name}, currently at ${round(weakestTopic.accuracy)}% accuracy.` : 'Complete more topic-tagged questions to identify the weakest area.'}</p></div></article>"""
new = """<section className="analytics-v12-next-steps"><div className="analytics-v12-next-icon"><ArrowRight /></div><article><span>1</span><div><strong>Strengthen the weakest topic</strong><p>{weakestTopic ? `Begin with ${weakestTopic.name}, currently at ${round(weakestTopic.accuracy)}% accuracy across n=${topicAnsweredEvidence(weakestTopic)} answered questions.` : `Complete at least ${MIN_TOPIC_INTERPRETATION_EVIDENCE} answered questions in a topic before Evidara labels it weak or strong.`}</p></div></article>"""
if old not in s:
    raise SystemExit('weakest recommendation anchor missing')
s = s.replace(old, new, 1)

old = """  const priority = payload.priorities.find((row) => row.topic_id === topic.id);"""
new = """  const topicSampleSize = topicAnsweredEvidence(topic);
  const priority = topicHasInterpretationEvidence(topic) ? payload.priorities.find((row) => row.topic_id === topic.id) : undefined;"""
if old not in s:
    raise SystemExit('topic priority anchor missing')
s = s.replace(old, new, 1)

old = """<MetricCard icon={<Target />} tone="green" label="Topic score" value={metricValue(topic.accuracy, '%')} copy={`${topic.questions} assessed outcomes`} delta={topic.trend_delta} />"""
new = """<MetricCard icon={<Target />} tone="green" label="Topic score" value={topicHasInterpretationEvidence(topic) ? metricValue(topic.accuracy, '%') : '—'} copy={topicHasInterpretationEvidence(topic) ? `n=${topicSampleSize} answered · ${topic.questions} exposed` : `Building evidence · n=${topicSampleSize}/${MIN_TOPIC_INTERPRETATION_EVIDENCE} answered`} delta={topicHasInterpretationEvidence(topic) ? topic.trend_delta : null} />"""
if old not in s:
    raise SystemExit('topic score anchor missing')
s = s.replace(old, new, 1)

old = """<small>{priority.questions} assessed outcomes · {round(priority.accuracy)}% accuracy</small>"""
new = """<small>n={topicSampleSize} answered · {priority.questions} exposed outcomes · {round(priority.accuracy)}% accuracy</small>"""
if old not in s:
    raise SystemExit('topic priority evidence anchor missing')
s = s.replace(old, new, 1)

old = """function PrioritiesView({ payload }: { payload: AnalyticsV12Payload }) {
  return <section className="analytics-v12-priorities-page"><div className="analytics-v12-section-head"><div><h3>Revision priorities</h3><p>Ranked automatically from accuracy, unanswered rate, pace and recent direction.</p></div></div><PriorityList rows={payload.priorities} /></section>;
}"""
new = """function PrioritiesView({ payload }: { payload: AnalyticsV12Payload }) {
  const priorities = eligiblePriorities(payload);
  return <section className="analytics-v12-priorities-page"><div className="analytics-v12-section-head"><div><h3>Revision priorities</h3><p>Ranked only after at least {MIN_TOPIC_INTERPRETATION_EVIDENCE} answered questions in the topic; sample size remains visible in topic analysis.</p></div></div><PriorityList rows={priorities} /></section>;
}"""
if old not in s:
    raise SystemExit('PrioritiesView anchor missing')
s = s.replace(old, new, 1)

old = """function EvidenceDrawer({ payload, open, close }: { payload: AnalyticsV12Payload; open: boolean; close: () => void }) {
  const strengths = payload.subjects.slice().sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);"""
new = """function EvidenceDrawer({ payload, open, close }: { payload: AnalyticsV12Payload; open: boolean; close: () => void }) {
  const strengths = payload.subjects.slice().sort((a, b) => b.accuracy - a.accuracy).slice(0, 3);
  const priorities = eligiblePriorities(payload);"""
if old not in s:
    raise SystemExit('EvidenceDrawer anchor missing')
s = s.replace(old, new, 1)
s = s.replace("payload.priorities.slice(0, 3).map", "priorities.slice(0, 3).map")

path.write_text(s)

f6 = r'''import fs from 'node:fs';
import assert from 'node:assert/strict';
const ui=fs.readFileSync('src/components/analytics-v12/student-analytics-v12.tsx','utf8');
const checks=[
 ['minimum topic evidence is five answered questions',ui.includes('const MIN_TOPIC_INTERPRETATION_EVIDENCE = 5;')],
 ['answered sample excludes unanswered',ui.includes('return row.correct + row.incorrect;')],
 ['topic interpretation helper enforces threshold',ui.includes('topicAnsweredEvidence(row) >= MIN_TOPIC_INTERPRETATION_EVIDENCE')],
 ['weakest topic filters to interpretable topics',ui.includes('const interpretableTopics = topics.filter(topicHasInterpretationEvidence);')],
 ['topic mastery hides score before threshold',ui.includes("ready ? `${round(row.accuracy)}%` : '—'")],
 ['topic mastery exposes sample size',ui.includes('`n=${sample} answered`') && ui.includes('`Building evidence · n=${sample}/${MIN_TOPIC_INTERPRETATION_EVIDENCE}`')],
 ['weakest recommendation displays answered sample',ui.includes('across n=${topicAnsweredEvidence(weakestTopic)} answered questions')],
 ['insufficient topic evidence is not labelled weak or strong',ui.includes('before Evidara labels it weak or strong')],
 ['topic recommendation is gated by same threshold',ui.includes('topicHasInterpretationEvidence(topic) ? payload.priorities.find')],
 ['topic recommendation displays sample size',ui.includes('n={topicSampleSize} answered')],
 ['priorities page filters using eligible topic evidence',ui.includes('const priorities = eligiblePriorities(payload);')],
 ['evidence drawer also uses threshold-filtered priorities',ui.includes('const priorities = eligiblePriorities(payload);') && (ui.match(/priorities\.slice\(0, 3\)\.map/g)||[]).length>=2],
];
for(const [name,ok] of checks){assert.ok(ok,`F6 canonical check failed: ${name}`);console.log(`PASS: ${name}`)}
console.log(`F6 canonical topic threshold checks passed: ${checks.length}/${checks.length}`);
'''
Path('scripts/f6-topic-evidence-threshold-smoke.mjs').write_text(f6)

f7 = r'''import fs from 'node:fs';
import assert from 'node:assert/strict';
const ui=fs.readFileSync('src/components/analytics-v12/student-analytics-v12.tsx','utf8');
const sql=fs.readFileSync('supabase/45_v12_evidence_analytics.sql','utf8');
const checks=[
 ['percentile cohort uses same paper/assessment',sql.includes('on cohort.paper_id = selected.paper_id')],
 ['percentile cohort includes submitted attempts only',sql.includes("and cohort.status = 'submitted'")],
 ['backend percentile requires cohort size at least five',sql.includes('case when cohort.cohort_size >= 5')],
 ['prominent percentile requires minimum cohort across product assessments',sql.includes('and completion.minimum_cohort >= 5')],
 ['percentile availability uses same threshold',sql.includes('and completion.minimum_cohort >= 5, false')],
 ['UI names actual cohort as same-assessment submitters',ui.includes('Percentile · same assessment') && ui.includes('Same-assessment submitters')],
 ['UI states minimum cohort threshold',ui.includes('const MIN_PERCENTILE_COHORT = 5;') && ui.includes('cohort threshold ≥ ${MIN_PERCENTILE_COHORT}')],
 ['unavailable copy explains all comparable assessments must meet threshold',ui.includes('submitted attempts on every comparable product assessment')],
 ['UI does not label percentile as school or class cohort',!ui.includes('Percentile · class') && !ui.includes('Percentile · school')],
];
for(const [name,ok] of checks){assert.ok(ok,`F7 canonical check failed: ${name}`);console.log(`PASS: ${name}`)}
console.log(`F7 canonical percentile cohort checks passed: ${checks.length}/${checks.length}`);
'''
Path('scripts/f7-percentile-cohort-smoke.mjs').write_text(f7)
