"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3, FileQuestion, LoaderCircle, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase";

type Landing={
 available:boolean;reason?:string;benchmark_id?:string;paper_title?:string;paper_version?:number;exam_type?:string;
 duration_minutes?:number;total_marks?:number;total_questions?:number;minimum_sample_size?:number;
 snapshot?:{available?:boolean;valid_attempts?:number;minimum_sample_size?:number};
};

export function BenchmarkLanding({token}:{token:string}){
 const [landing,setLanding]=useState<Landing|null>(null);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");

 useEffect(()=>{void load()},[token]);
 async function load(){
  if(!supabase){setLanding({available:true,benchmark_id:"demo",paper_title:"NEET Full Syllabus Mock 01",paper_version:1,exam_type:"NEET",duration_minutes:180,total_marks:720,total_questions:180,minimum_sample_size:20,snapshot:{available:true,valid_attempts:12842,minimum_sample_size:20}});setLoading(false);return}
  const {data,error:loadError}=await supabase.rpc("get_shared_benchmark_landing",{p_share_token:token});
  if(loadError)setError(loadError.message);else setLanding(data as Landing);
  setLoading(false);
 }

 async function start(){
  if(!supabase){window.location.assign("/trial/");return}
  setBusy(true);setError("");
  const {data:session}=await supabase.auth.getSession();
  if(!session.session){
   localStorage.setItem("evidara_after_login",`/benchmark/${token}/`);
   window.location.assign("/login/");return;
  }
  const {data,error:startError}=await supabase.rpc("start_shared_benchmark_attempt",{p_share_token:token});
  if(startError){setError(startError.message);setBusy(false);return}
  const result=data as {attempt_id:string;benchmark_id:string};
  window.location.assign(`/student/tests/take/?attempt=${encodeURIComponent(result.attempt_id)}&benchmark=${encodeURIComponent(result.benchmark_id)}`);
 }

 if(loading)return <main className="ev-public-benchmark"><LoaderCircle className="spin"/><p>Loading the shared assessment…</p></main>;
 if(error&&!landing)return <main className="ev-public-benchmark"><Logo/><h1>Assessment unavailable</h1><p>{error}</p><Link href="/" className="rm-btn-secondary">Return to Evidara</Link></main>;
 if(!landing?.available)return <main className="ev-public-benchmark"><Logo/><ShieldCheck size={42}/><h1>This assessment is not open</h1><p>The sharing window may have closed or the school may have paused new attempts.</p><Link href="/" className="rm-btn-secondary">Return to Evidara</Link></main>;
 const attempts=landing.snapshot?.valid_attempts||0;
 return <main className="ev-public-benchmark"><section className="ev-benchmark-landing-card"><Logo/><span className="so-kicker">ANONYMOUS SHARED-PAPER BENCHMARK</span><h1>{landing.paper_title}</h1><p className="ev-benchmark-lead">Answer the exact same paper version as every other participant. Your identity, school and response sheet are never shown in the wider benchmark.</p><div className="ev-landing-metrics"><div><Clock3/><strong>{landing.duration_minutes}</strong><span>minutes</span></div><div><FileQuestion/><strong>{landing.total_questions}</strong><span>questions</span></div><div><strong>{landing.total_marks}</strong><span>maximum marks</span></div><div><Users/><strong>{attempts}</strong><span>valid attempts so far</span></div></div><div className="so-notice info"><ShieldCheck/><span>Aggregate comparison appears only after at least {landing.minimum_sample_size||20} valid completed attempts. No school leaderboard is created.</span></div>{error&&<div className="so-notice warning">{error}</div>}<button className="so-btn so-btn-primary" disabled={busy} onClick={()=>void start()}>{busy?<LoaderCircle className="spin" size={17}/>:<ArrowRight size={17}/>}Sign in and start assessment</button><small>Paper version {landing.paper_version} · {landing.exam_type}</small></section></main>;
}
