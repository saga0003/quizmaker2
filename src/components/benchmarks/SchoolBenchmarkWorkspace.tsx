"use client";

import { useMemo, useState } from "react";
import { BarChart3, Copy, EyeOff, FileCheck2, Globe2, LockKeyhole, School, ShieldCheck, Users } from "lucide-react";
import { BenchmarkPrivacyNotice } from "./BenchmarkPrivacyNotice";
import { MetricInfo, MetricLabel } from "@/components/ui/MetricInfo";
import { metricDefinitions } from "@/lib/evidaraMetrics";
import { BENCHMARK_PRIVACY_MINIMUM, benchmarkProgress, benchmarkPublications } from "@/lib/evidaraBenchmarks";

export function SchoolBenchmarkWorkspace(){
  const [selectedId,setSelectedId]=useState(benchmarkPublications[0].id);
  const [copied,setCopied]=useState(false);
  const selected=useMemo(()=>benchmarkPublications.find(item=>item.id===selectedId)||benchmarkPublications[0],[selectedId]);
  const progress=benchmarkProgress(selected);

  async function copyCode(){
    await navigator.clipboard?.writeText(selected.accessCode);
    setCopied(true);
    window.setTimeout(()=>setCopied(false),1500);
  }

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">V6.5 SHARED-PAPER BENCHMARKS</span><h1>Compare your cohort without exposing another school</h1><p>Use one exact paper version across schools and compare your private cohort with an anonymous aggregate.</p></div><span className="so-status success"><ShieldCheck size={14}/>Privacy minimum {BENCHMARK_PRIVACY_MINIMUM}</span></div>
    <BenchmarkPrivacyNotice/>

    <div className="benchmark-layout so-mt">
      <aside className="so-card benchmark-list"><div className="benchmark-list-head"><span className="so-kicker">SHARED PAPERS</span><strong>{benchmarkPublications.length} windows</strong></div>{benchmarkPublications.map(item=><button key={item.id} onClick={()=>setSelectedId(item.id)} className={item.id===selected.id?"active":""}><span><strong>{item.title}</strong><small>{item.paperVersion}</small></span><em className={`so-status ${item.privacyReady?"success":"warning"}`}>{item.privacyReady?"Aggregate ready":`${item.validAttempts}/${item.minimumSample}`}</em></button>)}</aside>

      <main className="benchmark-main">
        <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">EXACT PAPER VERSION</span><h2>{selected.title}</h2><small className="ev-evidence-window">{selected.paperVersion} · {selected.fingerprint}</small></div><span className={`so-status ${selected.shareStatus==="Published"?"success":"neutral"}`}>{selected.shareStatus}</span></div><div className="benchmark-code-row"><div><span>Student access code</span><strong>{selected.accessCode}</strong></div><button className="so-btn so-btn-secondary" onClick={()=>void copyCode()}><Copy size={16}/>{copied?"Copied":"Copy code"}</button></div><div className="benchmark-meta"><span><School/>Your school stays named only to you</span><span><Globe2/>External schools hidden</span><span><FileCheck2/>{selected.window}</span></div></section>

        <div className="so-grid so-grid-4 so-mt"><div className="so-stat"><Users/><strong>{selected.validAttempts.toLocaleString("en-IN")}</strong><span><MetricLabel {...metricDefinitions.benchmark}>valid attempts</MetricLabel></span></div><div className="so-stat"><School/><strong>{selected.participatingSchools}</strong><span>anonymous schools</span></div><div className="so-stat"><BarChart3/><strong>{selected.schoolAverage===null?"—":`${selected.schoolAverage}%`}</strong><span><MetricLabel {...metricDefinitions.score}>your cohort average</MetricLabel></span></div><div className="so-stat"><Globe2/><strong>{selected.networkAverage===null?"Locked":`${selected.networkAverage}%`}</strong><span><MetricLabel {...metricDefinitions.benchmark}>network average</MetricLabel></span></div></div>

        {!selected.privacyReady?<section className="so-card so-pad so-mt benchmark-locked"><EyeOff/><div><span className="so-kicker">AGGREGATE HIDDEN</span><h2>{selected.validAttempts} of {selected.minimumSample} valid attempts collected</h2><p>Your own school results remain available, but the cross-school aggregate stays hidden until the privacy minimum is reached.</p><div className="benchmark-progress"><i style={{width:`${progress}%`}}/></div></div></section>:<>
          <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">PRIVATE SCHOOL POSITION</span><h2>How your cohort compares</h2><small className="ev-evidence-window">Same paper version only</small></div><MetricInfo {...metricDefinitions.benchmark}/></div><div className="benchmark-comparison"><div><span>Your cohort average</span><strong>{selected.schoolAverage}%</strong><small>{selected.schoolAttempts} submitted students</small></div><div><span>Anonymous network average</span><strong>{selected.networkAverage}%</strong><small>{selected.participatingSchools} participating schools</small></div><div><span>Your cohort standing</span><strong>{selected.schoolPercentile}th</strong><small><MetricLabel {...metricDefinitions.percentile}>aggregate percentile</MetricLabel></small></div><div><span>Top-quartile cutoff</span><strong>{selected.topQuartileCutoff}%</strong><small>Same paper and window</small></div></div></section>

          <section className="so-card so-table-wrap so-mt"><div className="so-section-head so-pad"><div><span className="so-kicker">SCORE DISTRIBUTION</span><h2>Anonymous network bands</h2></div><MetricInfo {...metricDefinitions.benchmark}/></div><table className="so-table"><thead><tr><th>Score band</th><th>Network students</th><th>Your students</th><th>Your share</th></tr></thead><tbody>{selected.bands.map(band=><tr key={band.label}><td><strong>{band.label}</strong></td><td>{band.networkCount.toLocaleString("en-IN")}</td><td>{band.schoolCount}</td><td>{selected.schoolAttempts?`${Math.round((band.schoolCount/selected.schoolAttempts)*100)}%`:"—"}</td></tr>)}</tbody></table></section>

          <section className="so-card so-table-wrap so-mt"><div className="so-section-head so-pad"><div><span className="so-kicker">SUBJECT COMPARISON</span><h2>Where the cohort differs</h2></div><BarChart3/></div><table className="so-table"><thead><tr><th>Subject</th><th>Your average</th><th>Network average</th><th>Difference</th><th>Your accuracy</th><th>Network accuracy</th></tr></thead><tbody>{selected.subjects.map(subject=><tr key={subject.subject}><td><strong>{subject.subject}</strong></td><td>{subject.schoolAverage}%</td><td>{subject.networkAverage}%</td><td>{subject.schoolAverage-subject.networkAverage>=0?"+":""}{subject.schoolAverage-subject.networkAverage}</td><td>{subject.schoolAccuracy}%</td><td>{subject.networkAccuracy}%</td></tr>)}</tbody></table></section>
        </>}

        <section className="so-card so-table-wrap so-mt"><div className="so-section-head so-pad"><div><span className="so-kicker">YOUR PRIVATE COHORT</span><h2>Named students visible only to your school</h2></div><LockKeyhole/></div><table className="so-table"><thead><tr><th>Student</th><th>Status</th><th>Marks</th><th>Percentage</th><th>Network percentile</th></tr></thead><tbody>{selected.students.map(student=><tr key={student.id}><td><strong>{student.name}</strong><small>{student.id}</small></td><td><span className={`so-status ${student.status==="Submitted"?"success":"warning"}`}>{student.status}</span></td><td>{student.status==="Submitted"?student.score:"—"}</td><td>{student.status==="Submitted"?`${student.percentage}%`:"—"}</td><td>{selected.privacyReady&&student.networkPercentile!==null?`${student.networkPercentile}th`:"Hidden"}</td></tr>)}</tbody></table></section>
      </main>
    </div>
  </div>;
}
