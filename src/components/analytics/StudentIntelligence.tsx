"use client";

import { Activity, Brain, CheckCircle2, Clock3, Gauge, Lightbulb, Target, TrendingUp, TriangleAlert } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MetricInfo, MetricLabel } from "@/components/ui/MetricInfo";
import { SortableDataTable, type DataColumn } from "@/components/ui/SortableDataTable";
import { metricDefinitions, segmentDefinitions } from "@/lib/evidaraMetrics";

const trend = [
  { id:"t1", test:"Foundation Diagnostic", subject:"Mixed", date:"12 May", score:58, accuracy:61, speed:54, percentile:62 },
  { id:"t2", test:"Unit Test 01", subject:"Science", date:"28 May", score:64, accuracy:68, speed:59, percentile:69 },
  { id:"t3", test:"Concept Check 02", subject:"Math", date:"11 Jun", score:71, accuracy:74, speed:66, percentile:77 },
  { id:"t4", test:"Mid-cycle Mock", subject:"Mixed", date:"27 Jun", score:78, accuracy:81, speed:70, percentile:85 },
  { id:"t5", test:"NEET Mock 01", subject:"Mixed", date:"14 Jul", score:84, accuracy:86, speed:76, percentile:91 },
];

const topics = [
  { id:"p1", name:"Cell Biology", subject:"Biology", questions:18, mastery:92, status:"Strong", trend:8 },
  { id:"p2", name:"Chemical Bonding", subject:"Chemistry", questions:16, mastery:78, status:"Improving", trend:11 },
  { id:"p3", name:"Kinematics", subject:"Physics", questions:20, mastery:63, status:"Needs practice", trend:5 },
  { id:"p4", name:"Ratio & Proportion", subject:"Mathematics", questions:14, mastery:57, status:"Priority", trend:-2 },
  { id:"p5", name:"Data Interpretation", subject:"Mathematics", questions:12, mastery:72, status:"Improving", trend:9 },
];

const errors = [
  { label:"Concept gap", value:36 },
  { label:"Wrong method", value:24 },
  { label:"Careless error", value:20 },
  { label:"Time pressure", value:12 },
  { label:"Guessing", value:8 },
];

export function StudentIntelligence(){
  const historyColumns:DataColumn<(typeof trend)[number]>[] = [
    { key:"test", label:"Assessment", value:row=>row.test, render:row=><><strong>{row.test}</strong><small>{row.date}</small></>, filter:{label:"subjects",value:row=>row.subject} },
    { key:"subject", label:"Subject", value:row=>row.subject, filter:{label:"subjects",value:row=>row.subject} },
    { key:"score", label:<MetricLabel {...metricDefinitions.score}>Score</MetricLabel>, value:row=>row.score, render:row=>`${row.score}%`, align:"right" },
    { key:"accuracy", label:"Accuracy", value:row=>row.accuracy, render:row=>`${row.accuracy}%`, align:"right" },
    { key:"speed", label:<MetricLabel {...metricDefinitions.speed}>Speed index</MetricLabel>, value:row=>row.speed, align:"right" },
    { key:"percentile", label:<MetricLabel {...metricDefinitions.percentile}>Percentile</MetricLabel>, value:row=>row.percentile, render:row=>`${row.percentile}th`, align:"right" },
  ];

  const topicColumns:DataColumn<(typeof topics)[number]>[] = [
    { key:"name", label:"Topic", value:row=>row.name, render:row=><><strong>{row.name}</strong><small>{row.questions} valid question responses</small></>, filter:{label:"subjects",value:row=>row.subject} },
    { key:"subject", label:"Subject", value:row=>row.subject, filter:{label:"subjects",value:row=>row.subject} },
    { key:"mastery", label:<MetricLabel {...metricDefinitions.mastery}>Mastery</MetricLabel>, value:row=>row.mastery, render:row=>`${row.mastery}%`, align:"right" },
    { key:"trend", label:<MetricLabel {...metricDefinitions.trend}>Change</MetricLabel>, value:row=>row.trend, render:row=><span className={row.trend>=0?"ev-positive":"ev-negative"}>{row.trend>=0?"+":""}{row.trend}</span>, align:"right" },
    { key:"status", label:"Evidence status", value:row=>row.status, render:row=><span className="ev-segment-pill">{row.status}</span>, filter:{label:"statuses",value:row=>row.status} },
  ];

  const segment=segmentDefinitions.fast_improver;

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">STUDENT EVIDENCE</span><h1>Progress, context and the next step</h1><p>Each measure explains what it means, how it was evaluated and what it can responsibly support. Current evidence covers five comparable assessments from 12 May to 14 July.</p></div><span className="so-status success">5 assessments analysed</span></div>

    <section className="analytics-command"><div><span className="so-kicker light">CURRENT DEVELOPMENT SEGMENT</span><div className="ev-dark-metric-title"><h2>{segment.label}</h2><MetricInfo {...metricDefinitions.segment}/></div><p>{segment.rule}</p><div className="so-inline-stats"><div><strong>84%</strong><span><MetricLabel {...metricDefinitions.score}>latest score</MetricLabel></span></div><div><strong>91st</strong><span><MetricLabel {...metricDefinitions.percentile}>percentile</MetricLabel></span></div><div><strong>+26</strong><span><MetricLabel {...metricDefinitions.trend}>score gain</MetricLabel></span></div><div><strong>76</strong><span><MetricLabel {...metricDefinitions.speed}>speed index</MetricLabel></span></div></div></div><div className="readiness-ring"><strong>82</strong><span><MetricLabel {...metricDefinitions.readiness}>readiness index</MetricLabel></span></div></section>

    <div className="so-grid so-grid-4 so-mt">
      <div className="so-stat"><CheckCircle2/><strong>42/50</strong><span>Correct answers</span></div>
      <div className="so-stat"><Clock3/><strong>68 sec</strong><span><MetricLabel {...metricDefinitions.speed}>average per question</MetricLabel></span></div>
      <div className="so-stat"><Gauge/><strong>6</strong><span>Overtime questions</span></div>
      <div className="so-stat"><TriangleAlert/><strong>8</strong><span><MetricLabel {...metricDefinitions.recoverableMarks}>recoverable marks</MetricLabel></span></div>
    </div>

    <div className="so-grid so-grid-2 so-mt">
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">IMPROVEMENT TREND</span><h2>Score, accuracy and speed</h2><small className="ev-evidence-window">Five comparable assessments · 12 May–14 July · latest point highlighted</small></div><MetricInfo {...metricDefinitions.trend}/></div><div style={{height:280}}><ResponsiveContainer width="100%" height="100%"><LineChart data={trend}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB"/><XAxis dataKey="date"/><YAxis domain={[40,100]}/><Tooltip/><Line type="monotone" dataKey="score" name="Score" stroke="#0E5A5A" strokeWidth={3}/><Line type="monotone" dataKey="accuracy" name="Accuracy" stroke="#AEB8BC" strokeWidth={2}/><Line type="monotone" dataKey="speed" name="Speed index" stroke="#F2B84B" strokeWidth={2}/></LineChart></ResponsiveContainer></div><div className="so-notice info"><Lightbulb/><span>The direction is positive across all three measures. Continue the current plan, then verify that the improvement remains after a 21-day delay.</span></div></section>
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">ERROR CAUSES</span><h2>Why marks were lost</h2><small className="ev-evidence-window">Based on 22 incorrect or overtime responses in the latest paper</small></div><MetricInfo title="Error-cause distribution" definition="The share of lost-mark responses assigned to the most likely immediate cause." evaluatedFrom="Question response, selected option, solution steps where available, response time and prior evidence on the same concept." whyItMatters="It separates a concept need from a method, checking or pacing need so the next action is more precise." caution="Automated classifications should be reviewed by a teacher when the response evidence is incomplete."/></div><div className="error-bars">{errors.map(error=><div key={error.label}><div><span>{error.label}</span><strong>{error.value}%</strong></div><i><b style={{width:`${error.value}%`}}/></i></div>)}</div><div className="so-notice warning"><Lightbulb/><span>Concept gap is the largest observed loss source. Repair the two priority concepts before adding another mixed full-length paper.</span></div></section>
    </div>

    <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">ASSESSMENT HISTORY</span><h2>Sort and filter every evidence cycle</h2></div><TrendingUp/></div><SortableDataTable rows={trend} columns={historyColumns} rowKey={row=>row.id} searchText={row=>`${row.test} ${row.subject} ${row.date} ${row.score} ${row.percentile}`} searchPlaceholder="Search assessment, subject, score or percentile" initialSortKey="date" initialSortDirection="desc"/></section>

    <div className="so-grid so-grid-2 so-mt">
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">TOPIC EVIDENCE</span><h2>Sort by mastery, change or subject</h2></div><Activity/></div><SortableDataTable rows={topics} columns={topicColumns} rowKey={row=>row.id} searchText={row=>`${row.name} ${row.subject} ${row.status}`} searchPlaceholder="Search topic, subject or evidence status" initialSortKey="mastery" initialSortDirection="desc"/></section>
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">SEGMENT DEFINITION</span><h2>Why “{segment.label}” appears</h2></div><MetricInfo {...metricDefinitions.segment}/></div><div className="ev-segment-definition"><span>Current rule</span><p>{segment.rule}</p><span>Recommended next action</span><p>{segment.nextAction}</p><span>Recalculation</span><p>After every valid assessment. The segment can change as new evidence becomes available.</p></div><div className="so-notice info"><Brain/><span>This segment describes the current evidence pattern. It is not a permanent judgement of ability, potential or future outcome.</span></div></section>
    </div>

    <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">DEVELOPMENT PLAN</span><h2>What to do next</h2></div><Target/></div><div className="so-steps"><div><b>1</b><span><strong>Repair Ratio & Proportion</strong><small>Watch one worked explanation, then complete 12 controlled questions without a timer.</small></span></div><div><b>2</b><span><strong>Run a Kinematics speed set</strong><small>Complete 15 medium questions with a 75-second cap and record skipped steps.</small></span></div><div><b>3</b><span><strong>Retest after seven days</strong><small>Look for at least 80% accuracy and no more than two avoidable errors.</small></span></div><div><b>4</b><span><strong>Retention check after 21 days</strong><small>Verify that the change survives a delay and an unfamiliar question format.</small></span></div></section>

    <div className="so-grid so-grid-3 so-mt"><article className="so-card so-pad insight-card"><Brain/><span className="so-kicker">COGNITIVE EVIDENCE</span><h3>Application strong; analysis improving</h3><p>Recall is not the main issue. Most lost marks occur when the learner must select a multi-step method quickly.</p></article><article className="so-card so-pad insight-card"><Clock3/><span className="so-kicker">TIME BEHAVIOUR</span><h3>Slow start, efficient finish</h3><p>The first five questions consume 22% more time. A structured first-pass strategy should recover exam time.</p></article><article className="so-card so-pad insight-card"><Target/><span className="so-kicker">TEACHER ACTION</span><h3>Small-group method clinic</h3><p>Place the learner with students showing the same procedural need, not with every student scoring below average.</p></article></div>
  </div>;
}
