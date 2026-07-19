"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BlockMath } from "react-katex";
import { ArrowLeft, CheckCircle2, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";
import type { QuestionDifficulty, QuestionOptionInput, QuestionPayload, QuestionStatus, QuestionType, TaxonomyChapter, TaxonomySubject } from "@/types/questions";
import { ImageUploadField } from "./ImageUploadField";
import { QuestionMathPreview } from "./QuestionMathPreview";
import { useQuestionScope } from "./useQuestionScope";

const optionSeed: QuestionOptionInput[] = ["A","B","C","D"].map((option_key,display_order)=>({option_key,content_text:"",content_latex:"",image_url:"",is_correct:false,display_order}));
const typeLabels: Record<QuestionType,string>={single_correct:"Single-correct MCQ",multiple_correct:"Multiple-correct MCQ",numerical:"Numerical value",integer:"Integer answer",assertion_reason:"Assertion & reason",match_following:"Match the following",passage:"Passage based",image_based:"Image-based MCQ"};

export function QuestionEditor({kind}:{kind:"admin"|"school"}){
  const {user,configured}=useAuth();
  const {organizationId,organizationName,loading:scopeLoading,error:scopeError}=useQuestionScope(kind);
  const [questionId,setQuestionId]=useState<string|null>(null);
  const [subjects,setSubjects]=useState<TaxonomySubject[]>([]);const [chapters,setChapters]=useState<TaxonomyChapter[]>([]);
  const [subjectId,setSubjectId]=useState("");const [chapterId,setChapterId]=useState("");
  const [type,setType]=useState<QuestionType>("single_correct");const [status,setStatus]=useState<QuestionStatus>("draft");const [difficulty,setDifficulty]=useState<QuestionDifficulty>("moderate");
  const [stem,setStem]=useState("");const [stemLatex,setStemLatex]=useState("");const [image,setImage]=useState("");const [passage,setPassage]=useState("");
  const [solution,setSolution]=useState("");const [solutionLatex,setSolutionLatex]=useState("");
  const [marks,setMarks]=useState(4);const [negative,setNegative]=useState(1);const [estimated,setEstimated]=useState(90);
  const [examTypes,setExamTypes]=useState<string[]>(["NEET"]);const [classLevel,setClassLevel]=useState("Class 11-12");const [language,setLanguage]=useState("English");
  const [source,setSource]=useState("");const [year,setYear]=useState<number|"">("");const [tags,setTags]=useState("");
  const [numericAnswer,setNumericAnswer]=useState("");const [options,setOptions]=useState<QuestionOptionInput[]>(optionSeed);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState("");const [error,setError]=useState("");

  const isChoice=!["numerical","integer"].includes(type);
  const visibleChapters=chapters.filter(c=>!subjectId||c.subject_id===subjectId);
  const correctCount=options.filter(o=>o.is_correct).length;
  const back=kind==="admin"?"/admin/questions/":"/school/questions/";

  useEffect(()=>{
    const id=new URLSearchParams(window.location.search).get("id");setQuestionId(id);
  },[]);

  useEffect(()=>{
    if(!supabase)return;
    Promise.all([
      supabase.from("subjects").select("id,name,code,organization_id").eq("is_active",true).order("name"),
      supabase.from("chapters").select("id,name,subject_id,organization_id").eq("is_active",true).order("display_order"),
    ]).then(([s,c])=>{if(s.data)setSubjects(s.data as TaxonomySubject[]);if(c.data)setChapters(c.data as TaxonomyChapter[])});
  },[]);

  useEffect(()=>{
    if(!questionId||!supabase)return;
    setBusy(true);
    supabase.from("questions").select("*,question_options(*)").eq("id",questionId).single().then(({data,error:loadError})=>{
      if(loadError){setError(loadError.message);setBusy(false);return;}
      setSubjectId(data.subject_id||"");setChapterId(data.chapter_id||"");setType(data.question_type);setStatus(data.status);setDifficulty(data.difficulty);
      setStem(data.stem_text||"");setStemLatex(data.stem_latex||"");setImage(data.question_image_url||"");setPassage(data.passage_text||"");
      setSolution(data.solution_text||"");setSolutionLatex(data.solution_latex||"");setMarks(Number(data.marks));setNegative(Number(data.negative_marks));setEstimated(data.estimated_seconds||90);
      setExamTypes(data.exam_types||[]);setClassLevel(data.class_level||"");setLanguage(data.language||"English");setSource(data.source||"");setYear(data.source_year||"");setTags((data.tags||[]).join(", "));
      const loaded=(data.question_options||[]).sort((a:QuestionOptionInput,b:QuestionOptionInput)=>a.display_order-b.display_order);
      if(loaded.length)setOptions(loaded); else setNumericAnswer(Array.isArray(data.correct_answer)?data.correct_answer.join(","):String(data.correct_answer??""));
      setBusy(false);
    });
  },[questionId]);

  function updateOption(index:number,patch:Partial<QuestionOptionInput>){setOptions(current=>current.map((o,i)=>i===index?{...o,...patch}:o));}
  function markCorrect(index:number){setOptions(current=>current.map((o,i)=>({...o,is_correct:type==="single_correct"||type==="image_based"||type==="assertion_reason"?i===index:i===index?!o.is_correct:o.is_correct})));}
  function addOption(){const key=String.fromCharCode(65+options.length);setOptions([...options,{option_key:key,content_text:"",content_latex:"",image_url:"",is_correct:false,display_order:options.length}]);}
  function removeOption(index:number){if(options.length<=2)return;setOptions(options.filter((_,i)=>i!==index).map((o,i)=>({...o,option_key:String.fromCharCode(65+i),display_order:i})));}
  function toggleExam(exam:string){setExamTypes(v=>v.includes(exam)?v.filter(x=>x!==exam):[...v,exam]);}

  const validation=useMemo(()=>{
    const problems:string[]=[];
    if(stem.trim().length<5)problems.push("Enter the question text.");
    if(!subjectId)problems.push("Select a subject.");
    if(isChoice&&options.filter(o=>o.content_text||o.content_latex||o.image_url).length<2)problems.push("Enter at least two options.");
    if(isChoice&&correctCount<1)problems.push("Select the correct answer.");
    if((type==="single_correct"||type==="image_based"||type==="assertion_reason")&&correctCount!==1)problems.push("Select exactly one correct answer.");
    if(!isChoice&&!numericAnswer.trim())problems.push("Enter the numerical/integer answer.");
    return problems;
  },[stem,subjectId,isChoice,options,correctCount,type,numericAnswer]);

  async function save(){
    setMessage("");setError("");
    if(validation.length){setError(validation.join(" "));return;}
    if(!supabase||!user){setMessage("Demo preview: connect Supabase to save this question.");return;}
    if(kind==="school"&&!organizationId){setError("No school workspace was found for this account.");return;}
    const payload:QuestionPayload={subject_id:subjectId,chapter_id:chapterId||undefined,question_type:type,status,difficulty,stem_text:stem,stem_latex:stemLatex,question_image_url:image,passage_text:passage,solution_text:solution,solution_latex:solutionLatex,marks,negative_marks:negative,estimated_seconds:estimated,correct_answer:isChoice?options.filter(o=>o.is_correct).map(o=>o.option_key):numericAnswer,exam_types:examTypes,class_level:classLevel,source,source_year:year===""?undefined:Number(year),language,tags:tags.split(",").map(t=>t.trim()).filter(Boolean),metadata:{editor:"version_3"},options:isChoice?options.filter(o=>o.content_text||o.content_latex||o.image_url):[]};
    setBusy(true);
    const {data, error:saveError}=await supabase.rpc("save_question",{p_question_id:questionId,p_organization_id:kind==="admin"?null:organizationId,p_payload:payload});
    if(saveError){setError(saveError.message);setBusy(false);return;}
    setQuestionId(data as string);setMessage(questionId?"Question updated successfully.":"Question created successfully.");
    if(!questionId)window.history.replaceState(null,"",`${window.location.pathname}?id=${data}`);
    setBusy(false);
  }

  if(scopeLoading||busy&&questionId&&!stem)return <div className="rm-card" style={{padding:30,textAlign:"center"}}><LoaderCircle className="spin"/> Loading question editor…</div>;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"end",flexWrap:"wrap"}}><div><Link href={back} style={{display:"inline-flex",gap:7,alignItems:"center",color:"#667085",fontWeight:700,fontSize:13}}><ArrowLeft size={16}/>Back to question bank</Link><span className="rm-label" style={{display:"block",marginTop:14}}>{organizationName}</span><h1 style={{margin:"5px 0",fontSize:32,color:"#131e35"}}>{questionId?"Edit question":"Create a question"}</h1></div><button className="rm-btn-primary" onClick={save} disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:<Save size={18}/>} {questionId?"Save new version":"Save question"}</button></div>
    {(scopeError||error||message)&&<div style={{marginTop:16,padding:13,borderRadius:12,background:error||scopeError?"#fef3f2":"#ecfdf3",color:error||scopeError?"#b42318":"#137a3a",fontWeight:650}}>{scopeError||error||message}</div>}
    <div className="editor-grid" style={{display:"grid",gridTemplateColumns:"minmax(0,1.45fr) minmax(330px,.75fr)",gap:18,marginTop:18}}>
      <div style={{display:"grid",gap:18}}>
        <section className="rm-card" style={{padding:20}}><span className="rm-label">Classification</span><div className="form-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:14}}><label><span className="rm-label">Subject *</span><select className="rm-input" style={{marginTop:6}} value={subjectId} onChange={e=>{setSubjectId(e.target.value);setChapterId("")}}><option value="">Select subject</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label><span className="rm-label">Chapter</span><select className="rm-input" style={{marginTop:6}} value={chapterId} onChange={e=>setChapterId(e.target.value)}><option value="">Select chapter</option>{visibleChapters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label><span className="rm-label">Question type</span><select className="rm-input" style={{marginTop:6}} value={type} onChange={e=>{setType(e.target.value as QuestionType);setOptions(optionSeed)}}>{Object.entries(typeLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label><label><span className="rm-label">Difficulty</span><select className="rm-input" style={{marginTop:6}} value={difficulty} onChange={e=>setDifficulty(e.target.value as QuestionDifficulty)}>{["very_easy","easy","moderate","difficult","very_difficult"].map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><label><span className="rm-label">Status</span><select className="rm-input" style={{marginTop:6}} value={status} onChange={e=>setStatus(e.target.value as QuestionStatus)}>{(kind==="admin"?["draft","in_review","approved","rejected","archived"]:["draft","in_review"]).map(v=><option key={v} value={v}>{v.replaceAll("_"," ")}</option>)}</select></label><label><span className="rm-label">Language</span><select className="rm-input" style={{marginTop:6}} value={language} onChange={e=>setLanguage(e.target.value)}><option>English</option><option>Kannada</option><option>Hindi</option><option>Bilingual</option></select></label></div><div style={{marginTop:14}}><span className="rm-label">Applicable examinations</span><div style={{display:"flex",flexWrap:"wrap",gap:8,marginTop:8}}>{["NEET","JEE Main","JEE Advanced","KCET","Custom"].map(exam=><button type="button" key={exam} onClick={()=>toggleExam(exam)} className="rm-badge" style={{border:`1px solid ${examTypes.includes(exam)?"#f6b100":"#d0d5dd"}`,background:examTypes.includes(exam)?"#fff6d8":"white",color:"#131e35"}}>{examTypes.includes(exam)&&<CheckCircle2 size={14}/>} {exam}</button>)}</div></div></section>
        <section className="rm-card" style={{padding:20}}><span className="rm-label">Question content</span>{type==="passage"&&<label style={{display:"block",marginTop:14}}><span className="rm-label">Passage</span><textarea className="rm-input" rows={5} style={{marginTop:6,resize:"vertical"}} value={passage} onChange={e=>setPassage(e.target.value)}/></label>}<label style={{display:"block",marginTop:14}}><span className="rm-label">Question text *</span><textarea className="rm-input" rows={5} style={{marginTop:6,resize:"vertical"}} placeholder="Type the question in plain text…" value={stem} onChange={e=>setStem(e.target.value)}/></label><label style={{display:"block",marginTop:14}}><span className="rm-label">LaTeX equation</span><textarea className="rm-input" rows={3} style={{marginTop:6,fontFamily:"monospace",resize:"vertical"}} placeholder="Example: R=\\frac{u^2\\sin 2\\theta}{g}" value={stemLatex} onChange={e=>setStemLatex(e.target.value)}/></label><div style={{marginTop:14}}><ImageUploadField label="Question image" value={image} onChange={setImage}/></div></section>
        {isChoice?<section className="rm-card" style={{padding:20}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div><span className="rm-label">Answer options</span><h2 style={{margin:"5px 0"}}>Select the correct answer</h2></div><button className="rm-btn-secondary" onClick={addOption} disabled={options.length>=6}><Plus size={16}/> Add option</button></div><div style={{display:"grid",gap:12,marginTop:14}}>{options.map((o,i)=><div key={o.option_key} style={{border:`1px solid ${o.is_correct?"#49a26c":"#e4e7ec"}`,background:o.is_correct?"#f0fdf4":"#fbfcfe",borderRadius:14,padding:14}}><div style={{display:"grid",gridTemplateColumns:"46px 1fr auto",gap:10,alignItems:"start"}}><button type="button" onClick={()=>markCorrect(i)} style={{width:42,height:42,borderRadius:12,border:`2px solid ${o.is_correct?"#137a3a":"#cbd2dc"}`,background:o.is_correct?"#137a3a":"white",color:o.is_correct?"white":"#131e35",fontWeight:900}}>{o.option_key}</button><div style={{display:"grid",gap:8}}><input className="rm-input" placeholder={`Option ${o.option_key} text`} value={o.content_text||""} onChange={e=>updateOption(i,{content_text:e.target.value})}/><input className="rm-input" style={{fontFamily:"monospace"}} placeholder="Optional LaTeX" value={o.content_latex||""} onChange={e=>updateOption(i,{content_latex:e.target.value})}/><input className="rm-input" placeholder="Optional public image URL" value={o.image_url||""} onChange={e=>updateOption(i,{image_url:e.target.value})}/></div><button type="button" onClick={()=>removeOption(i)} style={{border:0,background:"transparent",color:"#b42318",padding:8}} aria-label="Remove option"><Trash2 size={18}/></button></div>{o.content_latex&&<div style={{marginTop:8,overflowX:"auto"}}><BlockMath math={o.content_latex}/></div>}</div>)}</div></section>:<section className="rm-card" style={{padding:20}}><span className="rm-label">Correct answer</span><input className="rm-input" style={{marginTop:8}} placeholder={type==="integer"?"Example: 42":"Example: 9.81"} value={numericAnswer} onChange={e=>setNumericAnswer(e.target.value)}/></section>}
        <section className="rm-card" style={{padding:20}}><span className="rm-label">Solution and scoring</span><label style={{display:"block",marginTop:14}}><span className="rm-label">Solution explanation</span><textarea className="rm-input" rows={5} style={{marginTop:6,resize:"vertical"}} value={solution} onChange={e=>setSolution(e.target.value)}/></label><label style={{display:"block",marginTop:14}}><span className="rm-label">Solution LaTeX</span><textarea className="rm-input" rows={3} style={{marginTop:6,fontFamily:"monospace"}} value={solutionLatex} onChange={e=>setSolutionLatex(e.target.value)}/></label><div className="form-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:14}}><label><span className="rm-label">Marks</span><input type="number" step="0.25" className="rm-input" style={{marginTop:6}} value={marks} onChange={e=>setMarks(Number(e.target.value))}/></label><label><span className="rm-label">Negative marks</span><input type="number" step="0.25" className="rm-input" style={{marginTop:6}} value={negative} onChange={e=>setNegative(Number(e.target.value))}/></label><label><span className="rm-label">Expected seconds</span><input type="number" className="rm-input" style={{marginTop:6}} value={estimated} onChange={e=>setEstimated(Number(e.target.value))}/></label></div></section>
        <section className="rm-card" style={{padding:20}}><span className="rm-label">Source and tags</span><div className="form-grid-3" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginTop:14}}><label><span className="rm-label">Class level</span><input className="rm-input" style={{marginTop:6}} value={classLevel} onChange={e=>setClassLevel(e.target.value)}/></label><label><span className="rm-label">Source</span><input className="rm-input" style={{marginTop:6}} placeholder="NCERT / original / PYQ" value={source} onChange={e=>setSource(e.target.value)}/></label><label><span className="rm-label">Source year</span><input type="number" className="rm-input" style={{marginTop:6}} value={year} onChange={e=>setYear(e.target.value?Number(e.target.value):"")}/></label></div><label style={{display:"block",marginTop:14}}><span className="rm-label">Tags separated by commas</span><input className="rm-input" style={{marginTop:6}} placeholder="mechanics, projectile, formula" value={tags} onChange={e=>setTags(e.target.value)}/></label></section>
      </div>
      <aside style={{display:"grid",gap:16,alignContent:"start",position:"sticky",top:18,height:"fit-content"}}><QuestionMathPreview text={stem} latex={stemLatex} imageUrl={image}/><div className="rm-card" style={{padding:18}}><span className="rm-label">Readiness check</span><div style={{display:"grid",gap:9,marginTop:12}}>{validation.length?validation.map(v=><div key={v} style={{color:"#b42318",fontSize:13}}>● {v}</div>):<div style={{color:"#137a3a",fontWeight:750}}>✓ Ready to save</div>}<div style={{borderTop:"1px solid #eef1f5",paddingTop:10,fontSize:13,color:"#667085"}}>Correct options: <strong>{correctCount}</strong></div><div style={{fontSize:13,color:"#667085"}}>Scope: <strong>{organizationName}</strong></div><div style={{fontSize:13,color:"#667085"}}>Mode: <strong>{configured?"Live database":"Demo preview"}</strong></div></div></div>{solutionLatex&&<div className="rm-card" style={{padding:18,overflowX:"auto"}}><span className="rm-label">Solution preview</span><BlockMath math={solutionLatex}/></div>}</aside>
    </div><style>{`@media(max-width:980px){.editor-grid{grid-template-columns:1fr!important}.editor-grid aside{position:static!important}.form-grid-3{grid-template-columns:1fr 1fr!important}}@media(max-width:620px){.form-grid-3{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
