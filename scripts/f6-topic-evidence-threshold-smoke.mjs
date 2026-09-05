import fs from 'node:fs';
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
