"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, CheckCircle2, CircleAlert, FileQuestion, Filter, LoaderCircle, Pencil, Plus, Search, Upload, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";
import type { QuestionRow, QuestionStatus, TaxonomySubject } from "@/types/questions";
import { useQuestionScope } from "./useQuestionScope";

const demo:QuestionRow[]=[
 {id:"demo-1",organization_id:null,created_by:"demo",subject_id:"phy",chapter_id:null,topic_id:null,question_type:"single_correct",status:"approved",difficulty:"moderate",stem_text:"A projectile is launched at 45°. What is its horizontal range?",stem_latex:"R=\\frac{u^2\\sin 2\\theta}{g}",question_image_url:null,passage_text:null,solution_text:null,solution_latex:null,marks:4,negative_marks:1,estimated_seconds:90,correct_answer:["B"],exam_types:["NEET","JEE Main"],class_level:"Class 11",source:"ScholarOS Trial",source_year:2026,language:"English",tags:["projectile"],version_number:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),subjects:{name:"Physics",code:"PHY"},chapters:{name:"Kinematics"}},
 {id:"demo-2",organization_id:"demo-org",created_by:"demo",subject_id:"bio",chapter_id:null,topic_id:null,question_type:"image_based",status:"in_review",difficulty:"easy",stem_text:"Identify the labelled organelle in the cell diagram.",stem_latex:null,question_image_url:"/trial/cell.svg",passage_text:null,solution_text:null,solution_latex:null,marks:4,negative_marks:1,estimated_seconds:60,correct_answer:["B"],exam_types:["NEET"],class_level:"Class 11",source:"School upload",source_year:null,language:"English",tags:["cell"],version_number:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),subjects:{name:"Biology",code:"BIO"},chapters:{name:"Cell: The Unit of Life"}},
];

const statusStyle:Record<QuestionStatus,{bg:string;color:string;icon:typeof CheckCircle2}>={
 approved:{bg:"#ecfdf3",color:"#137a3a",icon:CheckCircle2},in_review:{bg:"#fff8e6",color:"#8a5f00",icon:CircleAlert},draft:{bg:"#f2f4f7",color:"#475467",icon:FileQuestion},rejected:{bg:"#fef3f2",color:"#b42318",icon:XCircle},archived:{bg:"#f2f4f7",color:"#667085",icon:FileQuestion}
};

export function QuestionBank({kind}:{kind:"admin"|"school"}){
 const {configured}=useAuth();const {organizationId,organizationName,loading:scopeLoading,error:scopeError}=useQuestionScope(kind);
 const [questions,setQuestions]=useState<QuestionRow[]>(configured?[]:demo);const [subjects,setSubjects]=useState<TaxonomySubject[]>([]);const [loading,setLoading]=useState(configured);const [error,setError]=useState("");
 const [search,setSearch]=useState("");const [status,setStatus]=useState("all");const [subject,setSubject]=useState("all");const [scope,setScope]=useState("all");
 const base=kind==="admin"?"/admin/questions":"/school/questions";
 async function load(){
  if(!supabase){setQuestions(demo);setLoading(false);return;}
  if(kind==="school"&&scopeLoading)return;
  setLoading(true);setError("");
  const [{data:q,error:qError},{data:s}]=await Promise.all([
    supabase.from("questions").select("*,subjects(name,code),chapters(name),question_options(option_key,is_correct)").order("updated_at",{ascending:false}).limit(500),
    supabase.from("subjects").select("id,name,code,organization_id").eq("is_active",true).order("name")
  ]);
  if(qError)setError(qError.message);else setQuestions((q||[]) as unknown as QuestionRow[]);
  if(s)setSubjects(s as TaxonomySubject[]);setLoading(false);
 }
 useEffect(()=>{load()},[kind,organizationId,scopeLoading]);
 const filtered=useMemo(()=>questions.filter(q=>{
  const hay=`${q.stem_text} ${q.subjects?.name||""} ${(q.tags||[]).join(" ")}`.toLowerCase();
  if(search&&!hay.includes(search.toLowerCase()))return false;
  if(status!=="all"&&q.status!==status)return false;
  if(subject!=="all"&&q.subject_id!==subject)return false;
  if(scope==="master"&&q.organization_id!==null)return false;
  if(scope==="private"&&q.organization_id===null)return false;
  return true;
 }),[questions,search,status,subject,scope]);
 const stats=useMemo(()=>({total:questions.length,approved:questions.filter(q=>q.status==="approved").length,review:questions.filter(q=>q.status==="in_review").length,private:questions.filter(q=>q.organization_id!==null).length}),[questions]);
 return <div>
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:14,flexWrap:"wrap"}}><div><span className="rm-label">{organizationName} · Version 3</span><h1 style={{margin:"5px 0",fontSize:34,color:"#131e35"}}>Question bank</h1><p style={{margin:0,color:"#667085"}}>Create, import, review and reuse questions for NEET, JEE, KCET and custom exams.</p></div><div style={{display:"flex",gap:9,flexWrap:"wrap"}}><Link className="rm-btn-secondary" href={`${base}/import/`}><Upload size={17}/> Bulk import</Link>{kind==="admin"&&<Link className="rm-btn-secondary" href={`${base}/review/`}><BookOpenCheck size={17}/> Review queue</Link>}<Link className="rm-btn-primary" href={`${base}/new/`}><Plus size={17}/> New question</Link></div></div>
  {(scopeError||error)&&<div style={{marginTop:14,padding:12,borderRadius:10,background:"#fef3f2",color:"#b42318"}}>{scopeError||error}</div>}
  <section className="q-stats" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:20}}>{[
   {label:"Total visible",value:stats.total,Icon:FileQuestion,color:"#131e35"},
   {label:"Approved",value:stats.approved,Icon:CheckCircle2,color:"#137a3a"},
   {label:"Awaiting review",value:stats.review,Icon:CircleAlert,color:"#8a5f00"},
   {label:kind==="admin"?"School private":"Private questions",value:stats.private,Icon:BookOpenCheck,color:"#6941c6"},
  ].map(({label,value,Icon,color})=><div className="rm-card" key={label} style={{padding:16}}><Icon size={20} color={color}/><strong style={{display:"block",fontSize:28,marginTop:8,color:"#131e35"}}>{value}</strong><span style={{fontSize:13,color:"#667085"}}>{label}</span></div>)}</section>
  <section className="rm-card" style={{padding:16,marginTop:16}}><div className="filters-grid" style={{display:"grid",gridTemplateColumns:"minmax(220px,1fr) repeat(3,minmax(150px,.35fr))",gap:10}}><div style={{position:"relative"}}><Search size={17} style={{position:"absolute",left:12,top:13,color:"#98a2b3"}}/><input className="rm-input" style={{paddingLeft:38}} placeholder="Search question, subject or tag" value={search} onChange={e=>setSearch(e.target.value)}/></div><select className="rm-input" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{["draft","in_review","approved","rejected","archived"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select><select className="rm-input" value={subject} onChange={e=>setSubject(e.target.value)}><option value="all">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="rm-input" value={scope} onChange={e=>setScope(e.target.value)}><option value="all">All ownership</option><option value="master">ScholarOS master</option><option value="private">School private</option></select></div></section>
  <section className="rm-card" style={{marginTop:16,overflow:"hidden"}}>{loading?<div style={{padding:36,textAlign:"center",color:"#667085"}}><LoaderCircle className="spin" size={22}/> Loading question bank…</div>:filtered.length===0?<div style={{padding:42,textAlign:"center"}}><Filter size={28} color="#98a2b3"/><h3>No matching questions</h3><p style={{color:"#667085"}}>Create a question or change the filters.</p></div>:<div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:920}}><thead><tr style={{textAlign:"left",background:"#f8fafc",color:"#667085"}}><th style={{padding:13}}>Question</th><th>Subject</th><th>Type</th><th>Difficulty</th><th>Ownership</th><th>Status</th><th>Marks</th><th>Version</th><th></th></tr></thead><tbody>{filtered.map(q=>{const style=statusStyle[q.status];const StatusIcon=style.icon;return <tr key={q.id} style={{borderTop:"1px solid #eef1f5"}}><td style={{padding:13,maxWidth:380}}><strong style={{display:"block",lineHeight:1.45}}>{q.stem_text}</strong><div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>{(q.exam_types||[]).slice(0,3).map(x=><span className="rm-badge" key={x} style={{padding:"3px 7px",background:"#f2f4f7"}}>{x}</span>)}</div></td><td>{q.subjects?.name||"Unclassified"}<div style={{fontSize:11,color:"#98a2b3",marginTop:3}}>{q.chapters?.name||"No chapter"}</div></td><td>{q.question_type.replaceAll("_"," ")}</td><td style={{textTransform:"capitalize"}}>{q.difficulty.replaceAll("_"," ")}</td><td><span className="rm-badge" style={{background:q.organization_id?"#f4ebff":"#fff6d8",color:q.organization_id?"#6941c6":"#775600"}}>{q.organization_id?"School":"ScholarOS"}</span></td><td><span className="rm-badge" style={{background:style.bg,color:style.color}}><StatusIcon size={13}/>{q.status.replaceAll("_"," ")}</span></td><td>{q.marks} / −{q.negative_marks}</td><td>v{q.version_number}</td><td>{!q.id.startsWith("demo")&&<Link href={`${base}/new/?id=${q.id}`} style={{display:"inline-flex",alignItems:"center",gap:5,fontWeight:750,color:"#775600"}}><Pencil size={15}/> Edit</Link>}</td></tr>})}</tbody></table></div>}</section>
  {!configured&&<div style={{marginTop:12,fontSize:12,color:"#667085"}}>Demo rows are shown because Supabase is not connected in this build.</div>}
  <style>{`@media(max-width:850px){.q-stats{grid-template-columns:repeat(2,1fr)!important}.filters-grid{grid-template-columns:1fr 1fr!important}}@media(max-width:520px){.q-stats,.filters-grid{grid-template-columns:1fr!important}}`}</style>
 </div>
}
