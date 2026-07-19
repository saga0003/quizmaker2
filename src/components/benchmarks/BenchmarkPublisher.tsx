"use client";

import { useEffect, useMemo, useState } from "react";
import { FilePlus2, LoaderCircle, ShieldCheck } from "lucide-react";
import { benchmarkRequest, type BenchmarkPaperOption } from "@/lib/benchmarkClient";
import { isSupabaseConfigured } from "@/lib/supabase";

type Props = { onCreated?: (publicationId: string) => void };

function newAccessCode(){return `EVI-${Math.random().toString(36).slice(2,7).toUpperCase()}-${new Date().getFullYear().toString().slice(-2)}`}

export function BenchmarkPublisher({onCreated}:Props){
  const [open,setOpen]=useState(false);
  const [papers,setPapers]=useState<BenchmarkPaperOption[]>([]);
  const [paperId,setPaperId]=useState("");
  const [title,setTitle]=useState("");
  const [paperVersion,setPaperVersion]=useState("Version 1.0");
  const [gradeLabel,setGradeLabel]=useState("Grade 10");
  const [preparationTrack,setPreparationTrack]=useState("School assessment");
  const [accessCode,setAccessCode]=useState(newAccessCode);
  const [opensAt,setOpensAt]=useState("");
  const [closesAt,setClosesAt]=useState("");
  const [publishNow,setPublishNow]=useState(true);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!isSupabaseConfigured)return;
    void benchmarkRequest<{papers:BenchmarkPaperOption[]}>("?includePapers=true")
      .then(payload=>{setPapers(payload.papers||[]);if(payload.papers?.[0]){setPaperId(payload.papers[0].id);setTitle(payload.papers[0].title);}})
      .catch(reason=>setError(reason instanceof Error?reason.message:"Could not load published papers."));
  },[]);

  const selectedPaper=useMemo(()=>papers.find(paper=>paper.id===paperId),[papers,paperId]);

  async function publish(event:React.FormEvent){
    event.preventDefault();setSaving(true);setError("");setMessage("");
    try{
      if(!isSupabaseConfigured){
        setMessage(`Demo draft created with access code ${accessCode}. Connect Supabase to store and publish it.`);
        return;
      }
      if(!paperId)throw new Error("Select a published question paper.");
      const created=await benchmarkRequest<{publicationId:string}>("",{method:"POST",body:JSON.stringify({
        action:"create",paperId,title,paperVersion,gradeLabel,preparationTrack,accessCode,
        opensAt:opensAt?new Date(opensAt).toISOString():null,
        closesAt:closesAt?new Date(closesAt).toISOString():null,
      })});
      if(publishNow){
        await benchmarkRequest("",{method:"POST",body:JSON.stringify({action:"publish",publicationId:created.publicationId})});
      }
      setMessage(`${publishNow?"Published":"Draft created"} successfully. Student code: ${accessCode}`);
      onCreated?.(created.publicationId);
      setAccessCode(newAccessCode());
    }catch(reason){setError(reason instanceof Error?reason.message:"Benchmark publication failed.");}
    finally{setSaving(false)}
  }

  return <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">SHARE A SCHOOL PAPER</span><h2>Create a live anonymous benchmark window</h2><p style={{color:"#6B7980",margin:"5px 0 0"}}>Evidara calculates the fingerprint from the selected published paper and records real submitted attempts automatically.</p></div><button className="so-btn so-btn-primary" onClick={()=>setOpen(value=>!value)}><FilePlus2 size={16}/>{open?"Close":"Publish a paper"}</button></div>{open&&<form className="benchmark-publish-form" onSubmit={publish}>
    <label><span className="rm-label">Published question paper</span><select className="rm-input" value={paperId} onChange={event=>{const id=event.target.value;setPaperId(id);const paper=papers.find(item=>item.id===id);if(paper)setTitle(paper.title)}} required={isSupabaseConfigured}><option value="">Select a paper</option>{papers.map(paper=><option value={paper.id} key={paper.id}>{paper.title} · {paper.total_marks} marks</option>)}</select>{isSupabaseConfigured&&papers.length===0&&<small>No published school papers are available yet.</small>}</label>
    <label><span className="rm-label">Benchmark title</span><input className="rm-input" value={title} onChange={event=>setTitle(event.target.value)} placeholder="Common Science Assessment" required/></label>
    <label><span className="rm-label">Exact version label</span><input className="rm-input" value={paperVersion} onChange={event=>setPaperVersion(event.target.value)} required/></label>
    <label><span className="rm-label">Grade</span><input className="rm-input" value={gradeLabel} onChange={event=>setGradeLabel(event.target.value)}/></label>
    <label><span className="rm-label">Preparation track</span><input className="rm-input" value={preparationTrack} onChange={event=>setPreparationTrack(event.target.value)}/></label>
    <label><span className="rm-label">Student access code</span><input className="rm-input" value={accessCode} onChange={event=>setAccessCode(event.target.value.toUpperCase())} minLength={6} required/></label>
    <label><span className="rm-label">Opens at</span><input type="datetime-local" className="rm-input" value={opensAt} onChange={event=>setOpensAt(event.target.value)}/></label>
    <label><span className="rm-label">Closes at</span><input type="datetime-local" className="rm-input" value={closesAt} onChange={event=>setClosesAt(event.target.value)}/></label>
    <label className="benchmark-check"><input type="checkbox" checked={publishNow} onChange={event=>setPublishNow(event.target.checked)}/><span>Publish immediately after creating the verified draft</span></label>
    <div className="so-notice info"><ShieldCheck/><span>{selectedPaper?`${selectedPaper.total_questions} questions · ${selectedPaper.total_marks} marks · ${selectedPaper.duration_minutes} minutes. `:""}Any content or scoring change creates a different fingerprint and requires a new benchmark.</span></div>
    <button className="so-btn so-btn-primary" type="submit" disabled={saving}>{saving?<LoaderCircle className="spin" size={17}/>:<FilePlus2 size={17}/>} {publishNow?"Create and publish":"Create benchmark draft"}</button>
  </form>}{error&&<div className="so-notice error so-mt">{error}</div>}{message&&<div className="so-notice success so-mt">{message}</div>}</section>;
}
