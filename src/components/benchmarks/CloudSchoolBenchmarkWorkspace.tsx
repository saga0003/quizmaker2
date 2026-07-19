"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, TriangleAlert, Users } from "lucide-react";
import { BenchmarkPrivacyNotice } from "./BenchmarkPrivacyNotice";
import { BenchmarkPublisher } from "./BenchmarkPublisher";
import { benchmarkRequest, type CloudBenchmarkCohortRow, type CloudBenchmarkPublication, type CloudBenchmarkSummary } from "@/lib/benchmarkClient";

export function CloudSchoolBenchmarkWorkspace(){
  const [items,setItems]=useState<CloudBenchmarkPublication[]>([]);
  const [selectedId,setSelectedId]=useState("");
  const [summary,setSummary]=useState<CloudBenchmarkSummary|null>(null);
  const [cohort,setCohort]=useState<CloudBenchmarkCohortRow[]>([]);
  const [canManage,setCanManage]=useState(false);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState("");
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  const loadList=useCallback(async(preferred?:string)=>{
    setLoading(true);setError("");
    try{
      const payload=await benchmarkRequest<{publications:CloudBenchmarkPublication[]}>("");
      const next=payload.publications||[];
      setItems(next);
      setSelectedId(preferred&&next.some(item=>item.id===preferred)?preferred:next[0]?.id||"");
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not load benchmarks.");}
    finally{setLoading(false)}
  },[]);

  const loadDetail=useCallback(async(id:string)=>{
    if(!id)return;
    try{
      const payload=await benchmarkRequest<{summary:CloudBenchmarkSummary;cohort:CloudBenchmarkCohortRow[];canManage:boolean}>(`?publicationId=${encodeURIComponent(id)}&includeCohort=true`);
      setSummary(payload.summary);setCohort(payload.cohort||[]);setCanManage(Boolean(payload.canManage));
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not load benchmark evidence.");}
  },[]);

  useEffect(()=>{void loadList()},[loadList]);
  useEffect(()=>{if(selectedId)void loadDetail(selectedId);else{setSummary(null);setCohort([])}},[selectedId,loadDetail]);

  async function run(action:"publish"|"close"|"backfill"){
    if(!selectedId)return;setWorking(action);setError("");setNotice("");
    try{
      const result=await benchmarkRequest<{status?:string;contributionsAdded?:number}>("",{method:"POST",body:JSON.stringify({action,publicationId:selectedId})});
      setNotice(action==="backfill"?`${result.contributionsAdded||0} submitted attempts added or refreshed.`:`Benchmark changed to ${result.status}.`);
      await loadList(selectedId);await loadDetail(selectedId);
    }catch(reason){setError(reason instanceof Error?reason.message:"Benchmark action failed.");}
    finally{setWorking("")}
  }

  async function reviewContribution(row:CloudBenchmarkCohortRow,action:"invalidate"|"restore"){
    if(!row.contribution_id)return;
    const confirmed=window.confirm(action==="invalidate"?`Exclude ${row.student_name}'s attempt from benchmark aggregates?`: `Restore ${row.student_name}'s manually excluded attempt?`);
    if(!confirmed)return;
    setWorking(row.contribution_id);setError("");setNotice("");
    try{
      await benchmarkRequest("",{method:"POST",body:JSON.stringify({action,contributionId:row.contribution_id,reason:action==="invalidate"?"manually_invalidated":null})});
      setNotice(action==="invalidate"?"Contribution excluded after school review.":"Contribution restored after school review.");
      await loadDetail(selectedId);
    }catch(reason){setError(reason instanceof Error?reason.message:"Contribution review failed.");}
    finally{setWorking("")}
  }

  const selected=items.find(item=>item.id===selectedId)||null;

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">V6.6 LIVE BENCHMARK OPERATIONS</span><h1>Real submissions and automatic contribution checks</h1><p>Completed attempts are attached to the exact paper version and included only after school-membership, timing and integrity checks.</p></div><span className="so-status success"><ShieldCheck size={14}/>Cloud connected</span></div>
    <BenchmarkPrivacyNotice/>
    <BenchmarkPublisher onCreated={id=>void loadList(id)}/>
    {error&&<div className="so-notice error so-mt">{error}</div>}{notice&&<div className="so-notice success so-mt">{notice}</div>}

    <div className="benchmark-layout so-mt">
      <aside className="so-card benchmark-list"><div className="benchmark-list-head"><span className="so-kicker">VISIBLE PUBLICATIONS</span><strong>{items.length} paper versions</strong></div>{loading?<div className="so-empty"><LoaderCircle className="spin"/> Loading</div>:items.map(item=><button key={item.id} className={selectedId===item.id?"active":""} onClick={()=>setSelectedId(item.id)}><span><strong>{item.title}</strong><small>{item.paper_version}</small></span><em className={`so-status ${item.status==="published"?"success":item.status==="draft"?"warning":"neutral"}`}>{item.can_manage?item.status:"Participated"}</em></button>)}</aside>

      <main className="benchmark-main">{selected&&<>
        <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">EXACT VERSION</span><h2>{selected.title}</h2><small>{selected.version_fingerprint.slice(0,20)}…</small></div><span className="so-status neutral">{selected.status}</span></div><div className="benchmark-code-row"><div><span>{selected.can_manage?"Student access code":"Participation mode"}</span><strong>{selected.access_code||"Code retained by publisher"}</strong></div>{selected.can_manage&&<div className="so-action-row">{selected.status==="draft"&&<button className="so-btn so-btn-primary" disabled={Boolean(working)} onClick={()=>void run("publish")}>Publish</button>}{selected.status==="published"&&<button className="so-btn so-btn-secondary" disabled={Boolean(working)} onClick={()=>void run("close")}>Close</button>}<button className="so-btn so-btn-secondary" disabled={Boolean(working)} onClick={()=>void run("backfill")}><RefreshCw size={15}/>Refresh submissions</button></div>}</div></section>

        <div className="so-grid so-grid-4 so-mt"><div className="so-stat"><Users/><strong>{summary?.school_attempts??0}</strong><span>valid school attempts</span></div><div className="so-stat"><BarChart3/><strong>{summary?.school_average==null?"—":`${summary.school_average}%`}</strong><span>school average</span></div><div className="so-stat"><Users/><strong>{summary?.external_valid_attempts??0}</strong><span>external attempts</span></div><div className="so-stat"><BarChart3/><strong>{summary?.network_average==null?"Locked":`${summary.network_average}%`}</strong><span>external average</span></div></div>

        {!summary?.privacy_ready&&<section className="so-card so-pad so-mt benchmark-locked"><LockKeyhole/><div><span className="so-kicker">COMPARISON LOCKED</span><h2>Waiting for the privacy minimum</h2><p>{summary?.external_valid_attempts??0} of {selected.privacy_minimum} external attempts are available. At least {selected.privacy_minimum_schools} external schools are also required.</p></div></section>}

        {summary?.privacy_ready&&<section className="so-card so-table-wrap so-mt"><div className="so-section-head so-pad"><div><span className="so-kicker">ANONYMOUS DISTRIBUTION</span><h2>External score bands</h2></div><ShieldCheck/></div><table className="so-table"><thead><tr><th>Score band</th><th>External students</th><th>Disclosure</th></tr></thead><tbody>{summary.distribution.map(band=><tr key={band.label}><td><strong>{band.label}</strong></td><td>{band.suppressed?"Hidden":band.count}</td><td><span className={`so-status ${band.suppressed?"warning":"success"}`}>{band.suppressed?"Small cell suppressed":"Aggregate visible"}</span></td></tr>)}</tbody></table></section>}

        <section className="so-card so-table-wrap so-mt"><div className="so-section-head so-pad"><div><span className="so-kicker">YOUR PRIVATE COHORT</span><h2>Submitted benchmark attempts</h2><small>{summary?.school_invalid_attempts??0} attempts currently excluded</small></div></div><table className="so-table"><thead><tr><th>Student</th><th>Submitted</th><th>Score</th><th>Percentage</th><th>Events</th><th>Validation</th><th>Actions</th></tr></thead><tbody>{cohort.map(row=><tr key={row.id}><td><strong>{row.student_name}</strong></td><td>{new Date(row.submitted_at).toLocaleString("en-IN")}</td><td>{row.score}/{row.maximum_marks}</td><td>{row.percentage}%</td><td>{row.violation_count}</td><td>{row.is_valid?<span className="so-status success"><CheckCircle2 size={13}/>Included</span>:<span className="so-status warning"><TriangleAlert size={13}/>{row.exclusion_reason?.replaceAll("_"," ")||"Pending"}</span>}</td><td>{row.contribution_id?(row.is_valid?<button className="so-btn so-btn-small so-btn-secondary" disabled={working===row.contribution_id} onClick={()=>void reviewContribution(row,"invalidate")}>Exclude</button>:row.exclusion_reason==="manually_invalidated"?<button className="so-btn so-btn-small so-btn-secondary" disabled={working===row.contribution_id} onClick={()=>void reviewContribution(row,"restore")}>Restore</button>:<span className="so-status neutral">Super Admin review</span>):<span className="so-status neutral">Sync pending</span>}</td></tr>)}</tbody></table>{cohort.length===0&&<div className="so-empty">No submitted benchmark attempts yet.</div>}</section>

        {!canManage&&<div className="so-notice info so-mt"><LockKeyhole/><span>This benchmark was published by another school. You can review only your own cohort and the anonymous external comparison; publication controls and its access code remain private to the publisher.</span></div>}
      </>}</main>
    </div>
  </div>;
}
