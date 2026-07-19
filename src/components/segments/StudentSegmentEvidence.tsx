import Link from "next/link";
import { Brain, CheckCircle2, CircleHelp, RefreshCw, ShieldCheck, Target } from "lucide-react";
import { evaluateStudentSegment } from "@/lib/evidaraSegments";
import { segmentStudentRecords } from "@/lib/evidaraSegmentDemo";

export function StudentSegmentEvidence(){
  const student=segmentStudentRecords[0];
  const evaluation=evaluateStudentSegment(student.evidence);
  const evidenceRows=[
    ["Comparable assessments",String(student.evidence.assessmentCount),"Minimum evidence and trend stability"],
    ["Latest percentile",student.evidence.percentile===null?"Not available":`${student.evidence.percentile}th`,"Context within the same assessment group"],
    ["Latest accuracy",student.evidence.accuracy===null?"Not available":`${student.evidence.accuracy}%`,"Answer quality among attempted questions"],
    ["Score change",student.evidence.scoreChange===null?"Not available":`${student.evidence.scoreChange>=0?"+":""}${student.evidence.scoreChange} points`,"Direction across comparable papers"],
    ["Avoidable loss share",student.evidence.avoidableLossShare===null?"Not available":`${student.evidence.avoidableLossShare}%`,"Marks that may respond to checking or method changes"],
    ["Response-time ratio",student.evidence.responseTimeRatio===null?"Not available":String(student.evidence.responseTimeRatio),"Pacing compared with expected question time"],
  ];

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">MY CURRENT DEVELOPMENT PATTERN</span><h1>Why this segment appears</h1><p>See the exact rule, evidence window and next action behind your current Evidara segment.</p><Link href="/metric-guide/" className="ev-guide-link"><CircleHelp size={16}/>Review metric definitions</Link></div><span className="so-status success"><RefreshCw size={14}/>Calculated {evaluation.calculatedAt}</span></div>

    <section className="analytics-command"><div><span className="so-kicker light">CURRENT PATTERN</span><h2>{evaluation.label}</h2><p>{evaluation.rule}</p><div className="so-inline-stats"><div><strong>{student.evidence.assessmentCount}</strong><span>assessments</span></div><div><strong>{student.evidence.accuracy}%</strong><span>accuracy</span></div><div><strong>+{student.evidence.scoreChange}</strong><span>score change</span></div></div></div><div className="readiness-ring"><strong>{evaluation.ruleVersion}</strong><span>rule version</span></div></section>

    <div className="so-grid so-grid-2 so-mt">
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">QUALIFYING CHECKS</span><h2>What the rule evaluated</h2></div><Brain/></div><div className="segment-criteria">{evaluation.criteria.map(item=><div key={item.label} className={item.passed?"passed":"pending"}><CheckCircle2/><div><strong>{item.label}</strong><span>Observed: {item.actual}</span><small>Required: {item.required}</small></div></div>)}</div></section>
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">NEXT ACTION</span><h2>What to do with this evidence</h2></div><Target/></div><div className="ev-segment-definition"><span>Recommended action</span><p>{evaluation.nextAction}</p><span>Evidence window</span><p>{evaluation.evidenceWindow}</p><span>Recalculation</span><p>{evaluation.reviewTrigger}</p></div></section>
    </div>

    <section className="so-card so-table-wrap so-mt"><table className="so-table"><thead><tr><th>Evidence measure</th><th>Current value</th><th>Why it is included</th></tr></thead><tbody>{evidenceRows.map(row=><tr key={row[0]}><td><strong>{row[0]}</strong></td><td>{row[1]}</td><td>{row[2]}</td></tr>)}</tbody></table></section>

    <div className="so-notice info so-mt"><ShieldCheck/><span><strong>This is not a permanent label.</strong> {evaluation.responsibleUse} It is recalculated as new evidence becomes available.</span></div>
  </div>;
}
