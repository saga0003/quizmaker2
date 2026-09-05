"use client";
import { useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Clock3, LoaderCircle, LockKeyhole, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AttemptResult } from "@/types/papers";

function releaseCopy(row: AttemptResult) {
  if (row.result_mode === "after_close" && row.available_until) {
    const close = new Date(row.available_until);
    if (!Number.isNaN(close.getTime())) {
      return `Your institution will release this result after ${close.toLocaleString("en-IN")}.`;
    }
  }
  if (row.result_mode === "hidden") return "Your institution has kept this result private for now.";
  return "Your result has been submitted and is waiting for release by the institution.";
}

export function StudentResults(){
  const [rows,setRows]=useState<AttemptResult[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  useEffect(()=>{void load()},[]);
  async function load(){if(!supabase){setLoading(false);return;}const {data,error}=await supabase.rpc("list_my_attempt_results");if(error)setError(error.message);else setRows((data||[]) as AttemptResult[]);setLoading(false)}
  return <div><div><span className="rm-label">Performance history</span><h1 style={{margin:"5px 0",fontSize:34,color:"#131e35"}}>My test results</h1><p style={{margin:0,color:"#667085"}}>Submitted assessments appear here according to the result-release policy chosen by your institution.</p></div>{error&&<div style={{marginTop:14,padding:12,background:"#fef3f2",color:"#b42318",borderRadius:12}}>{error}</div>}{loading?<div style={{padding:45,textAlign:"center",color:"#667085"}}><LoaderCircle className="spin"/> Loading results…</div>:rows.length===0?<div className="rm-card" style={{padding:45,textAlign:"center",marginTop:18}}><BarChart3 size={32} color="#98a2b3"/><h3>No submitted tests yet</h3><p style={{color:"#667085"}}>Complete a published question paper to create your first result.</p></div>:<div style={{display:"grid",gap:13,marginTop:18}}>{rows.map(row=>{
    const released = row.result_released !== false && row.score !== null && row.maximum_marks !== null && row.percentage !== null;
    return <article key={row.attempt_id} className="rm-card" style={{padding:18}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start",flexWrap:"wrap"}}><div><span className="rm-label">{row.status}</span><h3 style={{margin:"5px 0",color:"#131e35"}}>{row.paper_title}</h3><div style={{fontSize:12,color:"#667085",display:"flex",alignItems:"center",gap:5}}><Clock3 size={14}/> {new Date(row.started_at).toLocaleString("en-IN")}</div></div>{released?<div style={{textAlign:"right"}}><strong style={{fontSize:28,color:(row.percentage??0)>=50?"#137a3a":"#b42318"}}>{row.score}/{row.maximum_marks}</strong><div style={{fontSize:13,color:"#667085"}}>{row.percentage}%</div></div>:<div style={{maxWidth:330,padding:12,borderRadius:12,background:"#f8fafc",color:"#475467",fontSize:13,lineHeight:1.5}}><div style={{display:"flex",alignItems:"center",gap:6,fontWeight:700,color:"#344054"}}><LockKeyhole size={15}/> Result not released</div><div style={{marginTop:4}}>{releaseCopy(row)}</div></div>}</div>{released?<div className="result-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:9,marginTop:14}}><div style={{padding:11,background:"#ecfdf3",borderRadius:10,color:"#137a3a"}}><CheckCircle2 size={16}/> <strong>{row.correct_count}</strong> Correct</div><div style={{padding:11,background:"#fef3f2",borderRadius:10,color:"#b42318"}}><XCircle size={16}/> <strong>{row.incorrect_count}</strong> Incorrect</div><div style={{padding:11,background:"#f2f4f7",borderRadius:10,color:"#667085"}}><strong>{row.unanswered_count}</strong> Unanswered</div></div>:null}</article>
  })}</div>}<style>{`@media(max-width:560px){.result-grid{grid-template-columns:1fr!important}}`}</style></div>
}
