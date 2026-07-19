"use client";
import {LoaderCircle,Plus,RefreshCw,Share2,ShieldCheck} from "lucide-react";
import {useQuestionScope} from "@/components/questions/useQuestionScope";
import {supabase} from "@/lib/supabase";
import {BenchmarkDemo} from "./BenchmarkDemo";
import {BenchmarkLiveHero} from "./BenchmarkLiveHero";
import {BenchmarkLiveTables} from "./BenchmarkLiveTables";
import {useSharedBenchmark} from "./useSharedBenchmark";
export function SharedBenchmark(){
 const{organizationId,organizationName,loading:scopeLoading,error:scopeError}=useQuestionScope("school");
 const data=useSharedBenchmark(organizationId,scopeLoading);
 if(!supabase)return <><div className="so-page-head"><div><span className="so-kicker">ANONYMOUS SHARED-PAPER BENCHMARK</span><h1>Compare the same evidence, without exposing the school</h1><p>The production workflow uses persisted controls and trusted completed attempts. This disconnected workspace shows an explicitly labelled preview.</p></div></div><BenchmarkDemo/></>;
 return <div><div className="so-page-head"><div><span className="so-kicker">ANONYMOUS SHARED-PAPER BENCHMARK</span><h1>Compare the same evidence, without exposing the school</h1><p>Every control below is persisted. Scores enter the benchmark only through a secured function that verifies the authenticated completed attempt.</p></div><div className="so-action-row"><button className="rm-btn-secondary" onClick={()=>void data.loadCatalog()}><RefreshCw/>Refresh</button>{data.selected&&<button className="so-btn so-btn-primary" disabled={data.busy==="toggle"} onClick={()=>void data.toggle()}><Share2/>{data.selected.is_active?"Pause new attempts":"Resume sharing"}</button>}</div></div>
 {(scopeError||data.error)&&<div className="so-notice warning">{scopeError||data.error}</div>}
 <section className="so-card so-pad"><div className="ev-benchmark-selector"><label className="so-field-label">Published school paper<select className="so-input" value={data.paperToShare} onChange={e=>data.setPaperToShare(e.target.value)}><option value="">Select a paper</option>{data.papers.map(p=><option key={p.id} value={p.id}>{p.title} · {p.exam_type}</option>)}</select></label><button className="so-btn so-btn-primary" disabled={!data.paperToShare||data.busy==="create"} onClick={()=>void data.create()}>{data.busy==="create"?<LoaderCircle className="spin"/>:<Plus/>}Create or update benchmark</button></div></section>
 {data.benchmarks.length>0&&<div className="ev-benchmark-tabs so-mt">{data.benchmarks.map(b=><button key={b.id} className={b.id===data.selectedId?"active":""} onClick={()=>data.setSelectedId(b.id)}>{b.title} · V{b.paper_version}</button>)}</div>}
 {data.loading?<div className="so-card ev-empty-benchmark so-mt"><LoaderCircle className="spin"/>Loading persisted evidence…</div>:!data.selected?<div className="so-card ev-empty-benchmark so-mt"><ShieldCheck/><h2>No shared benchmark yet</h2><p>Publish a school-owned paper and create its comparison above.</p></div>:<><BenchmarkLiveHero selected={data.selected} snapshot={data.snapshot}/><BenchmarkLiveTables snapshot={data.snapshot} students={data.students} organizationName={organizationName}/></>}
 </div>;
}
