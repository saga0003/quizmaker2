"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { parseCsv } from "@/lib/csvReader";
import { parseXlsx } from "@/lib/xlsxReader";
import { readZip } from "@/lib/zipReader";
import { ArrowLeft, CheckCircle2, Download, FileArchive, FileSpreadsheet, LoaderCircle, UploadCloud, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";
import { parseQuestionRows } from "@/lib/questionImport";
import type { ParsedQuestionRow, QuestionPayload, TaxonomyChapter, TaxonomySubject } from "@/types/questions";
import { useQuestionScope } from "./useQuestionScope";
import { normalizeImageBytes, safeImageFileName } from "@/lib/imageFiles";

const isUrl=(value:string)=>/^https?:\/\//i.test(value);
const baseName=(path:string)=>path.split(/[\\/]/).pop()?.toLowerCase()||"";


export function QuestionImporter({kind}:{kind:"admin"|"school"}){
 const {user,configured}=useAuth();const {organizationId,organizationName,loading:scopeLoading,error:scopeError}=useQuestionScope(kind);
 const [file,setFile]=useState<File|null>(null);const [zipFile,setZipFile]=useState<File|null>(null);const [rows,setRows]=useState<ParsedQuestionRow[]>([]);
 const [subjects,setSubjects]=useState<TaxonomySubject[]>([]);const [chapters,setChapters]=useState<TaxonomyChapter[]>([]);
 const [busy,setBusy]=useState(false);const [stage,setStage]=useState("");const [error,setError]=useState("");const [result,setResult]=useState<{imported:number;failed:number;errors?:Array<{row?:number;error?:string}|string>}|null>(null);
 const back=kind==="admin"?"/admin/questions/":"/school/questions/";
 useEffect(()=>{if(!supabase)return;Promise.all([supabase.from("subjects").select("id,name,code,organization_id").eq("is_active",true),supabase.from("chapters").select("id,name,subject_id,organization_id").eq("is_active",true)]).then(([s,c])=>{if(s.data)setSubjects(s.data as TaxonomySubject[]);if(c.data)setChapters(c.data as TaxonomyChapter[])})},[]);
 const valid=rows.filter(r=>r.payload&&r.errors.length===0&&!r.duplicate);const invalid=rows.filter(r=>!r.payload||r.errors.length>0||r.duplicate);
 const summary=useMemo(()=>({total:rows.length,valid:valid.length,invalid:invalid.length,images:rows.filter(r=>String(r.raw.question_image||r.raw.question_image_filename||"")).length}),[rows,valid.length,invalid.length]);

 async function parse(fileValue:File){
  setFile(fileValue);setRows([]);setError("");setResult(null);setBusy(true);setStage("Reading question file…");
  try{
   let records:Record<string,unknown>[]=[];
   const ext=fileValue.name.split(".").pop()?.toLowerCase();
   if(ext==="csv"){
    const text=await fileValue.text();records=parseCsv(text);
   }else if(ext==="xlsx"||ext==="xls"){
    records=await parseXlsx(await fileValue.arrayBuffer());
   }else throw new Error("Upload a CSV or Excel (.xlsx) file.");
   if(records.length>1000)throw new Error("This Version 4 importer supports up to 1,000 rows per file. Split larger files into multiple imports.");
   const parsed=parseQuestionRows(records);const seen=new Map<string,number>();
   parsed.forEach(row=>{const hash=`${row.payload?.stem_text.toLowerCase().replace(/\s/g,"")}|${JSON.stringify(row.payload?.options.map(o=>o.content_text.toLowerCase().replace(/\s/g,"")))}`;if(seen.has(hash)){row.duplicate=true;row.errors.push(`Possible duplicate of row ${seen.get(hash)}.`)}else seen.set(hash,row.rowNumber)});
   setRows(parsed);setStage("");
  }catch(e){setError(e instanceof Error?e.message:"Unable to read the file.");}finally{setBusy(false)}
 }

 async function prepareImages(payloads:QuestionPayload[]){
  if(!zipFile)return payloads;
  if(!supabase||!user)throw new Error("Sign in before uploading image ZIP files.");
  const client=supabase;
  const userId=user.id;
  const selectedZip=zipFile;
  setStage("Opening image ZIP…");const zip=await readZip(await selectedZip.arrayBuffer());
  const zipName=selectedZip.name;
  const entries=[...zip.values()];const byName=new Map(entries.map(entry=>[baseName(entry.name),entry]));const uploaded=new Map<string,string>();
  async function resolve(value:string){
   if(!value||isUrl(value))return value;
   const key=baseName(value);if(uploaded.has(key))return uploaded.get(key)!;
   const entry=byName.get(key);if(!entry)throw new Error(`Image '${value}' was referenced but not found inside ${zipName}.`);
   const {blob,mime}=normalizeImageBytes(entry.bytes,key);
   const safe=safeImageFileName(key);const path=`${userId}/imports/${crypto.randomUUID()}-${safe}`;
   setStage(`Uploading ${key}…`);const {error:uploadError}=await client.storage.from("question-assets").upload(path,blob,{upsert:false,contentType:mime,cacheControl:"3600"});if(uploadError)throw uploadError;
   const {data}=client.storage.from("question-assets").getPublicUrl(path);uploaded.set(key,data.publicUrl);return data.publicUrl;
  }
  for(const payload of payloads){payload.question_image_url=await resolve(payload.question_image_url||"");for(const option of payload.options)option.image_url=await resolve(option.image_url||"")}
  return payloads;
 }

 async function doImport(){
  setError("");setResult(null);
  if(!file||!valid.length){setError("Choose a valid CSV or Excel file first.");return;}
  if(!supabase||!user){setError("Connect Supabase and sign in before importing.");return;}
  if(kind==="school"&&!organizationId){setError("No school workspace was found for this account.");return;}
  setBusy(true);
  try{
   const subjectByName=new Map(subjects.map(s=>[s.name.toLowerCase(),s]));const subjectByCode=new Map(subjects.map(s=>[s.code.toLowerCase(),s]));
   const mapped=valid.map(row=>{
    const payload=structuredClone(row.payload!);const subjectName=String(row.raw.subject||"").trim().toLowerCase();const selected=subjectByName.get(subjectName)||subjectByCode.get(subjectName);
    if(!selected)throw new Error(`Row ${row.rowNumber}: subject '${row.raw.subject}' is not available in the database.`);
    payload.subject_id=selected.id;const chapterName=String(row.raw.chapter||"").trim().toLowerCase();if(chapterName){const chapter=chapters.find(c=>c.subject_id===selected.id&&c.name.toLowerCase()===chapterName);if(chapter)payload.chapter_id=chapter.id;}
    if(kind==="school"&&payload.status==="approved")payload.status="in_review";
    return payload;
   });
   const localImageRefs=mapped.flatMap(payload=>[payload.question_image_url||"",...payload.options.map(option=>option.image_url||"")]).filter(value=>value&&!isUrl(value));
   if(localImageRefs.length&&!zipFile)throw new Error(`This file references ${localImageRefs.length} local image(s). Select the matching image ZIP before importing.`);
   await prepareImages(mapped);setStage("Saving questions to Supabase…");
   const {data,error:rpcError}=await supabase.rpc("bulk_import_questions",{p_organization_id:kind==="admin"?null:organizationId,p_filename:file.name,p_format:file.name.toLowerCase().endsWith(".csv")?"csv":"xlsx",p_rows:mapped});
   if(rpcError)throw rpcError;const value=data as {imported:number;failed:number;errors?:Array<{row?:number;error?:string}|string>};setResult(value);setStage("");
  }catch(e){setError(e instanceof Error?e.message:"Import failed.");}finally{setBusy(false)}
 }

 return <div><div style={{display:"flex",justifyContent:"space-between",gap:14,alignItems:"end",flexWrap:"wrap"}}><div><Link href={back} style={{display:"inline-flex",alignItems:"center",gap:7,color:"#667085",fontWeight:700,fontSize:13}}><ArrowLeft size={16}/>Back to question bank</Link><span className="rm-label" style={{display:"block",marginTop:14}}>{organizationName}</span><h1 style={{margin:"5px 0",fontSize:32,color:"#131e35"}}>Bulk question import</h1><p style={{margin:0,color:"#667085"}}>Upload Excel or CSV, validate every row, attach a ZIP of diagrams in common image formats, and import approved rows.</p></div><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><a className="rm-btn-secondary" href="/templates/rankmint-question-template.xlsx" download><Download size={16}/> Excel template</a><a className="rm-btn-secondary" href="/templates/rankmint-question-template.csv" download><Download size={16}/> CSV template</a><a className="rm-btn-secondary" href="/templates/rankmint-sample-question-images.zip" download><FileArchive size={16}/> Sample images ZIP</a><a className="rm-btn-secondary" href="/templates/rankmint-image-format-test.csv" download><Download size={16}/> Image-format test CSV</a><a className="rm-btn-secondary" href="/templates/rankmint-image-format-test.zip" download><FileArchive size={16}/> Image-format test ZIP</a></div></div>
 {(scopeError||error)&&<div style={{marginTop:14,padding:13,borderRadius:12,background:"#fef3f2",color:"#b42318",fontWeight:650}}>{scopeError||error}</div>}
 {result&&<div style={{marginTop:14,padding:14,borderRadius:12,background:result.failed?"#fff8e6":"#ecfdf3",color:result.failed?"#8a5f00":"#137a3a",fontWeight:750}}>
  <div>Import completed: {result.imported} question(s) added, {result.failed} failed.</div>
  {!!result.failed&&!!result.errors?.length&&<details open style={{marginTop:10,fontWeight:500}}><summary style={{cursor:"pointer",fontWeight:750}}>Show database error details</summary><ol style={{margin:"8px 0 0",paddingLeft:22}}>{result.errors.slice(0,20).map((item,index)=>{const value=typeof item==="string"?item:item.error||JSON.stringify(item);const row=typeof item==="string"?index+1:item.row;return <li key={`${row}-${index}`} style={{marginTop:5}}>{row?`Import row ${row}: `:""}{value}</li>})}</ol>{result.errors.length>20&&<div style={{marginTop:8}}>Showing the first 20 of {result.errors.length} errors.</div>}</details>}
 </div>}
 <section className="import-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginTop:18}}><label className="rm-card" style={{padding:22,borderStyle:"dashed",cursor:"pointer",minHeight:170,display:"grid",placeItems:"center",textAlign:"center"}}><div><FileSpreadsheet size={32} color="#8a5f00"/><h3 style={{margin:"10px 0 5px"}}>1. Select Excel or CSV</h3><p style={{margin:"0 0 12px",color:"#667085",fontSize:13}}>{file?file.name:"Use the ScholarOS template for the cleanest import."}</p><span className="rm-btn-primary">Choose question file</span></div><input type="file" accept=".xlsx,.xls,.csv" hidden onChange={e=>e.target.files?.[0]&&parse(e.target.files[0])}/></label><label className="rm-card" style={{padding:22,borderStyle:"dashed",cursor:"pointer",minHeight:170,display:"grid",placeItems:"center",textAlign:"center"}}><div><FileArchive size={32} color="#6941c6"/><h3 style={{margin:"10px 0 5px"}}>2. Optional image ZIP</h3><p style={{margin:"0 0 12px",color:"#667085",fontSize:13}}>{zipFile?zipFile.name:"Image filenames must match the Excel/CSV cells."}</p><span className="rm-btn-secondary">Choose ZIP file</span></div><input type="file" accept=".zip" hidden onChange={e=>setZipFile(e.target.files?.[0]||null)}/></label></section>
 {rows.length>0&&<><section className="import-stats" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginTop:16}}>{[["Rows",summary.total,"#131e35"],["Ready",summary.valid,"#137a3a"],["Needs correction",summary.invalid,"#b42318"],["Image references",summary.images,"#6941c6"]].map(([label,value,color])=><div className="rm-card" style={{padding:15}} key={String(label)}><strong style={{fontSize:26,color:String(color)}}>{String(value)}</strong><div style={{fontSize:12,color:"#667085",marginTop:3}}>{String(label)}</div></div>)}</section><section className="rm-card" style={{marginTop:16,overflow:"hidden"}}><div style={{padding:15,borderBottom:"1px solid #eef1f5",display:"flex",justifyContent:"space-between",gap:12,alignItems:"center",flexWrap:"wrap"}}><div><strong>Validation preview</strong><div style={{fontSize:12,color:"#667085",marginTop:3}}>Showing the first 100 rows.</div></div><button className="rm-btn-primary" onClick={doImport} disabled={busy||valid.length===0}>{busy?<LoaderCircle className="spin" size={17}/>:<UploadCloud size={17}/>} Import {valid.length} valid question{valid.length===1?"":"s"}</button></div><div style={{overflowX:"auto"}}><table style={{width:"100%",borderCollapse:"collapse",fontSize:12,minWidth:880}}><thead><tr style={{background:"#f8fafc",textAlign:"left",color:"#667085"}}><th style={{padding:11}}>Row</th><th>Question</th><th>Subject</th><th>Type</th><th>Answer</th><th>Status</th><th>Validation</th></tr></thead><tbody>{rows.slice(0,100).map(row=><tr key={row.rowNumber} style={{borderTop:"1px solid #eef1f5"}}><td style={{padding:11}}>{row.rowNumber}</td><td style={{maxWidth:340,fontWeight:650}}>{String(row.raw.question||row.raw.stem_text||"")}</td><td>{String(row.raw.subject||"")}</td><td>{String(row.raw.question_type||"single_correct")}</td><td>{String(row.raw.correct_answer||"")}</td><td>{String(row.raw.status||"draft")}</td><td>{row.errors.length?<span style={{display:"inline-flex",gap:5,color:"#b42318",alignItems:"center"}}><XCircle size={14}/>{row.errors.join(" ")}</span>:<span style={{display:"inline-flex",gap:5,color:"#137a3a",alignItems:"center"}}><CheckCircle2 size={14}/>Ready</span>}</td></tr>)}</tbody></table></div></section></>}
 {busy&&stage&&<div style={{position:"fixed",inset:0,background:"rgba(19,30,53,.55)",display:"grid",placeItems:"center",zIndex:50}}><div className="rm-card" style={{padding:24,minWidth:300,textAlign:"center"}}><LoaderCircle className="spin" size={28} color="#8a5f00"/><h3>{stage}</h3><p style={{color:"#667085",fontSize:13}}>Do not close this tab during the import.</p></div></div>}
 {!configured&&<div style={{marginTop:14,color:"#667085",fontSize:12}}>Parsing and validation work in Demo Mode. Database import requires Supabase.</div>}
 <style>{`@media(max-width:760px){.import-grid{grid-template-columns:1fr!important}.import-stats{grid-template-columns:1fr 1fr!important}}`}</style>
 </div>
}
