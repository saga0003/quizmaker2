'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Database, LoaderCircle, RefreshCw, Search, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { supabase } from '@/lib/supabase';
import { StudentAnalyticsDashboardV10_10 } from './StudentAnalyticsDashboardV10_10';
import { DemoCohortStudio } from './DemoCohortStudio';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type DirectoryStudent={student_id:string;student_name:string;school_name:string;grade:number|null;section:string;average_percentage:number|null;average_percentile:number|null;completed_tests:number;viewer_role:string};
type DirectoryPayload={viewer_role:string;students:DirectoryStudent[];generated_at:string};

export function V12LiveAnalytics({mode}:{mode:'student'|'admin'}){
 const {user,profile,loading:authLoading,configured}=useAuth();
 const [workspace,setWorkspace]=useState<'student'|'cohort'>('student');
 const [directory,setDirectory]=useState<DirectoryPayload|null>(null);
 const [selectedId,setSelectedId]=useState('');
 const [search,setSearch]=useState('');
 const [loading,setLoading]=useState(mode==='admin');
 const [error,setError]=useState('');
 const loadDirectory=useCallback(async()=>{if(mode!=='admin')return;if(!supabase){setError('Connect Supabase and apply migrations through 42_v10_12_analytics_student_directory.sql.');setLoading(false);return}setLoading(true);setError('');const {data,error:rpcError}=await supabase.rpc('list_analytics_students_v10_12');if(rpcError){setError(`${rpcError.message}. Apply migrations 35–42 in order, then refresh.`);setDirectory(null)}else{const next=data as DirectoryPayload;setDirectory(next);setSelectedId(current=>current&&next.students.some(row=>row.student_id===current)?current:next.students[0]?.student_id||'')}setLoading(false)},[mode]);
 useEffect(()=>{void loadDirectory()},[loadDirectory]);
 const studentId=mode==='student'?(profile?.id||user?.id||''):selectedId;
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return (directory?.students||[]).filter(row=>!q||`${row.student_name} ${row.school_name} ${row.grade??''} ${row.section}`.toLowerCase().includes(q))},[directory,search]);
 if(authLoading)return <div className="grid min-h-[60vh] place-items-center text-sm text-[#6B7980]"><LoaderCircle className="h-5 w-5 animate-spin"/>Loading V12 analytics…</div>;
 if(!configured)return <div className="rounded-xl border border-[#F2B84B]/50 bg-[#FFF8EF] p-5 text-sm text-[#6B4B12]">Supabase is not configured. Add the public Supabase URL and publishable key, then reload.</div>;
 if(mode==='student'&&!studentId)return <div className="rounded-xl border border-[#B54747]/20 bg-[#FFF0EF] p-5 text-sm text-[#B54747]">A signed-in student profile is required.</div>;
 return <div className="space-y-4">
  <section className="rounded-[15px] border border-[#DFE6EC] bg-white p-4 shadow-[0_10px_30px_rgba(5,31,50,0.055)]"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#006B70]"><Database className="h-4 w-4"/>Evidara V12 · Live Supabase analytics</div><h1 className="mt-2 text-2xl font-bold text-[#071D34]">{mode==='admin'?'Student analytics and trial evidence':'Your complete analytics'}</h1><p className="mt-1 text-sm text-[#536579]">Scores, subjects, chapters, topics, responses, benchmarks and PDF reports use the authorised Supabase evidence scope.</p></div>{mode==='admin'&&<div className="inline-flex rounded-[10px] border border-[#DFE6EC] p-1"><button className={`rounded-lg px-4 py-2 text-sm ${workspace==='student'?'bg-[#006B70] text-white':'text-[#31465A]'}`} onClick={()=>setWorkspace('student')}><Users className="mr-2 inline h-4 w-4"/>Student drill-down</button><button className={`rounded-lg px-4 py-2 text-sm ${workspace==='cohort'?'bg-[#006B70] text-white':'text-[#31465A]'}`} onClick={()=>setWorkspace('cohort')}><BarChart3 className="mr-2 inline h-4 w-4"/>Trial cohort</button></div>}</div></section>
  {error&&<div className="rounded-xl border border-[#B54747]/20 bg-[#FFF0EF] px-4 py-3 text-sm text-[#B54747]">{error}</div>}
  {mode==='admin'&&workspace==='cohort'?<DemoCohortStudio/>:<>{mode==='admin'&&<section className="rounded-[15px] border border-[#DFE6EC] bg-white p-4 shadow-[0_10px_30px_rgba(5,31,50,0.055)]"><div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8998A8]"/><Input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search student, school, grade or section" className="pl-9"/></div><select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="h-10 min-w-[320px] rounded-md border border-[#DFE6EC] bg-white px-3 text-sm">{filtered.map(row=><option key={row.student_id} value={row.student_id}>{row.student_name} · {row.school_name} · Grade {row.grade??'—'} {row.section}</option>)}</select><Button variant="outline" onClick={()=>void loadDirectory()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh</Button></div>{selectedId&&<div className="mt-3 flex flex-wrap gap-2 text-xs text-[#536579]">{directory?.students.filter(row=>row.student_id===selectedId).map(row=><span key={row.student_id} className="rounded-full bg-[#EAF6F4] px-3 py-1.5">{row.completed_tests} tests · {row.average_percentage==null?'No average':`${Number(row.average_percentage).toFixed(1)}%`} · {row.average_percentile==null?'Percentile locked':`${Number(row.average_percentile).toFixed(2)} percentile`}</span>)}</div>}</section>}{loading?<div className="grid min-h-[45vh] place-items-center text-sm text-[#6B7980]"><LoaderCircle className="h-5 w-5 animate-spin"/>Loading authorised students…</div>:studentId?<StudentAnalyticsDashboardV10_10 key={studentId} studentId={studentId}/>:<div className="rounded-xl border border-[#DFE6EC] bg-white p-10 text-center text-sm text-[#536579]">No student is available in your authorised scope.</div>}</>}
 </div>
}
