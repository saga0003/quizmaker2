'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export type SelfClassification = 'concept_gap'|'calculation_error'|'careless_error'|'guessed'|'ran_out_of_time'|'other';
type QueueItem={response_id:string;paper_question_id:string;is_correct:boolean;is_skipped:boolean;time_spent_seconds:number;classification:SelfClassification|null;confidence_rating:number|null;note:string|null};
const options:[SelfClassification,string,string][]=[
 ['concept_gap','I did not know the concept','Concept gap'],['calculation_error','I made a calculation mistake','Calculation'],
 ['careless_error','I made a careless mistake','Careless'],['guessed','I guessed the answer','Guessed'],
 ['ran_out_of_time','I ran out of time','Time pressure'],['other','Another reason','Other'],
];

export function PostTestErrorClassification({attemptId,onComplete}:{attemptId:string;onComplete?:()=>void}){
 const [items,setItems]=useState<QueueItem[]>([]); const [index,setIndex]=useState(0); const [confidence,setConfidence]=useState<number|null>(null); const [reason,setReason]=useState<SelfClassification|null>(null); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{void load()},[attemptId]);
 useEffect(()=>{const item=items[index];setConfidence(item?.confidence_rating??null);setReason(item?.classification??null)},[index,items]);
 async function load(){setLoading(true);setError('');try{if(!supabase) throw new Error('Supabase is not configured.');const {data,error:e}=await supabase.rpc('list_post_test_reflection_queue_v13',{p_attempt_id:attemptId});if(e)throw e;setItems(Array.isArray(data?.items)?data.items:[]);setIndex(0)}catch(e){setError(e instanceof Error?e.message:'Unable to load questions.')}finally{setLoading(false)}}
 async function save(){const item=items[index];if(!item||!supabase||confidence===null)return;setSaving(true);setError('');try{const {error:e}=await supabase.rpc('save_exam_response_reflection_v13',{p_response_id:item.response_id,p_confidence_rating:confidence,p_classification:item.is_correct?null:reason,p_note:null});if(e)throw e;const next=items.map((row,i)=>i===index?{...row,confidence_rating:confidence,classification:item.is_correct?null:reason}:row);setItems(next);if(index<next.length-1)setIndex(index+1);else onComplete?.()}catch(e){setError(e instanceof Error?e.message:'Unable to save reflection.')}finally{setSaving(false)}}
 if(loading)return <div className="post-test-classification-state">Loading reflection questions…</div>;
 if(error&&!items.length)return <div className="post-test-classification-state error">{error}</div>;
 if(!items.length)return <div className="post-test-classification-complete"><CheckCircle2/><div><strong>No responses available</strong><p>Submitted responses will appear here for reflection.</p></div></div>;
 const item=items[index]; const completed=items.filter(row=>row.confidence_rating).length;
 return <section className="post-test-classification"><header><div><span>Post-test reflection</span><h3>How confident were you while answering?</h3><p>Reflect immediately after submission or later while reviewing solutions.</p></div><div className="post-test-classification-progress">{completed}/{items.length}</div></header><div className="post-test-question-summary">{item.is_correct?<CheckCircle2/>:<AlertTriangle/>}<div><strong>Question {index+1} of {items.length}</strong><p>{item.is_correct?'Correct response':item.is_skipped?'Skipped question':'Incorrect response'} · <Clock3/> {item.time_spent_seconds || 0} sec</p></div></div><div className="post-test-confidence"><p>Confidence while answering</p><div>{[1,2,3,4,5].map(value=><button type="button" key={value} className={confidence===value?'selected':''} onClick={()=>setConfidence(value)}><strong>{value}</strong><small>{['Completely unsure','Slightly unsure','Somewhat confident','Confident','Absolutely certain'][value-1]}</small></button>)}</div></div>{!item.is_correct&&<><p className="post-test-reason-label">Why was this incorrect or skipped?</p><div className="post-test-classification-options">{options.map(([value,label,short])=><button type="button" key={value} disabled={saving} className={reason===value?'selected':''} onClick={()=>setReason(value)}><span>{label}</span><small>{short}</small><ChevronRight/></button>)}</div></>}<button type="button" className="post-test-reflection-save" disabled={saving||confidence===null||(!item.is_correct&&reason===null)} onClick={()=>void save()}>{saving?'Saving…':index===items.length-1?'Save reflection':'Save & next'} <ChevronRight/></button>{error&&<p className="post-test-classification-error">{error}</p>}</section>
}
