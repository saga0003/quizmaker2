'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, LoaderCircle, RefreshCw, Search, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type StudentRow = {
  sl:number;
  student_id:string;
  student_name:string;
  school_name:string;
  grade?:number|null;
  section?:string|null;
  average_percentage?:number|null;
  average_percentile?:number|null;
  completed_tests:number;
  viewer_role:string;
};

type SortKey='sl'|'student_name'|'school_name'|'grade'|'section'|'average_percentage'|'average_percentile'|'completed_tests';

function metric(value?:number|null,suffix=''){return value==null?'—':`${Number(value).toFixed(1)}${suffix}`;}

export function AnalyticsStudentDirectory({onOpenStudent}:{onOpenStudent:(studentId:string)=>void}){
  const [rows,setRows]=useState<StudentRow[]>([]);
  const [role,setRole]=useState('');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [sortKey,setSortKey]=useState<SortKey>('student_name');
  const [direction,setDirection]=useState<'asc'|'desc'>('asc');

  const load=useCallback(async()=>{
    if(!supabase){setError('Connect Supabase and apply migration 42.');setLoading(false);return;}
    setLoading(true);setError('');
    const {data,error:loadError}=await supabase.rpc('list_analytics_students_v10_12');
    if(loadError){setError(loadError.message.includes('list_analytics_students_v10_12')?'Apply migration 42_v10_12_analytics_student_directory.sql, then refresh.':loadError.message);setRows([]);}
    else{const payload=data as {viewer_role:string;students:StudentRow[]};setRole(payload.viewer_role||'');setRows(payload.students||[]);}
    setLoading(false);
  },[]);

  useEffect(()=>{void load();},[load]);

  function changeSort(key:SortKey){if(sortKey===key)setDirection(value=>value==='asc'?'desc':'asc');else{setSortKey(key);setDirection('asc');}}
  function SortIcon({column}:{column:SortKey}){return sortKey!==column?<ArrowUpDown size={14}/>:direction==='asc'?<ArrowUp size={14}/>:<ArrowDown size={14}/>;}

  const schoolColumn=role==='super_admin'||role==='evidara_admin';
  const visible=useMemo(()=>{
    const query=search.trim().toLowerCase();
    const filtered=rows.filter(row=>!query||`${row.student_name} ${row.school_name} ${row.grade||''} ${row.section||''}`.toLowerCase().includes(query));
    return [...filtered].sort((a,b)=>{
      const av=a[sortKey]??'';const bv=b[sortKey]??'';
      const result=typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'});
      return direction==='asc'?result:-result;
    });
  },[direction,rows,search,sortKey]);

  if(loading&&!rows.length)return <Card className="border-[#E7ECEB] shadow-none"><CardContent className="grid min-h-[320px] place-items-center text-sm text-[#6B7980]"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin"/>Loading student analytics directory…</div></CardContent></Card>;

  return <div className="space-y-5">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div><div className="text-xs font-semibold uppercase tracking-[.16em] text-[#0E5A5A]">Student analytics directory</div><h2 className="mt-2 text-2xl font-bold tracking-tight text-[#14232B]">Open any student’s complete evidence profile</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-[#6B7980]">Sort the table, choose a student and review the same Overview, Subject, Chapter, Topic, Practice, Test History and Goals workspace visible to the student.</p></div>
      <Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading?'animate-spin':''}`}/>Refresh students</Button>
    </div>
    {error&&<div className="rounded-xl border border-[#B54747]/20 bg-[#FAEEEE] p-4 text-sm text-[#B54747]">{error}</div>}
    <Card className="border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]"/><Input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search student, school, grade or section" className="h-11 pl-9"/></div></CardContent></Card>
    <div className="overflow-x-auto rounded-[15px] border border-[#E7ECEB] bg-white shadow-[0_10px_30px_rgba(5,31,50,.055)]">
      <table className="ev-sortable w-full min-w-[1040px] text-left">
        <thead><tr>
          <th className="px-4 py-2"><button onClick={()=>changeSort('sl')}>Sl.<SortIcon column="sl"/></button></th>
          <th className="px-4 py-2"><button onClick={()=>changeSort('student_name')}>Student name<SortIcon column="student_name"/></button></th>
          {schoolColumn?<th className="px-4 py-2"><button onClick={()=>changeSort('school_name')}>School name<SortIcon column="school_name"/></button></th>:<><th className="px-4 py-2"><button onClick={()=>changeSort('grade')}>Grade<SortIcon column="grade"/></button></th><th className="px-4 py-2"><button onClick={()=>changeSort('section')}>Section<SortIcon column="section"/></button></th></>}
          <th className="px-4 py-2"><button onClick={()=>changeSort('average_percentage')}>Average percentage<SortIcon column="average_percentage"/></button></th>
          <th className="px-4 py-2"><button onClick={()=>changeSort('average_percentile')}>Average percentile<SortIcon column="average_percentile"/></button></th>
          <th className="px-4 py-2"><button onClick={()=>changeSort('completed_tests')}>Tests<SortIcon column="completed_tests"/></button></th>
        </tr></thead>
        <tbody>{visible.map((row,index)=><tr key={row.student_id} role="button" tabIndex={0} onClick={()=>onOpenStudent(row.student_id)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onOpenStudent(row.student_id);}}} className="border-t border-[#E7ECEB] focus-visible:outline focus-visible:outline-3 focus-visible:outline-[#2164D6]">
          <td className="px-4 py-4 text-[#6B7980]">{index+1}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-[#DCE9E7] font-semibold text-[#0E5A5A]"><Users size={17}/></span><div><strong className="block text-[#14232B]">{row.student_name}</strong><span className="text-xs text-[#6B7980]">{row.completed_tests} completed test{row.completed_tests===1?'':'s'}</span></div></div></td>
          {schoolColumn?<td className="px-4 py-4">{row.school_name}</td>:<><td className="px-4 py-4">{row.grade||'—'}</td><td className="px-4 py-4">{row.section||'—'}</td></>}
          <td className="px-4 py-4 font-semibold text-[#0E5A5A]">{metric(row.average_percentage,'%')}</td><td className="px-4 py-4">{metric(row.average_percentile)}</td><td className="px-4 py-4">{row.completed_tests}</td>
        </tr>)}{!visible.length&&<tr><td colSpan={schoolColumn?6:7} className="px-4 py-16 text-center text-[#6B7980]">No students match the current search.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}
