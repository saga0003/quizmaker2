'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileJson2, FileText, LoaderCircle, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { parseStructuredQuestionText } from '@/lib/questionDocumentReader';
import { parseEvidaraLatexPaperPackage, type EvidaraLatexPaperMeta } from '@/lib/evidaraLatexPaperImport';
import { parseQuestionRows } from '@/lib/questionImport';
import type { QuestionPayload } from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RichQuestionContent, RichOptionContent } from '@/components/evidara/rich-math-content';

type ExistingMatch = {
  id: string;
  stem_text: string;
  status: string;
  source?: string | null;
  source_year?: number | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  similarity: number;
};
type MatchResult = { client_id: string; exact?: ExistingMatch | null; near?: ExistingMatch[] };
type ImportQuestion = {
  client_id: string;
  question_number: number;
  section_key: string;
  section_title: string;
  subject_label: string;
  payload: QuestionPayload & { subject_name?: string; chapter_name?: string; topic_name?: string };
  errors: string[];
  decision: 'new' | 'reuse' | 'review';
  existing_question_id?: string;
  match?: MatchResult;
};
type PaperMeta = EvidaraLatexPaperMeta;


async function accessToken() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error(error?.message || 'Sign in again.');
  return data.session.access_token;
}
async function api(body: Record<string, unknown>) {
  const token = await accessToken();
  const response = await fetch('/api/admin/paper-file-import/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Paper import failed.');
  return payload;
}

function header(text: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match = text.match(new RegExp(`\\\\${escaped}\\s*\\{([^}]*)\\}`,'i'));
  return match?.[1]?.trim() || '';
}
function booleanHeader(value: string) { return /^(1|true|yes|pyq)$/i.test(value.trim()); }

function latexPaperMeta(text: string): PaperMeta {
  const year = Number(header(text,'year')) || undefined;
  const variant = header(text,'variant') || 'Main';
  const exam = header(text,'exam') || header(text,'examtype') || 'Custom';
  const code = header(text,'code');
  const title = header(text,'paper') || `${exam}${year ? ` ${year}` : ''}${variant && variant!=='Main' ? ` ${variant}` : ''}`;
  const isPyq = booleanHeader(header(text,'pyq')) || Boolean(year && /neet|jee|aipmt/i.test(exam));
  return {
    title: title || 'Imported LaTeX Paper',
    code,
    exam_type: exam,
    grade_level: header(text,'grade') || 'Grade 11-12',
    test_type: isPyq ? 'previous_year_paper' : 'custom_test',
    duration_minutes: Number(header(text,'duration')) || 180,
    description: header(text,'description'),
    instructions: header(text,'instructions'),
    is_previous_year_paper: isPyq,
    source_year: year,
    source_variant: isPyq ? variant : undefined,
    source_paper_code: isPyq ? code || undefined : undefined,
    pyq_source: isPyq && year ? { exam_type: exam, year, variant, paper_code: code || undefined, display_name: title } : undefined,
  };
}

function normalizeJsonQuestion(row: Record<string, unknown>, index: number, paper: PaperMeta): ImportQuestion {
  const payloadCandidate = row.payload && typeof row.payload === 'object' ? row.payload as Record<string, unknown> : row;
  const options = Array.isArray(payloadCandidate.options) ? payloadCandidate.options : [];
  const stem = String(
    payloadCandidate.stem_text ||
    payloadCandidate.question ||
    payloadCandidate.working_stem_latex ||
    payloadCandidate.source_stem_latex ||
    '',
  );
  if (stem.trim()) {
    const subjectName = String(
      payloadCandidate.subject_name ||
      payloadCandidate.subject ||
      payloadCandidate.source_subject ||
      row.subject_label ||
      '',
    );
    const rawQuestionType = String(payloadCandidate.question_type || payloadCandidate.mapped_question_type || payloadCandidate.source_question_type || 'single_correct');
    const questionType = (/^(mcq|single[_ -]?correct)$/i.test(rawQuestionType) ? 'single_correct' : rawQuestionType) as QuestionPayload['question_type'];
    const rawAnswer = payloadCandidate.correct_answer ?? payloadCandidate.working_answer ?? payloadCandidate.source_answer_text ?? [];
    const answer = Array.isArray(rawAnswer)
      ? rawAnswer.map((value) => String(value).trim().toUpperCase()).filter(Boolean)
      : questionType === 'numerical'
        ? (typeof rawAnswer === 'number' ? rawAnswer : String(rawAnswer).trim())
        : String(rawAnswer).split(/[,|;]/).map((value) => value.trim().toUpperCase()).filter(Boolean);
    const answerKeys = new Set(Array.isArray(answer) ? answer.map(String) : []);
    const chapterName = String(payloadCandidate.chapter_name || payloadCandidate.chapter || payloadCandidate.source_chapter || payloadCandidate.taxonomy_candidate_chapter || '');
    const topicName = String(payloadCandidate.topic_name || payloadCandidate.topic || payloadCandidate.source_topic || payloadCandidate.taxonomy_candidate_topic || '');
    const sourceYear = Number(payloadCandidate.source_year || payloadCandidate.pyq_year || paper.source_year || 0) || undefined;
    const existingMetadata = (payloadCandidate.metadata && typeof payloadCandidate.metadata === 'object' ? payloadCandidate.metadata : {}) as Record<string, unknown>;
    const pyqMetadata = paper.is_previous_year_paper ? {
      pyq_exam_type: String(payloadCandidate.pyq_exam_type || paper.exam_type || ''),
      pyq_year: Number(payloadCandidate.pyq_year || sourceYear || 0) || undefined,
      pyq_variant: String(payloadCandidate.pyq_variant || paper.source_variant || 'Main'),
      pyq_paper_code: String(payloadCandidate.pyq_paper_code || paper.source_paper_code || ''),
      pyq_paper_key: String(payloadCandidate.pyq_paper_key || ''),
      pyq_paper_label: String(payloadCandidate.pyq_paper_label || paper.title || ''),
      pyq_question_number: Number(payloadCandidate.pyq_question_number || payloadCandidate.source_question_number || row.question_number || index + 1),
      source_key: String(payloadCandidate.source_key || ''),
      source_record_id: String(payloadCandidate.source_record_id || ''),
      mapping_status: String(payloadCandidate.mapping_status || ''),
      mapping_confidence: Number(payloadCandidate.mapping_confidence || 0) || undefined,
    } : {};
    return {
      client_id: String(row.client_id || payloadCandidate.staging_external_id || `q-${index+1}`),
      question_number: Number(row.question_number || payloadCandidate.question_number || payloadCandidate.source_question_number || payloadCandidate.pyq_question_number || index+1),
      section_key: String(row.section_key || row.section_title || subjectName || 'General'),
      section_title: String(row.section_title || row.section_key || subjectName || 'General'),
      subject_label: subjectName,
      payload: {
        question_type: questionType,
        status: 'in_review',
        difficulty: String(payloadCandidate.difficulty || payloadCandidate.difficulty_estimate || 'moderate') as QuestionPayload['difficulty'],
        stem_text: stem,
        stem_latex: String(payloadCandidate.stem_latex || payloadCandidate.question_latex || payloadCandidate.working_stem_latex || payloadCandidate.source_stem_latex || ''),
        question_image_url: String(payloadCandidate.question_image_url || payloadCandidate.question_image || ''),
        passage_text: String(payloadCandidate.passage_text || payloadCandidate.passage || ''),
        solution_text: String(payloadCandidate.solution_text || payloadCandidate.solution || payloadCandidate.working_solution_latex || payloadCandidate.source_solution_latex || ''),
        solution_latex: String(payloadCandidate.solution_latex || payloadCandidate.working_solution_latex || payloadCandidate.source_solution_latex || ''),
        marks: Number(payloadCandidate.marks ?? 4),
        negative_marks: Number(payloadCandidate.negative_marks ?? 1),
        estimated_seconds: Number(payloadCandidate.estimated_seconds || 0) || undefined,
        correct_answer: answer as QuestionPayload['correct_answer'],
        exam_types: Array.isArray(payloadCandidate.exam_types) ? payloadCandidate.exam_types.map(String) : [String(payloadCandidate.pyq_exam_type || paper.exam_type)],
        class_level: String(payloadCandidate.class_level || payloadCandidate.grade || paper.grade_level || ''),
        source: String(payloadCandidate.source || (paper.is_previous_year_paper ? 'Previous Year Question' : 'Paper File Import')),
        source_year: sourceYear,
        language: String(payloadCandidate.language || 'English'),
        tags: Array.isArray(payloadCandidate.tags) ? payloadCandidate.tags.map(String) : (paper.is_previous_year_paper ? ['PYQ', String(sourceYear || '')].filter(Boolean) : []),
        metadata: { ...existingMetadata, ...pyqMetadata },
        options: options.map((option, optionIndex) => {
          const value = option as Record<string, unknown>;
          const key = String(value.option_key || String.fromCharCode(65+optionIndex)).trim().toUpperCase();
          return {
            option_key: key,
            content_text: String(value.content_text || value.source_content_latex || value.working_content_latex || value.content_latex || ''),
            content_latex: String(value.content_latex || value.working_content_latex || value.source_content_latex || ''),
            image_url: String(value.image_url || ''),
            is_correct: value.is_correct !== undefined || value.source_is_correct !== undefined
              ? Boolean(value.is_correct ?? value.source_is_correct)
              : answerKeys.has(key),
            display_order: Number(value.display_order ?? optionIndex),
          };
        }),
        subject_id: String(payloadCandidate.subject_id || '') || undefined,
        chapter_id: String(payloadCandidate.chapter_id || '') || undefined,
        topic_id: String(payloadCandidate.topic_id || '') || undefined,
        subject_name: subjectName,
        chapter_name: chapterName,
        topic_name: topicName,
      },
      errors: stem.trim().length < 5 ? ['Question text is missing or too short.'] : [],
      decision: 'new',
    };
  }
  throw new Error(`Question ${index+1} does not contain a readable question/stem_text/working_stem_latex field.`);
}

function normalizeStructuredRows(rows: Record<string, unknown>[], paper: PaperMeta): ImportQuestion[] {
  return parseQuestionRows(rows.map((row)=>({
    ...row,
    exam_types: row.exam_types || paper.exam_type,
    grade: row.grade || paper.grade_level,
    status: 'in_review',
    source: row.source || (paper.is_previous_year_paper ? 'Previous Year Question' : 'Paper File Import'),
    source_year: row.source_year || paper.source_year,
  }))).map((parsed,index)=>{
    const payload = parsed.payload!;
    const subject = String(parsed.raw.subject || '');
    return {
      client_id:String(parsed.raw.external_id || `q-${index+1}`),
      question_number:Number(parsed.raw.question_number || index+1),
      section_key:String(parsed.raw.section || subject || 'General'),
      section_title:String(parsed.raw.section || subject || 'General'),
      subject_label:subject,
      payload:{
        ...payload,status:'in_review',
        metadata:{
          ...(payload.metadata || {}),
          import_format:String(parsed.raw.import_format || payload.metadata?.import_format || ''),
          import_file:String(parsed.raw.import_file || payload.metadata?.import_file || ''),
          solution_image_url:String(parsed.raw.solution_image_url || '') || undefined,
        },
        subject_name:subject,
        chapter_name:String(parsed.raw.chapter || ''),
        topic_name:String(parsed.raw.topic || ''),
      },
      errors:parsed.errors,
      decision:'new' as const,
    };
  });
}

export function PaperFileImportDialog({ open, onOpenChange, onImported }: { open: boolean; onOpenChange: (value: boolean)=>void; onImported?: ()=>void }) {
  const [paper,setPaper]=useState<PaperMeta | null>(null);
  const [questions,setQuestions]=useState<ImportQuestion[]>([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [sourceName,setSourceName]=useState('');
  const [warnings,setWarnings]=useState<string[]>([]);
  const [uploadedAssets,setUploadedAssets]=useState(0);

  async function parseFile(file: File) {
    setBusy(true); setError(''); setMessage(''); setQuestions([]); setPaper(null); setWarnings([]); setUploadedAssets(0); setSourceName(file.name);
    try {
      const ext=file.name.split('.').pop()?.toLowerCase();
      if (ext==='json') {
        const text=await file.text();
        const root=JSON.parse(text) as Record<string,unknown>;
        if (Array.isArray(root.batches)) {
          throw new Error('This JSON contains multiple papers. Import one year/paper/set at a time so Evidara can create a clearly defined paper immediately.');
        }
        const batchInput=(root.batch && typeof root.batch==='object' ? root.batch : {}) as Record<string,unknown>;
        const batchSource=(batchInput.source_paper && typeof batchInput.source_paper==='object' ? batchInput.source_paper : {}) as Record<string,unknown>;
        const paperInput=(root.paper && typeof root.paper==='object' ? root.paper : root.metadata && typeof root.metadata==='object' ? root.metadata : {}) as Record<string,unknown>;
        const paperPyq=(paperInput.pyq_source && typeof paperInput.pyq_source==='object' ? paperInput.pyq_source : {}) as Record<string,unknown>;
        const pyq=Object.keys(paperPyq).length ? paperPyq : batchSource;
        const year=Number(paperInput.source_year || pyq.year || batchInput.year || 0)||undefined;
        const isPyq=Boolean(paperInput.is_previous_year_paper ?? pyq.year ?? batchInput.source_key);
        const meta:PaperMeta={
          title:String(paperInput.title || pyq.display_name || root.title || batchInput.external_batch_id || file.name.replace(/\.json$/i,'')),
          code:String(paperInput.code || pyq.paper_code || ''),
          exam_type:String(paperInput.exam_type || pyq.exam_type || 'Custom'),
          grade_level:String(paperInput.grade_level || 'Grade 11-12'),
          test_type:String(paperInput.test_type || (isPyq?'previous_year_paper':'custom_test')),
          duration_minutes:Number(paperInput.duration_minutes || pyq.duration_minutes || 180),
          description:String(paperInput.description || ''),
          instructions:String(paperInput.instructions || ''),
          is_previous_year_paper:isPyq,
          source_year:year,
          source_variant:String(paperInput.source_variant || pyq.variant || '')||undefined,
          source_paper_code:String(paperInput.source_paper_code || pyq.paper_code || '')||undefined,
          pyq_source:isPyq&&year?{...pyq,source_key:String(pyq.source_key||batchInput.source_key||''),exam_type:String(pyq.exam_type||paperInput.exam_type||'NEET'),year,variant:String(pyq.variant||paperInput.source_variant||'Main'),paper_code:String(pyq.paper_code||paperInput.source_paper_code||'')||undefined,display_name:String(pyq.display_name||paperInput.title||root.title||batchInput.external_batch_id||'')}:undefined,
        };
        const rawQuestions=Array.isArray(root.questions)?root.questions:Array.isArray(root.rows)?root.rows:[];
        if(!rawQuestions.length) throw new Error('JSON must contain a questions array or rows array for one paper.');
        const normalized=rawQuestions.map((row,index)=>normalizeJsonQuestion(row as Record<string,unknown>,index,meta));
        setPaper(meta); setQuestions(normalized);
        await previewDuplicates(normalized);
      } else if (ext==='tex'||ext==='latex'||ext==='ltx'||ext==='zip') {
        const parsed=await parseEvidaraLatexPaperPackage(file);
        const normalized=normalizeStructuredRows(parsed.rows,parsed.paper);
        setPaper(parsed.paper); setQuestions(normalized); setWarnings(parsed.warnings); setUploadedAssets(parsed.uploadedAssets);
        await previewDuplicates(normalized);
      } else if (ext==='txt') {
        const text=await file.text();
        const meta=latexPaperMeta(text);
        const raw=parseStructuredQuestionText(text);
        const normalized=normalizeStructuredRows(raw,meta);
        setPaper(meta); setQuestions(normalized);
        await previewDuplicates(normalized);
      } else throw new Error('Use one .json, .tex, .latex, .ltx, .zip or .txt paper file.');
    } catch(e){setError(e instanceof Error?e.message:'Unable to parse this paper.');}
    finally{setBusy(false);}
  }

  async function previewDuplicates(rows:ImportQuestion[]){
    const valid=rows.filter((row)=>!row.errors.length);
    if(!valid.length) return;
    const matches:MatchResult[]=[];
    for(let start=0;start<valid.length;start+=200){
      const chunk=valid.slice(start,start+200);
      const payload=await api({action:'preview',rows:chunk.map((row)=>({client_id:row.client_id,stem_text:row.payload.stem_text,options:row.payload.options}))});
      matches.push(...((payload.matches||[]) as MatchResult[]));
    }
    const byId=new Map<string,MatchResult>(matches.map((match)=>[match.client_id,match]));
    setQuestions(rows.map((row)=>{
      const match=byId.get(row.client_id);
      const exact=match?.exact;
      return {...row,match,decision:exact?'reuse':(match?.near?.length?'review':'new'),existing_question_id:exact?.id};
    }));
  }

  function choose(index:number,decision:'new'|'reuse',existingId?:string){
    setQuestions((current)=>current.map((row,rowIndex)=>rowIndex===index?{...row,decision,existing_question_id:decision==='reuse'?existingId:undefined}:row));
  }

  async function commit(){
    if(!paper||!questions.length) return;
    const blocking=questions.filter((row)=>row.errors.length);
    if(blocking.length){setError(`${blocking.length} question${blocking.length===1?'':'s'} still have import errors.`);return;}
    const unresolved=questions.filter((row)=>row.decision==='review' || (row.match?.near?.length && !row.match.exact && row.decision==='reuse' && !row.existing_question_id));
    if(unresolved.length){setError(`${unresolved.length} possible duplicate${unresolved.length===1?'':'s'} still need a manual choice: reuse an existing question or keep both.`);return;}
    setBusy(true);setError('');setMessage('');
    try{
      const payload=await api({action:'commit',bundle:{paper,questions:questions.map(({match,errors,...row})=>row)}});
      setMessage(`Draft paper created. ${payload.result.created_questions} new questions were sent to In Review and ${payload.result.reused_questions} existing questions were reused.`);
      onImported?.();
    }catch(e){setError(e instanceof Error?e.message:'Paper import failed.');}
    finally{setBusy(false);}
  }

  const exactCount=useMemo(()=>questions.filter((row)=>row.match?.exact).length,[questions]);
  const nearCount=useMemo(()=>questions.filter((row)=>!row.match?.exact && (row.match?.near?.length||0)>0).length,[questions]);
  const errorCount=useMemo(()=>questions.filter((row)=>row.errors.length).length,[questions]);

  return <Dialog open={open} onOpenChange={(value)=>!busy&&onOpenChange(value)}>
    <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-[var(--teal)]" />Import Year / Paper / Question Set</DialogTitle>
        <DialogDescription>Import one paper at a time. Evidara stores the year, exam, variant/set, paper code and original question order, imports text + KaTeX/LaTeX + images, and creates the draft paper in the same operation.</DialogDescription>
      </DialogHeader>
      {error&&<div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">{error}</div>}
      {message&&<div className="rounded-xl border border-[var(--teal)]/20 bg-[var(--secondary)]/60 px-4 py-3 text-sm text-[var(--teal)]">{message}</div>}
      {warnings.length>0&&<div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber)]/10 px-4 py-3 text-sm text-[#6A5100]"><strong>Import warnings:</strong><ul className="mt-2 list-disc space-y-1 pl-5">{warnings.slice(0,12).map((warning,index)=><li key={`${warning}-${index}`}>{warning}</li>)}</ul>{warnings.length>12&&<div className="mt-2 text-xs">+ {warnings.length-12} more warnings</div>}</div>}
      <Card className="shadow-none"><CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold">Choose one complete year / paper / set</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Recommended: one .tex file, or one ZIP containing that .tex plus its images. Define \\paper, \\exam, \\year, \\variant (or set), \\code, \\duration and one \\begin{'{'}question{'}'} block per question.</p><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs"><a className="font-medium text-[var(--teal)] underline underline-offset-2" href="/templates/Evidara_LaTeX_Paper_Template.tex" download>Download Evidara LaTeX template</a><a className="font-medium text-[var(--teal)] underline underline-offset-2" href="/templates/Evidara_AI_QuestionBank_to_LaTeX_Prompt.txt" download>Download AI conversion prompt</a></div></div>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-[var(--teal)] px-4 text-sm font-medium text-white"><FileText className="mr-2 h-4 w-4" />Choose Paper Package<input className="hidden" type="file" accept=".json,.tex,.latex,.ltx,.zip,.txt,application/json,text/plain,application/zip" disabled={busy} onChange={(event)=>{const file=event.target.files?.[0];if(file)void parseFile(file);event.currentTarget.value='';}}/></label>
        </div>
      </CardContent></Card>
      {paper&&<div className="space-y-4">
        <Card className="shadow-none"><CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{paper.title}</h3>{paper.is_previous_year_paper&&<Badge className="bg-[var(--secondary)] text-[var(--teal)]">PYQ · {paper.source_year} {paper.source_variant}</Badge>}<Badge variant="outline">{questions.length} questions</Badge></div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{sourceName} · {paper.exam_type} · {paper.duration_minutes} min{uploadedAssets>0?` · ${uploadedAssets} image asset${uploadedAssets===1?'':'s'} uploaded`:''}</p></div><div className="flex gap-2 text-xs"><span className="rounded-full bg-[var(--muted)] px-2.5 py-1">{exactCount} exact reused</span><span className="rounded-full bg-[var(--amber)]/15 px-2.5 py-1">{nearCount} similar</span>{errorCount>0&&<span className="rounded-full bg-[var(--destructive)]/10 px-2.5 py-1 text-[var(--destructive)]">{errorCount} errors</span>}</div></div>
        </CardContent></Card>
        <div className="space-y-3">{questions.map((row,index)=>{
          const near=row.match?.near||[];
          return <Card key={row.client_id} className={`shadow-none ${row.errors.length?'border-[var(--destructive)]/30':near.length||row.match?.exact?'border-[var(--amber)]/30':'border-[var(--line)]'}`}><CardContent className="p-4">
            <div className="flex items-start gap-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-xs font-bold">Q{row.question_number}</div><div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{row.subject_label||'Unmapped subject'}</Badge>{row.payload.metadata?.import_chapter&&<Badge variant="outline">{String(row.payload.metadata.import_chapter)}</Badge>}{row.match?.exact&&<Badge className="bg-[var(--secondary)] text-[var(--teal)]"><Check className="mr-1 h-3 w-3"/>Exact existing question</Badge>}{!row.match?.exact&&near.length>0&&<Badge className="bg-[var(--amber)]/20 text-[#7A5800]"><AlertTriangle className="mr-1 h-3 w-3"/>Possible duplicate</Badge>}</div>
              <div className="mt-2 rounded-xl border border-[var(--line)] bg-white p-3 text-sm text-[var(--foreground)]"><RichQuestionContent text={row.payload.stem_text} latex={row.payload.stem_latex} imageUrl={row.payload.question_image_url} textClassName="text-sm" />{row.payload.options.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">{row.payload.options.map((option)=><div key={option.option_key} className="flex gap-2 rounded-lg border border-[var(--line)] px-2.5 py-2 text-xs"><strong>{option.option_key}.</strong><RichOptionContent text={option.content_text} latex={option.content_latex} imageUrl={option.image_url} imageAlt={`Option ${option.option_key}`} /></div>)}</div>}</div>
              {row.errors.length>0&&<div className="mt-2 text-xs text-[var(--destructive)]">{row.errors.join(' · ')}</div>}
              {row.match?.exact&&<div className="mt-3 grid gap-3 md:grid-cols-2"><div className="rounded-xl border bg-white p-3"><div className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">Imported</div><p className="mt-1 text-xs">{row.payload.stem_text}</p></div><div className="rounded-xl border border-[var(--teal)]/20 bg-[var(--secondary)]/40 p-3"><div className="text-[10px] font-semibold uppercase text-[var(--teal)]">Existing question — automatically reused</div><p className="mt-1 text-xs">{row.match.exact.stem_text}</p><p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{row.match.exact.subject} · {row.match.exact.chapter} · {row.match.exact.topic}</p></div></div>}
              {!row.match?.exact&&near.length>0&&<div className="mt-3 space-y-2"><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border bg-white p-3"><div className="text-[10px] font-semibold uppercase text-[var(--muted-foreground)]">Imported question</div><p className="mt-1 text-xs">{row.payload.stem_text}</p><Button size="sm" variant={row.decision==='new'?'default':'outline'} className="mt-3" onClick={()=>choose(index,'new')}>Keep both / import this</Button></div><div className="space-y-2">{near.map((candidate)=><button type="button" key={candidate.id} onClick={()=>choose(index,'reuse',candidate.id)} className={`w-full rounded-xl border p-3 text-left ${row.decision==='reuse'&&row.existing_question_id===candidate.id?'border-[var(--teal)] bg-[var(--secondary)]/50':'border-[var(--line)] bg-white'}`}><div className="flex justify-between gap-2"><span className="text-[10px] font-semibold uppercase text-[var(--teal)]">Existing · {Math.round(Number(candidate.similarity)*100)}% similar</span>{row.decision==='reuse'&&row.existing_question_id===candidate.id&&<Check className="h-4 w-4 text-[var(--teal)]"/>}</div><p className="mt-1 text-xs">{candidate.stem_text}</p><p className="mt-1 text-[10px] text-[var(--muted-foreground)]">{candidate.subject} · {candidate.chapter} · {candidate.topic}</p></button>)}</div></div></div>}
            </div></div>
          </CardContent></Card>;
        })}</div>
      </div>}
      <DialogFooter><Button variant="outline" onClick={()=>onOpenChange(false)} disabled={busy}><X className="mr-2 h-4 w-4"/>Close</Button><Button onClick={()=>void commit()} disabled={busy||!paper||!questions.length||errorCount>0} className="bg-[var(--teal)] text-white">{busy?<LoaderCircle className="mr-2 h-4 w-4 animate-spin"/>:<FileJson2 className="mr-2 h-4 w-4"/>}Create Draft Paper</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
