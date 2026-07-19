"use client";

import {useEffect,useMemo,useState} from "react";
import {BarChart3,LoaderCircle} from "lucide-react";
import {supabase} from "@/lib/supabase";
import type {AttemptResult} from "@/types/papers";
import {SortableDataTable,type DataColumn} from "@/components/ui/SortableDataTable";
import {MetricLabel} from "@/components/ui/MetricInfo";
import {metricDefinitions} from "@/lib/evidaraMetrics";

const demoRows:AttemptResult[]=[
 {attempt_id:"a1",paper_title:"NEET Full Syllabus Mock 01",status:"submitted",started_at:"2026-07-14T09:00:00Z",score:604,maximum_marks:720,percentage:83.9,correct_count:151,incorrect_count:25,unanswered_count:4} as AttemptResult,
 {attempt_id:"a2",paper_title:"Physics Unit Test 04",status:"submitted",started_at:"2026-06-27T09:00:00Z",score:78,maximum_marks:100,percentage:78,correct_count:32,incorrect_count:6,unanswered_count:2} as AttemptResult,
];

export function StudentResults(){
 const[rows,setRows]=useState<AttemptResult[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
 useEffect(()=>{void load()},[]);
 async function load(){
  if(!supabase){setRows(demoRows);setLoading(false);return}
  setLoading(true);setError("");
  const sync=await supabase.rpc("sync_my_shared_benchmark_facts");
  if(sync.error&&!sync.error.message.toLowerCase().includes("function"))setError(sync.error.message);
  const{data,error:loadError}=await supabase.rpc("list_my_attempt_results");
  if(loadError)setError(loadError.message);else setRows((data||[])as AttemptResult[]);setLoading(false);
 }
 const columns=useMemo<DataColumn<AttemptResult>[]>(()=>[
  {key:"paper",label:"Assessment",value:r=>r.paper_title,render:r=><><strong>{r.paper_title}</strong><small>{new Date(r.started_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</small></>},
  {key:"status",label:"Status",value:r=>r.status,render:r=><span className="so-status success">{r.status}</span>,filter:{label:"statuses",value:r=>r.status}},
  {key:"score",label:"Marks",value:r=>r.score,render:r=>`${r.score}/${r.maximum_marks}`,align:"right"},
  {key:"percentage",label:<MetricLabel {...metricDefinitions.trend}>Score %</MetricLabel>,value:r=>r.percentage,render:r=>`${Number(r.percentage).toFixed(1)}%`,align:"right"},
  {key:"correct",label:"Correct",value:r=>r.correct_count,align:"right"},{key:"incorrect",label:"Incorrect",value:r=>r.incorrect_count,align:"right"},{key:"unanswered",label:"Unanswered",value:r=>r.unanswered_count,align:"right"},
  {key:"date",label:"Date",value:r=>new Date(r.started_at),render:r=>new Date(r.started_at).toLocaleDateString("en-IN"),align:"right"},
 ],[]);
 return <div><div className="so-page-head"><div><span className="so-kicker">PERFORMANCE HISTORY</span><h1>My assessment results</h1><p>Shared-paper contributions are verified from completed results; the browser never supplies benchmark marks.</p></div><span className="so-status neutral">{rows.length} result cycles</span></div>{error&&<div className="so-notice warning">{error}</div>}{loading?<div style={{padding:45,textAlign:"center",color:"#6B7980"}}><LoaderCircle className="spin"/> Loading results…</div>:rows.length===0?<div className="so-card so-pad" style={{textAlign:"center"}}><BarChart3/><h3>No submitted tests yet</h3></div>:<section className="so-card so-pad"><SortableDataTable rows={rows} columns={columns} rowKey={r=>r.attempt_id} searchText={r=>`${r.paper_title} ${r.status} ${r.score} ${r.percentage}`} searchPlaceholder="Search test, marks, percentage or status" initialSortKey="date" initialSortDirection="desc"/></section>}</div>;
}
