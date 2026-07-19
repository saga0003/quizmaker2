"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3, FileCheck2, LockKeyhole, Search, ShieldCheck, Users } from "lucide-react";
import { BenchmarkPrivacyNotice } from "./BenchmarkPrivacyNotice";
import { benchmarkPublications } from "@/lib/evidaraBenchmarks";
import { MetricInfo, MetricLabel } from "@/components/ui/MetricInfo";
import { metricDefinitions } from "@/lib/evidaraMetrics";

export function StudentBenchmarkWorkspace(){
  const [code,setCode]=useState("");
  const [message,setMessage]=useState("");
  const paper=benchmarkPublications[0];
  const myResult=paper.students[0];

  function findPaper(){
    const match=benchmarkPublications.find(item=>item.accessCode.toLowerCase()===code.trim().toLowerCase());
    setMessage(match?`Found: ${match.title} · ${match.paperVersion}`:"No active shared paper matches that access code.");
  }

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">V6.5 MY BENCHMARKS</span><h1>See where your result stands—without seeing anyone else</h1><p>Your school can share an exact paper version for wider participation. Evidara returns only anonymous comparison evidence.</p></div><span className="so-status success"><ShieldCheck size={14}/>Identity protected</span></div>
    <BenchmarkPrivacyNotice/>

    <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">JOIN A SHARED PAPER</span><h2>Enter the school-provided access code</h2></div><Search/></div><div className="benchmark-join"><input className="rm-input" value={code} onChange={event=>setCode(event.target.value)} placeholder="Example: EVI-SCI-2607"/><button className="so-btn so-btn-primary" onClick={findPaper}>Find paper</button></div>{message&&<div className="so-notice info so-mt">{message}</div>}</section>

    <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">LATEST SHARED RESULT</span><h2>{paper.title}</h2><small className="ev-evidence-window">{paper.paperVersion} · {paper.fingerprint}</small></div><FileCheck2/></div><div className="so-grid so-grid-4 so-mt"><div className="so-stat"><BarChart3/><strong>{myResult.score}</strong><span><MetricLabel {...metricDefinitions.score}>marks</MetricLabel></span></div><div className="so-stat"><BarChart3/><strong>{myResult.percentage}%</strong><span>percentage</span></div><div className="so-stat"><Users/><strong>{paper.validAttempts.toLocaleString("en-IN")}</strong><span><MetricLabel {...metricDefinitions.benchmark}>valid attempts</MetricLabel></span></div><div className="so-stat"><BarChart3/><strong>{paper.privacyReady&&myResult.networkPercentile!==null?`${myResult.networkPercentile}th`:"Hidden"}</strong><span><MetricLabel {...metricDefinitions.percentile}>anonymous percentile</MetricLabel></span></div></div></section>

    <div className="so-grid so-grid-2 so-mt"><section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">WHAT YOU CAN SEE</span><h2>Your result and aggregate context</h2></div><MetricInfo {...metricDefinitions.benchmark}/></div><div className="ev-segment-definition"><span>Available</span><p>Your score, percentage, anonymous percentile, network score bands and broad subject comparison when the privacy minimum is met.</p><span>Never available</span><p>Another student&apos;s name, school, score, answer sheet, phone number or contact details.</p></div></section><section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">PRIVACY THRESHOLD</span><h2>Comparison can remain hidden</h2></div><LockKeyhole/></div><p style={{color:"#6B7980",lineHeight:1.7}}>If fewer than {paper.minimumSample} valid attempts exist, your own result remains visible but the shared percentile and aggregate comparison stay locked.</p><Link href="/metric-guide/" className="rm-btn-secondary">Understand benchmark metrics</Link></section></div>
  </div>;
}
