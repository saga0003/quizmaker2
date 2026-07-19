"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, CalendarClock, ClipboardCheck, Eye, FilePlus2, LoaderCircle, Pencil, PlayCircle, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PaperListRow, PaperStatus } from "@/types/papers";
import { useQuestionScope } from "@/components/questions/useQuestionScope";

const demo: PaperListRow[] = [{
  id:"demo-paper",organization_id:null,title:"NEET Full Syllabus Mock 01",code:"NEET-M01",description:"Demo paper builder preview",exam_type:"NEET",
  status:"draft",duration_minutes:180,total_marks:720,total_questions:180,access_mode:"public",available_from:null,available_until:null,
  attempt_limit:1,result_mode:"score_only",created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
}];

export function QuestionPaperList({kind}:{kind:"admin"|"school"}){
  const {organizationId,organizationName,loading:scopeLoading,error:scopeError}=useQuestionScope(kind);
  const [papers,setPapers]=useState<PaperListRow[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const [search,setSearch]=useState("");const [status,setStatus]=useState("all");
  const base=kind==="admin"?"/admin/papers":"/school/papers";
  async function load(){
    if(!supabase){setPapers(demo);setLoading(false);return;}
    if(kind==="school"&&scopeLoading)return;
    setLoading(true);setError("");
    let query=supabase.from("question_papers").select("id,organization_id,title,code,description,exam_type,status,duration_minutes,total_marks,total_questions,access_mode,available_from,available_until,attempt_limit,result_mode,created_at,updated_at").order("updated_at",{ascending:false});
    query=kind==="admin"?query.is("organization_id",null):query.eq("organization_id",organizationId!);
    const {data,error}=await query;
    if(error)setError(error.message);else setPapers((data||[]) as PaperListRow[]);
    setLoading(false);
  }
  useEffect(()=>{load()},[kind,organizationId,scopeLoading]);
  async function setPaperStatus(id:string,next:PaperStatus){
    if(!supabase)return;
    const {error}=await supabase.rpc("set_question_paper_status",{p_paper_id:id,p_status:next});
    if(error)setError(error.message);else await load();
  }
  const filtered=useMemo(()=>papers.filter(p=>{
    const hay=`${p.title} ${p.code||""} ${p.exam_type}`.toLowerCase();
    return (!search||hay.includes(search.toLowerCase()))&&(status==="all"||p.status===status);
  }),[papers,search,status]);
  const stats={total:papers.length,published:papers.filter(p=>p.status==="published").length,drafts:papers.filter(p=>p.status==="draft").length,questions:papers.reduce((n,p)=>n+p.total_questions,0)};
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"end",flexWrap:"wrap"}}><div><span className="rm-label">{organizationName} · Version 4</span><h1 style={{margin:"5px 0",fontSize:34,color:"#0b1324"}}>Tests and question papers</h1><p style={{margin:0,color:"#667085"}}>Build sections, select approved questions, schedule access and publish timed online tests. School-created tests carry no per-test charge.</p></div><Link className="rm-btn-primary" href={`${base}/new/`}><FilePlus2 size={18}/>Create question paper</Link></div>
    {(scopeError||error)&&<div style={{marginTop:14,padding:12,borderRadius:12,background:"#fef3f2",color:"#b42318",fontWeight:650}}>{scopeError||error}</div>}
    <section className="paper-stats" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:18}}>{[
      ["Total papers",stats.total,"#131e35"],["Published",stats.published,"#137a3a"],["Drafts",stats.drafts,"#8a5f00"],["Questions placed",stats.questions,"#6941c6"],
    ].map(([label,value,color])=><div className="rm-card" key={String(label)} style={{padding:16}}><strong style={{fontSize:28,color:String(color)}}>{value}</strong><div style={{fontSize:13,color:"#667085",marginTop:5}}>{label}</div></div>)}</section>
    <section className="rm-card" style={{padding:15,marginTop:16,display:"grid",gridTemplateColumns:"1fr 180px",gap:10}}><div style={{position:"relative"}}><Search size={17} style={{position:"absolute",left:12,top:13,color:"#98a2b3"}}/><input className="rm-input" style={{paddingLeft:38}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search paper title, code or exam type"/></div><select className="rm-input" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></section>
    <section className="rm-card" style={{marginTop:16,overflow:"hidden"}}>{loading?<div style={{padding:40,textAlign:"center",color:"#667085"}}><LoaderCircle className="spin"/> Loading papers…</div>:filtered.length===0?<div style={{padding:45,textAlign:"center"}}><ClipboardCheck size={30} color="#98a2b3"/><h3>No question papers yet</h3><p style={{color:"#667085"}}>Create your first paper using approved questions from the question bank.</p></div>:<div style={{overflowX:"auto"}}><table className="rm-table" style={{minWidth:980}}><thead><tr><th>Paper</th><th>Exam</th><th>Questions</th><th>Marks</th><th>Duration</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(p=><tr key={p.id}><td><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><strong>{p.title}</strong>{kind==="school"&&<span className="so-label free">FREE</span>}</div><div style={{fontSize:11,color:"#98a2b3",marginTop:4}}>{p.code||"No paper code"}</div></td><td>{p.exam_type}</td><td>{p.total_questions}</td><td>{p.total_marks}</td><td>{p.duration_minutes} min</td><td style={{textTransform:"capitalize"}}>{p.access_mode}</td><td><span className="rm-badge" style={{background:p.status==="published"?"#ecfdf3":p.status==="draft"?"#fff8e6":"#f2f4f7",color:p.status==="published"?"#137a3a":p.status==="draft"?"#8a5f00":"#667085"}}>{p.status}</span></td><td><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{!p.id.startsWith("demo")&&<><Link href={`${base}/new/?id=${p.id}`} title="Edit" className="rm-btn-secondary" style={{padding:"8px 10px"}}><Pencil size={15}/></Link><Link href={`${base}/preview/?id=${p.id}`} title="Preview" className="rm-btn-secondary" style={{padding:"8px 10px"}}><Eye size={15}/></Link>{p.status!=="published"?<button title="Publish" className="rm-btn-secondary" style={{padding:"8px 10px",color:"#137a3a"}} onClick={()=>setPaperStatus(p.id,"published")}><PlayCircle size={15}/></button>:<button title="Archive" className="rm-btn-secondary" style={{padding:"8px 10px"}} onClick={()=>setPaperStatus(p.id,"archived")}><Archive size={15}/></button>}</>}</div></td></tr>)}</tbody></table></div>}</section>
    <div style={{marginTop:13,fontSize:12,color:"#667085",display:"flex",alignItems:"center",gap:6}}><CalendarClock size={14}/>Publishing makes a paper visible according to its access mode and schedule. FREE means no additional per-test fee within the active annual school subscription.</div>
    <style>{`@media(max-width:760px){.paper-stats{grid-template-columns:1fr 1fr!important}section[style*="180px"]{grid-template-columns:1fr!important}}@media(max-width:480px){.paper-stats{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
