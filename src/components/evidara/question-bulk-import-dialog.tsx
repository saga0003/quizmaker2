'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileArchive,
  FileCode2,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Upload,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import { normalizeImageBytes, safeImageFileName } from '@/lib/imageFiles';
import { bulkQuestionTemplateHeaders, parseQuestionRows } from '@/lib/questionImport';
import { parseStructuredQuestionText, readQuestionDocument } from '@/lib/questionDocumentReader';
import { readZip } from '@/lib/zipReader';
import { downloadBlob } from '@/lib/simpleZip';
import {
  downloadQuestionImageZipTemplate,
  downloadQuestionImportGuide,
  downloadQuestionTemplateWorkbook,
} from '@/lib/questionTemplateWorkbook';
import type {
  MatchFollowingPair,
  ParsedQuestionRow,
  QuestionDifficulty,
  QuestionPayload,
  QuestionStatus,
  QuestionTestType,
  QuestionType,
  TaxonomyChapter,
  TaxonomySubject,
  TaxonomyTopic,
} from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GuidedLabel, HelpIcon } from '@/components/evidara/question-help';
import { QuestionDevicePreview } from '@/components/evidara/question-device-preview';
import { SearchableTaxonomySelect } from '@/components/evidara/searchable-taxonomy-select';

const isUrl = (value: string) => /^https?:\/\//i.test(value);
const baseName = (value: string) => value.split(/[\\/]/).pop()?.toLowerCase() || '';
const simpleQuestionTypes: QuestionType[] = ['single_correct', 'multiple_correct', 'numerical', 'integer', 'assertion_reason', 'passage', 'image_based'];
const difficulties: QuestionDifficulty[] = ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'];
const testTypes: QuestionTestType[] = ['full_length', 'part_test', 'chapter_test', 'topic_test', 'custom'];

function templateCsv() {
  const example: Record<string, string> = {
    exam_types: 'NEET', test_type: 'chapter_test', class_level: 'Class 11', subject: 'Physics', chapter: 'Units and Measurements', topic: 'Dimensions',
    question_type: 'single_correct', difficulty: 'moderate', question: 'Which quantity is dimensionless?', option_a: 'Velocity', option_b: 'Strain', option_c: 'Force', option_d: 'Energy',
    correct_answer: 'B', solution: 'Strain is a ratio and therefore dimensionless.', marks: '4', negative_marks: '1', estimated_seconds: '60', language: 'English', status: 'draft',
  };
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return `${bulkQuestionTemplateHeaders.map(escape).join(',')}\n${bulkQuestionTemplateHeaders.map((key) => escape(example[key] || '')).join(',')}\n`;
}

function downloadCsvTemplate() {
  downloadBlob(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }), 'evidara-question-import-template.csv');
}

function displayError(item: { row?: number; error?: string } | string) {
  return typeof item === 'string' ? item : `${item.row ? `Row ${item.row}: ` : ''}${item.error || 'Unknown database error'}`;
}

function rawText(raw: Record<string, unknown>, key: string) {
  return String(raw[key] ?? '');
}

function duplicateKey(payload: QuestionPayload) {
  return `${payload.stem_text.toLowerCase().replace(/\s/g, '')}|${JSON.stringify(payload.options.map((option) => `${option.content_text}${option.content_latex || ''}`.toLowerCase().replace(/\s/g, '')))}`;
}

export function QuestionBulkImportDialog({
  open,
  onOpenChange,
  kind,
  organizationId,
  subjects,
  chapters,
  topics,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'admin' | 'school';
  organizationId: string | null;
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  topics: TaxonomyTopic[];
  onImported: () => Promise<void> | void;
}) {
  const { user, profile } = useAuth();
  const role = normalizeEvidaraRole(profile?.role);
  const canPublish = role === 'super_admin' || role === 'evidara_admin' || role === 'school_admin';
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [imageZip, setImageZip] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [format, setFormat] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [latexText, setLatexText] = useState('');
  const [showLatexWorkspace, setShowLatexWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; failed: number; errors?: Array<{ row?: number; error?: string } | string> } | null>(null);

  const orderedSubjects = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [subjects]);
  const orderedChapters = useMemo(() => [...chapters].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [chapters]);
  const orderedTopics = useMemo(() => [...topics].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [topics]);

  const rows = useMemo(() => {
    const subjectByName = new Map(orderedSubjects.map((subject) => [subject.name.trim().toLowerCase(), subject]));
    const subjectByCode = new Map(orderedSubjects.map((subject) => [subject.code.trim().toLowerCase(), subject]));
    const parsed = parseQuestionRows(rawRows).map((row) => {
      const payload = structuredClone(row.payload!);
      const errors = [...row.errors];
      const subjectValue = String(row.raw.subject || payload.metadata?.import_subject || '').trim().toLowerCase();
      const selectedSubject = subjectByName.get(subjectValue) || subjectByCode.get(subjectValue);
      if (!selectedSubject) errors.push(`Subject '${String(row.raw.subject || '')}' is not available in Question Settings.`);
      else payload.subject_id = selectedSubject.id;

      const chapterValue = String(row.raw.chapter || payload.metadata?.import_chapter || '').trim().toLowerCase();
      const selectedChapter = chapterValue && selectedSubject
        ? orderedChapters.find((chapter) => chapter.subject_id === selectedSubject.id && chapter.name.trim().toLowerCase() === chapterValue)
        : undefined;
      if (chapterValue && !selectedChapter) errors.push(`Chapter '${String(row.raw.chapter || '')}' does not match the selected subject.`);
      if (selectedChapter) payload.chapter_id = selectedChapter.id;

      const topicValue = String(row.raw.topic || payload.metadata?.import_topic || '').trim().toLowerCase();
      const selectedTopic = topicValue && selectedChapter
        ? orderedTopics.find((topic) => topic.chapter_id === selectedChapter.id && topic.name.trim().toLowerCase() === topicValue)
        : undefined;
      if (topicValue && !selectedTopic) errors.push(`Topic '${String(row.raw.topic || '')}' does not match the selected chapter.`);
      if (selectedTopic) payload.topic_id = selectedTopic.id;

      if (!canPublish && payload.status === 'approved') errors.push('Teachers cannot publish. Change status to draft or in_review.');
      return { ...row, payload, errors };
    });

    const seen = new Map<string, number>();
    return parsed.map((row) => {
      if (!row.payload) return row;
      const key = duplicateKey(row.payload);
      const previous = seen.get(key);
      if (previous) return { ...row, duplicate: true, errors: [...row.errors, `Possible duplicate of row ${previous}.`] };
      seen.set(key, row.rowNumber);
      return row;
    });
  }, [canPublish, orderedChapters, orderedSubjects, orderedTopics, rawRows]);

  const valid = useMemo(() => rows.filter((row) => row.payload && row.errors.length === 0 && !row.duplicate), [rows]);
  const invalid = useMemo(() => rows.filter((row) => !row.payload || row.errors.length > 0 || row.duplicate), [rows]);
  const current = rows[currentIndex] || null;
  const currentPayload = current?.payload;
  const currentSubjectId = currentPayload?.subject_id || '';
  const currentChapterId = currentPayload?.chapter_id || '';
  const currentChapters = orderedChapters.filter((chapter) => !currentSubjectId || chapter.subject_id === currentSubjectId);
  const currentTopics = orderedTopics.filter((topic) => !currentChapterId || topic.chapter_id === currentChapterId);

  const imageReferences = useMemo(() => rows.reduce((count, row) => {
    const payload = row.payload;
    if (!payload) return count;
    const matches = (payload.metadata?.match_pairs || []) as MatchFollowingPair[];
    return count + (payload.question_image_url ? 1 : 0) + payload.options.filter((option) => option.image_url).length + matches.filter((pair) => pair.left_image_url || pair.right_image_url).length;
  }, 0), [rows]);

  function reset() {
    setQuestionFile(null);
    setImageZip(null);
    setRawRows([]);
    setFormat('');
    setCurrentIndex(0);
    setLatexText('');
    setShowLatexWorkspace(false);
    setStage('');
    setError('');
    setResult(null);
  }

  async function parse(file: File) {
    setQuestionFile(file);
    setRawRows([]);
    setResult(null);
    setError('');
    setBusy(true);
    setStage(`Reading ${file.name}…`);
    try {
      const document = await readQuestionDocument(file);
      if (document.rows.length > 2000) throw new Error('Import files are limited to 2,000 questions per batch. Split larger banks into separate files.');
      setRawRows(document.rows);
      setFormat(document.format);
      setCurrentIndex(0);
      setStage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read this question file.');
    } finally {
      setBusy(false);
    }
  }

  function reviewPastedLatex() {
    setError('');
    try {
      const parsed = parseStructuredQuestionText(latexText);
      if (!parsed.length) throw new Error('No labelled questions could be detected in the pasted LaTeX.');
      if (parsed.length > 2000) throw new Error('Pasted batches are limited to 2,000 questions.');
      const file = new File([latexText], 'pasted-question-latex.tex', { type: 'text/plain' });
      setQuestionFile(file);
      setRawRows(parsed);
      setFormat('tex');
      setCurrentIndex(0);
      setResult(null);
      setShowLatexWorkspace(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to parse the pasted LaTeX.');
    }
  }

  function updateRaw(key: string, value: unknown) {
    setRawRows((existing) => existing.map((row, index) => index === currentIndex ? { ...row, [key]: value } : row));
  }

  function jumpToFirstError() {
    const index = rows.findIndex((row) => row.errors.length > 0 || row.duplicate);
    if (index >= 0) setCurrentIndex(index);
  }

  async function prepareImages(payloads: QuestionPayload[]) {
    const localReferences = payloads.flatMap((payload) => {
      const pairs = (payload.metadata?.match_pairs || []) as MatchFollowingPair[];
      return [payload.question_image_url || '', ...payload.options.map((option) => option.image_url || ''), ...pairs.flatMap((pair) => [pair.left_image_url || '', pair.right_image_url || ''])];
    }).filter((value) => value && !isUrl(value));

    if (!localReferences.length) return payloads;
    if (!imageZip) throw new Error(`${localReferences.length} local image reference(s) were found. Attach the matching image ZIP.`);
    if (!supabase || !user) throw new Error('Sign in before uploading question images.');
    const zipFile = imageZip;
    const client = supabase;
    const activeUser = user;
    setStage('Opening image ZIP…');
    const zip = await readZip(await zipFile.arrayBuffer());
    const byName = new Map([...zip.values()].map((entry) => [baseName(entry.name), entry]));
    const uploaded = new Map<string, string>();

    async function resolve(value: string) {
      if (!value || isUrl(value)) return value;
      const key = baseName(value);
      if (uploaded.has(key)) return uploaded.get(key)!;
      const entry = byName.get(key);
      if (!entry) throw new Error(`Image '${value}' was referenced but was not found inside ${zipFile.name}.`);
      const { blob, mime } = normalizeImageBytes(entry.bytes, key);
      const path = `${activeUser.id}/imports/${crypto.randomUUID()}-${safeImageFileName(key)}`;
      setStage(`Uploading ${key}…`);
      const { error: uploadError } = await client.storage.from('question-assets').upload(path, blob, { upsert: false, contentType: mime, cacheControl: '3600' });
      if (uploadError) throw uploadError;
      const { data } = client.storage.from('question-assets').getPublicUrl(path);
      uploaded.set(key, data.publicUrl);
      return data.publicUrl;
    }

    for (const payload of payloads) {
      payload.question_image_url = await resolve(payload.question_image_url || '');
      for (const option of payload.options) option.image_url = await resolve(option.image_url || '');
      const pairs = (payload.metadata?.match_pairs || []) as MatchFollowingPair[];
      for (const pair of pairs) {
        pair.left_image_url = await resolve(pair.left_image_url || '');
        pair.right_image_url = await resolve(pair.right_image_url || '');
      }
    }
    return payloads;
  }

  async function runImport() {
    setError('');
    setResult(null);
    if (!questionFile || !valid.length) {
      setError('Choose a question source with at least one valid row.');
      return;
    }
    if (!supabase || !user) {
      setError('Sign in to Evidara before importing.');
      return;
    }
    if (kind === 'school' && !organizationId) {
      setError('This account is not linked to a school organization.');
      return;
    }

    setBusy(true);
    try {
      const payloads = valid.map((row) => {
        const payload = structuredClone(row.payload!);
        payload.metadata = { ...(payload.metadata || {}), import_format: format, import_file: questionFile.name };
        if (!canPublish && payload.status === 'approved') payload.status = 'in_review';
        if (payload.status === 'approved') payload.metadata.published_at = payload.metadata.published_at || new Date().toISOString();
        return payload;
      });
      await prepareImages(payloads);
      setStage('Saving reviewed questions…');
      const rpcFormat = format === 'csv' ? 'csv' : format === 'xlsx' || format === 'xls' ? 'xlsx' : 'manual_batch';
      const { data, error: importError } = await supabase.rpc('bulk_import_questions', {
        p_organization_id: kind === 'admin' ? null : organizationId,
        p_filename: questionFile.name,
        p_format: rpcFormat,
        p_rows: payloads,
      });
      if (importError) throw importError;
      const summary = data as { imported: number; failed: number; errors?: Array<{ row?: number; error?: string } | string> };
      setResult(summary);
      setStage('');
      if (summary.imported > 0) await onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Question import failed.');
    } finally {
      setBusy(false);
    }
  }

  const previewOptions = currentPayload?.options || [];
  const previewCorrect = Array.isArray(currentPayload?.correct_answer) ? currentPayload.correct_answer.join('|') : String(currentPayload?.correct_answer || '');
  const statCards: Array<{ label: string; value: number; Icon: typeof FileSpreadsheet; tone: string }> = [
    { label: 'Questions detected', value: rows.length, Icon: FileSpreadsheet, tone: '#14232B' },
    { label: 'Ready to import', value: valid.length, Icon: CheckCircle2, tone: '#0E5A5A' },
    { label: 'Needs correction', value: invalid.length, Icon: XCircle, tone: '#B54747' },
    { label: 'Image references', value: imageReferences, Icon: FileArchive, tone: '#8A5F00' },
  ];

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
      <DialogContent className="max-h-[96vh] w-[96vw] max-w-[1540px] overflow-hidden border-[#E7ECEB] p-0">
        <DialogHeader className="border-b border-[#E7ECEB] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 pr-8 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <DialogTitle className="text-xl text-[#14232B]">Bulk Question Import and Review</DialogTitle>
              <DialogDescription className="mt-1 max-w-3xl">Excel is recommended because it includes fixed-value dropdowns. Every detected question remains editable inside Evidara before anything is published.</DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => void downloadQuestionTemplateWorkbook({ subjects, chapters, topics })} className="border-[#E7ECEB]"><Download className="mr-1.5 h-4 w-4" />Excel</Button>
              <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate} className="border-[#E7ECEB]"><Download className="mr-1.5 h-4 w-4" />CSV</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void downloadQuestionImageZipTemplate()} className="border-[#E7ECEB]"><FileArchive className="mr-1.5 h-4 w-4" />Image ZIP</Button>
              <Button type="button" variant="outline" size="sm" onClick={downloadQuestionImportGuide} className="border-[#E7ECEB]"><FileText className="mr-1.5 h-4 w-4" />Guide</Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowLatexWorkspace((value) => !value)} className="border-[#E7ECEB]"><FileCode2 className="mr-1.5 h-4 w-4" />Paste LaTeX</Button>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#FBFCFC] px-3 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-4 text-sm text-[#6B7980]"><div className="flex items-start gap-2"><HelpIcon text="Excel, CSV, Word, text-based PDF, TEX, TXT and JSON are supported. Scanned PDFs are not silently OCR-processed. Invalid rows remain editable in this review workspace." /><span>Nothing is saved until you click the final import button. You may review one question and import the batch immediately, or move through every question first.</span></div></div>

          {showLatexWorkspace && (
            <div className="mb-5 rounded-2xl border border-[#DCE9E7] bg-white p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-[#14232B]">Paste LaTeX question code</strong><p className="text-xs text-[#6B7980]">Paste structured question blocks, review the live rendering, then edit any incorrect field directly.</p></div><Button type="button" onClick={reviewPastedLatex} disabled={!latexText.trim()} className="bg-[#0E5A5A] text-white"><FileCode2 className="mr-2 h-4 w-4" />Review pasted LaTeX</Button></div>
              <Textarea rows={10} value={latexText} onChange={(event) => setLatexText(event.target.value)} placeholder={'\\begin{question}\n\\subject{Physics}\n\\question{...}\n\\option[A]{...}\n\\answer{A}\n\\solution{...}\n\\end{question}'} className="mt-4 border-[#E7ECEB] font-mono text-xs" />
            </div>
          )}

          {(error || result) && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error || result?.failed ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#0E5A5A]/20 bg-[#DCE9E7]/50 text-[#0E5A5A]'}`}>{error || `Import completed: ${result?.imported || 0} added, ${result?.failed || 0} failed.`}{!!result?.errors?.length && <details className="mt-2"><summary className="cursor-pointer font-semibold">Show database errors</summary><ol className="mt-2 list-decimal space-y-1 pl-5">{result.errors.slice(0, 50).map((item, index) => <li key={index}>{displayError(item)}</li>)}</ol></details>}</div>}

          {!rows.length && (
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DCE9E7] bg-[#F7F9F7] p-5 text-center transition hover:border-[#0E5A5A]/40"><FileSpreadsheet className="h-10 w-10 text-[#0E5A5A]" /><strong className="mt-3 text-[#14232B]">1. Question source file</strong><p className="mt-1 max-w-md text-xs leading-relaxed text-[#6B7980]">{questionFile ? questionFile.name : 'Recommended: XLSX. Also supports CSV, XLS, DOCX, text PDF, TEX, TXT and JSON.'}</p><span className="mt-3 rounded-lg bg-[#0E5A5A] px-3 py-2 text-xs font-semibold text-white">Choose source file</span><input hidden type="file" accept=".csv,.xlsx,.xls,.docx,.pdf,.tex,.txt,.json" onChange={(event) => event.target.files?.[0] && void parse(event.target.files[0])} /></label>
              <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E7ECEB] bg-white p-5 text-center transition hover:border-[#F2B84B]"><FileArchive className="h-10 w-10 text-[#8A5F00]" /><strong className="mt-3 text-[#14232B]">2. Optional image ZIP</strong><p className="mt-1 max-w-md text-xs leading-relaxed text-[#6B7980]">{imageZip ? imageZip.name : 'Attach when question or option image cells contain local filenames instead of public URLs.'}</p><span className="mt-3 rounded-lg border border-[#E7ECEB] px-3 py-2 text-xs font-semibold text-[#14232B]">Choose image ZIP</span><input hidden type="file" accept=".zip" onChange={(event) => setImageZip(event.target.files?.[0] || null)} /></label>
            </div>
          )}

          {busy && stage && <div className="mt-5 rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-4"><div className="flex items-center gap-3 text-sm font-medium text-[#14232B]"><LoaderCircle className="h-5 w-5 animate-spin text-[#0E5A5A]" />{stage}</div><Progress value={65} className="mt-3 h-2" /></div>}

          {!!rows.length && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statCards.map(({ label, value, Icon, tone }) => <div key={label} className="rounded-xl border border-[#E7ECEB] bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#6B7980]">{label}</span><Icon className="h-4 w-4" style={{ color: tone }} /></div><strong className="mt-2 block text-2xl" style={{ color: tone }}>{value}</strong></div>)}</div>

              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-[#E7ECEB] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" disabled={currentIndex <= 0} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} className="border-[#E7ECEB]"><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><Button type="button" variant="outline" size="sm" disabled={currentIndex >= rows.length - 1} onClick={() => setCurrentIndex((value) => Math.min(rows.length - 1, value + 1))} className="border-[#E7ECEB]">Next question<ChevronRight className="ml-1 h-4 w-4" /></Button></div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7980]"><span>Reviewing question <strong className="text-[#14232B]">{currentIndex + 1}</strong> of {rows.length}</span>{invalid.length > 0 && <Button type="button" variant="ghost" size="sm" onClick={jumpToFirstError} className="h-8 text-[#B54747]"><AlertCircle className="mr-1 h-4 w-4" />Jump to first error</Button>}</div>
              </div>

              {current && currentPayload && (
                <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[230px_minmax(0,1fr)_minmax(360px,.62fr)]">
                  <aside className="min-w-0 rounded-2xl border border-[#E7ECEB] bg-white p-3 xl:sticky xl:top-0 xl:max-h-[72vh] xl:self-start xl:overflow-y-auto">
                    <strong className="text-sm text-[#14232B]">Question navigator</strong><p className="mt-1 text-xs text-[#6B7980]">Click any row, especially those marked red.</p>
                    <div className="mt-3 space-y-1.5">{rows.map((row, index) => <button key={`${row.rowNumber}-${index}`} type="button" onClick={() => setCurrentIndex(index)} className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${index === currentIndex ? 'border-[#0E5A5A] bg-[#DCE9E7]/45' : row.errors.length || row.duplicate ? 'border-[#B54747]/20 bg-[#B54747]/5' : 'border-[#E7ECEB] hover:border-[#0E5A5A]/30'}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${row.errors.length || row.duplicate ? 'bg-[#B54747] text-white' : 'bg-[#DCE9E7] text-[#0E5A5A]'}`}>{index + 1}</span><span className="min-w-0"><span className="line-clamp-2 block text-xs font-medium text-[#14232B]">{String(row.raw.question || row.raw.stem_text || 'Untitled question')}</span><span className={`mt-0.5 block text-[10px] ${row.errors.length || row.duplicate ? 'text-[#B54747]' : 'text-[#0E5A5A]'}`}>{row.errors.length || row.duplicate ? `${row.errors.length} issue${row.errors.length === 1 ? '' : 's'}` : 'Ready'}</span></span></button>)}</div>
                  </aside>

                  <main className="min-w-0 space-y-4">
                    {current.errors.length > 0 && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 p-3"><div className="flex items-center gap-2 text-sm font-semibold text-[#B54747]"><AlertCircle className="h-4 w-4" />Correct these fields before import</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#B54747]">{current.errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}

                    <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4">
                      <div className="mb-4"><strong className="text-sm text-[#14232B]">Classification</strong><p className="text-xs text-[#6B7980]">Search existing taxonomy and correct any mismatched fixed value.</p></div>
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <div className="space-y-2"><GuidedLabel required help="Choose an existing subject from Question Settings.">Subject</GuidedLabel><SearchableTaxonomySelect value={currentSubjectId} onValueChange={(subjectId) => { const subject = orderedSubjects.find((item) => item.id === subjectId); updateRaw('subject', subject?.name || ''); updateRaw('chapter', ''); updateRaw('topic', ''); }} options={orderedSubjects.map((subject) => ({ value: subject.id, label: subject.name, description: subject.code }))} placeholder="Search subject" /></div>
                        <div className="space-y-2"><GuidedLabel help="Choose the chapter belonging to the selected subject.">Chapter</GuidedLabel><SearchableTaxonomySelect value={currentChapterId} onValueChange={(chapterId) => { const chapter = orderedChapters.find((item) => item.id === chapterId); updateRaw('chapter', chapter?.name || ''); updateRaw('topic', ''); }} options={currentChapters.map((chapter) => ({ value: chapter.id, label: chapter.name }))} placeholder="Search chapter" disabled={!currentSubjectId} allowClear clearLabel="No chapter" /></div>
                        <div className="space-y-2"><GuidedLabel help="Topic is optional but recommended.">Topic</GuidedLabel><SearchableTaxonomySelect value={currentPayload.topic_id || ''} onValueChange={(topicId) => { const topic = orderedTopics.find((item) => item.id === topicId); updateRaw('topic', topic?.name || ''); }} options={currentTopics.map((topic) => ({ value: topic.id, label: topic.name }))} placeholder="Search topic" disabled={!currentChapterId} allowClear clearLabel="No topic" /></div>
                        <div className="space-y-2"><GuidedLabel required help="The simple template excludes Match the Following; use the manual editor for that format.">Question type</GuidedLabel><Select value={currentPayload.question_type} onValueChange={(value) => updateRaw('question_type', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{simpleQuestionTypes.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><GuidedLabel required help="Choose a supported fixed difficulty.">Difficulty</GuidedLabel><Select value={currentPayload.difficulty} onValueChange={(value) => updateRaw('difficulty', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{difficulties.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><GuidedLabel required help="Choose the intended test classification.">Test type</GuidedLabel><Select value={currentPayload.metadata?.test_type || 'chapter_test'} onValueChange={(value) => updateRaw('test_type', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{testTypes.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><GuidedLabel help="Teachers can use Draft or In Review only.">Status</GuidedLabel><Select value={currentPayload.status} onValueChange={(value) => updateRaw('status', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{(canPublish ? ['draft', 'in_review', 'approved'] : ['draft', 'in_review']).map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                        <div className="space-y-2"><GuidedLabel required help="Use | between multiple examinations.">Exam types</GuidedLabel><Input value={rawText(current.raw, 'exam_types')} onChange={(event) => updateRaw('exam_types', event.target.value)} placeholder="NEET|KCET" className="border-[#E7ECEB]" /></div>
                        <div className="space-y-2"><GuidedLabel help="Grade or class used for filters.">Class level</GuidedLabel><Input value={rawText(current.raw, 'class_level')} onChange={(event) => updateRaw('class_level', event.target.value)} className="border-[#E7ECEB]" /></div>
                      </div>
                      {(currentPayload.metadata?.test_type === 'custom' || rawText(current.raw, 'test_type') === 'custom') && <div className="mt-4 max-w-md space-y-2"><GuidedLabel required help="Name the custom test classification.">Custom test type</GuidedLabel><Input value={rawText(current.raw, 'custom_test_type')} onChange={(event) => updateRaw('custom_test_type', event.target.value)} className="border-[#E7ECEB]" /></div>}
                    </div>

                    <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4">
                      <div className="mb-4"><strong className="text-sm text-[#14232B]">Question, LaTeX and image</strong><p className="text-xs text-[#6B7980]">Edit here and verify the rendered version in the live preview.</p></div>
                      <div className="space-y-4"><div className="space-y-2"><GuidedLabel required help="Complete learner-facing question text.">Question text</GuidedLabel><Textarea rows={6} value={rawText(current.raw, 'question') || rawText(current.raw, 'stem_text')} onChange={(event) => updateRaw('question', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Paste and correct question LaTeX directly.">Question LaTeX</GuidedLabel><Textarea rows={3} value={rawText(current.raw, 'question_latex') || rawText(current.raw, 'stem_latex')} onChange={(event) => updateRaw('question_latex', event.target.value)} className="border-[#E7ECEB] font-mono text-xs" /></div><div className="space-y-2"><GuidedLabel help="Public HTTPS URL or exact filename from the attached image ZIP.">Question image</GuidedLabel><Input value={rawText(current.raw, 'question_image')} onChange={(event) => updateRaw('question_image', event.target.value)} placeholder="https://... or physics-q1.png" className="border-[#E7ECEB]" /></div></div>
                    </div>

                    <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4">
                      <div className="mb-4"><strong className="text-sm text-[#14232B]">Options and correct answer</strong><p className="text-xs text-[#6B7980]">Review all four options, LaTeX and image references before importing.</p></div>
                      {['a', 'b', 'c', 'd'].map((key) => <div key={key} className="mb-3 rounded-xl border border-[#E7ECEB] bg-[#F7F9F7]/45 p-3 last:mb-0"><div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">{key.toUpperCase()}</div><div className="grid gap-2 lg:grid-cols-3"><Input value={rawText(current.raw, `option_${key}`)} onChange={(event) => updateRaw(`option_${key}`, event.target.value)} placeholder={`Option ${key.toUpperCase()} text`} className="border-[#E7ECEB] bg-white" /><Input value={rawText(current.raw, `option_${key}_latex`)} onChange={(event) => updateRaw(`option_${key}_latex`, event.target.value)} placeholder="Optional LaTeX" className="border-[#E7ECEB] bg-white font-mono text-xs" /><Input value={rawText(current.raw, `option_${key}_image`)} onChange={(event) => updateRaw(`option_${key}_image`, event.target.value)} placeholder="Image URL or filename" className="border-[#E7ECEB] bg-white text-xs" /></div></div>)}
                      <div className="mt-4 max-w-sm space-y-2"><GuidedLabel required help="A, B, C or D. Multiple correct uses A|B. Numerical questions use the exact number.">Correct answer</GuidedLabel><Input value={rawText(current.raw, 'correct_answer')} onChange={(event) => updateRaw('correct_answer', event.target.value)} placeholder="B" className="border-[#E7ECEB]" /></div>
                    </div>

                    <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4">
                      <div className="mb-4"><strong className="text-sm text-[#14232B]">Solution and remaining details</strong></div>
                      <div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2"><GuidedLabel help="Human-readable solution.">Solution</GuidedLabel><Textarea rows={5} value={rawText(current.raw, 'solution')} onChange={(event) => updateRaw('solution', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Optional solution LaTeX.">Solution LaTeX</GuidedLabel><Textarea rows={5} value={rawText(current.raw, 'solution_latex')} onChange={(event) => updateRaw('solution_latex', event.target.value)} className="border-[#E7ECEB] font-mono text-xs" /></div></div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><GuidedLabel help="Correct marks.">Marks</GuidedLabel><Input type="number" value={rawText(current.raw, 'marks')} onChange={(event) => updateRaw('marks', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Incorrect-answer deduction.">Negative marks</GuidedLabel><Input type="number" value={rawText(current.raw, 'negative_marks')} onChange={(event) => updateRaw('negative_marks', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Expected solving time.">Expected seconds</GuidedLabel><Input type="number" value={rawText(current.raw, 'estimated_seconds')} onChange={(event) => updateRaw('estimated_seconds', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="English, Kannada, Hindi or Bilingual.">Language</GuidedLabel><Select value={currentPayload.language} onValueChange={(value) => updateRaw('language', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{['English', 'Kannada', 'Hindi', 'Bilingual'].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div></div>
                      <div className="mt-4 grid gap-4 md:grid-cols-3"><div className="space-y-2"><GuidedLabel help="Question source.">Source</GuidedLabel><Input value={rawText(current.raw, 'source')} onChange={(event) => updateRaw('source', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Source year.">Source year</GuidedLabel><Input type="number" value={rawText(current.raw, 'source_year')} onChange={(event) => updateRaw('source_year', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Comma- or pipe-separated tags.">Tags</GuidedLabel><Input value={rawText(current.raw, 'tags')} onChange={(event) => updateRaw('tags', event.target.value)} className="border-[#E7ECEB]" /></div></div>
                    </div>
                  </main>

                  <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
                    <QuestionDevicePreview value={{ stemText: currentPayload.stem_text, stemLatex: currentPayload.stem_latex || '', imageUrl: isUrl(currentPayload.question_image_url || '') ? currentPayload.question_image_url : '', passageText: currentPayload.passage_text || '', questionType: currentPayload.question_type, options: previewOptions, numericAnswer: previewCorrect, subject: orderedSubjects.find((subject) => subject.id === currentPayload.subject_id)?.name || rawText(current.raw, 'subject'), chapter: orderedChapters.find((chapter) => chapter.id === currentPayload.chapter_id)?.name || rawText(current.raw, 'chapter'), topic: orderedTopics.find((topic) => topic.id === currentPayload.topic_id)?.name || rawText(current.raw, 'topic'), difficulty: currentPayload.difficulty, showCorrectAnswer: true }} />
                  </aside>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="border-t border-[#E7ECEB] bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="mr-auto hidden max-w-2xl text-xs text-[#6B7980] md:block">{rows.length ? `${valid.length} ready · ${invalid.length} need correction. Invalid questions are never imported.` : 'Download the validated Excel template or choose an existing file.'}</div>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E7ECEB]">Cancel</Button>
          <Button onClick={() => void runImport()} disabled={busy || valid.length === 0} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
            {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            {canPublish ? `Import ${valid.length} Ready Question${valid.length === 1 ? '' : 's'}` : `Import ${valid.length} Draft/Review Question${valid.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
