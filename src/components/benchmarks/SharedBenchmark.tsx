"use client";

import { useMemo, useState } from "react";
import { BarChart3, Check, Copy, EyeOff, Link2, Share2, ShieldCheck, Users } from "lucide-react";
import { MetricInfo, MetricLabel } from "@/components/ui/MetricInfo";
import { SortableDataTable, type DataColumn } from "@/components/ui/SortableDataTable";
import { metricDefinitions } from "@/lib/evidaraMetrics";

type StudentRow = { id:string; name:string; grade:string; score:number; percentile:number; accuracy:number; trend:number; segment:string };
const students:StudentRow[]=[
 {id:"s1",name:"Ananya Rao",grade:"11-A",score:604,percentile:91,accuracy:84,trend:26,segment:"Fast improver"},
 {id:"s2",name:"Aarav N",grade:"11-A",score:578,percentile:84,accuracy:80,trend:14,segment:"Accurate, pacing opportunity"},
 {id:"s3",name:"Diya S",grade:"11-B",score:552,percentile:76,accuracy:77,trend:19,segment:"High potential, avoidable loss"},
 {id:"s4",name:"Ishaan K",grade:"11-B",score:511,percentile:61,accuracy:71,trend:8,segment:"Developing evidence"},
 {id:"s5",name:"Meera P",grade:"11-A",score:492,percentile:54,accuracy:68,trend:11,segment:"Developing evidence"},
];
const distribution=[
 {band:"600-720",participants:842,share:6.6},{band:"550-599",participants:1944,share:15.1},{band:"500-549",participants:3120,share:24.3},{band:"450-499",participants:3355,share:26.1},{band:"Below 450",participants:3581,share:27.9},
];

export function SharedBenchmark(){
 const [shared,setShared]=useState(true);const [copied,setCopied]=useState(false);
 const total=distribution.reduce((sum,row)=>sum+row.participants,0);const schoolAverage=Math.round(students.reduce((sum,row)=>sum+row.score,0)/students.length);
 const studentColumns=useMemo<DataColumn<StudentRow>[]>(()=>[
  {key:"name",label:"Student",value:r=>r.name,render:r=><><strong>{r.name}</strong><small>Private to your school</small></>,filter:{label:"grades",value:r=>r.grade}},
  {key:"grade",label:"Grade",value:r=>r.grade,filter:{label:"grades",value:r=>r.grade}},
  {key:"score",label:"Marks",value:r=>r.score,align:"right"},
  {key:"percentile",label:<MetricLabel {...metricDefinitions.percentile}>Percentile</MetricLabel>,value:r=>r.percentile,render:r=>`${r.percentile}th`,align:"right"},
  {key:"accuracy",label:"Accuracy",value:r=>r.accuracy,render:r=>`${r.accuracy}%`,align:"right"},
  {key:"trend",label:<MetricLabel {...metricDefinitions.trend}>Trend</MetricLabel>,value:r=>r.trend,render:r=><span className={r.trend>=0?"ev-positive":"ev-negative"}>{r.trend>=0?"+":""}{r.trend}</span>,align:"right"},
  {key:"segment",label:"Current segment",value:r=>r.segment,render:r=><span className="ev-segment-pill">{r.segment}</span>,filter:{label:"segments",value:r=>r.segment}},
 ],[]);
 const distColumns=useMemo<DataColumn<(typeof distribution)[number]>[]>(()=>[
  {key:"band",label:"Score band",value:r=>r.band},{key:"participants",label:"Anonymous attempts",value:r=>r.participants,align:"right"},{key:"share",label:"Share",value:r=>r.share,render:r=>`${r.share}%`,align:"right"},
 ],[]);
 function copy(){navigator.clipboard?.writeText(`${window.location.origin}/benchmark/demo-paper/`);setCopied(true);setTimeout(()=>setCopied(false),1400)}
 return <div>
  <div className="so-page-head"><div><span className="so-kicker">ANONYMOUS SHARED-PAPER BENCHMARK</span><h1>Compare the same evidence, without exposing the school</h1><p>Schools can share an exact paper version for wider participation. Evidara publishes only aggregate evidence; student identities, school names and response sheets remain private.</p></div><button className="so-btn so-btn-primary" onClick={()=>setShared(v=>!v)}><Share2 size={16}/>{shared?"Pause public attempts":"Share this paper"}</button></div>
  <section className="ev-benchmark-hero"><div><span className="so-kicker light">NEET FULL SYLLABUS MOCK 01 · VERSION 1</span><h2>Your cohort is at the 67th percentile among participating cohorts</h2><p>The comparison uses the exact same question paper, duration and scoring rule. It is context for teaching decisions, not a public school league table.</p><div className="so-inline-stats"><div><strong>{total.toLocaleString("en-IN")}</strong><span>valid attempts</span></div><div><strong>493</strong><span>benchmark average</span></div><div><strong>{schoolAverage}</strong><span>your school average</span></div><div><strong>67th</strong><span>private cohort percentile</span></div></div></div><div className="ev-share-box"><Link2 size={21}/><strong>Shareable assessment link</strong><span>Participants contribute only after a valid completed attempt.</span><button className="rm-btn-secondary" onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?"Copied":"Copy link"}</button></div></section>
  <div className="so-grid so-grid-4 so-mt"><div className="so-stat"><Users/><strong>{total.toLocaleString("en-IN")}</strong><span><MetricLabel {...metricDefinitions.benchmark}>Total attempts</MetricLabel></span></div><div className="so-stat"><BarChart3/><strong>493</strong><span>Benchmark average</span></div><div className="so-stat"><ShieldCheck/><strong>20</strong><span>Minimum privacy sample</span></div><div className="so-stat"><EyeOff/><strong>0</strong><span>School identities disclosed</span></div></div>
  <div className="so-notice info so-mt"><ShieldCheck/><span><strong>Privacy rule:</strong> aggregate results appear only after at least 20 valid attempts. No other school name, student name, contact detail, response or rank list is disclosed.</span></div>
  <div className="so-grid so-grid-2 so-mt"><section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">GLOBAL DISTRIBUTION</span><h2>Where participants scored</h2></div><MetricInfo {...metricDefinitions.benchmark}/></div><SortableDataTable rows={distribution} columns={distColumns} rowKey={r=>r.band} initialSortKey="participants" initialSortDirection="desc"/></section><section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">RESPONSIBLE INTERPRETATION</span><h2>What the benchmark can say</h2></div><ShieldCheck/></div><div className="so-steps"><div><b>1</b><span><strong>Comparable paper evidence</strong><small>Only the exact published version is included.</small></span></div><div><b>2</b><span><strong>Context, not ranking</strong><small>Your cohort result stays private to authorised school users.</small></span></div><div><b>3</b><span><strong>Visible sample size</strong><small>Every result states the valid attempt count and window.</small></span></div><div><b>4</b><span><strong>Action after evidence</strong><small>Use topic and pacing gaps to plan the next intervention.</small></span></div></div></section></div>
  <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">YOUR SCHOOL · PRIVATE VIEW</span><h2>Students on this shared paper</h2></div><span className="so-status neutral">Names visible only to your school</span></div><SortableDataTable rows={students} columns={studentColumns} rowKey={r=>r.id} searchText={r=>`${r.name} ${r.grade} ${r.segment} ${r.score}`} searchPlaceholder="Search student, grade, marks or segment" initialSortKey="score" initialSortDirection="desc"/></section>
 </div>
}
