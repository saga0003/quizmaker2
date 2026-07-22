'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  LoaderCircle,
  Upload,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeImageBytes, safeImageFileName } from '@/lib/imageFiles';
import { parseQuestionRows, questionTemplateHeaders } from '@/lib/questionImport';
import { readQuestionDocument } from '@/lib/questionDocumentReader';
import { readZip } from '@/lib/zipReader';
import type {
  MatchFollowingPair,
  ParsedQuestionRow,
  QuestionPayload,
  TaxonomyChapter,
  TaxonomySubject,
} from '@/types/questions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { HelpIcon } from '@/components/evidara/question-help';

const isUrl = (value: string) => /^https?:\/\//i.test(value);
const baseName = (value: string) => value.split(/[\\/]/).pop()?.toLowerCase() || '';

function templateCsv() {
  const example: Record<string, string> = {
    exam_types: 'NEET',
    test_type: 'chapter_test',
    class_level: 'Class 11',
    subject: 'Physics',
    chapter: 'Units and Measurements',
    question_type: 'single_correct',
    difficulty: 'moderate',
    question: 'Which quantity is dimensionless?',
    option_a: 'Velocity',
    option_b: 'Strain',
    option_c: 'Force',
    option_d: 'Energy',
    correct_answer: 'B',
    solution: 'Strain is a ratio and therefore dimensionless.',
    marks: '4',
    negative_marks: '1',
    estimated_seconds: '60',
    language: 'English',
    status: 'draft',
  };
  const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return `${questionTemplateHeaders.map(escape).join(',')}\n${questionTemplateHeaders.map((key) => escape(example[key] || '')).join(',')}\n`;
}

function downloadTemplate() {
  const blob = new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'evidara-question-import-template.csv';
  anchor.click();
  URL.revokeObjectURL(url);
}

function displayError(item: { row?: number; error?: string } | string) {
  return typeof item === 'string' ? item : `${item.row ? `Row ${item.row}: ` : ''}${item.error || 'Unknown database error'}`;
}

export function QuestionBulkImportDialog({
  open,
  onOpenChange,
  kind,
  organizationId,
  subjects,
  chapters,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'admin' | 'school';
  organizationId: string | null;
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  onImported: () => Promise<void> | void;
}) {
  const { user } = useAuth();
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [imageZip, setImageZip] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedQuestionRow[]>([]);
  const [format, setFormat] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ imported: number; failed: number; errors?: Array<{ row?: number; error?: string } | string> } | null>(null);

  const valid = useMemo(() => rows.filter((row) => row.payload && row.errors.length === 0 && !row.duplicate), [rows]);
  const invalid = useMemo(() => rows.filter((row) => !row.payload || row.errors.length > 0 || row.duplicate), [rows]);
  const imageReferences = useMemo(() => rows.reduce((count, row) => {
    const payload = row.payload;
    if (!payload) return count;
    const matches = (payload.metadata?.match_pairs || []) as MatchFollowingPair[];
    return count
      + (payload.question_image_url ? 1 : 0)
      + payload.options.filter((option) => option.image_url).length
      + matches.filter((pair) => pair.left_image_url || pair.right_image_url).length;
  }, 0), [rows]);

  function reset() {
    setQuestionFile(null);
    setImageZip(null);
    setRows([]);
    setFormat('');
    setStage('');
    setError('');
    setResult(null);
  }

  async function parse(file: File) {
    setQuestionFile(file);
    setRows([]);
    setResult(null);
    setError('');
    setBusy(true);
    setStage(`Reading ${file.name}…`);
    try {
      const document = await readQuestionDocument(file);
      if (document.rows.length > 2000) throw new Error('Import files are limited to 2,000 questions per batch. Split larger banks into separate files.');
      const parsed = parseQuestionRows(document.rows);
      const seen = new Map<string, number>();
      parsed.forEach((row) => {
        if (!row.payload) return;
        const hash = `${row.payload.stem_text.toLowerCase().replace(/\s/g, '')}|${JSON.stringify(row.payload.options.map((option) => option.content_text.toLowerCase().replace(/\s/g, '')))}`;
        if (seen.has(hash)) {
          row.duplicate = true;
          row.errors.push(`Possible duplicate of row ${seen.get(hash)}.`);
        } else {
          seen.set(hash, row.rowNumber);
        }
      });
      setRows(parsed);
      setFormat(document.format);
      setStage('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to read this question file.');
    } finally {
      setBusy(false);
    }
  }

  async function prepareImages(payloads: QuestionPayload[]) {
    const localReferences = payloads.flatMap((payload) => {
      const pairs = (payload.metadata?.match_pairs || []) as MatchFollowingPair[];
      return [
        payload.question_image_url || '',
        ...payload.options.map((option) => option.image_url || ''),
        ...pairs.flatMap((pair) => [pair.left_image_url || '', pair.right_image_url || '']),
      ];
    }).filter((value) => value && !isUrl(value));

    if (!localReferences.length) return payloads;
    if (!imageZip) throw new Error(`${localReferences.length} local image reference(s) were found. Attach the matching image ZIP.`);
    if (!supabase || !user) throw new Error('Sign in before uploading question images.');

    setStage('Opening image ZIP…');
    const zip = await readZip(await imageZip.arrayBuffer());
    const entries = [...zip.values()];
    const byName = new Map(entries.map((entry) => [baseName(entry.name), entry]));
    const uploaded = new Map<string, string>();

    async function resolve(value: string) {
      if (!value || isUrl(value)) return value;
      const key = baseName(value);
      if (uploaded.has(key)) return uploaded.get(key)!;
      const entry = byName.get(key);
      if (!entry) throw new Error(`Image '${value}' was referenced but was not found inside ${imageZip.name}.`);
      const { blob, mime } = normalizeImageBytes(entry.bytes, key);
      const path = `${user.id}/imports/${crypto.randomUUID()}-${safeImageFileName(key)}`;
      setStage(`Uploading ${key}…`);
      const { error: uploadError } = await supabase.storage.from('question-assets').upload(path, blob, {
        upsert: false,
        contentType: mime,
        cacheControl: '3600',
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('question-assets').getPublicUrl(path);
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
      setError('Choose a question file with at least one valid row.');
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
      const subjectByName = new Map(subjects.map((subject) => [subject.name.trim().toLowerCase(), subject]));
      const subjectByCode = new Map(subjects.map((subject) => [subject.code.trim().toLowerCase(), subject]));
      const payloads = valid.map((row) => {
        const payload = structuredClone(row.payload!);
        const subjectValue = String(row.raw.subject || payload.metadata?.import_subject || '').trim().toLowerCase();
        const selectedSubject = subjectByName.get(subjectValue) || subjectByCode.get(subjectValue);
        if (!selectedSubject) throw new Error(`Row ${row.rowNumber}: subject '${String(row.raw.subject || '')}' is not available.`);
        payload.subject_id = selectedSubject.id;

        const chapterValue = String(row.raw.chapter || payload.metadata?.import_chapter || '').trim().toLowerCase();
        if (chapterValue) {
          const chapter = chapters.find((item) => item.subject_id === selectedSubject.id && item.name.trim().toLowerCase() === chapterValue);
          if (chapter) payload.chapter_id = chapter.id;
        }

        payload.metadata = { ...(payload.metadata || {}), import_format: format, import_file: questionFile.name };
        if (kind === 'school' && payload.status === 'approved') payload.status = 'in_review';
        return payload;
      });

      await prepareImages(payloads);
      setStage('Saving validated questions…');
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[96vh] w-[96vw] max-w-[1320px] overflow-hidden border-[#E7ECEB] p-0">
        <DialogHeader className="border-b border-[#E7ECEB] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-xl text-[#14232B]">Bulk Question Import</DialogTitle>
              <DialogDescription className="mt-1 max-w-3xl">
                Import Excel, CSV, Word, text-based PDF, LaTeX/TEX, TXT or JSON. Attach an image ZIP when the file refers to local image names.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="border-[#E7ECEB]">{kind === 'admin' ? 'Evidara Master Bank' : 'School Question Bank'}</Badge>
              <Button type="button" variant="outline" onClick={downloadTemplate} className="border-[#E7ECEB]">
                <Download className="mr-2 h-4 w-4" />Template
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="mb-5 rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-4 text-sm text-[#6B7980]">
            <div className="flex items-start gap-2">
              <HelpIcon text="Structured files are validated before saving. Text-based Word, PDF and LaTeX files should label fields such as Subject, Question, A, B, C, D, Answer and Solution. Scanned PDFs are not silently OCR-processed." />
              <span>Nothing is saved until validation is complete and you click Import Valid Questions.</span>
            </div>
          </div>

          {(error || result) && (
            <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error || result?.failed ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#0E5A5A]/20 bg-[#DCE9E7]/50 text-[#0E5A5A]'}`}>
              {error || `Import completed: ${result?.imported || 0} added, ${result?.failed || 0} failed.`}
              {!!result?.errors?.length && (
                <details className="mt-2">
                  <summary className="cursor-pointer font-semibold">Show import errors</summary>
                  <ol className="mt-2 list-decimal space-y-1 pl-5">
                    {result.errors.slice(0, 30).map((item, index) => <li key={index}>{displayError(item)}</li>)}
                  </ol>
                </details>
              )}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DCE9E7] bg-[#F7F9F7] p-5 text-center transition hover:border-[#0E5A5A]/40">
              <FileText className="h-9 w-9 text-[#0E5A5A]" />
              <strong className="mt-3 text-[#14232B]">1. Question source file</strong>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#6B7980]">
                {questionFile ? questionFile.name : 'CSV, XLSX, XLS, DOCX, text PDF, TEX, TXT or JSON'}
              </p>
              <span className="mt-3 rounded-lg bg-[#0E5A5A] px-3 py-2 text-xs font-semibold text-white">Choose file</span>
              <input hidden type="file" accept=".csv,.xlsx,.xls,.docx,.pdf,.tex,.txt,.json" onChange={(event) => event.target.files?.[0] && void parse(event.target.files[0])} />
            </label>

            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E7ECEB] bg-white p-5 text-center transition hover:border-[#F2B84B]">
              <FileArchive className="h-9 w-9 text-[#8A5F00]" />
              <strong className="mt-3 text-[#14232B]">2. Optional image ZIP</strong>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-[#6B7980]">
                {imageZip ? imageZip.name : 'Use when question_image or option image cells contain local filenames.'}
              </p>
              <span className="mt-3 rounded-lg border border-[#E7ECEB] px-3 py-2 text-xs font-semibold text-[#14232B]">Choose ZIP</span>
              <input hidden type="file" accept=".zip" onChange={(event) => setImageZip(event.target.files?.[0] || null)} />
            </label>
          </div>

          {busy && stage && (
            <div className="mt-5 rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-4">
              <div className="flex items-center gap-3 text-sm font-medium text-[#14232B]">
                <LoaderCircle className="h-5 w-5 animate-spin text-[#0E5A5A]" />{stage}
              </div>
              <Progress value={65} className="mt-3 h-2" />
            </div>
          )}

          {!!rows.length && (
            <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Rows detected', rows.length, FileSpreadsheet, '#14232B'],
                  ['Ready', valid.length, CheckCircle2, '#0E5A5A'],
                  ['Needs correction', invalid.length, XCircle, '#B54747'],
                  ['Image references', imageReferences, FileArchive, '#8A5F00'],
                ].map(([label, value, Icon, tone]) => (
                  <div key={String(label)} className="rounded-xl border border-[#E7ECEB] bg-white p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#6B7980]">{String(label)}</span>
                      <Icon className="h-4 w-4" style={{ color: String(tone) }} />
                    </div>
                    <strong className="mt-2 block text-2xl" style={{ color: String(tone) }}>{String(value)}</strong>
                  </div>
                ))}
              </div>

              <div className="mt-5 overflow-hidden rounded-2xl border border-[#E7ECEB]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7ECEB] bg-[#F7F9F7] px-4 py-3">
                  <div>
                    <strong className="text-sm text-[#14232B]">Validation preview</strong>
                    <p className="text-xs text-[#6B7980]">First 100 rows shown. Invalid rows are never imported.</p>
                  </div>
                  {invalid.length > 0 && <div className="flex items-center gap-1 text-xs font-medium text-[#B54747]"><AlertCircle className="h-4 w-4" />Correct the source file and upload it again.</div>}
                </div>
                <div className="max-h-[420px] overflow-auto">
                  <table className="min-w-[1000px] w-full text-left text-xs">
                    <thead className="sticky top-0 bg-white text-[#6B7980]">
                      <tr>
                        <th className="px-4 py-3">Row</th>
                        <th className="px-4 py-3">Question</th>
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Question type</th>
                        <th className="px-4 py-3">Test type</th>
                        <th className="px-4 py-3">Answer</th>
                        <th className="px-4 py-3">Validation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.slice(0, 100).map((row) => (
                        <tr key={row.rowNumber} className="border-t border-[#E7ECEB] align-top">
                          <td className="px-4 py-3 text-[#6B7980]">{row.rowNumber}</td>
                          <td className="max-w-[360px] px-4 py-3 font-medium text-[#14232B]">{String(row.raw.question || row.raw.stem_text || '')}</td>
                          <td className="px-4 py-3">{String(row.raw.subject || '')}</td>
                          <td className="px-4 py-3">{String(row.raw.question_type || 'single_correct')}</td>
                          <td className="px-4 py-3">{String(row.raw.test_type || 'custom')}</td>
                          <td className="px-4 py-3">{String(row.raw.correct_answer || '')}</td>
                          <td className="max-w-[320px] px-4 py-3">
                            {row.errors.length ? <span className="text-[#B54747]">{row.errors.join(' ')}</span> : <span className="text-[#0E5A5A]">Ready</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="border-t border-[#E7ECEB] px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E7ECEB]">Cancel</Button>
          <Button onClick={() => void runImport()} disabled={busy || valid.length === 0} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
            {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Import {valid.length} Valid Question{valid.length === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
