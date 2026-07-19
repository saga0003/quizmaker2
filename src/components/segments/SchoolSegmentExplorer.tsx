"use client";

import { useMemo, useState } from "react";
import { Brain, CheckCircle2, CircleHelp, Clock3, RefreshCw, ShieldCheck, Target, TriangleAlert, Users } from "lucide-react";
import { evaluateStudentSegment, SEGMENT_RULE_VERSION } from "@/lib/evidaraSegments";
import { segmentStudentRecords } from "@/lib/evidaraSegmentDemo";

export function SchoolSegmentExplorer(){
  const records=useMemo(()=>segmentStudentRecords.map(student=>({...student,evaluation:evaluateStudentSegment(student.evidence)})),[]);
  const [selectedId,setSelectedId]=useState(records[0].id);
  const selected=records.find(student=>student.id===selectedId)||records[0];
  const counts=records.reduce<Record<string,number>>((total,student)=>{total[student.evaluation.label]=(total[student.evaluation.label]||0)+1;return total;},{});
  const sufficient=records.filter(student=>student.evaluation.evidenceStatus==="sufficient").length;

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">V6.4 DEVELOPMENT PATTERNS</span><h1>Transparent student segments</h1><p>Group current evidence into actionable teaching patterns without turning one score into a permanent student label.</p></div><span className="so-status success"><RefreshCw size={14}/>Rule set {SEGMENT_RULE_VERSION}</span></div>

    <div className="so-notice info"><ShieldCheck/><span><strong>Responsible-use boundary:</strong> segments support teaching, practice and review planning only. They cannot decide admission, discipline, promotion, fees, scholarship, access or a student&apos;s future.</span></div>

    <div className="so-grid so-grid-4 so-mt">
      <div className="so-stat"><Users/><strong>{records.length}</strong><span>Students reviewed</span></div>
      <div className="so-stat"><CheckCircle2/><strong>{sufficient}</strong><span>Sufficient evidence</span></div>
      <div className="so-stat"><TriangleAlert/><strong>{records.length-sufficient}</strong><span>Limited evidence</span></div>
      <div className="so-stat"><Brain/><strong>{Object.keys(counts).length}</strong><span>Current patterns</span></div>
    </div>

    <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">COHORT DISTRIBUTION</span><h2>Current evidence patterns</h2><small className="ev-evidence-window">Recalculated after each valid comparable assessment</small></div><CircleHelp/></div><div className="segment-distribution">{Object.entries(counts).map(([label,count])=><div key={label}><strong>{count}</strong><span>{label}</span></div>)}</div></section>

    <section className="so-card so-table-wrap so-mt"><table className="so-table"><thead><tr><th>Student</th><th>Grade</th><th>Focus</th><th>Assessments</th><th>Accuracy</th><th>Trend</th><th>Current segment</th><th>Evidence status</th><th>Actions</th></tr></thead><tbody>{records.map(student=><tr key={student.id}>
      <td><strong>{student.name}</strong><small>{student.evidence.evidenceWindow}</small></td>
      <td>Grade {student.grade}-{student.section}</td>
      <td>{student.subjectFocus}</td>
      <td>{student.evidence.assessmentCount}</td>
      <td>{student.evidence.accuracy===null?"Not available":`${student.evidence.accuracy}%`}</td>
      <td>{student.evidence.scoreChange===null?"Not available":`${student.evidence.scoreChange>=0?"+":""}${student.evidence.scoreChange}`}</td>
      <td><span className="so-status neutral">{student.evaluation.label}</span></td>
      <td><span className={`so-status ${student.evaluation.evidenceStatus==="sufficient"?"success":"warning"}`}>{student.evaluation.evidenceStatus}</span></td>
      <td><button className="so-btn so-btn-small so-btn-primary" onClick={()=>setSelectedId(student.id)}>Review evidence</button></td>
    </tr>)}</tbody></table></section>

    <div className="so-grid so-grid-2 so-mt">
      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">SELECTED STUDENT</span><h2>{selected.name}</h2><small className="ev-evidence-window">{selected.evidence.evidenceWindow}</small></div><span className={`so-status ${selected.evaluation.evidenceStatus==="sufficient"?"success":"warning"}`}>{selected.evaluation.evidenceStatus} evidence</span></div>
        <div className="segment-result-card"><span>Current development pattern</span><h3>{selected.evaluation.label}</h3><p>{selected.evaluation.rule}</p><small>Rule version {selected.evaluation.ruleVersion} · calculated {selected.evaluation.calculatedAt}</small></div>
        <div className="segment-criteria">{selected.evaluation.criteria.map(item=><div key={item.label} className={item.passed?"passed":"pending"}>{item.passed?<CheckCircle2/>:<Clock3/>}<div><strong>{item.label}</strong><span>Observed: {item.actual}</span><small>Rule requires: {item.required}</small></div></div>)}</div>
      </section>

      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">NEXT RESPONSIBLE ACTION</span><h2>Turn evidence into support</h2></div><Target/></div><div className="ev-segment-definition"><span>Recommended action</span><p>{selected.evaluation.nextAction}</p><span>Recalculation trigger</span><p>{selected.evaluation.reviewTrigger}</p><span>Method boundary</span><p>{selected.evaluation.responsibleUse}</p></div><div className="so-notice info"><Brain/><span>Teachers should review the underlying responses before assigning an intervention. The segment can change immediately when new valid evidence is available.</span></div></section>
    </div>
  </div>;
}
