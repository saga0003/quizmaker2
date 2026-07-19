"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3, LoaderCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AttemptResult } from "@/types/papers";
import { SortableDataTable, type DataColumn } from "@/components/ui/SortableDataTable";
import { MetricLabel } from "@/components/ui/MetricInfo";
import { metricDefinitions } from "@/lib/evidaraMetrics";

const demoRows:AttemptResult[]=[
 {attempt_id:"a1",paper_title:"NEET Full Syllabus Mock 01",status:"evaluated",started_at:"2026-07-14T09:00:00Z",score:604,maximum_marks:720,percentage:83.9,correct_count:151,incorrect_count:25,unanswered_count:4} as AttemptResult,
 {attempt_id:"a2",paper_title:"Physics Unit Test 04",status:"evaluated",started_at:"2026-06-27T09:00:00Z",score:78,maximum_marks:100,percentage:78,correct_count:32,incorrect_count:6,unanswered_count:2} as AttemptResult,
 {attempt_id:"a3",paper_title:"Chemistry Concept Check",status:"evaluated",started_at:"2026-06-11T09:00:00Z",score:71,maximum_marks:100,percentage:71,correct_count:29,incorrect_count:8,unanswered_count:3} as AttemptResult,
 {attempt_id:"a4",paper_title:"Foundation Diagnostic",status:"evaluated",started_at:"2026-05-12T09:00:00Z",score:58,maximum_marks:100,percentage:58,correct_count:24,incorrect_count:12,unanswered_count:4} as AttemptResult,
];

export function StudentResults(){
  const [rows,setRows]=useState<AttemptResult[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  useEffect(()=>{void load()},[]);
  async function load(){if(!supabase){setRows(demoRows);setLoading(false);return}const {data,error:loadError}=await supabase.rpc("list_my_attempt_results");if(loadError)setError(loadError.message);else setRows((data||[]) as AttemptResult[]);setLoading(false)}

  const columns=useMemo<DataColumn<AttemptResult>[]>(()=>[
    {key:"paper",label:"Assessment",value:row=>row.paper_title,render:row=><><strong>{row.paper_title}</strong><small>{new Date(row.started_at).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})}</small></>},
    {key:"status",label:"Status",value:row=>row.status,render:row=><span className="so-status success">{row.status}</span>,filter:{label:"statuses",value:row=>row.status}},
    {key:"score",label:"Marks",value:row=>row.score,render:row=>`${row.score}/${row.maximum_marks}`,align:"right"},
    {key:"percentage",label:<MetricLabel {...metricDefinitions.trend}>Score %</MetricLabel>,value:row=>row.percentage,render:row=>`${Number(row.percentage).toFixed(1)}%`,align:"right"},
    {key:"correct",label:"Correct",value:row=>row.correct_count,align:"right"},
    {key:"incorrect",label:"Incorrect",value:row=>row.incorrect_count,render:row=><span style={{color:"#9A6508",fontWeight:750}}>{row.incorrect_count}</span>,align:"right"},
    {key:"unanswered",label:"Unanswered",value:row=>row.unanswered_count,align:"right"},
    {key:"date",label:"Date",value:row=>new Date(row.started_at),render:row=>new Date(row.started_at).toLocaleDateString("en-IN"),align:"right"},
  ],[]);

  return <div><div className="so-page-head"><div><span className="so-kicker">PERFORMANCE HISTORY</span><h1>My assessment results</h1><p>Search and sort by test, marks, percentage, date or response outcome. Use the analytics view to understand why the result changed and what should happen next.</p></div><span className="so-status neutral">{rows.length} result cycles</span></div>{error&&<div className="so-notice warning">{error}</div>}{loading?<div style={{padding:45,textAlign:"center",color:"#6B7980"}}><LoaderCircle className="spin"/> Loading results…</div>:rows.length===0?<div className="so-card so-pad" style={{textAlign:"center"}}><BarChart3 size={32} color="#AEB8BC"/><h3>No submitted tests yet</h3><p style={{color:"#6B7980"}}>Complete a published question paper to create your first evidence cycle.</p></div>:<section className="so-card so-pad"><SortableDataTable rows={rows} columns={columns} rowKey={row=>row.attempt_id} searchText={row=>`${row.paper_title} ${row.status} ${row.score} ${row.percentage}`} searchPlaceholder="Search test, marks, percentage or status" initialSortKey="date" initialSortDirection="desc"/></section>}</div>;
}
