"use client";

import { useEffect, useState } from "react";
import { BarChart3, FileCheck2, LoaderCircle, LockKeyhole, ShieldCheck } from "lucide-react";
import { benchmarkRequest, type CloudBenchmarkPublication } from "@/lib/benchmarkClient";

export function CloudBenchmarkGovernance(){
  const [items,setItems]=useState<CloudBenchmarkPublication[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{
    void benchmarkRequest<{publications:CloudBenchmarkPublication[]}>("")
      .then(payload=>setItems(payload.publications||[]))
      .catch(reason=>setError(reason instanceof Error?reason.message:"Could not load benchmark governance data."))
      .finally(()=>setLoading(false));
  },[]);

  const published=items.filter(item=>item.status==="published").length;
  const closed=items.filter(item=>item.status==="closed").length;

  return <div>
    <div className="so-page-head"><div><span className="so-kicker">V6.6 BENCHMARK GOVERNANCE</span><h1>Live paper versions and disclosure controls</h1><p>Review every cloud benchmark publication, its exact fingerprint, sample rules and current lifecycle state.</p></div><span className="so-status success"><ShieldCheck size={14}/>Server aggregated</span></div>
    {error&&<div className="so-notice error">{error}</div>}
    <div className="so-grid so-grid-4"><div className="so-stat"><FileCheck2/><strong>{items.length}</strong><span>paper versions</span></div><div className="so-stat"><BarChart3/><strong>{published}</strong><span>published windows</span></div><div className="so-stat"><LockKeyhole/><strong>{closed}</strong><span>closed windows</span></div><div className="so-stat"><ShieldCheck/><strong>20 / 3 / 10</strong><span>attempts / schools / cell floor</span></div></div>
    <section className="so-card so-table-wrap so-mt">{loading?<div className="so-empty"><LoaderCircle className="spin"/> Loading cloud publications</div>:<table className="so-table"><thead><tr><th>Publication</th><th>Version</th><th>Fingerprint</th><th>Status</th><th>Privacy attempts</th><th>Privacy schools</th><th>Small-cell floor</th><th>Window</th></tr></thead><tbody>{items.map(item=><tr key={item.id}><td><strong>{item.title}</strong><small>{item.grade_label||"All eligible grades"}</small></td><td>{item.paper_version}</td><td>{item.version_fingerprint.slice(0,18)}…</td><td><span className={`so-status ${item.status==="published"?"success":item.status==="draft"?"warning":"neutral"}`}>{item.status}</span></td><td>{item.privacy_minimum}</td><td>{item.privacy_minimum_schools}</td><td>{item.small_cell_minimum}</td><td>{item.opens_at?new Date(item.opens_at).toLocaleDateString("en-IN"):"Immediate"} – {item.closes_at?new Date(item.closes_at).toLocaleDateString("en-IN"):"Open"}</td></tr>)}</tbody></table>}</section>
    <div className="so-notice info so-mt"><ShieldCheck/><span>Raw contribution rows remain server-only. This workspace receives publication metadata, not external student identities or school-level response records.</span></div>
  </div>;
}
