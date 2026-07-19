"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, CalendarClock, ClipboardCheck, Eye, FilePlus2, GitCompareArrows, LoaderCircle, Pencil, PlayCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PaperListRow, PaperStatus } from "@/types/papers";
import { useQuestionScope } from "@/components/questions/useQuestionScope";
import { SortableDataTable, type DataColumn } from "@/components/ui/SortableDataTable";
import { MetricInfo } from "@/components/ui/MetricInfo";
import { metricDefinitions } from "@/lib/evidaraMetrics";

const now=new Date().toISOString();
const demo:PaperListRow[]=[
 {id:"demo-paper",organization_id:null,title:"NEET Full Syllabus Mock 01",code:"NEET-M01",description:"Shared benchmark paper",exam_type:"NEET",status:"published",duration_minutes:180,total_marks:720,total_questions:180,access_mode:"public",available_from:null,available_until:null,attempt_limit:1,result_mode:"score_only",created_at:now,updated_at:now},
 {id:"demo-paper-2",organization_id:null,title:"Physics Unit Test 04",code:"PHY-U04",description:"School unit test",exam_type:"School",status:"draft",duration_minutes:60,total_marks:100,total_questions:40,access_mode:"code",available_from:null,available_until:null,attempt_limit:1,result_mode:"score_and_answers",created_at:now,updated_at:now},
 {id:"demo-paper-3",organization_id:null,title:"KCET Mathematics Mock",code:"KCET-M02",description:"Entrance practice",exam_type:"KCET",status:"archived",duration_minutes:80,total_marks:60,total_questions:60,access_mode:"organization",available_from:null,available_until:null,attempt_limit:2,result_mode:"score_only",created_at:now,updated_at:now},
];

export function QuestionPaperList({kind}:{kind:"admin"|"school"}){
  const {organizationId,organizationName,loading:scopeLoading,error:scopeError}=useQuestionScope(kind);
  const [papers,setPapers]=useState<PaperListRow[]>([]);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  const base=kind==="admin"?"/admin/papers":"/school/papers";

  async function load(){
    if(!supabase){setPapers(demo);setLoading(false);return}
    if(kind==="school"&&scopeLoading)return;
    setLoading(true);setError("");
    let query=supabase.from("question_papers").select("id,organization_id,title,code,description,exam_type,status,duration_minutes,total_marks,total_questions,access_mode,available_from,available_until,attempt_limit,result_mode,created_at,updated_at").order("updated_at",{ascending:false});
    query=kind==="admin"?query.is("organization_id",null):query.eq("organization_id",organizationId!);
    const {data,error:loadError}=await query;
    if(loadError)setError(loadError.message);else setPapers((data||[]) as PaperListRow[]);
    setLoading(false);
  }

  useEffect(()=>{void load()},[kind,organizationId,scopeLoading]);

  async function setPaperStatus(id:string,next:PaperStatus){
    if(!supabase)return;
    const {error:statusError}=await supabase.rpc("set_question_paper_status",{p_paper_id:id,p_status:next});
    if(statusError)setError(statusError.message);else await load();
  }

  const stats={total:papers.length,published:papers.filter(p=>p.status==="published").length,drafts:papers.filter(p=>p.status==="draft").length,questions:papers.reduce((sum,paper)=>sum+paper.total_questions,0)};

  const columns=useMemo<DataColumn<PaperListRow>[]>(()=>[
    {key:"title",label:"Paper",value:paper=>paper.title,render:paper=><div><div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap"}}><strong>{paper.title}</strong>{kind==="school"&&<span className="so-label free">FREE</span>}</div><small>{paper.code||"No paper code"}</small></div>},
    {key:"exam",label:"Exam",value:paper=>paper.exam_type,filter:{label:"exam types",value:paper=>paper.exam_type}},
    {key:"questions",label:"Questions",value:paper=>paper.total_questions,align:"right"},
    {key:"marks",label:"Marks",value:paper=>paper.total_marks,align:"right"},
    {key:"duration",label:"Duration",value:paper=>paper.duration_minutes,render:paper=>`${paper.duration_minutes} min`,align:"right"},
    {key:"access",label:"Access",value:paper=>paper.access_mode,render:paper=><span style={{textTransform:"capitalize"}}>{paper.access_mode}</span>,filter:{label:"access modes",value:paper=>paper.access_mode}},
    {key:"status",label:"Status",value:paper=>paper.status,render:paper=><span className={`so-status ${paper.status==="published"?"success":"neutral"}`}>{paper.status}</span>,filter:{label:"statuses",value:paper=>paper.status}},
    {key:"benchmark",label:<span className="ev-metric-label">Benchmark<MetricInfo {...metricDefinitions.benchmark}/></span>,value:paper=>paper.status==="published"&&paper.access_mode==="public",render:paper=>paper.status==="published"&&paper.access_mode==="public"?<Link href="/school/benchmarks/" className="ev-segment-pill"><GitCompareArrows size={14}/> Shared</Link>:<span style={{color:"#AEB8BC"}}>Not shared</span>},
    {key:"actions",label:"Actions",value:paper=>paper.updated_at,sortable:false,render:paper=><div className="so-action-row">{paper.id.startsWith("demo")?<><Link href={`${base}/preview/?id=${paper.id}`} title="Preview" className="rm-btn-secondary" style={{padding:"8px 10px"}}><Eye size={15}/></Link>{kind==="school"&&paper.status==="published"&&<Link href="/school/benchmarks/" title="Benchmark" className="rm-btn-secondary" style={{padding:"8px 10px"}}><GitCompareArrows size={15}/></Link>}</>:<><Link href={`${base}/new/?id=${paper.id}`} title="Edit" className="rm-btn-secondary" style={{padding:"8px 10px"}}><Pencil size={15}/></Link><Link href={`${base}/preview/?id=${paper.id}`} title="Preview" className="rm-btn-secondary" style={{padding:"8px 10px"}}><Eye size={15}/></Link>{paper.status!=="published"?<button title="Publish" className="rm-btn-secondary" style={{padding:"8px 10px",color:"#237A57"}} onClick={()=>void setPaperStatus(paper.id,"published")}><PlayCircle size={15}/></button>:<button title="Archive" className="rm-btn-secondary" style={{padding:"8px 10px"}} onClick={()=>void setPaperStatus(paper.id,"archived")}><Archive size={15}/></button>}</>}</div>},
  ],[base,kind]);

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">{organizationName} · EVIDARA ASSESSMENTS</span><h1>Tests and question papers</h1><p>Build, schedule and publish assessments. Click any table heading to sort; use filters to narrow by exam, access or status. Public published papers can become anonymous shared benchmarks.</p></div><Link className="so-btn so-btn-primary" href={`${base}/new/`}><FilePlus2 size={18}/>Create question paper</Link></div>
    {(scopeError||error)&&<div className="so-notice warning">{scopeError||error}</div>}
    <section className="paper-stats" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:18}}>{[["Total papers",stats.total],["Published",stats.published],["Drafts",stats.drafts],["Questions placed",stats.questions]].map(([label,value])=><div className="so-card so-pad" key={String(label)}><strong style={{fontSize:28,color:"#14232B"}}>{value}</strong><div style={{fontSize:13,color:"#6B7980",marginTop:5}}>{label}</div></div>)}</section>
    <section className="so-card so-pad so-mt">{loading?<div style={{padding:40,textAlign:"center",color:"#6B7980"}}><LoaderCircle className="spin"/> Loading papers…</div>:papers.length===0?<div style={{padding:45,textAlign:"center"}}><ClipboardCheck size={30} color="#AEB8BC"/><h3>No question papers yet</h3><p style={{color:"#6B7980"}}>Create your first paper using approved questions from the question bank.</p></div>:<SortableDataTable rows={papers} columns={columns} rowKey={paper=>paper.id} searchText={paper=>`${paper.title} ${paper.code||""} ${paper.exam_type} ${paper.status} ${paper.access_mode}`} searchPlaceholder="Search paper, code, exam, status or access" initialSortKey="title"/>}</section>
    <div style={{marginTop:13,fontSize:12,color:"#6B7980",display:"flex",alignItems:"center",gap:6}}><CalendarClock size={14}/>FREE means no additional per-test fee within the active annual school subscription. Shared benchmark results remain aggregate and privacy-thresholded.</div>
    <style>{`@media(max-width:760px){.paper-stats{grid-template-columns:1fr 1fr!important}}@media(max-width:480px){.paper-stats{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
