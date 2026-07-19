"use client";

import { useState } from "react";
import { FilePlus2, ShieldCheck } from "lucide-react";

export function BenchmarkPublisher(){
  const [open,setOpen]=useState(false);
  const [title,setTitle]=useState("Grade 10 Science Common Assessment");
  const [paperVersion,setPaperVersion]=useState("Version 1.0 · 80 marks · 90 minutes");
  const [fingerprint,setFingerprint]=useState("EV-SCI10-2607-A91F");
  const [message,setMessage]=useState("");

  function publish(event:React.FormEvent){
    event.preventDefault();
    const code=`EVI-${Math.random().toString(36).slice(2,6).toUpperCase()}-${new Date().getFullYear().toString().slice(-2)}`;
    setMessage(`Draft created with access code ${code}. The aggregate will remain hidden until 20 valid attempts are collected.`);
  }

  return <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">SHARE A SCHOOL PAPER</span><h2>Create an anonymous benchmark window</h2><p style={{color:"#6B7980",margin:"5px 0 0"}}>The paper remains your school&apos;s test. Evidara shares only its access window and privacy-thresholded aggregate.</p></div><button className="so-btn so-btn-primary" onClick={()=>setOpen(value=>!value)}><FilePlus2 size={16}/>{open?"Close":"Publish a paper"}</button></div>{open&&<form className="benchmark-publish-form" onSubmit={publish}><label><span className="rm-label">Paper title</span><input className="rm-input" value={title} onChange={event=>setTitle(event.target.value)} required/></label><label><span className="rm-label">Exact version description</span><input className="rm-input" value={paperVersion} onChange={event=>setPaperVersion(event.target.value)} required/></label><label><span className="rm-label">Version fingerprint</span><input className="rm-input" value={fingerprint} onChange={event=>setFingerprint(event.target.value)} required/></label><div className="so-notice info"><ShieldCheck/><span>Any change to a question, mark, scoring rule, option order or duration requires a new fingerprint and separate benchmark.</span></div><button className="so-btn so-btn-primary" type="submit">Create benchmark draft</button></form>}{message&&<div className="so-notice success so-mt">{message}</div>}</section>;
}
