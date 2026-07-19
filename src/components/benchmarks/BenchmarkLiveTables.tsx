"use client";
import {useMemo} from "react";
import {ShieldCheck} from "lucide-react";
import {MetricInfo,MetricLabel} from "@/components/ui/MetricInfo";
import {SortableDataTable,type DataColumn} from "@/components/ui/SortableDataTable";
import {metricDefinitions} from "@/lib/evidaraMetrics";
import type {Snapshot,StudentRow} from "./useSharedBenchmark";
export function BenchmarkLiveTables({snapshot,students,organizationName}:{snapshot:Snapshot|null;students:StudentRow[];organizationName:string}){
 const studentColumns=useMemo<DataColumn<StudentRow>[]>(()=>{
  const columns:DataColumn<StudentRow>[]=[
   {key:"name",label:"Student",value:r=>r.student_name,render:r=><><strong>{r.student_name}</strong><small>Private to {organizationName}</small></>,filter:{label:"grades",value:r=>r.grade}},
   {key:"grade",label:"Grade",value:r=>r.grade,filter:{label:"grades",value:r=>r.grade}},
   {key:"score",label:"Marks",value:r=>Number(r.score),render:r=>`${r.score}/${r.maximum_marks}`,align:"right"},
   {key:"percentage",label:"Score %",value:r=>Number(r.percentage),render:r=>`${Number(r.percentage).toFixed(1)}%`,align:"right"},
   {key:"segment",label:"Current segment",value:r=>r.segment_label,render:r=><span className="ev-segment-pill">{r.segment_label}</span>,filter:{label:"segments",value:r=>r.segment_label}},
  ];
  if(snapshot?.available)columns.splice(4,0,{key:"percentile",label:<MetricLabel {...metricDefinitions.percentile}>Percentile</MetricLabel>,value:r=>Number(r.percentile),render:r=>r.percentile==null?"Hidden":`${Math.round(Number(r.percentile))}th`,align:"right"});
  return columns;
 },[organizationName,snapshot?.available]);
 const total=snapshot?.valid_attempts||0,dist=(snapshot?.distribution||[]).map(row=>({...row,share:total?row.attempts/total*100:0}));
 const distColumns:DataColumn<(typeof dist)[number]>[]=[{key:"band",label:"Score band",value:r=>r.band},{key:"attempts",label:"Anonymous attempts",value:r=>r.attempts,align:"right"},{key:"share",label:"Share",value:r=>r.share,render:r=>`${r.share.toFixed(1)}%`,align:"right"}];
 return <><div className="so-grid so-grid-2 so-mt"><section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">GLOBAL DISTRIBUTION</span><h2>{snapshot?.available?"Where participants scored":"Waiting for the privacy minimum"}</h2></div><MetricInfo {...metricDefinitions.benchmark}/></div>{snapshot?.available?<SortableDataTable rows={dist} columns={distColumns} rowKey={r=>r.band}/>:<div className="ev-empty-benchmark"><ShieldCheck/><p>Wider statistics and individual relative percentiles remain hidden until {snapshot?.minimum_sample_size||20} verified attempts.</p></div>}</section><section className="so-card so-pad"><span className="so-kicker">RESPONSIBLE USE</span><h2>What the benchmark can say</h2><div className="so-steps"><div><b>1</b><span><strong>Exact-version evidence</strong><small>Only the same published paper is included.</small></span></div><div><b>2</b><span><strong>Trusted result facts</strong><small>The server derives marks during submission.</small></span></div><div><b>3</b><span><strong>Context, not ranking</strong><small>No public school name or external student row is shown.</small></span></div></div></section></div><section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">YOUR SCHOOL · PRIVATE VIEW</span><h2>Students on this shared paper</h2></div><span className="so-status neutral">{students.length} attempts</span></div><SortableDataTable rows={students} columns={studentColumns} rowKey={r=>`${r.student_id}-${r.submitted_at}`} searchText={r=>`${r.student_name} ${r.grade} ${r.segment_label} ${r.score}`} searchPlaceholder="Search student, grade, marks or segment" initialSortKey="score" initialSortDirection="desc"/></section></>;
}
