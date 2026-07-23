'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  ImagePlus,
  ListChecks,
  LoaderCircle,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  Undo2,
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
  ParsedQuestionRow,
  QuestionDifficulty,
  QuestionPayload,
  QuestionType,
  TaxonomyChapter,
  TaxonomySubject,
  TaxonomyTopic,
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
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
import { GuidedLabel } from '@/components/evidara/question-help';
import { QuestionDevicePreview } from '@/components/evidara/question-device-preview';
import { SearchableTaxonomySelect } from '@/components/evidara/searchable-taxonomy-select';

const simpleQuestionTypes: QuestionType[] = [
  'single_correct',
  'multiple_correct',
  'numerical',
  'integer',
  'assertion_reason',
  'passage',
  'image_based',
];
const difficulties: QuestionDifficulty[] = ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'];
const languages = ['English', 'Kannada', 'Hindi', 'Bilingual'];
const normalizeName = (value: unknown) => String(value ?? '').trim().replace(/\s+/g, ' ');
const nameKey = (value: unknown) => normalizeName(value).toLocaleLowerCase();
const baseName = (value: string) => value.trim().split(/[\\/]/).pop()?.toLocaleLowerCase() || '';

type EditPatch = {
  index: number;
  key: string;
  before: unknown;
  after: unknown;
};

type Preflight = {
  ok: boolean;
  role?: string;
  can_import?: boolean;
  storage_ready?: boolean;
  message?: string;
};

type ResolvedRow = ParsedQuestionRow & {
  missingChapter?: { name: string; subjectId: string };
  missingTopic?: { name: string; chapterId: string };
  warnings?: string[];
};

type ImportResult = {
  imported: number;
  failed: number;
  errors?: Array<{ row?: number; error?: string } | string>;
};

function isRemoteUrl(value: string) {
  const clean = value.trim();
  if (!clean) return false;
  try {
    const parsed = new URL(clean);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPlaceholderImageUrl(value: string) {
  if (!isRemoteUrl(value)) return false;
  try {
    const host = new URL(value.trim()).hostname.toLocaleLowerCase();
    return host === 'avatars.githubusercontent.com'
      || host.endsWith('.placeholder.com')
      || host === 'via.placeholder.com';
  } catch {
    return false;
  }
}

function templateCsv() {
  const example: Record<string, string> = {
    exam_types: 'NEET',
    class_level: 'Class 11',
    subject: 'Physics',
    chapter: 'Units and Measurements',
    topic: 'Dimensions',
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
  return `${bulkQuestionTemplateHeaders.map(escape).join(',')}\n${bulkQuestionTemplateHeaders.map((key) => escape(example[key] || '')).join(',')}\n`;
}

function downloadCsvTemplate() {
  downloadBlob(new Blob([templateCsv()], { type: 'text/csv;charset=utf-8' }), 'evidara-question-import-template.csv');
}

function rawText(raw: Record<string, unknown>, key: string) {
  return String(raw[key] ?? '');
}

function duplicateKey(payload: QuestionPayload) {
  return `${payload.stem_text.toLocaleLowerCase().replace(/\s/g, '')}|${JSON.stringify(payload.options.map((option) => `${option.content_text}${option.content_latex || ''}`.toLocaleLowerCase().replace(/\s/g, '')))}`;
}

function friendlyDatabaseError(value: string) {
  const message = value.replace(/\s+/g, ' ').trim();
  if (/btrim\(app_role\)/i.test(message)) return 'The database role compatibility update is missing. Apply Supabase migration 30 and retry.';
  if (/bulk_import_questions_v71/i.test(message) && /does not exist|not found/i.test(message)) return 'The V7.1 database migration is not applied yet. Run migration 30 in Supabase SQL Editor.';
  if (/row-level security|permission denied|42501/i.test(message)) return 'Your account does not have permission for this import. Check the Evidara role and school assignment.';
  if (/question-assets|bucket/i.test(message)) return 'Question image storage is not ready. Apply migration 30, then refresh the page.';
  return message || 'The database could not save this import.';
}

function displayError(item: { row?: number; error?: string } | string) {
  if (typeof item === 'string') return friendlyDatabaseError(item);
  return `${item.row ? `Question ${item.row}: ` : ''}${friendlyDatabaseError(item.error || 'Unknown database error')}`;
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
  const { user, profile, session } = useAuth();
  const role = normalizeEvidaraRole(profile?.role);
  const canPublish = role === 'super_admin' || role === 'evidara_admin' || role === 'school_admin';
  const platformImport = kind === 'admin' && (role === 'super_admin' || role === 'evidara_admin');
  const [questionFile, setQuestionFile] = useState<File | null>(null);
  const [imageZip, setImageZip] = useState<File | null>(null);
  const [zipNames, setZipNames] = useState<Set<string> | null>(null);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [localSubjects, setLocalSubjects] = useState<TaxonomySubject[]>(subjects);
  const [localChapters, setLocalChapters] = useState<TaxonomyChapter[]>(chapters);
  const [localTopics, setLocalTopics] = useState<TaxonomyTopic[]>(topics);
  const [format, setFormat] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [latexText, setLatexText] = useState('');
  const [showLatexWorkspace, setShowLatexWorkspace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [publishMaster, setPublishMaster] = useState(platformImport);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryRequested, setSummaryRequested] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [undoStack, setUndoStack] = useState<EditPatch[]>([]);
  const [redoStack, setRedoStack] = useState<EditPatch[]>([]);

  useEffect(() => { setLocalSubjects(subjects); }, [subjects]);
  useEffect(() => { setLocalChapters(chapters); }, [chapters]);
  useEffect(() => { setLocalTopics(topics); }, [topics]);
  useEffect(() => { setPublishMaster(platformImport); }, [platformImport]);

  const orderedSubjects = useMemo(() => [...localSubjects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [localSubjects]);
  const orderedChapters = useMemo(() => [...localChapters].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [localChapters]);
  const orderedTopics = useMemo(() => [...localTopics].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [localTopics]);

  const rows = useMemo<ResolvedRow[]>(() => {
    const subjectByName = new Map(orderedSubjects.map((subject) => [nameKey(subject.name), subject]));
    const subjectByCode = new Map(orderedSubjects.map((subject) => [nameKey(subject.code), subject]));
    const parsed = parseQuestionRows(rawRows).map((row) => {
      const payload = structuredClone(row.payload!);
      const errors = row.errors.map((item) => item
        .replace(/question_type/g, 'question type')
        .replace(/custom_test_type/g, 'custom test type')
        .replace(/test_type/g, 'test type'));
      const warnings: string[] = [];
      const subjectName = normalizeName(row.raw.subject || payload.metadata?.import_subject);
      const selectedSubject = subjectByName.get(nameKey(subjectName)) || subjectByCode.get(nameKey(subjectName));
      if (!selectedSubject) errors.push(`Subject '${subjectName || 'blank'}' is not available. Only Super Admin can add a new subject from Question Settings.`);
      else payload.subject_id = selectedSubject.id;

      const chapterName = normalizeName(row.raw.chapter || payload.metadata?.import_chapter);
      const selectedChapter = chapterName && selectedSubject
        ? orderedChapters.find((chapter) => chapter.subject_id === selectedSubject.id && nameKey(chapter.name) === nameKey(chapterName))
        : undefined;
      const missingChapter = chapterName && selectedSubject && !selectedChapter
        ? { name: chapterName, subjectId: selectedSubject.id }
        : undefined;
      if (missingChapter) errors.push(`Chapter '${chapterName}' is not listed under ${selectedSubject?.name}. Click Add chapter or Create all missing taxonomy.`);
      if (selectedChapter) payload.chapter_id = selectedChapter.id;

      const topicName = normalizeName(row.raw.topic || payload.metadata?.import_topic);
      const selectedTopic = topicName && selectedChapter
        ? orderedTopics.find((topic) => topic.chapter_id === selectedChapter.id && nameKey(topic.name) === nameKey(topicName))
        : undefined;
      const missingTopic = topicName && selectedChapter && !selectedTopic
        ? { name: topicName, chapterId: selectedChapter.id }
        : undefined;
      if (missingTopic) errors.push(`Topic '${topicName}' is not listed under ${selectedChapter?.name}. Click Add topic or Create all missing taxonomy.`);
      if (selectedTopic) payload.topic_id = selectedTopic.id;

      if (!canPublish && payload.status === 'approved') errors.push('Teachers cannot publish questions. Change Status to Draft or In Review.');

      const imageValues = [payload.question_image_url || '', ...payload.options.map((option) => option.image_url || '')].filter(Boolean);
      if (imageValues.some(isPlaceholderImageUrl)) errors.push('A question image uses a placeholder/avatar URL. Replace it with the correct public image or an image filename from the ZIP.');
      if (imageValues.some((value) => !isRemoteUrl(value)) && !imageZip) warnings.push('This question refers to a local image filename. Attach the matching image ZIP before importing.');

      return { ...row, payload, errors, warnings, missingChapter, missingTopic };
    });

    const seen = new Map<string, number>();
    return parsed.map((row) => {
      if (!row.payload) return row;
      const key = duplicateKey(row.payload);
      const previous = seen.get(key);
      if (previous) return { ...row, duplicate: true, errors: [...row.errors, `Possible duplicate of question ${previous}.`] };
      seen.set(key, row.rowNumber - 1);
      return row;
    });
  }, [canPublish, imageZip, orderedChapters, orderedSubjects, orderedTopics, rawRows]);

  const localImageReferences = useMemo(() => rows.flatMap((row) => {
    const payload = row.payload;
    if (!payload) return [];
    return [payload.question_image_url || '', ...payload.options.map((option) => option.image_url || '')]
      .filter((value) => value && !isRemoteUrl(value));
  }), [rows]);
  const missingZipFiles = useMemo(() => {
    if (!zipNames) return [];
    return [...new Set(localImageReferences.map(baseName).filter(Boolean))].filter((name) => !zipNames.has(name));
  }, [localImageReferences, zipNames]);
  const valid = useMemo(() => rows.filter((row) => row.payload && row.errors.length === 0 && !row.duplicate), [rows]);
  const invalid = useMemo(() => rows.filter((row) => !row.payload || row.errors.length > 0 || row.duplicate), [rows]);
  const issueIndexes = useMemo(() => rows.map((row, index) => ({ row, index })).filter(({ row }) => row.errors.length > 0 || row.duplicate).map(({ index }) => index), [rows]);
  const currentIssuePosition = issueIndexes.indexOf(currentIndex);
  const current = rows[currentIndex] || null;
  const currentPayload = current?.payload;
  const currentSubjectId = currentPayload?.subject_id || '';
  const currentChapterId = currentPayload?.chapter_id || '';
  const currentChapters = orderedChapters.filter((chapter) => !currentSubjectId || chapter.subject_id === currentSubjectId);
  const currentTopics = orderedTopics.filter((topic) => !currentChapterId || topic.chapter_id === currentChapterId);
  const imageBlocked = localImageReferences.length > 0 && (!imageZip || missingZipFiles.length > 0);
  const importBlocked = !preflight?.ok || valid.length === 0 || imageBlocked || busy;
  const missingTaxonomyCount = rows.filter((row) => row.missingChapter || row.missingTopic).length;

  useEffect(() => {
    if (summaryRequested && rows.length) {
      setSummaryOpen(true);
      setSummaryRequested(false);
    }
  }, [rows.length, summaryRequested]);

  function clearEditHistory() {
    setUndoStack([]);
    setRedoStack([]);
  }

  function reset() {
    setQuestionFile(null);
    setImageZip(null);
    setZipNames(null);
    setRawRows([]);
    setFormat('');
    setCurrentIndex(0);
    setLatexText('');
    setShowLatexWorkspace(false);
    setStage('');
    setError('');
    setNotice('');
    setResult(null);
    setSummaryOpen(false);
    setSummaryRequested(false);
    setResultOpen(false);
    clearEditHistory();
  }

  function closeImmediately() {
    reset();
    setDiscardOpen(false);
    onOpenChange(false);
  }

  function requestClose() {
    const hasWork = Boolean(questionFile || rawRows.length || imageZip || latexText.trim());
    if (hasWork && !result) {
      setDiscardOpen(true);
      return;
    }
    closeImmediately();
  }

  async function runPreflight() {
    if (!open || !supabase || !user) return;
    setPreflight(null);
    const { data, error: preflightError } = await supabase.rpc('question_import_preflight_v71', {
      p_organization_id: kind === 'admin' ? null : organizationId,
    });
    if (preflightError) {
      setPreflight({ ok: false, message: friendlyDatabaseError(preflightError.message) });
      return;
    }
    setPreflight(data as Preflight);
  }

  useEffect(() => { void runPreflight(); }, [open, kind, organizationId, user]);

  async function parse(file: File) {
    setQuestionFile(file);
    setRawRows([]);
    setResult(null);
    setError('');
    setNotice('');
    clearEditHistory();
    setBusy(true);
    setStage(`Reading ${file.name}…`);
    try {
      const document = await readQuestionDocument(file);
      if (document.rows.length > 2000) throw new Error('This file contains more than 2,000 questions. Split it into smaller batches.');
      setRawRows(document.rows);
      setFormat(document.format);
      setCurrentIndex(0);
      setSummaryRequested(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Evidara could not read this question file.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  async function attachImageZip(file: File) {
    setImageZip(file);
    setZipNames(null);
    setError('');
    setBusy(true);
    setStage(`Checking ${file.name}…`);
    try {
      const zip = await readZip(await file.arrayBuffer());
      const names = new Set([...zip.values()].filter((entry) => !entry.name.endsWith('/')).map((entry) => baseName(entry.name)));
      if (!names.size) throw new Error('The selected ZIP does not contain any files.');
      setZipNames(names);
      setNotice(`${names.size} image file${names.size === 1 ? '' : 's'} found in ${file.name}.`);
    } catch (caught) {
      setImageZip(null);
      setError(caught instanceof Error ? caught.message : 'Evidara could not open this image ZIP.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  function reviewPastedLatex() {
    setError('');
    try {
      const parsed = parseStructuredQuestionText(latexText);
      if (!parsed.length) throw new Error('No labelled questions were detected. Use Question, Option A, Answer and Solution labels.');
      if (parsed.length > 2000) throw new Error('Pasted batches are limited to 2,000 questions.');
      setQuestionFile(new File([latexText], 'pasted-question-latex.tex', { type: 'text/plain' }));
      setRawRows(parsed);
      setFormat('tex');
      setCurrentIndex(0);
      setResult(null);
      setShowLatexWorkspace(false);
      clearEditHistory();
      setSummaryRequested(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Evidara could not understand the pasted LaTeX questions.');
    }
  }

  function updateRaw(key: string, value: unknown) {
    const before = rawRows[currentIndex]?.[key];
    if (Object.is(before, value)) return;
    setUndoStack((existing) => [...existing, { index: currentIndex, key, before, after: value }].slice(-250));
    setRedoStack([]);
    setRawRows((existing) => existing.map((row, index) => index === currentIndex ? { ...row, [key]: value } : row));
  }

  const undo = useCallback(() => {
    const patch = undoStack.at(-1);
    if (!patch) return;
    setRawRows((existing) => existing.map((row, index) => index === patch.index ? { ...row, [patch.key]: patch.before } : row));
    setCurrentIndex(patch.index);
    setUndoStack((existing) => existing.slice(0, -1));
    setRedoStack((existing) => [...existing, patch].slice(-250));
  }, [undoStack]);

  const redo = useCallback(() => {
    const patch = redoStack.at(-1);
    if (!patch) return;
    setRawRows((existing) => existing.map((row, index) => index === patch.index ? { ...row, [patch.key]: patch.after } : row));
    setCurrentIndex(patch.index);
    setRedoStack((existing) => existing.slice(0, -1));
    setUndoStack((existing) => [...existing, patch].slice(-250));
  }, [redoStack]);

  useEffect(() => {
    if (!open) return;
    const handleHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleHistoryShortcut);
    return () => window.removeEventListener('keydown', handleHistoryShortcut);
  }, [open, redo, undo]);

  function goToFirstIssue() {
    if (!issueIndexes.length) return;
    setCurrentIndex(issueIndexes[0]);
  }

  function goToIssue(direction: 1 | -1) {
    if (!issueIndexes.length) return;
    if (currentIssuePosition < 0) {
      setCurrentIndex(direction > 0 ? issueIndexes[0] : issueIndexes[issueIndexes.length - 1]);
      return;
    }
    const next = (currentIssuePosition + direction + issueIndexes.length) % issueIndexes.length;
    setCurrentIndex(issueIndexes[next]);
  }

  async function postTaxonomy(action: 'createChapter' | 'createTopic', body: Record<string, unknown>) {
    if (!session?.access_token) throw new Error('Sign in again before adding chapters or topics.');
    const response = await fetch('/api/question-taxonomy/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, organizationId: kind === 'school' ? organizationId : null, ...body }),
    });
    const resultBody = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(resultBody.error || 'Evidara could not add this taxonomy item.');
    return resultBody.item as TaxonomyChapter | TaxonomyTopic;
  }

  async function createCurrentChapter() {
    if (!current?.missingChapter) return;
    setBusy(true);
    setStage(`Adding chapter ${current.missingChapter.name}…`);
    setError('');
    try {
      const item = await postTaxonomy('createChapter', { name: current.missingChapter.name, subjectId: current.missingChapter.subjectId }) as TaxonomyChapter;
      setLocalChapters((existing) => existing.some((chapter) => chapter.id === item.id) ? existing : [...existing, item]);
      setNotice(`Chapter '${item.name}' is now available.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add this chapter.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  async function createCurrentTopic() {
    if (!current?.missingTopic) return;
    setBusy(true);
    setStage(`Adding topic ${current.missingTopic.name}…`);
    setError('');
    try {
      const item = await postTaxonomy('createTopic', { name: current.missingTopic.name, chapterId: current.missingTopic.chapterId }) as TaxonomyTopic;
      setLocalTopics((existing) => existing.some((topic) => topic.id === item.id) ? existing : [...existing, item]);
      setNotice(`Topic '${item.name}' is now available.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add this topic.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  async function createAllMissingTaxonomy() {
    setBusy(true);
    setError('');
    setStage('Creating missing chapters and topics…');
    try {
      const nextChapters = [...localChapters];
      const nextTopics = [...localTopics];
      const subjectByName = new Map(localSubjects.flatMap((subject) => [[nameKey(subject.name), subject], [nameKey(subject.code), subject]] as const));
      const chapterRequests = new Map<string, { name: string; subjectId: string }>();

      for (const raw of rawRows) {
        const subject = subjectByName.get(nameKey(raw.subject));
        const chapterName = normalizeName(raw.chapter);
        if (!subject || !chapterName) continue;
        const key = `${subject.id}|${nameKey(chapterName)}`;
        if (!nextChapters.some((chapter) => chapter.subject_id === subject.id && nameKey(chapter.name) === nameKey(chapterName))) chapterRequests.set(key, { name: chapterName, subjectId: subject.id });
      }

      for (const request of chapterRequests.values()) {
        const item = await postTaxonomy('createChapter', request) as TaxonomyChapter;
        if (!nextChapters.some((chapter) => chapter.id === item.id)) nextChapters.push(item);
      }

      const topicRequests = new Map<string, { name: string; chapterId: string }>();
      for (const raw of rawRows) {
        const subject = subjectByName.get(nameKey(raw.subject));
        const chapterName = normalizeName(raw.chapter);
        const topicName = normalizeName(raw.topic);
        if (!subject || !chapterName || !topicName) continue;
        const chapter = nextChapters.find((item) => item.subject_id === subject.id && nameKey(item.name) === nameKey(chapterName));
        if (!chapter) continue;
        const key = `${chapter.id}|${nameKey(topicName)}`;
        if (!nextTopics.some((topic) => topic.chapter_id === chapter.id && nameKey(topic.name) === nameKey(topicName))) topicRequests.set(key, { name: topicName, chapterId: chapter.id });
      }

      for (const request of topicRequests.values()) {
        const item = await postTaxonomy('createTopic', request) as TaxonomyTopic;
        if (!nextTopics.some((topic) => topic.id === item.id)) nextTopics.push(item);
      }

      setLocalChapters(nextChapters);
      setLocalTopics(nextTopics);
      setNotice(`Taxonomy updated: ${chapterRequests.size} chapter${chapterRequests.size === 1 ? '' : 's'} and ${topicRequests.size} topic${topicRequests.size === 1 ? '' : 's'} checked.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Evidara could not create the missing taxonomy.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  async function prepareImages(payloads: QuestionPayload[]) {
    const localReferences = payloads.flatMap((payload) => [payload.question_image_url || '', ...payload.options.map((option) => option.image_url || '')])
      .filter((value) => value && !isRemoteUrl(value));
    if (!localReferences.length) return payloads;
    if (!imageZip) throw new Error(`${localReferences.length} local image reference${localReferences.length === 1 ? '' : 's'} found. Choose the matching image ZIP before importing.`);
    if (!supabase || !user) throw new Error('Sign in again before uploading question images.');

    const client = supabase;
    const activeUser = user;
    const zip = await readZip(await imageZip.arrayBuffer());
    const byName = new Map([...zip.values()].map((entry) => [baseName(entry.name), entry]));
    const uploaded = new Map<string, string>();

    async function resolve(value: string) {
      if (!value || isRemoteUrl(value)) return value.trim();
      const key = baseName(value);
      if (uploaded.has(key)) return uploaded.get(key)!;
      const entry = byName.get(key);
      if (!entry) throw new Error(`Image '${value}' is referenced in Excel but is missing from ${imageZip?.name}.`);
      const { blob, mime } = normalizeImageBytes(entry.bytes, key);
      const path = `${activeUser.id}/imports/${crypto.randomUUID()}-${safeImageFileName(key)}`;
      setStage(`Uploading ${key}…`);
      const { error: uploadError } = await client.storage.from('question-assets').upload(path, blob, { upsert: false, contentType: mime, cacheControl: '3600' });
      if (uploadError) throw new Error(friendlyDatabaseError(uploadError.message));
      const { data } = client.storage.from('question-assets').getPublicUrl(path);
      uploaded.set(key, data.publicUrl);
      return data.publicUrl;
    }

    for (const payload of payloads) {
      payload.question_image_url = await resolve(payload.question_image_url || '');
      for (const option of payload.options) option.image_url = await resolve(option.image_url || '');
    }
    return payloads;
  }

  async function runImport() {
    setError('');
    setResult(null);
    if (!questionFile || !valid.length) {
      setError('Choose a question file and correct every highlighted issue before importing.');
      return;
    }
    if (!preflight?.ok) {
      setError(preflight?.message || 'The V7.1 database preflight has not passed.');
      return;
    }
    if (imageBlocked) {
      setError(missingZipFiles.length
        ? `The image ZIP is missing: ${missingZipFiles.slice(0, 8).join(', ')}${missingZipFiles.length > 8 ? '…' : ''}`
        : 'Attach the matching image ZIP before importing.');
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
        payload.metadata = { ...(payload.metadata || {}), import_format: format, import_file: questionFile.name, release: '7.1.1' };
        delete payload.metadata.test_type;
        delete payload.metadata.custom_test_type;
        if (!canPublish && payload.status === 'approved') payload.status = 'in_review';
        if (platformImport && publishMaster) payload.status = 'approved';
        if (payload.status === 'approved') payload.metadata.published_at = payload.metadata.published_at || new Date().toISOString();
        return payload;
      });
      await prepareImages(payloads);
      setStage('Saving reviewed questions…');
      const rpcFormat = ['csv', 'xlsx', 'xls', 'json', 'tex', 'txt'].includes(format) ? format : 'json';
      const { data, error: importError } = await supabase.rpc('bulk_import_questions_v71', {
        p_organization_id: kind === 'admin' ? null : organizationId,
        p_filename: questionFile.name,
        p_format: rpcFormat,
        p_rows: payloads,
      });
      if (importError) throw new Error(friendlyDatabaseError(importError.message));
      const summary = data as ImportResult;
      setResult(summary);
      setResultOpen(true);
      if (summary.imported > 0) await onImported();
    } catch (caught) {
      setError(caught instanceof Error ? friendlyDatabaseError(caught.message) : 'Question import failed.');
    } finally {
      setBusy(false);
      setStage('');
    }
  }

  const previewOptions = currentPayload?.options || [];
  const previewCorrect = Array.isArray(currentPayload?.correct_answer)
    ? currentPayload.correct_answer.join('|')
    : String(currentPayload?.correct_answer || '');
  const statCards = [
    { label: 'Questions detected', value: rows.length, icon: FileSpreadsheet, tone: '#14232B' },
    { label: 'Ready to import', value: valid.length, icon: CheckCircle2, tone: '#0E5A5A' },
    { label: 'Needs correction', value: invalid.length, icon: XCircle, tone: '#B54747' },
    { label: 'Local image files', value: localImageReferences.length, icon: FileArchive, tone: '#8A5F00' },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { if (!next) requestClose(); }}>
        <DialogContent className="max-h-[96vh] w-[96vw] max-w-[1540px] overflow-hidden border-[#E7ECEB] p-0">
          <DialogHeader className="border-b border-[#E7ECEB] px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 pr-8 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <DialogTitle className="text-xl text-[#14232B]">Bulk Question Import and Review · Final</DialogTitle>
                <DialogDescription className="mt-1 max-w-3xl">Upload Excel, attach its image ZIP when filenames are used, navigate only the errors, undo changes when needed, and publish only after review.</DialogDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => void downloadQuestionTemplateWorkbook({ subjects: localSubjects, chapters: localChapters, topics: localTopics })} className="border-[#E7ECEB]"><Download className="mr-1.5 h-4 w-4" />Excel</Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadCsvTemplate} className="border-[#E7ECEB]"><Download className="mr-1.5 h-4 w-4" />CSV</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => void downloadQuestionImageZipTemplate()} className="border-[#E7ECEB]"><FileArchive className="mr-1.5 h-4 w-4" />Image ZIP Template</Button>
                <Button type="button" variant="outline" size="sm" onClick={downloadQuestionImportGuide} className="border-[#E7ECEB]"><FileText className="mr-1.5 h-4 w-4" />Guide</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowLatexWorkspace((value) => !value)} className="border-[#E7ECEB]"><FileCode2 className="mr-1.5 h-4 w-4" />Paste LaTeX</Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#FBFCFC] px-3 py-4 sm:px-6 sm:py-5">
            <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${preflight?.ok ? 'border-[#0E5A5A]/20 bg-[#DCE9E7]/50 text-[#0E5A5A]' : 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]'}`}>
              <div className="flex items-start justify-between gap-3"><div className="flex items-start gap-2">{preflight?.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}<span>{preflight?.message || 'Checking database role, import function and image storage…'}</span></div><Button type="button" variant="ghost" size="sm" onClick={() => void runPreflight()} className="h-7 shrink-0 px-2"><RefreshCw className="mr-1 h-3.5 w-3.5" />Check again</Button></div>
            </div>

            {error && <div className="mb-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{error}</div>}
            {notice && !error && <div className="mb-4 rounded-xl border border-[#DCE9E7] bg-white px-4 py-3 text-sm text-[#0E5A5A]">{notice}</div>}

            <div className="grid gap-4 lg:grid-cols-2">
              <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#DCE9E7] bg-white p-5 text-center transition hover:border-[#0E5A5A]/50"><FileSpreadsheet className="h-9 w-9 text-[#0E5A5A]" /><strong className="mt-3 text-[#14232B]">1. Excel or question source</strong><p className="mt-1 max-w-md text-xs text-[#6B7980]">{questionFile ? questionFile.name : 'XLSX recommended. CSV, XLS, DOCX, text PDF, TEX, TXT and JSON are also supported.'}</p><span className="mt-3 rounded-lg bg-[#0E5A5A] px-3 py-2 text-xs font-semibold text-white">{questionFile ? 'Replace source file' : 'Choose source file'}</span><input hidden type="file" accept=".csv,.xlsx,.xls,.docx,.pdf,.tex,.txt,.json" onChange={(event) => event.target.files?.[0] && void parse(event.target.files[0])} /></label>
              <label className={`flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-5 text-center transition ${localImageReferences.length && !imageZip ? 'border-[#B54747]/50 bg-[#FFF8F8]' : 'border-[#F2B84B]/50 bg-white hover:border-[#F2B84B]'}`}><ImagePlus className="h-9 w-9 text-[#8A5F00]" /><strong className="mt-3 text-[#14232B]">2. Matching image ZIP</strong><p className="mt-1 max-w-md text-xs leading-relaxed text-[#6B7980]">{imageZip ? `${imageZip.name}${zipNames ? ` · ${zipNames.size} files detected` : ''}` : localImageReferences.length ? `${localImageReferences.length} local image reference${localImageReferences.length === 1 ? '' : 's'} found. Choose the ZIP now.` : 'Optional when every image cell contains a real public HTTPS URL.'}</p><span className="mt-3 rounded-lg border border-[#E7ECEB] bg-white px-3 py-2 text-xs font-semibold text-[#14232B]">{imageZip ? 'Replace image ZIP' : 'Choose image ZIP'}</span><input hidden type="file" accept=".zip" onChange={(event) => event.target.files?.[0] && void attachImageZip(event.target.files[0])} /></label>
            </div>

            {missingZipFiles.length > 0 && <div className="mt-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]"><strong>The ZIP does not contain {missingZipFiles.length} referenced image file{missingZipFiles.length === 1 ? '' : 's'}.</strong><p className="mt-1 text-xs">Missing: {missingZipFiles.slice(0, 12).join(', ')}{missingZipFiles.length > 12 ? '…' : ''}</p></div>}

            {showLatexWorkspace && <div className="mt-4 rounded-2xl border border-[#DCE9E7] bg-white p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-[#14232B]">Paste structured LaTeX questions</strong><p className="text-xs text-[#6B7980]">Review the parsed fields and rendered question before import.</p></div><Button type="button" onClick={reviewPastedLatex} disabled={!latexText.trim()} className="bg-[#0E5A5A] text-white"><FileCode2 className="mr-2 h-4 w-4" />Review pasted LaTeX</Button></div><Textarea rows={10} value={latexText} onChange={(event) => setLatexText(event.target.value)} placeholder={'\\begin{question}\n\\subject{Physics}\n\\question{...}\n\\option[A]{...}\n\\answer{A}\n\\solution{...}\n\\end{question}'} className="mt-4 border-[#E7ECEB] font-mono text-xs" /></div>}

            {busy && stage && <div className="mt-4 rounded-xl border border-[#DCE9E7] bg-white p-4"><div className="flex items-center gap-3 text-sm font-medium text-[#14232B]"><LoaderCircle className="h-5 w-5 animate-spin text-[#0E5A5A]" />{stage}</div><Progress value={65} className="mt-3 h-2" /></div>}

            {!!rows.length && <>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statCards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-xl border border-[#E7ECEB] bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs text-[#6B7980]">{label}</span><Icon className="h-4 w-4" style={{ color: tone }} /></div><strong className="mt-2 block text-2xl" style={{ color: tone }}>{value}</strong></div>)}</div>

              {missingTaxonomyCount > 0 && <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#F2B84B]/50 bg-[#FFFDF7] p-4 sm:flex-row sm:items-center sm:justify-between"><div><strong className="text-sm text-[#8A5F00]">{missingTaxonomyCount} question{missingTaxonomyCount === 1 ? '' : 's'} refer to a chapter or topic that is not in Evidara.</strong><p className="mt-1 text-xs text-[#6B7980]">Add each item while reviewing, or create all unique missing chapters and topics now.</p></div><Button type="button" onClick={() => void createAllMissingTaxonomy()} disabled={busy} className="shrink-0 bg-[#8A5F00] text-white hover:bg-[#704D00]"><Plus className="mr-2 h-4 w-4" />Create all missing taxonomy</Button></div>}

              {platformImport && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[#DCE9E7] bg-white p-4"><input type="checkbox" checked={publishMaster} onChange={(event) => setPublishMaster(event.target.checked)} className="mt-1 h-4 w-4" /><span><strong className="block text-sm text-[#14232B]">Publish Evidara master questions immediately</strong><span className="mt-1 block text-xs text-[#6B7980]">Enabled by default for Super Admin and Evidara Admin so approved master questions appear to School Admins and Teachers.</span></span></label>}

              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-[#E7ECEB] bg-white p-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" disabled={currentIndex <= 0} onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} className="border-[#E7ECEB]"><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
                  <Button type="button" variant="outline" size="sm" disabled={currentIndex >= rows.length - 1} onClick={() => setCurrentIndex((value) => Math.min(rows.length - 1, value + 1))} className="border-[#E7ECEB]">Next question<ChevronRight className="ml-1 h-4 w-4" /></Button>
                  <Button type="button" variant="outline" size="sm" disabled={!issueIndexes.length} onClick={goToFirstIssue} className="border-[#B54747]/30 text-[#B54747]"><ListChecks className="mr-1.5 h-4 w-4" />First issue</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!issueIndexes.length} onClick={() => goToIssue(-1)} className="border-[#B54747]/30 text-[#B54747]">Previous issue</Button>
                  <Button type="button" variant="outline" size="sm" disabled={!issueIndexes.length} onClick={() => goToIssue(1)} className="border-[#B54747]/30 text-[#B54747]">Next issue</Button>
                  {issueIndexes.length > 0 && <Select value={String(currentIssuePosition >= 0 ? currentIndex : issueIndexes[0])} onValueChange={(value) => setCurrentIndex(Number(value))}><SelectTrigger className="h-9 w-[150px] border-[#B54747]/30 text-[#B54747]"><SelectValue placeholder="Jump to issue" /></SelectTrigger><SelectContent>{issueIndexes.map((index) => <SelectItem key={index} value={String(index)}>Question {index + 1}</SelectItem>)}</SelectContent></Select>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={!undoStack.length} title="Undo (Ctrl+Z)"><Undo2 className="mr-1.5 h-4 w-4" />Undo</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={redo} disabled={!redoStack.length} title="Redo (Ctrl+Shift+Z or Ctrl+Y)"><Redo2 className="mr-1.5 h-4 w-4" />Redo</Button>
                  <span className="text-xs text-[#6B7980]">Question <strong className="text-[#14232B]">{currentIndex + 1}</strong> of {rows.length}{issueIndexes.length ? ` · ${issueIndexes.length} with issues` : ' · no issues'}</span>
                </div>
              </div>

              {current && currentPayload && <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[230px_minmax(0,1fr)_minmax(360px,.62fr)]">
                <aside className="min-w-0 rounded-2xl border border-[#E7ECEB] bg-white p-3 xl:sticky xl:top-0 xl:max-h-[72vh] xl:self-start xl:overflow-y-auto"><strong className="text-sm text-[#14232B]">Question navigator</strong><p className="mt-1 text-xs text-[#6B7980]">Red rows need correction. Use the issue buttons to skip directly between them.</p><div className="mt-3 space-y-1.5">{rows.map((row, index) => <button key={`${row.rowNumber}-${index}`} type="button" onClick={() => setCurrentIndex(index)} className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition ${index === currentIndex ? 'border-[#0E5A5A] bg-[#DCE9E7]/45' : row.errors.length || row.duplicate ? 'border-[#B54747]/20 bg-[#B54747]/5' : 'border-[#E7ECEB] hover:border-[#0E5A5A]/30'}`}><span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${row.errors.length || row.duplicate ? 'bg-[#B54747] text-white' : 'bg-[#DCE9E7] text-[#0E5A5A]'}`}>{index + 1}</span><span className="min-w-0"><span className="line-clamp-2 block text-xs font-medium text-[#14232B]">{String(row.raw.question || row.raw.stem_text || 'Untitled question')}</span><span className={`mt-0.5 block text-[10px] ${row.errors.length || row.duplicate ? 'text-[#B54747]' : 'text-[#0E5A5A]'}`}>{row.errors.length || row.duplicate ? `${row.errors.length} issue${row.errors.length === 1 ? '' : 's'}` : 'Ready'}</span></span></button>)}</div></aside>

                <main className="min-w-0 space-y-4">
                  {current.errors.length > 0 && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 p-3"><div className="flex items-center gap-2 text-sm font-semibold text-[#B54747]"><AlertCircle className="h-4 w-4" />Correct these items before Import</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#B54747]">{current.errors.map((item, index) => <li key={index}>{item}</li>)}</ul></div>}
                  {!!current.warnings?.length && <div className="rounded-xl border border-[#F2B84B]/50 bg-[#FFFDF7] p-3 text-xs text-[#8A5F00]">{current.warnings.join(' ')}</div>}

                  <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4"><div className="mb-4"><strong className="text-sm text-[#14232B]">Classification</strong><p className="text-xs text-[#6B7980]">Search existing taxonomy or add a missing chapter/topic from this question.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2"><GuidedLabel required help="Subjects are universal. Only Super Admin can create a missing subject from Question Settings.">Subject</GuidedLabel><SearchableTaxonomySelect value={currentSubjectId} onValueChange={(subjectId) => { const subject = orderedSubjects.find((item) => item.id === subjectId); updateRaw('subject', subject?.name || ''); updateRaw('chapter', ''); updateRaw('topic', ''); }} options={orderedSubjects.map((subject) => ({ value: subject.id, label: subject.name, description: subject.code }))} placeholder="Search subject" /></div>
                    <div className="space-y-2"><GuidedLabel help="Choose an existing chapter or use the Excel chapter name.">Chapter</GuidedLabel><SearchableTaxonomySelect value={currentChapterId} onValueChange={(chapterId) => { const chapter = orderedChapters.find((item) => item.id === chapterId); updateRaw('chapter', chapter?.name || ''); updateRaw('topic', ''); }} options={currentChapters.map((chapter) => ({ value: chapter.id, label: chapter.name }))} placeholder="Search chapter" disabled={!currentSubjectId} allowClear clearLabel="No chapter" /><Input value={rawText(current.raw, 'chapter')} onChange={(event) => { updateRaw('chapter', event.target.value); updateRaw('topic', ''); }} placeholder="Chapter name from Excel" className="border-[#E7ECEB]" />{current.missingChapter && <Button type="button" size="sm" onClick={() => void createCurrentChapter()} disabled={busy} className="w-full bg-[#8A5F00] text-white"><Plus className="mr-1.5 h-4 w-4" />Add chapter “{current.missingChapter.name}”</Button>}</div>
                    <div className="space-y-2"><GuidedLabel help="Topic is optional but recommended.">Topic</GuidedLabel><SearchableTaxonomySelect value={currentPayload.topic_id || ''} onValueChange={(topicId) => { const topic = orderedTopics.find((item) => item.id === topicId); updateRaw('topic', topic?.name || ''); }} options={currentTopics.map((topic) => ({ value: topic.id, label: topic.name }))} placeholder="Search topic" disabled={!currentChapterId} allowClear clearLabel="No topic" /><Input value={rawText(current.raw, 'topic')} onChange={(event) => updateRaw('topic', event.target.value)} placeholder="Optional topic name" className="border-[#E7ECEB]" />{current.missingTopic && <Button type="button" size="sm" onClick={() => void createCurrentTopic()} disabled={busy} className="w-full bg-[#8A5F00] text-white"><Plus className="mr-1.5 h-4 w-4" />Add topic “{current.missingTopic.name}”</Button>}</div>
                    <div className="space-y-2"><GuidedLabel required help="Choose the way a learner answers this question.">Question type</GuidedLabel><Select value={currentPayload.question_type} onValueChange={(value) => updateRaw('question_type', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{simpleQuestionTypes.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><GuidedLabel required help="Difficulty is used for paper balancing and analytics.">Difficulty</GuidedLabel><Select value={currentPayload.difficulty} onValueChange={(value) => updateRaw('difficulty', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{difficulties.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><GuidedLabel help="Teachers may use Draft or In Review only.">Status</GuidedLabel><Select value={currentPayload.status} onValueChange={(value) => updateRaw('status', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{(canPublish ? ['draft', 'in_review', 'approved'] : ['draft', 'in_review']).map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><GuidedLabel required help="Use | between multiple examinations.">Exam types</GuidedLabel><Input value={rawText(current.raw, 'exam_types')} onChange={(event) => updateRaw('exam_types', event.target.value)} placeholder="NEET|KCET" className="border-[#E7ECEB]" /></div>
                    <div className="space-y-2"><GuidedLabel help="Grade or class used for filters.">Class level</GuidedLabel><Input value={rawText(current.raw, 'class_level')} onChange={(event) => updateRaw('class_level', event.target.value)} className="border-[#E7ECEB]" /></div>
                  </div></div>

                  <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4"><div className="mb-4"><strong className="text-sm text-[#14232B]">Question, LaTeX and image</strong><p className="text-xs text-[#6B7980]">Edit here and verify the rendered result on the right.</p></div><div className="space-y-4"><div className="space-y-2"><GuidedLabel required help="Complete learner-facing question text.">Question text</GuidedLabel><Textarea rows={6} value={rawText(current.raw, 'question') || rawText(current.raw, 'stem_text')} onChange={(event) => updateRaw('question', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Paste and correct question LaTeX directly.">Question LaTeX</GuidedLabel><Textarea rows={3} value={rawText(current.raw, 'question_latex') || rawText(current.raw, 'stem_latex')} onChange={(event) => updateRaw('question_latex', event.target.value)} className="border-[#E7ECEB] font-mono text-xs" /></div><div className="space-y-2"><GuidedLabel help="Use a real public HTTPS URL or the exact filename inside the selected ZIP.">Question image</GuidedLabel><Input value={rawText(current.raw, 'question_image')} onChange={(event) => updateRaw('question_image', event.target.value)} placeholder="physics-q1.png or https://…" className="border-[#E7ECEB]" /></div></div></div>

                  <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4"><div className="mb-4"><strong className="text-sm text-[#14232B]">Options and correct answer</strong><p className="text-xs text-[#6B7980]">Review text, LaTeX and image filename for every option.</p></div>{['a', 'b', 'c', 'd'].map((key) => <div key={key} className="mb-3 rounded-xl border border-[#E7ECEB] bg-[#F7F9F7]/45 p-3 last:mb-0"><div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">{key.toUpperCase()}</div><div className="grid gap-2 lg:grid-cols-3"><Input value={rawText(current.raw, `option_${key}`)} onChange={(event) => updateRaw(`option_${key}`, event.target.value)} placeholder={`Option ${key.toUpperCase()} text`} className="border-[#E7ECEB] bg-white" /><Input value={rawText(current.raw, `option_${key}_latex`)} onChange={(event) => updateRaw(`option_${key}_latex`, event.target.value)} placeholder="Optional LaTeX" className="border-[#E7ECEB] bg-white font-mono text-xs" /><Input value={rawText(current.raw, `option_${key}_image`)} onChange={(event) => updateRaw(`option_${key}_image`, event.target.value)} placeholder="Image filename or URL" className="border-[#E7ECEB] bg-white text-xs" /></div></div>)}<div className="mt-4 max-w-sm space-y-2"><GuidedLabel required help="A, B, C or D. Multiple correct uses A|B. Numerical questions use the exact number.">Correct answer</GuidedLabel><Input value={rawText(current.raw, 'correct_answer')} onChange={(event) => updateRaw('correct_answer', event.target.value)} className="border-[#E7ECEB]" /></div></div>

                  <div className="rounded-2xl border border-[#E7ECEB] bg-white p-4"><div className="mb-4"><strong className="text-sm text-[#14232B]">Solution and remaining details</strong></div><div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2"><GuidedLabel help="Human-readable solution.">Solution</GuidedLabel><Textarea rows={5} value={rawText(current.raw, 'solution')} onChange={(event) => updateRaw('solution', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Optional solution LaTeX.">Solution LaTeX</GuidedLabel><Textarea rows={5} value={rawText(current.raw, 'solution_latex')} onChange={(event) => updateRaw('solution_latex', event.target.value)} className="border-[#E7ECEB] font-mono text-xs" /></div></div><div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><GuidedLabel help="Marks for a correct answer.">Marks</GuidedLabel><Input type="number" value={rawText(current.raw, 'marks')} onChange={(event) => updateRaw('marks', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Incorrect-answer deduction.">Negative marks</GuidedLabel><Input type="number" value={rawText(current.raw, 'negative_marks')} onChange={(event) => updateRaw('negative_marks', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Expected solving time.">Expected seconds</GuidedLabel><Input type="number" value={rawText(current.raw, 'estimated_seconds')} onChange={(event) => updateRaw('estimated_seconds', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Learner-facing language.">Language</GuidedLabel><Select value={currentPayload.language} onValueChange={(value) => updateRaw('language', value)}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{languages.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div></div><div className="mt-4 grid gap-4 md:grid-cols-3"><div className="space-y-2"><GuidedLabel help="Question source.">Source</GuidedLabel><Input value={rawText(current.raw, 'source')} onChange={(event) => updateRaw('source', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Source year.">Source year</GuidedLabel><Input type="number" value={rawText(current.raw, 'source_year')} onChange={(event) => updateRaw('source_year', event.target.value)} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Comma- or pipe-separated search tags.">Tags</GuidedLabel><Input value={rawText(current.raw, 'tags')} onChange={(event) => updateRaw('tags', event.target.value)} className="border-[#E7ECEB]" /></div></div></div>
                </main>

                <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start"><QuestionDevicePreview value={{ stemText: currentPayload.stem_text, stemLatex: currentPayload.stem_latex || '', imageUrl: isRemoteUrl(currentPayload.question_image_url || '') ? currentPayload.question_image_url : '', passageText: currentPayload.passage_text || '', questionType: currentPayload.question_type, options: previewOptions, numericAnswer: previewCorrect, subject: orderedSubjects.find((subject) => subject.id === currentPayload.subject_id)?.name || rawText(current.raw, 'subject'), chapter: orderedChapters.find((chapter) => chapter.id === currentPayload.chapter_id)?.name || rawText(current.raw, 'chapter'), topic: orderedTopics.find((topic) => topic.id === currentPayload.topic_id)?.name || rawText(current.raw, 'topic'), difficulty: currentPayload.difficulty, showCorrectAnswer: true }} /></aside>
              </div>}
            </>}
          </div>

          <DialogFooter className="border-t border-[#E7ECEB] bg-white px-4 py-3 sm:px-6 sm:py-4">
            <div className="mr-auto hidden max-w-2xl text-xs text-[#6B7980] md:block">{rows.length ? `${valid.length} ready · ${invalid.length} need correction${localImageReferences.length ? ` · ${localImageReferences.length} local image reference${localImageReferences.length === 1 ? '' : 's'}` : ''}. Ctrl+Z undoes your latest review edit.` : 'Choose an Excel file or paste structured LaTeX questions.'}</div>
            <Button variant="outline" onClick={requestClose} className="border-[#E7ECEB]">{result ? 'Close' : 'Cancel'}</Button>
            {!result && <Button onClick={() => void runImport()} disabled={importBlocked} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}{canPublish ? `Import ${valid.length} Ready Question${valid.length === 1 ? '' : 's'}` : `Import ${valid.length} Draft/Review Question${valid.length === 1 ? '' : 's'}`}</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <AlertDialogContent className="overflow-hidden border-[#E7ECEB] p-0 sm:max-w-2xl">
          <div className="bg-[#14232B] px-6 py-5 text-white"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0E5A5A]"><ListChecks className="h-5 w-5" /></div><AlertDialogHeader className="mt-4 text-left"><AlertDialogTitle className="text-xl text-white">{rows.length} questions detected</AlertDialogTitle><AlertDialogDescription className="text-[#DCE9E7]">The file has been analysed before anything is saved. Start with the first question or jump directly to the first issue.</AlertDialogDescription></AlertDialogHeader></div>
          <div className="grid gap-3 px-6 py-5 sm:grid-cols-4">{statCards.map(({ label, value, icon: Icon, tone }) => <div key={label} className="rounded-xl border border-[#E7ECEB] bg-[#F7F9F7] p-3"><Icon className="h-4 w-4" style={{ color: tone }} /><strong className="mt-2 block text-2xl" style={{ color: tone }}>{value}</strong><span className="text-xs text-[#6B7980]">{label}</span></div>)}</div>
          <div className="px-6 pb-5 text-sm text-[#6B7980]">{invalid.length ? <p><strong className="text-[#B54747]">{invalid.length} question{invalid.length === 1 ? '' : 's'} need attention.</strong> Evidara will never import those rows until the highlighted fields are corrected.</p> : <p className="text-[#0E5A5A]"><strong>Every detected question passed the current review checks.</strong></p>}</div>
          <AlertDialogFooter className="border-t border-[#E7ECEB] px-6 py-4"><Button type="button" variant="outline" onClick={() => { setCurrentIndex(0); setSummaryOpen(false); }}>Review from question 1</Button>{invalid.length > 0 && <Button type="button" onClick={() => { goToFirstIssue(); setSummaryOpen(false); }} className="bg-[#B54747] text-white hover:bg-[#9C3838]"><AlertCircle className="mr-2 h-4 w-4" />Fix first issue</Button>}</AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent className="overflow-hidden border-[#E7ECEB] p-0 sm:max-w-lg">
          <div className="bg-[#14232B] px-6 py-5 text-white"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F2B84B] text-[#14232B]"><RotateCcw className="h-5 w-5" /></div><AlertDialogHeader className="mt-4 text-left"><AlertDialogTitle className="text-xl text-white">Discard this import review?</AlertDialogTitle><AlertDialogDescription className="text-[#DCE9E7]">The selected files, taxonomy corrections and all unsaved edits in this review will be cleared.</AlertDialogDescription></AlertDialogHeader></div>
          <div className="px-6 py-5"><div className="rounded-xl border border-[#F2B84B]/50 bg-[#FFFDF7] p-4 text-sm text-[#8A5F00]"><strong>{rows.length || 0} question{rows.length === 1 ? '' : 's'} currently in review</strong><p className="mt-1 text-xs">Choose “Continue reviewing” to return without losing anything.</p></div></div>
          <AlertDialogFooter className="border-t border-[#E7ECEB] px-6 py-4"><AlertDialogCancel>Continue reviewing</AlertDialogCancel><Button type="button" variant="destructive" onClick={closeImmediately}><XCircle className="mr-2 h-4 w-4" />Discard import</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resultOpen} onOpenChange={setResultOpen}>
        <AlertDialogContent className="overflow-hidden border-[#E7ECEB] p-0 sm:max-w-xl">
          <div className="bg-[#14232B] px-6 py-5 text-white"><div className={`flex h-11 w-11 items-center justify-center rounded-xl ${result?.failed ? 'bg-[#F2B84B] text-[#14232B]' : 'bg-[#0E5A5A]'}`}>{result?.failed ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}</div><AlertDialogHeader className="mt-4 text-left"><AlertDialogTitle className="text-xl text-white">Import completed</AlertDialogTitle><AlertDialogDescription className="text-[#DCE9E7]">{result?.imported || 0} added · {result?.failed || 0} not added</AlertDialogDescription></AlertDialogHeader></div>
          <div className="px-6 py-5">{!!result?.errors?.length ? <div className="max-h-64 overflow-y-auto rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 p-4"><strong className="text-sm text-[#B54747]">Questions not added</strong><ol className="mt-3 list-decimal space-y-2 pl-5 text-xs text-[#B54747]">{result.errors.slice(0, 100).map((item, index) => <li key={index}>{displayError(item)}</li>)}</ol></div> : <p className="text-sm text-[#0E5A5A]">Every reviewed question was added successfully.</p>}</div>
          <AlertDialogFooter className="border-t border-[#E7ECEB] px-6 py-4"><Button type="button" onClick={() => setResultOpen(false)} className="bg-[#0E5A5A] text-white">Return to review</Button></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
