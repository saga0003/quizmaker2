"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ChevronDown, FileQuestion, Filter, LoaderCircle, Plus, Save, Search, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuestionScope } from "@/components/questions/useQuestionScope";
import type { QuestionRow, TaxonomySubject } from "@/types/questions";
import type { PaperAccessMode, PaperPayload, PaperQuestionInput, PaperSectionInput, PaperStatus, ResultMode } from "@/types/papers";

const examTypes=["NEET","JEE Main","JEE Advanced","KCET","School MCQ","Scholarship Exam","Custom"];
const id=()=>crypto.randomUUID();
const emptySection=(order=0):PaperSectionInput=>({client_id:id(),title:`Section ${String.fromCharCode(65+order)}`,display_order:order});
const toIso=(value:string)=>value?new Date(value).toISOString():"";
const toLocal=(value:string|null|undefined)=>value?new Date(value).toISOString().slice(0,16):"";

type SelectedQuestion=PaperQuestionInput&{question:QuestionRow};

export function QuestionPaperBuilder({kind}:{kind:"admin"|"school"}){
  const {organizationId,organizationName,loading:scopeLoading,error:scopeError}=useQuestionScope(kind);
  const [paperId,setPaperId]=useState<string|null>(null);const [loading,setLoading]=useState(true);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [message,setMessage]=useState("");
  const [subjects,setSubjects]=useState<TaxonomySubject[]>([]);const [questions,setQuestions]=useState<QuestionRow[]>([]);
  const [sections,setSections]=useState<PaperSectionInput[]>([emptySection()]);const [selected,setSelected]=useState<SelectedQuestion[]>([]);const [activeSection,setActiveSection]=useState("");
  const [title,setTitle]=useState("");const [code,setCode]=useState("");const [description,setDescription]=useState("");const [examType,setExamType]=useState("NEET");const [duration,setDuration]=useState(180);const [instructions,setInstructions]=useState("Read every question carefully. Your answers are autosaved. Submit before the timer reaches zero.");
  const [accessMode,setAccessMode]=useState<PaperAccessMode>("public");const [accessCode,setAccessCode]=useState("");const [availableFrom,setAvailableFrom]=useState("");const [availableUntil,setAvailableUntil]=useState("");const [attemptLimit,setAttemptLimit]=useState(1);const [shuffleQuestions,setShuffleQuestions]=useState(false);const [shuffleOptions,setShuffleOptions]=useState(false);const [resultMode,setResultMode]=useState<ResultMode>("score_only");
  const [search,setSearch]=useState("");const [subjectFilter,setSubjectFilter]=useState("all");const [difficultyFilter,setDifficultyFilter]=useState("all");const [typeFilter,setTypeFilter]=useState("all");
  const base=kind==="admin"?"/admin/papers":"/school/papers";

  useEffect(()=>{const value=new URLSearchParams(window.location.search).get("id");setPaperId(value)},[]);
  useEffect(()=>{if(sections.length&&!activeSection)setActiveSection(sections[0].client_id)},[sections,activeSection]);
  useEffect(()=>{if(!supabase){setLoading(false);return;}if(kind==="school"&&scopeLoading)return;load()},[kind,organizationId,scopeLoading,paperId]);

  async function load(){
    if(!supabase)return;setLoading(true);setError("");
    const [{data:s,error:sErr},{data:q,error:qErr}]=await Promise.all([
      supabase.from("subjects").select("id,name,code,organization_id").eq("is_active",true).order("name"),
      supabase.from("questions").select("*,subjects(name,code),chapters(name),question_options(option_key,content_text,content_latex,image_url,is_correct,display_order)").eq("status","approved").order("updated_at",{ascending:false}).limit(1000),
    ]);
    if(sErr||qErr){setError(sErr?.message||qErr?.message||"Unable to load the question bank.");setLoading(false);return;}
    const visible=((q||[]) as unknown as QuestionRow[]).filter(question=>kind==="admin"?question.organization_id===null:question.organization_id===null||question.organization_id===organizationId);
    setSubjects((s||[]) as TaxonomySubject[]);setQuestions(visible);
    if(paperId){await loadExisting(paperId,visible)}
    setLoading(false);
  }

  async function loadExisting(existingId:string,availableQuestions:QuestionRow[]){
    if(!supabase)return;
    const [{data:p,error:pErr},{data:s,error:sErr},{data:items,error:iErr}]=await Promise.all([
      supabase.from("question_papers").select("*").eq("id",existingId).single(),
      supabase.from("paper_sections").select("*").eq("paper_id",existingId).order("display_order"),
      supabase.from("paper_questions").select("id,question_id,section_id,display_order,marks,negative_marks,is_mandatory").eq("paper_id",existingId).order("display_order"),
    ]);
    if(pErr||sErr||iErr){setError(pErr?.message||sErr?.message||iErr?.message||"Unable to open this paper.");return;}
    setTitle(p.title);setCode(p.code||"");setDescription(p.description||"");setExamType(p.exam_type);setDuration(p.duration_minutes);setInstructions(p.instructions||"");setAccessMode(p.access_mode);setAccessCode(p.access_code||"");setAvailableFrom(toLocal(p.available_from));setAvailableUntil(toLocal(p.available_until));setAttemptLimit(p.attempt_limit);setShuffleQuestions(p.shuffle_questions);setShuffleOptions(p.shuffle_options);setResultMode(p.result_mode);
    const sectionRows=(s||[]).map((row,index)=>({client_id:row.id,id:row.id,title:row.title,subject_id:row.subject_id||undefined,instructions:row.instructions||undefined,questions_to_attempt:row.questions_to_attempt||undefined,display_order:index}));
    setSections(sectionRows.length?sectionRows:[emptySection()]);setActiveSection(sectionRows[0]?.client_id||"");
    setSelected((items||[]).map(item=>{
      const question=availableQuestions.find(q=>q.id===item.question_id);
      if(!question)return null;
      return {question_id:item.question_id,section_client_id:item.section_id,display_order:item.display_order,marks:Number(item.marks),negative_marks:Number(item.negative_marks),is_mandatory:item.is_mandatory,question};
    }).filter(Boolean) as SelectedQuestion[]);
  }

  const filtered=useMemo(()=>questions.filter(q=>{
    const hay=`${q.stem_text} ${q.subjects?.name||""} ${(q.tags||[]).join(" ")}`.toLowerCase();
    return (!search||hay.includes(search.toLowerCase()))&&(subjectFilter==="all"||q.subject_id===subjectFilter)&&(difficultyFilter==="all"||q.difficulty===difficultyFilter)&&(typeFilter==="all"||q.question_type===typeFilter);
  }),[questions,search,subjectFilter,difficultyFilter,typeFilter]);
  const selectedIds=new Set(selected.map(item=>item.question_id));
  const totalMarks=selected.reduce((n,item)=>n+Number(item.marks||0),0);
  const currentSection=sections.find(section=>section.client_id===activeSection);

  function addSection(){const next=emptySection(sections.length);setSections([...sections,next]);setActiveSection(next.client_id)}
  function updateSection(clientId:string,patch:Partial<PaperSectionInput>){setSections(sections.map(s=>s.client_id===clientId?{...s,...patch}:s))}
  function removeSection(clientId:string){if(sections.length===1){setError("A paper must contain at least one section.");return;}const next=sections.filter(s=>s.client_id!==clientId).map((s,index)=>({...s,display_order:index}));setSections(next);setSelected(selected.filter(q=>q.section_client_id!==clientId));if(activeSection===clientId)setActiveSection(next[0].client_id)}
  function addQuestion(question:QuestionRow){if(selectedIds.has(question.id))return;const sectionId=activeSection||sections[0]?.client_id;if(!sectionId){setError("Create a section first.");return;}setSelected([...selected,{question_id:question.id,section_client_id:sectionId,display_order:selected.length,marks:Number(question.marks),negative_marks:Number(question.negative_marks),is_mandatory:true,question}])}
  function moveQuestion(index:number,direction:-1|1){const target=index+direction;if(target<0||target>=selected.length)return;const copy=[...selected];[copy[index],copy[target]]=[copy[target],copy[index]];setSelected(copy.map((q,i)=>({...q,display_order:i})))}
  function updateSelected(questionId:string,patch:Partial<PaperQuestionInput>){setSelected(selected.map(item=>item.question_id===questionId?{...item,...patch}:item))}
  function removeQuestion(questionId:string){setSelected(selected.filter(item=>item.question_id!==questionId).map((q,i)=>({...q,display_order:i})))}

  function validate(){
    if(title.trim().length<3)return "Enter a paper title.";
    if(duration<1)return "Duration must be at least one minute.";
    if(!sections.length)return "Create at least one section.";
    if(sections.some(s=>s.title.trim().length<1))return "Every section needs a title.";
    if(!selected.length)return "Add at least one approved question.";
    if(accessMode==="code"&&accessCode.trim().length<4)return "Access code must have at least four characters.";
    if(availableFrom&&availableUntil&&new Date(availableUntil)<=new Date(availableFrom))return "Closing time must be later than opening time.";
    return "";
  }

  async function save(status:PaperStatus){
    const validation=validate();if(validation){setError(validation);return;}if(!supabase){setError("Connect Supabase before saving.");return;}if(kind==="school"&&!organizationId){setError("School workspace not found.");return;}
    setBusy(true);setError("");setMessage("");
    const payload:PaperPayload={title:title.trim(),code:code.trim()||undefined,description:description.trim()||undefined,exam_type:examType,status,duration_minutes:duration,instructions:instructions.trim()||undefined,access_mode:accessMode,access_code:accessMode==="code"?accessCode.trim():undefined,available_from:toIso(availableFrom)||undefined,available_until:toIso(availableUntil)||undefined,attempt_limit:attemptLimit,shuffle_questions:shuffleQuestions,shuffle_options:shuffleOptions,result_mode:resultMode,sections:sections.map((s,index)=>({...s,display_order:index})),questions:selected.map((q,index)=>({question_id:q.question_id,section_client_id:q.section_client_id,display_order:index,marks:q.marks,negative_marks:q.negative_marks,is_mandatory:q.is_mandatory}))};
    const {data,error}=await supabase.rpc("save_question_paper",{p_paper_id:paperId,p_organization_id:kind==="admin"?null:organizationId,p_payload:payload});
    if(error){setError(error.message)}else{const saved=String(data);setPaperId(saved);setMessage(status==="published"?"Question paper published successfully.":"Draft saved successfully.");window.history.replaceState(null,"",`${base}/new/?id=${saved}`)}
    setBusy(false);
  }

  if(loading)return <div style={{padding:45,textAlign:"center",color:"#667085"}}><LoaderCircle className="spin" size={25}/> Loading paper builder…</div>;
  return <div>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"end",gap:14,flexWrap:"wrap"}}><div><Link href={`${base}/`} style={{display:"inline-flex",gap:7,alignItems:"center",fontWeight:700,color:"#667085",fontSize:13}}><ArrowLeft size={16}/>Back to papers</Link><span className="rm-label" style={{display:"block",marginTop:12}}>{organizationName}</span><h1 style={{margin:"5px 0",fontSize:34,color:"#131e35"}}>{paperId?"Edit question paper":"Create question paper"}</h1><p style={{margin:0,color:"#667085"}}>Choose approved questions, organise sections and publish a timed web examination.</p></div><div style={{display:"flex",gap:9,flexWrap:"wrap"}}><button disabled={busy} className="rm-btn-secondary" onClick={()=>save("draft")}>{busy?<LoaderCircle className="spin" size={17}/>:<Save size={17}/>}Save draft</button><button disabled={busy} className="rm-btn-primary" onClick={()=>save("published")}><CheckCircle2 size={17}/>Save & publish</button></div></div>
    {(scopeError||error)&&<div style={{marginTop:14,padding:13,borderRadius:12,background:"#fef3f2",color:"#b42318",fontWeight:650}}>{scopeError||error}</div>}
    {message&&<div style={{marginTop:14,padding:13,borderRadius:12,background:"#ecfdf3",color:"#137a3a",fontWeight:700}}>{message}</div>}

    <section className="rm-card paper-details" style={{padding:20,marginTop:18,display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:14}}>
      <label><span className="rm-label">Paper title</span><input className="rm-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Example: NEET Full Syllabus Mock 01" style={{marginTop:6}}/></label>
      <label><span className="rm-label">Paper code</span><input className="rm-input" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="NEET-M01" style={{marginTop:6}}/></label>
      <label><span className="rm-label">Exam type</span><select className="rm-input" value={examType} onChange={e=>setExamType(e.target.value)} style={{marginTop:6}}>{examTypes.map(x=><option key={x}>{x}</option>)}</select></label>
      <label style={{gridColumn:"1/-1"}}><span className="rm-label">Description</span><textarea className="rm-input" rows={2} value={description} onChange={e=>setDescription(e.target.value)} style={{marginTop:6}} placeholder="What this paper covers"/></label>
      <label><span className="rm-label">Duration (minutes)</span><input type="number" min={1} max={1440} className="rm-input" value={duration} onChange={e=>setDuration(Number(e.target.value))} style={{marginTop:6}}/></label>
      <label><span className="rm-label">Attempts allowed</span><input type="number" min={1} max={100} className="rm-input" value={attemptLimit} onChange={e=>setAttemptLimit(Number(e.target.value))} style={{marginTop:6}}/></label>
      <label><span className="rm-label">Result display</span><select className="rm-input" value={resultMode} onChange={e=>setResultMode(e.target.value as ResultMode)} style={{marginTop:6}}><option value="score_only">Score only</option><option value="score_and_answers">Score and answers</option><option value="after_close">After test closes</option><option value="hidden">Hidden</option></select></label>
      <label><span className="rm-label">Access mode</span><select className="rm-input" value={accessMode} onChange={e=>setAccessMode(e.target.value as PaperAccessMode)} style={{marginTop:6}}><option value="public">All logged-in students</option>{kind==="school"&&<option value="organization">School members only</option>}<option value="code">Access code required</option></select></label>
      {accessMode==="code"&&<label><span className="rm-label">Access code</span><input className="rm-input" value={accessCode} onChange={e=>setAccessCode(e.target.value.toUpperCase())} style={{marginTop:6}} placeholder="At least 4 characters"/></label>}
      <label><span className="rm-label">Opens at (optional)</span><input type="datetime-local" className="rm-input" value={availableFrom} onChange={e=>setAvailableFrom(e.target.value)} style={{marginTop:6}}/></label>
      <label><span className="rm-label">Closes at (optional)</span><input type="datetime-local" className="rm-input" value={availableUntil} onChange={e=>setAvailableUntil(e.target.value)} style={{marginTop:6}}/></label>
      <label style={{gridColumn:"1/-1"}}><span className="rm-label">Student instructions</span><textarea className="rm-input" rows={3} value={instructions} onChange={e=>setInstructions(e.target.value)} style={{marginTop:6}}/></label>
      <label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={shuffleQuestions} onChange={e=>setShuffleQuestions(e.target.checked)}/>Shuffle question order</label><label style={{display:"flex",gap:8,alignItems:"center"}}><input type="checkbox" checked={shuffleOptions} onChange={e=>setShuffleOptions(e.target.checked)}/>Shuffle option order</label>
    </section>

    <section className="rm-card" style={{padding:20,marginTop:18}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><span className="rm-label">Paper structure</span><h2 style={{margin:"5px 0"}}>Sections</h2></div><button className="rm-btn-secondary" onClick={addSection}><Plus size={16}/>Add section</button></div><div className="section-grid" style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:12,marginTop:12}}>{sections.map((section,index)=><div key={section.client_id} style={{border:activeSection===section.client_id?"2px solid #f6b100":"1px solid #e4e7ec",borderRadius:14,padding:14,background:activeSection===section.client_id?"#fffaf0":"white"}} onClick={()=>setActiveSection(section.client_id)}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><strong>Section {index+1}</strong><button onClick={e=>{e.stopPropagation();removeSection(section.client_id)}} style={{border:0,background:"transparent",color:"#b42318"}}><Trash2 size={16}/></button></div><input className="rm-input" value={section.title} onChange={e=>updateSection(section.client_id,{title:e.target.value})} style={{marginTop:10}}/><select className="rm-input" value={section.subject_id||""} onChange={e=>updateSection(section.client_id,{subject_id:e.target.value||undefined})} style={{marginTop:8}}><option value="">Mixed subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input type="number" min={1} className="rm-input" value={section.questions_to_attempt||""} onChange={e=>updateSection(section.client_id,{questions_to_attempt:e.target.value?Number(e.target.value):undefined})} placeholder="Questions to attempt (optional)" style={{marginTop:8}}/><div style={{fontSize:12,color:"#667085",marginTop:8}}>{selected.filter(q=>q.section_client_id===section.client_id).length} questions assigned</div></div>)}</div></section>

    <div className="builder-columns" style={{display:"grid",gridTemplateColumns:"1.08fr .92fr",gap:18,marginTop:18}}>
      <section className="rm-card" style={{padding:18,minWidth:0}}><div><span className="rm-label">Approved bank</span><h2 style={{margin:"5px 0"}}>Add questions to {currentSection?.title||"section"}</h2></div><div className="bank-filters" style={{display:"grid",gridTemplateColumns:"1fr repeat(3,140px)",gap:8,marginTop:12}}><div style={{position:"relative"}}><Search size={16} style={{position:"absolute",left:11,top:13,color:"#98a2b3"}}/><input className="rm-input" style={{paddingLeft:35}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search questions"/></div><select className="rm-input" value={subjectFilter} onChange={e=>setSubjectFilter(e.target.value)}><option value="all">All subjects</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="rm-input" value={difficultyFilter} onChange={e=>setDifficultyFilter(e.target.value)}><option value="all">All difficulties</option>{["very_easy","easy","moderate","difficult","very_difficult"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select><select className="rm-input" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="all">All types</option>{["single_correct","multiple_correct","numerical","integer","assertion_reason","image_based","passage","match_following"].map(x=><option key={x} value={x}>{x.replaceAll("_"," ")}</option>)}</select></div><div style={{maxHeight:650,overflowY:"auto",marginTop:12,display:"grid",gap:9}}>{filtered.length===0?<div style={{padding:35,textAlign:"center",color:"#667085"}}><Filter size={24}/><p>No approved questions match these filters.</p></div>:filtered.map(q=><article key={q.id} style={{border:"1px solid #e4e7ec",borderRadius:13,padding:13,background:selectedIds.has(q.id)?"#f2f4f7":"white"}}><div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"start"}}><div><strong style={{lineHeight:1.45}}>{q.stem_text}</strong><div style={{display:"flex",gap:6,marginTop:7,flexWrap:"wrap",fontSize:11,color:"#667085"}}><span>{q.subjects?.name||"Unclassified"}</span><span>•</span><span>{q.difficulty.replaceAll("_"," ")}</span><span>•</span><span>{q.question_type.replaceAll("_"," ")}</span><span>•</span><span>{q.marks} marks</span></div>{q.question_image_url&&<img src={q.question_image_url} alt="Question" style={{marginTop:8,maxWidth:180,maxHeight:100,objectFit:"contain",borderRadius:8}}/>}</div><button disabled={selectedIds.has(q.id)} className={selectedIds.has(q.id)?"rm-btn-secondary":"rm-btn-primary"} style={{padding:"8px 11px",whiteSpace:"nowrap"}} onClick={()=>addQuestion(q)}>{selectedIds.has(q.id)?"Added":"Add"}</button></div></article>)}</div></section>
      <section className="rm-card" style={{padding:18,minWidth:0}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"start",gap:10}}><div><span className="rm-label">Selected paper</span><h2 style={{margin:"5px 0"}}>{selected.length} questions · {totalMarks} marks</h2></div><FileQuestion color="#8a5f00"/></div><div style={{maxHeight:760,overflowY:"auto",display:"grid",gap:9,marginTop:12}}>{selected.length===0?<div style={{padding:45,textAlign:"center",color:"#667085"}}>Choose an active section, then add approved questions from the bank.</div>:selected.map((item,index)=><article key={item.question_id} style={{border:"1px solid #e4e7ec",borderRadius:13,padding:12}}><div style={{display:"flex",gap:9,alignItems:"start"}}><strong style={{color:"#8a5f00",minWidth:26}}>Q{index+1}</strong><div style={{flex:1,minWidth:0}}><div style={{fontWeight:700,lineHeight:1.45}}>{item.question.stem_text}</div><select className="rm-input" value={item.section_client_id} onChange={e=>updateSelected(item.question_id,{section_client_id:e.target.value})} style={{marginTop:8,padding:"8px 10px"}}>{sections.map(s=><option key={s.client_id} value={s.client_id}>{s.title}</option>)}</select><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8}}><label style={{fontSize:11,color:"#667085"}}>Marks<input type="number" step="0.25" className="rm-input" value={item.marks} onChange={e=>updateSelected(item.question_id,{marks:Number(e.target.value)})} style={{padding:"8px 9px",marginTop:3}}/></label><label style={{fontSize:11,color:"#667085"}}>Negative<input type="number" step="0.25" className="rm-input" value={item.negative_marks} onChange={e=>updateSelected(item.question_id,{negative_marks:Number(e.target.value)})} style={{padding:"8px 9px",marginTop:3}}/></label></div></div><div style={{display:"grid",gap:5}}><button className="rm-btn-secondary" style={{padding:6}} onClick={()=>moveQuestion(index,-1)}><ArrowUp size={14}/></button><button className="rm-btn-secondary" style={{padding:6}} onClick={()=>moveQuestion(index,1)}><ArrowDown size={14}/></button><button className="rm-btn-secondary" style={{padding:6,color:"#b42318"}} onClick={()=>removeQuestion(item.question_id)}><Trash2 size={14}/></button></div></div></article>)}</div></section>
    </div>
    <div style={{position:"sticky",bottom:12,marginTop:18,display:"flex",justifyContent:"flex-end",gap:9,padding:12,borderRadius:15,background:"rgba(255,255,255,.94)",boxShadow:"0 8px 30px rgba(19,30,53,.15)",backdropFilter:"blur(8px)"}}><button disabled={busy} className="rm-btn-secondary" onClick={()=>save("draft")}><Save size={17}/>Save draft</button><button disabled={busy} className="rm-btn-primary" onClick={()=>save("published")}><CheckCircle2 size={17}/>Save & publish</button></div>
    <style>{`@media(max-width:980px){.builder-columns{grid-template-columns:1fr!important}.paper-details{grid-template-columns:1fr 1fr!important}.bank-filters{grid-template-columns:1fr 1fr!important}}@media(max-width:620px){.paper-details,.section-grid,.bank-filters{grid-template-columns:1fr!important}}`}</style>
  </div>;
}
