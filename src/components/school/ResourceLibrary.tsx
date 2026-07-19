"use client";
import { useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, FileText, GraduationCap, LockKeyhole, Search, ShieldCheck, Sparkles } from "lucide-react";
import { resourceEligibility } from "@/lib/schoolPlatform";
import { useSchoolPlatform } from "./useSchoolPlatform";

export function ResourceLibrary({studentMode=false}:{studentMode?:boolean}) {
  const {state,ready}=useSchoolPlatform(); const [studentId,setStudentId]=useState("st-1"); const [query,setQuery]=useState("");
  const student=state.students.find(s=>s.id===studentId)||state.students.find(s=>s.status==="active")||state.students[0];
  const resources=useMemo(()=>state.resources.filter(r=>(r.title+" "+r.subject+" "+r.kind).toLowerCase().includes(query.toLowerCase())),[state.resources,query]);
  if(!ready||!student)return <div className="so-card so-pad">Loading resources…</div>;
  const eligibleCount=resources.filter(r=>resourceEligibility(r,student,state.school.subscription).allowed).length;
  return <div><div className="so-page-head"><div><span className="so-kicker">SUBSCRIPTION RESOURCE LIBRARY</span><h1>{studentMode?"Your eligible resources":"Board, entrance and school resources"}</h1><p>“Complimentary” resources require an active annual subscription. Eligibility is evaluated per student.</p></div><span className="so-status success">{eligibleCount} eligible</span></div>
    {!studentMode&&<section className="so-card so-pad eligibility-selector"><div><span className="so-kicker">PREVIEW ACCESS AS</span><select className="so-input" value={studentId} onChange={e=>setStudentId(e.target.value)}>{state.students.map(s=><option key={s.id} value={s.id}>{s.name} · Grade {s.grade} · {s.status}</option>)}</select></div><div className="eligibility-profile"><strong>{student.name}</strong><span>{student.board} · Grade {student.grade}</span><div className="track-pills static">{student.tracks.map(t=><span key={t}>{t}</span>)}</div></div></section>}
    <div className="so-search so-mt"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search previous papers, NEET, JEE, KCET, Olympiad…"/></div>
    <div className="resource-grid so-mt">{resources.map(resource=>{const access=resourceEligibility(resource,student,state.school.subscription);return <article key={resource.id} className={`resource-card ${access.allowed?"":"locked"}`}><div className="resource-top"><span className={`so-label ${resource.accessLabel.toLowerCase()}`}>{resource.accessLabel}</span>{access.allowed?<CheckCircle2 className="access-ok"/>:<LockKeyhole className="access-lock"/>}</div><div className="resource-icon">{resource.kind==="school_test"?<FileText/>:resource.kind==="previous_year_board"?<BookOpenCheck/>:resource.kind==="olympiad"?<Sparkles/>:<GraduationCap/>}</div><h3>{resource.title}</h3><p>{resource.description}</p><div className="resource-meta"><span>{resource.subject}</span><span>Grades {resource.gradeMin}{resource.gradeMax!==resource.gradeMin?`–${resource.gradeMax}`:""}</span>{resource.board&&<span>{resource.board}</span>}{resource.track&&<span>{resource.track}</span>}</div>{access.allowed?<button className="so-btn so-btn-primary"><BookOpenCheck size={16}/> Open resource</button>:<div className="resource-lock-message"><ShieldCheck size={15}/>{access.reason}</div>}</article>})}</div>
    <div className="so-notice info so-mt"><Sparkles/><span><strong>Terminology used in the product:</strong> School-authored tests are shown as <b>Free</b> because no per-test charge applies. Previous-year papers are shown as <b>Complimentary</b> because they unlock only after an annual subscription is active.</span></div>
  </div>
}
