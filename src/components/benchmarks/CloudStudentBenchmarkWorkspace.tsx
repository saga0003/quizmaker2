"use client";

import { useEffect, useState } from "react";
import { BarChart3, LoaderCircle, LockKeyhole, Search, ShieldCheck, Users } from "lucide-react";
import { BenchmarkPrivacyNotice } from "./BenchmarkPrivacyNotice";
import { benchmarkRequest, type CloudBenchmarkPublication } from "@/lib/benchmarkClient";

type StudentResult = {
  publication_id: string;
  attempt_id: string;
  score: number;
  maximum_score: number;
  percentage: number;
  is_valid: boolean;
  exclusion_reason: string | null;
  submitted_at: string;
  privacy_ready: boolean;
  network_percentile: number | null;
  external_valid_attempts: number;
};

export function CloudStudentBenchmarkWorkspace(){
  const [items,setItems]=useState<CloudBenchmarkPublication[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [result,setResult]=useState<StudentResult|null>(null);
  const [code,setCode]=useState("");
  const [loading,setLoading]=useState(true);
  const [joining,setJoining]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{
    void benchmarkRequest<{publications:CloudBenchmarkPublication[]}>("")
      .then(payload=>{const next=payload.publications||[];setItems(next);setSelectedId(next[0]?.id||"")})
      .catch(reason=>setError(reason instanceof Error?reason.message:"Could not load shared benchmarks."))
      .finally(()=>setLoading(false));
  },[]);

  useEffect(()=>{
    if(!selectedId){setResult(null);return;}
    void benchmarkRequest<{result:StudentResult|null}>(`?publicationId=${encodeURIComponent(selectedId)}&mine=true`)
      .then(payload=>setResult(payload.result))
      .catch(reason=>setError(reason instanceof Error?reason.message:"Could not load your benchmark result."));
  },[selectedId]);

  async function join(){
    if(!code.trim())return;setJoining(true);setError("");
    try{
      const payload=await benchmarkRequest<{attempt_id?:string;attemptId?:string}>("",{method:"POST",body:JSON.stringify({action:"join",accessCode:code.trim()})});
      const attempt=payload.attempt_id||payload.attemptId;
      if(!attempt)throw new Error("The benchmark attempt could not be started.");
      window.location.href=`/student/tests/take/?attempt=${encodeURIComponent(attempt)}`;
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not join this benchmark.");setJoining(false)}
  }

  const selected=items.find(item=>item.id===selectedId)||null;

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">V6.6 LIVE SHARED BENCHMARKS</span><h1>Join with a code and submit a real benchmark attempt</h1><p>Your completed test is automatically checked and compared only after the anonymous external sample reaches the privacy minimum.</p></div><span className="so-status success"><ShieldCheck size={14}/>Cloud protected</span></div>
    <BenchmarkPrivacyNotice/>

    <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">JOIN A BENCHMARK</span><h2>Enter the code shared by your school</h2></div><Search/></div><div className="benchmark-join"><input className="rm-input" value={code} onChange={event=>setCode(event.target.value.toUpperCase())} placeholder="EVI-SCI-2607"/><button className="so-btn so-btn-primary" disabled={joining} onClick={()=>void join()}>{joining?<LoaderCircle className="spin" size={17}/>:<Search size={17}/>}Start benchmark</button></div>{error&&<div className="so-notice error so-mt">{error}</div>}</section>

    <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">MY SHARED RESULTS</span><h2>Select a paper version</h2></div></div>{loading?<div className="so-empty">Loading…</div>:<select className="rm-input" value={selectedId} onChange={event=>setSelectedId(event.target.value)}><option value="">Select benchmark</option>{items.map(item=><option key={item.id} value={item.id}>{item.title} · {item.paper_version}</option>)}</select>}</section>

    {selected&&<section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">{selected.title}</span><h2>{result?"Your submitted evidence":"No submitted attempt yet"}</h2><small>{selected.paper_version}</small></div><BarChart3/></div>{result?<><div className="so-grid so-grid-4 so-mt"><div className="so-stat"><BarChart3/><strong>{result.score}/{result.maximum_score}</strong><span>score</span></div><div className="so-stat"><BarChart3/><strong>{result.percentage}%</strong><span>percentage</span></div><div className="so-stat"><Users/><strong>{result.external_valid_attempts}</strong><span>external attempts</span></div><div className="so-stat"><BarChart3/><strong>{result.privacy_ready&&result.network_percentile!==null?`${result.network_percentile}th`:"Locked"}</strong><span>anonymous percentile</span></div></div>{!result.is_valid&&<div className="so-notice warning so-mt">This attempt was excluded from the aggregate: {result.exclusion_reason||"validation review"}.</div>}{!result.privacy_ready&&<div className="so-notice info so-mt"><LockKeyhole/><span>Your score remains visible. The external percentile stays hidden until enough other schools and students have completed this exact paper.</span></div>}</>:<p style={{color:"#6B7980",lineHeight:1.7}}>Use the benchmark access code to start the exact paper. Your first submitted attempt becomes the benchmark contribution.</p>}</section>}
  </div>;
}
