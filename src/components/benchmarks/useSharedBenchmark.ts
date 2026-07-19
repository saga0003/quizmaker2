"use client";
import {useEffect,useState} from "react";
import {supabase} from "@/lib/supabase";
export type BenchmarkRow={id:string;paper_id:string;title:string;share_token:string;paper_version:number;is_active:boolean;minimum_sample_size:number};
export type PaperRow={id:string;title:string;exam_type:string};
export type Snapshot={available:boolean;valid_attempts:number;minimum_sample_size:number;average_percentage:number|null;distribution:{band:string;attempts:number}[];school_attempts:number;school_average_percentage:number|null;school_cohort_percentile:number|null};
export type StudentRow={student_id:string;student_name:string;grade:string;score:number;maximum_marks:number;percentage:number;percentile:number|null;submitted_at:string;segment_label:string};
export function useSharedBenchmark(organizationId?:string|null,scopeLoading=false){
 const [benchmarks,setBenchmarks]=useState<BenchmarkRow[]>([]),[papers,setPapers]=useState<PaperRow[]>([]),[selectedId,setSelectedId]=useState(""),[paperToShare,setPaperToShare]=useState("");
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null),[students,setStudents]=useState<StudentRow[]>([]),[loading,setLoading]=useState(Boolean(supabase)),[busy,setBusy]=useState(""),[error,setError]=useState("");
 const selected=benchmarks.find(row=>row.id===selectedId)||null;
 useEffect(()=>{if(supabase&&!scopeLoading&&organizationId)void loadCatalog()},[organizationId,scopeLoading]);
 useEffect(()=>{if(supabase&&selectedId)void loadEvidence(selectedId)},[selectedId]);
 async function loadCatalog(){if(!supabase||!organizationId)return;setLoading(true);setError("");const[a,b]=await Promise.all([supabase.rpc("list_school_shared_benchmarks",{p_organization_id:organizationId}),supabase.rpc("list_shareable_school_papers",{p_organization_id:organizationId})]);if(a.error)setError(a.error.message);else{const rows=(a.data||[])as BenchmarkRow[];setBenchmarks(rows);setSelectedId(current=>rows.some(row=>row.id===current)?current:rows[0]?.id||"")}if(b.error)setError(current=>current||b.error.message);else{const rows=(b.data||[])as PaperRow[];setPapers(rows);setPaperToShare(current=>rows.some(row=>row.id===current)?current:rows[0]?.id||"")}setLoading(false)}
 async function loadEvidence(id:string){if(!supabase)return;setLoading(true);const[a,b]=await Promise.all([supabase.rpc("get_school_shared_benchmark_snapshot",{p_benchmark_id:id}),supabase.rpc("list_school_benchmark_students",{p_benchmark_id:id})]);if(a.error)setError(a.error.message);else setSnapshot(a.data as Snapshot);if(b.error)setError(current=>current||b.error.message);else setStudents((b.data||[])as StudentRow[]);setLoading(false)}
 async function create(){if(!supabase||!paperToShare)return;setBusy("create");const{data,error:e}=await supabase.rpc("ensure_school_shared_benchmark",{p_paper_id:paperToShare});if(e)setError(e.message);else{await loadCatalog();setSelectedId(String(data))}setBusy("")}
 async function toggle(){if(!supabase||!selected)return;setBusy("toggle");const{error:e}=await supabase.rpc("set_shared_benchmark_active",{p_benchmark_id:selected.id,p_is_active:!selected.is_active});if(e)setError(e.message);else setBenchmarks(rows=>rows.map(row=>row.id===selected.id?{...row,is_active:!row.is_active}:row));setBusy("")}
 return{benchmarks,papers,selectedId,setSelectedId,paperToShare,setPaperToShare,selected,snapshot,students,loading,busy,error,loadCatalog,create,toggle};
}
