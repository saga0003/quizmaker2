'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  GripVertical,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type {
  MatchFollowingPair,
  QuestionDifficulty,
  QuestionOptionInput,
  QuestionPayload,
  QuestionPyqOccurrenceInput,
  QuestionRow,
  QuestionStatus,
  QuestionType,
  TaxonomyChapter,
  TaxonomySubject,
  TaxonomyTopic,
} from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { GuidedLabel, HelpIcon } from '@/components/evidara/question-help';
import { QuestionImageField } from '@/components/evidara/question-image-field';
import { QuestionDevicePreview } from '@/components/evidara/question-device-preview';
import { SearchableTaxonomySelect } from '@/components/evidara/searchable-taxonomy-select';
import { useAssessmentOptions } from '@/components/evidara/use-assessment-options';

const questionTypeLabels: Record<QuestionType, string> = {
  single_correct: 'Single-correct MCQ',
  multiple_correct: 'Multiple-correct MCQ',
  numerical: 'Numerical value',
  integer: 'Integer answer',
  assertion_reason: 'Assertion and reason',
  match_following: 'Match the following',
  passage: 'Passage based',
  image_based: 'Image based',
};

const questionTypeHelp: Record<QuestionType, string> = {
  single_correct: 'Create two to six options and mark exactly one as correct.',
  multiple_correct: 'Create two to six options and mark every correct option. The learner must select the complete correct set.',
  numerical: 'The learner enters a numerical value. Use decimals only when the examination allows them.',
  integer: 'The learner enters a whole-number answer. Do not add answer options.',
  assertion_reason: 'Enter the complete assertion-and-reason prompt and the standard relationship options. Mark exactly one option.',
  match_following: 'Build two columns. Each left entry is mapped to one numbered right entry. Evidara stores the correct mapping.',
  passage: 'Add the common passage first, then the question and answer options that depend on it.',
  image_based: 'Add a public image URL or upload an image, then create the answer options. The preview updates immediately.',
};

const difficultyLabels: Record<QuestionDifficulty, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  very_difficult: 'Very difficult',
};

const choiceTypes: QuestionType[] = ['single_correct', 'multiple_correct', 'assertion_reason', 'passage', 'image_based'];

function seedOptions(): QuestionOptionInput[] {
  return ['A', 'B', 'C', 'D'].map((option_key, display_order) => ({
    option_key,
    content_text: '',
    content_latex: '',
    image_url: '',
    is_correct: false,
    display_order,
  }));
}

function seedMatchPairs(): MatchFollowingPair[] {
  return ['A', 'B', 'C', 'D'].map((left_key, index) => ({
    id: crypto.randomUUID(),
    left_key,
    left_text: '',
    left_latex: '',
    left_image_url: '',
    right_key: String(index + 1),
    right_text: '',
    right_latex: '',
    right_image_url: '',
  }));
}

type EditorState = {
  id: string | null;
  subjectId: string;
  chapterId: string;
  topicId: string;
  type: QuestionType;
  status: QuestionStatus;
  difficulty: QuestionDifficulty;
  stem: string;
  stemLatex: string;
  passage: string;
  imageUrl: string;
  solution: string;
  solutionLatex: string;
  marks: number;
  negativeMarks: number;
  estimatedSeconds: number;
  examTypes: string[];
  classLevel: string;
  biologyDivision: 'combined' | 'botany' | 'zoology';
  language: string;
  source: string;
  sourceYear: string;
  tags: string;
  numericAnswer: string;
  options: QuestionOptionInput[];
  matchPairs: MatchFollowingPair[];
  pyqOccurrences: QuestionPyqOccurrenceInput[];
};

function emptyEditor(kind: 'admin' | 'school', canPublish: boolean): EditorState {
  return {
    id: null,
    subjectId: '',
    chapterId: '',
    topicId: '',
    type: 'single_correct',
    status: kind === 'admin' && canPublish ? 'approved' : 'draft',
    difficulty: 'moderate',
    stem: '',
    stemLatex: '',
    passage: '',
    imageUrl: '',
    solution: '',
    solutionLatex: '',
    marks: 4,
    negativeMarks: 1,
    estimatedSeconds: 90,
    examTypes: ['NEET'],
    classLevel: 'Grade 11',
    biologyDivision: 'combined',
    language: 'English',
    source: '',
    sourceYear: '',
    tags: '',
    numericAnswer: '',
    options: seedOptions(),
    matchPairs: seedMatchPairs(),
    pyqOccurrences: [],
  };
}

function metadataMatchPairs(question?: QuestionRow | null): MatchFollowingPair[] {
  const pairs = question?.metadata?.match_pairs;
  if (Array.isArray(pairs) && pairs.length) {
    return pairs.map((pair, index) => ({
      id: pair.id || crypto.randomUUID(),
      left_key: pair.left_key || String.fromCharCode(65 + index),
      left_text: pair.left_text || '',
      left_latex: pair.left_latex || '',
      left_image_url: pair.left_image_url || '',
      right_key: pair.right_key || String(index + 1),
      right_text: pair.right_text || '',
      right_latex: pair.right_latex || '',
      right_image_url: pair.right_image_url || '',
    }));
  }
  return seedMatchPairs();
}

function pyqOccurrencesFromQuestion(question?: QuestionRow | null): QuestionPyqOccurrenceInput[] {
  return (question?.question_pyq_occurrences || []).map((occurrence) => {
    const source = occurrence.pyq_source_papers;
    return {
      exam_type: source?.exam_type || 'NEET',
      year: Number(source?.source_year || question?.source_year || new Date().getFullYear()),
      variant: source?.variant || 'Main',
      paper_code: source?.paper_code || '',
      paper_key: source?.paper_key || '',
      display_name: source?.display_name || '',
      source_key: source?.source_key || '',
      question_number: Number(occurrence.source_question_number || 0) || undefined,
      subject_label: occurrence.subject_label || '',
      expected_question_count: Number(source?.expected_question_count || 0) || undefined,
    };
  });
}

function editorFromQuestion(kind: 'admin' | 'school', canPublish: boolean, question?: QuestionRow | null): EditorState {
  if (!question) return emptyEditor(kind, canPublish);
  const answer = Array.isArray(question.correct_answer) ? question.correct_answer.join(',') : String(question.correct_answer ?? '');
  const options = (question.question_options || []).slice().sort((a, b) => a.display_order - b.display_order);
  const metadata = question.metadata || {};
  return {
    id: question.id,
    subjectId: question.subject_id || '',
    chapterId: question.chapter_id || '',
    topicId: question.topic_id || '',
    type: question.question_type,
    status: question.status,
    difficulty: question.difficulty,
    stem: question.stem_text,
    stemLatex: question.stem_latex || '',
    passage: question.passage_text || '',
    imageUrl: question.question_image_url || '',
    solution: question.solution_text || '',
    solutionLatex: question.solution_latex || '',
    marks: Number(question.marks),
    negativeMarks: Number(question.negative_marks),
    estimatedSeconds: question.estimated_seconds || 90,
    examTypes: question.exam_types || [],
    classLevel: question.class_level || 'Grade 11',
    biologyDivision: (metadata.biology_division === 'botany' || metadata.biology_division === 'zoology') ? metadata.biology_division : 'combined',
    language: question.language || 'English',
    source: question.source || '',
    sourceYear: question.source_year ? String(question.source_year) : '',
    tags: (question.tags || []).join(', '),
    numericAnswer: answer,
    options: options.length ? options : seedOptions(),
    matchPairs: metadataMatchPairs(question),
    pyqOccurrences: pyqOccurrencesFromQuestion(question),
  };
}

function SectionHeading({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 border-b border-[#E7ECEB] pb-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">{number}</span>
      <div><h3 className="font-semibold text-[#14232B]">{title}</h3><p className="mt-0.5 text-xs leading-relaxed text-[#6B7980]">{description}</p></div>
    </div>
  );
}

export function QuestionEditorDialog({
  open,
  onOpenChange,
  kind,
  organizationId,
  subjects,
  chapters,
  topics,
  question,
  onSaved,
  onTaxonomyChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'admin' | 'school';
  organizationId: string | null;
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  topics: TaxonomyTopic[];
  question?: QuestionRow | null;
  onSaved: () => Promise<void> | void;
  onTaxonomyChanged?: () => Promise<void> | void;
}) {
  const { profile, session } = useAuth();
  const role = normalizeEvidaraRole(profile?.role);
  const canPublish = role === 'super_admin' || role === 'evidara_admin' || role === 'school_admin';
  const teacher = role === 'school_teacher';
  const { grades, exams, error: settingsError } = useAssessmentOptions(organizationId);
  const lockedDecision = teacher && Boolean(question && ['approved', 'rejected', 'archived'].includes(question.status));
  const [editor, setEditor] = useState<EditorState>(() => editorFromQuestion(kind, canPublish, question));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [chapterDraft, setChapterDraft] = useState('');
  const [topicDraft, setTopicDraft] = useState('');
  const [showChapterCreate, setShowChapterCreate] = useState(false);
  const [showTopicCreate, setShowTopicCreate] = useState(false);
  const [taxonomyBusy, setTaxonomyBusy] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditor(editorFromQuestion(kind, canPublish, question));
    setError('');
    setChapterDraft('');
    setTopicDraft('');
    setShowChapterCreate(false);
    setShowTopicCreate(false);
  }, [canPublish, kind, open, question]);

  const orderedSubjects = useMemo(() => [...subjects].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })), [subjects]);
  const visibleChapters = useMemo(
    () => chapters.filter((chapter) => !editor.subjectId || chapter.subject_id === editor.subjectId).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [chapters, editor.subjectId],
  );
  const visibleTopics = useMemo(
    () => topics.filter((topic) => !editor.chapterId || topic.chapter_id === editor.chapterId).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [editor.chapterId, topics],
  );
  const selectedSubject = orderedSubjects.find((subject) => subject.id === editor.subjectId);
  const selectedChapter = chapters.find((chapter) => chapter.id === editor.chapterId);
  const selectedTopic = topics.find((topic) => topic.id === editor.topicId);
  const biologySubject = Boolean(selectedSubject && /biology|botany|zoology/i.test(`${selectedSubject.name} ${selectedSubject.code}`));
  const availableGrades = useMemo(() => {
    const values = grades.map((item) => item.value);
    return editor.classLevel && !values.includes(editor.classLevel) ? [...values, editor.classLevel] : values;
  }, [editor.classLevel, grades]);
  const isChoice = choiceTypes.includes(editor.type);
  const isMatch = editor.type === 'match_following';
  const isNumeric = editor.type === 'numerical' || editor.type === 'integer';

  const usableOptions = editor.options.filter((option) => option.content_text.trim() || option.content_latex?.trim() || option.image_url?.trim());
  const correctOptions = usableOptions.filter((option) => option.is_correct);
  const usablePairs = editor.matchPairs.filter((pair) =>
    pair.left_text.trim() || pair.left_latex?.trim() || pair.left_image_url?.trim()
    || pair.right_text.trim() || pair.right_latex?.trim() || pair.right_image_url?.trim(),
  );

  const validation = useMemo(() => {
    const problems: string[] = [];
    if (editor.stem.trim().length < 5) problems.push('Enter a complete question.');
    if (!editor.subjectId) problems.push('Select a subject.');
    if (!editor.examTypes.length) problems.push('Select at least one examination.');
    if (!editor.classLevel.trim()) problems.push('Select a grade.');
    if (kind === 'school' && !organizationId) problems.push('This account is not linked to a school organization.');
    if (teacher && !['draft', 'in_review'].includes(editor.status)) problems.push('Teachers can save drafts or submit questions for review only.');
    if (isChoice && usableOptions.length < 2) problems.push('Enter at least two answer options.');
    if (isChoice && correctOptions.length < 1) problems.push('Mark the correct answer.');
    if (isChoice && editor.type !== 'multiple_correct' && correctOptions.length !== 1) problems.push('This question type requires exactly one correct option.');
    if (isNumeric && !editor.numericAnswer.trim()) problems.push('Enter the numerical or integer answer.');
    if (editor.type === 'integer' && editor.numericAnswer && !Number.isInteger(Number(editor.numericAnswer))) problems.push('Integer questions require a whole-number answer.');
    if (isMatch && usablePairs.length < 2) problems.push('Add at least two complete match pairs.');
    if (isMatch && usablePairs.some((pair) => (!pair.left_text.trim() && !pair.left_latex?.trim() && !pair.left_image_url?.trim()) || (!pair.right_text.trim() && !pair.right_latex?.trim() && !pair.right_image_url?.trim()))) problems.push('Every match row needs content on both sides.');
    if (lockedDecision) problems.push('Teachers cannot modify a question after an administrator has approved, rejected or archived it.');
    if (kind === 'admin' && role === 'super_admin' && editor.pyqOccurrences.some((item) => !item.year || item.year < 1990 || item.year > 2100 || !item.exam_type.trim() || !item.variant.trim())) {
      problems.push('Complete the exam, year and paper variant for every PYQ occurrence.');
    }
    return problems;
  }, [correctOptions.length, editor, isChoice, isMatch, isNumeric, kind, lockedDecision, organizationId, teacher, usableOptions.length, usablePairs]);

  function addPyqOccurrence() {
    const subjectLabel = selectedSubject?.name || '';
    setEditor((current) => ({
      ...current,
      pyqOccurrences: [...current.pyqOccurrences, {
        exam_type: current.examTypes.includes('NEET') ? 'NEET' : current.examTypes[0] || 'NEET',
        year: new Date().getFullYear(),
        variant: 'Main',
        paper_code: '',
        display_name: '',
        question_number: undefined,
        subject_label: subjectLabel,
        expected_question_count: 180,
      }],
    }));
  }

  function updatePyqOccurrence(index: number, patch: Partial<QuestionPyqOccurrenceInput>) {
    setEditor((current) => ({
      ...current,
      pyqOccurrences: current.pyqOccurrences.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
  }

  function removePyqOccurrence(index: number) {
    setEditor((current) => ({ ...current, pyqOccurrences: current.pyqOccurrences.filter((_item, itemIndex) => itemIndex !== index) }));
  }

  function updateOption(index: number, patch: Partial<QuestionOptionInput>) {
    setEditor((current) => ({ ...current, options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) }));
  }

  function markCorrect(index: number) {
    setEditor((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => ({
        ...option,
        is_correct: current.type === 'multiple_correct' ? optionIndex === index ? !option.is_correct : option.is_correct : optionIndex === index,
      })),
    }));
  }

  function addOption() {
    setEditor((current) => {
      if (current.options.length >= 6) return current;
      const key = String.fromCharCode(65 + current.options.length);
      return { ...current, options: [...current.options, { option_key: key, content_text: '', content_latex: '', image_url: '', is_correct: false, display_order: current.options.length }] };
    });
  }

  function removeOption(index: number) {
    setEditor((current) => ({
      ...current,
      options: current.options.filter((_option, optionIndex) => optionIndex !== index).map((option, optionIndex) => ({ ...option, option_key: String.fromCharCode(65 + optionIndex), display_order: optionIndex })),
    }));
  }

  function updatePair(index: number, patch: Partial<MatchFollowingPair>) {
    setEditor((current) => ({ ...current, matchPairs: current.matchPairs.map((pair, pairIndex) => pairIndex === index ? { ...pair, ...patch } : pair) }));
  }

  function addPair() {
    setEditor((current) => {
      if (current.matchPairs.length >= 6) return current;
      const index = current.matchPairs.length;
      return { ...current, matchPairs: [...current.matchPairs, { id: crypto.randomUUID(), left_key: String.fromCharCode(65 + index), left_text: '', left_latex: '', left_image_url: '', right_key: String(index + 1), right_text: '', right_latex: '', right_image_url: '' }] };
    });
  }

  function removePair(index: number) {
    setEditor((current) => ({ ...current, matchPairs: current.matchPairs.filter((_pair, pairIndex) => pairIndex !== index).map((pair, pairIndex) => ({ ...pair, left_key: String.fromCharCode(65 + pairIndex), right_key: String(pairIndex + 1) })) }));
  }

  function toggleExam(exam: string) {
    setEditor((current) => ({ ...current, examTypes: current.examTypes.includes(exam) ? current.examTypes.filter((value) => value !== exam) : [...current.examTypes, exam] }));
  }

  async function createTaxonomy(action: 'createChapter' | 'createTopic') {
    if (!session?.access_token) {
      setError('Sign in again before adding taxonomy.');
      return;
    }
    const name = action === 'createChapter' ? chapterDraft.trim() : topicDraft.trim();
    if (!name) return;
    setTaxonomyBusy(action);
    setError('');
    try {
      const response = await fetch('/api/question-taxonomy/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          organizationId: kind === 'school' ? organizationId : null,
          name,
          subjectId: editor.subjectId,
          chapterId: editor.chapterId,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to add taxonomy.');
      await onTaxonomyChanged?.();
      if (action === 'createChapter') {
        setEditor((current) => ({ ...current, chapterId: result.item.id, topicId: '' }));
        setChapterDraft('');
        setShowChapterCreate(false);
      } else {
        setEditor((current) => ({ ...current, topicId: result.item.id }));
        setTopicDraft('');
        setShowTopicCreate(false);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to add taxonomy.');
    } finally {
      setTaxonomyBusy('');
    }
  }

  async function save() {
    setError('');
    if (validation.length) {
      setError(validation.join(' '));
      return;
    }
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    const examTypes = [...editor.examTypes];
    const matchOptions: QuestionOptionInput[] = usablePairs.map((pair, display_order) => ({ option_key: pair.right_key, content_text: pair.right_text, content_latex: pair.right_latex, image_url: pair.right_image_url, is_correct: false, display_order }));
    const correctAnswer = isMatch ? usablePairs.map((pair) => `${pair.left_key}-${pair.right_key}`) : isChoice ? correctOptions.map((option) => option.option_key) : editor.numericAnswer.trim();
    const existingPublishedAt = question?.metadata?.published_at;

    const payload: QuestionPayload = {
      subject_id: editor.subjectId,
      chapter_id: editor.chapterId || undefined,
      topic_id: editor.topicId || undefined,
      question_type: editor.type,
      status: editor.status,
      difficulty: editor.difficulty,
      stem_text: editor.stem.trim(),
      stem_latex: editor.stemLatex.trim() || undefined,
      question_image_url: editor.imageUrl.trim() || undefined,
      passage_text: editor.passage.trim() || undefined,
      solution_text: editor.solution.trim() || undefined,
      solution_latex: editor.solutionLatex.trim() || undefined,
      marks: Number(editor.marks),
      negative_marks: Number(editor.negativeMarks),
      estimated_seconds: Number(editor.estimatedSeconds),
      correct_answer: correctAnswer,
      exam_types: examTypes,
      class_level: editor.classLevel.trim() || undefined,
      source: editor.source.trim() || undefined,
      source_year: editor.sourceYear ? Number(editor.sourceYear) : undefined,
      language: editor.language,
      tags: editor.tags.split(',').map((value) => value.trim()).filter(Boolean),
      metadata: {
        ...(question?.metadata || {}),
        editor: 'evidara_v7_one_page_question_editor',
        biology_division: biologySubject ? editor.biologyDivision : undefined,
        match_pairs: isMatch ? usablePairs : undefined,
        published_at: editor.status === 'approved' ? existingPublishedAt || new Date().toISOString() : existingPublishedAt,
      },
      options: isMatch ? matchOptions : isChoice ? usableOptions : [],
      change_note: editor.id ? 'Updated from Evidara V12 question editor' : 'Created from Evidara V12 question editor',
    };

    setSaving(true);
    const { data: savedQuestionId, error: saveError } = await supabase.rpc('save_question', { p_question_id: editor.id, p_organization_id: kind === 'admin' ? null : organizationId, p_payload: {
      ...payload,
      source: editor.pyqOccurrences.length ? 'Previous Year Question' : payload.source,
      source_year: editor.pyqOccurrences.length ? Math.max(...editor.pyqOccurrences.map((item) => Number(item.year || 0))) : payload.source_year,
      metadata: {
        ...(payload.metadata || {}),
        has_pyq_occurrences: editor.pyqOccurrences.length > 0,
        pyq_occurrence_labels: editor.pyqOccurrences.map((item) => item.display_name || `${item.exam_type} ${item.year} ${item.variant}`),
      },
    } });
    if (saveError) {
      setSaving(false);
      setError(saveError.message);
      return;
    }
    const questionId = String(savedQuestionId || editor.id || '');
    if (kind === 'admin' && role === 'super_admin' && questionId && session?.access_token) {
      const response = await fetch('/api/admin/pyq-paper-sources/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: 'syncQuestionOccurrences', questionId, occurrences: editor.pyqOccurrences }),
      });
      const responsePayload = await response.json();
      if (!response.ok) {
        setSaving(false);
        setError(responsePayload.error || 'Question saved, but PYQ occurrences could not be synchronized.');
        return;
      }
    }
    setSaving(false);
    onOpenChange(false);
    await onSaved();
  }

  const previewOptions = isMatch
    ? usablePairs.map((pair, index) => ({ option_key: pair.left_key, content_text: `${pair.left_text || pair.left_latex || 'Left item'}  →  ${pair.right_key}. ${pair.right_text || pair.right_latex || 'Right item'}`, is_correct: true, display_order: index }))
    : usableOptions;

  const statusOptions: QuestionStatus[] = canPublish
    ? question ? ['draft', 'in_review', 'approved', 'rejected', 'archived'] : ['draft', 'in_review', 'approved']
    : ['draft', 'in_review'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-[96vw] max-w-[1540px] overflow-hidden border-[#E7ECEB] p-0">
        <DialogHeader className="border-b border-[#E7ECEB] px-4 py-4 sm:px-6">
          <div className="flex flex-col gap-3 pr-8 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <DialogTitle className="text-xl text-[#14232B]">{editor.id ? 'Edit Question' : 'Add Question'}</DialogTitle>
              <DialogDescription className="mt-1 max-w-3xl">Complete the question on one page. Classification, options, solution and the learner preview remain visible in one continuous workflow.</DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{questionTypeLabels[editor.type]}</Badge>
              <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{editor.classLevel || 'Grade pending'}</Badge>
              <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{kind === 'admin' ? 'Evidara Master Bank' : 'School Question Bank'}</Badge>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#FBFCFC] px-3 py-4 sm:px-6 sm:py-5">
          {(error || settingsError) && <div className="mb-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{error || settingsError}</div>}
          {lockedDecision && <div className="mb-4 rounded-xl border border-[#8A5F00]/20 bg-[#F2B84B]/10 px-4 py-3 text-sm text-[#8A5F00]">This question has already received an administrator decision. Teachers can review the result but cannot modify or archive it.</div>}

          <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(390px,.62fr)]">
            <div className="min-w-0 space-y-5">
              <Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
                <CardContent className="space-y-5 p-4 sm:p-5">
                  <SectionHeading number="1" title="Classification and use" description="Choose the academic hierarchy and where this question should be used. Every selector supports typing and A–Z search." />
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <div className="space-y-2"><GuidedLabel required help="Subjects are universal and can be added only by Super Admin from Question Settings.">Subject</GuidedLabel><SearchableTaxonomySelect value={editor.subjectId} onValueChange={(subjectId) => setEditor((current) => ({ ...current, subjectId, chapterId: '', topicId: '' }))} options={orderedSubjects.map((subject) => ({ value: subject.id, label: subject.name, description: subject.code }))} placeholder="Select or search subject" /></div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2"><GuidedLabel help="Choose a chapter or add a missing chapter without leaving this question.">Chapter</GuidedLabel><Button type="button" variant="ghost" size="sm" disabled={!editor.subjectId} onClick={() => setShowChapterCreate((value) => !value)} className="h-7 px-2 text-xs text-[#0E5A5A]"><Plus className="mr-1 h-3.5 w-3.5" />New</Button></div>
                      <SearchableTaxonomySelect value={editor.chapterId} onValueChange={(chapterId) => setEditor((current) => ({ ...current, chapterId, topicId: '' }))} options={visibleChapters.map((chapter) => ({ value: chapter.id, label: chapter.name }))} placeholder={editor.subjectId ? 'Select or search chapter' : 'Choose subject first'} disabled={!editor.subjectId} allowClear clearLabel="No chapter" />
                      {showChapterCreate && <div className="flex gap-2 rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-2"><Input autoFocus value={chapterDraft} onChange={(event) => setChapterDraft(event.target.value)} placeholder="New chapter name" className="border-[#E7ECEB] bg-white" /><Button type="button" size="icon" disabled={!chapterDraft.trim() || taxonomyBusy === 'createChapter'} onClick={() => void createTaxonomy('createChapter')} className="shrink-0 bg-[#0E5A5A]">{taxonomyBusy === 'createChapter' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}</Button><Button type="button" variant="ghost" size="icon" onClick={() => setShowChapterCreate(false)}><X className="h-4 w-4" /></Button></div>}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2"><GuidedLabel help="Topic is optional but recommended for topic tests, analytics and dynamic topic-wise serial numbers.">Topic</GuidedLabel><Button type="button" variant="ghost" size="sm" disabled={!editor.chapterId} onClick={() => setShowTopicCreate((value) => !value)} className="h-7 px-2 text-xs text-[#0E5A5A]"><Plus className="mr-1 h-3.5 w-3.5" />New</Button></div>
                      <SearchableTaxonomySelect value={editor.topicId} onValueChange={(topicId) => setEditor((current) => ({ ...current, topicId }))} options={visibleTopics.map((topic) => ({ value: topic.id, label: topic.name }))} placeholder={editor.chapterId ? 'Select or search topic' : 'Choose chapter first'} disabled={!editor.chapterId} allowClear clearLabel="No topic" />
                      {showTopicCreate && <div className="flex gap-2 rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-2"><Input autoFocus value={topicDraft} onChange={(event) => setTopicDraft(event.target.value)} placeholder="New topic name" className="border-[#E7ECEB] bg-white" /><Button type="button" size="icon" disabled={!topicDraft.trim() || taxonomyBusy === 'createTopic'} onClick={() => void createTaxonomy('createTopic')} className="shrink-0 bg-[#0E5A5A]">{taxonomyBusy === 'createTopic' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}</Button><Button type="button" variant="ghost" size="icon" onClick={() => setShowTopicCreate(false)}><X className="h-4 w-4" /></Button></div>}
                    </div>
                  </div>
                  {biologySubject && (
                    <div className="rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-3">
                      <GuidedLabel help="Keep Biology as the parent subject while classifying the question for combined Biology, Botany or Zoology sections.">Biology division</GuidedLabel>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {([['combined', 'Combined Biology'], ['botany', 'Botany'], ['zoology', 'Zoology']] as const).map(([value, label]) => (
                          <Button key={value} type="button" variant="outline" size="sm" onClick={() => setEditor((current) => ({ ...current, biologyDivision: value }))} className={editor.biologyDivision === value ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] bg-white text-[#44545C]'}>{label}</Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-2"><GuidedLabel required help="The question type controls how answers are entered and evaluated.">Question type</GuidedLabel><Select value={editor.type} onValueChange={(value) => setEditor((current) => ({ ...current, type: value as QuestionType, options: seedOptions(), matchPairs: seedMatchPairs(), numericAnswer: '' }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(questionTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><GuidedLabel required help="Grade controls eligibility, filtering and paper selection.">Grade</GuidedLabel><Select value={editor.classLevel} onValueChange={(classLevel) => setEditor((current) => ({ ...current, classLevel }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Select grade" /></SelectTrigger><SelectContent>{availableGrades.map((value) => <SelectItem key={value} value={value}>{grades.find((item) => item.value === value)?.label || value}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><GuidedLabel help="Difficulty supports paper balancing and analytics.">Difficulty</GuidedLabel><Select value={editor.difficulty} onValueChange={(value) => setEditor((current) => ({ ...current, difficulty: value as QuestionDifficulty }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(difficultyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><GuidedLabel help={canPublish ? 'Administrators may publish, reject or archive. Teachers are limited to Draft and In Review.' : 'Teachers can save a draft or send the question for administrator review.'}>Status</GuidedLabel><Select value={editor.status} onValueChange={(value) => setEditor((current) => ({ ...current, status: value as QuestionStatus }))} disabled={lockedDecision}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{statusOptions.map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-[#F7F9F7] p-3 text-xs leading-relaxed text-[#6B7980]"><HelpIcon text={questionTypeHelp[editor.type]} /><span>{questionTypeHelp[editor.type]}</span></div>
                </CardContent>
              </Card>

              <Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
                <CardContent className="space-y-5 p-4 sm:p-5">
                  <SectionHeading number="2" title="Question content" description="Add normal text, LaTeX and images together. The learner preview updates while you type." />
                  {editor.type === 'passage' && <div className="space-y-2"><GuidedLabel required help="Enter the shared passage, case, graph description or experiment.">Passage</GuidedLabel><Textarea rows={6} value={editor.passage} onChange={(event) => setEditor((current) => ({ ...current, passage: event.target.value }))} className="border-[#E7ECEB]" /></div>}
                  <div className="space-y-2"><GuidedLabel required help="Enter the complete learner-facing question. Do not include the answer key here.">Question text</GuidedLabel><Textarea rows={7} value={editor.stem} onChange={(event) => setEditor((current) => ({ ...current, stem: event.target.value }))} placeholder="Enter the complete question" className="border-[#E7ECEB] text-base leading-relaxed" /></div>
                  <div className="space-y-2"><GuidedLabel help="Paste mathematical or scientific LaTeX here. You can type and correct the code while viewing the live rendering.">Question LaTeX</GuidedLabel><Textarea rows={4} value={editor.stemLatex} onChange={(event) => setEditor((current) => ({ ...current, stemLatex: event.target.value }))} placeholder="Example: R=\\frac{u^2\\sin 2\\theta}{g}" className="border-[#E7ECEB] font-mono" /></div>
                  <QuestionImageField label="Question image" value={editor.imageUrl} onChange={(imageUrl) => setEditor((current) => ({ ...current, imageUrl }))} help="Paste a public Cloudflare, R2, Supabase Storage or other HTTPS image URL, or upload a local image." />
                </CardContent>
              </Card>

              <Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
                <CardContent className="space-y-5 p-4 sm:p-5">
                  <SectionHeading number="3" title="Answer and options" description="Set the correct answer and review the exact option layout before saving." />
                  {isMatch ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold text-[#14232B]">Match columns</h4><HelpIcon text="Each row defines the correct mapping. The right column may be shuffled during an exam." /></div><p className="mt-1 text-xs text-[#6B7980]">Add text, LaTeX or an image to both sides.</p></div><Button type="button" variant="outline" onClick={addPair} disabled={editor.matchPairs.length >= 6} className="border-[#E7ECEB]"><Plus className="mr-2 h-4 w-4" />Add pair</Button></div>
                      <div className="space-y-3">{editor.matchPairs.map((pair, index) => <div key={pair.id} className="rounded-2xl border border-[#E7ECEB] bg-white p-4"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6B7980]"><GripVertical className="h-4 w-4" />Correct mapping {pair.left_key} → {pair.right_key}</div><Button type="button" variant="ghost" size="icon" disabled={editor.matchPairs.length <= 2} onClick={() => removePair(index)} className="h-8 w-8 text-[#B54747]"><Trash2 className="h-4 w-4" /></Button></div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-3"><div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">{pair.left_key}</span><strong className="text-sm text-[#14232B]">Left item</strong></div><div className="space-y-2"><Input value={pair.left_text} onChange={(event) => updatePair(index, { left_text: event.target.value })} placeholder="Left-side text" className="border-[#E7ECEB] bg-white" /><Input value={pair.left_latex || ''} onChange={(event) => updatePair(index, { left_latex: event.target.value })} placeholder="Optional LaTeX" className="border-[#E7ECEB] bg-white font-mono text-xs" /><QuestionImageField compact label="Left image" value={pair.left_image_url || ''} onChange={(left_image_url) => updatePair(index, { left_image_url })} help="Optional image for this left-side item." /></div></div><div className="rounded-xl border border-[#F2B84B]/40 bg-[#FFFDF7] p-3"><div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F2B84B] text-xs font-bold text-[#14232B]">{pair.right_key}</span><strong className="text-sm text-[#14232B]">Correct right item</strong></div><div className="space-y-2"><Input value={pair.right_text} onChange={(event) => updatePair(index, { right_text: event.target.value })} placeholder="Right-side text" className="border-[#E7ECEB] bg-white" /><Input value={pair.right_latex || ''} onChange={(event) => updatePair(index, { right_latex: event.target.value })} placeholder="Optional LaTeX" className="border-[#E7ECEB] bg-white font-mono text-xs" /><QuestionImageField compact label="Right image" value={pair.right_image_url || ''} onChange={(right_image_url) => updatePair(index, { right_image_url })} help="Optional image for the mapped right-side item." /></div></div></div></div>)}</div>
                    </div>
                  ) : isChoice ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold text-[#14232B]">Answer options</h4><HelpIcon text={editor.type === 'multiple_correct' ? 'Click every correct option letter.' : 'Click one option letter to mark the correct answer.'} /></div><p className="mt-1 text-xs text-[#6B7980]">Options may contain text, LaTeX and an image.</p></div><Button type="button" variant="outline" onClick={addOption} disabled={editor.options.length >= 6} className="border-[#E7ECEB]"><Plus className="mr-2 h-4 w-4" />Add option</Button></div>
                      <div className="grid gap-4 lg:grid-cols-2">{editor.options.map((option, index) => <div key={option.option_key} className={`rounded-2xl border p-4 ${option.is_correct ? 'border-[#0E5A5A] bg-[#DCE9E7]/35' : 'border-[#E7ECEB] bg-white'}`}><div className="flex items-start gap-3"><button type="button" onClick={() => markCorrect(index)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-bold ${option.is_correct ? 'border-[#0E5A5A] bg-[#0E5A5A] text-white' : 'border-[#D0D5DD] bg-white text-[#14232B]'}`}>{option.option_key}</button><div className="min-w-0 flex-1 space-y-3"><Input value={option.content_text} onChange={(event) => updateOption(index, { content_text: event.target.value })} placeholder={`Option ${option.option_key} text`} className="border-[#E7ECEB]" /><Input value={option.content_latex || ''} onChange={(event) => updateOption(index, { content_latex: event.target.value })} placeholder="Optional LaTeX" className="border-[#E7ECEB] font-mono text-xs" /><QuestionImageField compact label={`Option ${option.option_key} image`} value={option.image_url || ''} onChange={(image_url) => updateOption(index, { image_url })} help="Optional learner-facing image for this option." /></div><Button type="button" variant="ghost" size="icon" disabled={editor.options.length <= 2} onClick={() => removeOption(index)} className="h-8 w-8 shrink-0 text-[#B54747]"><Trash2 className="h-4 w-4" /></Button></div>{option.is_correct && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#0E5A5A]"><CheckCircle2 className="h-4 w-4" />Correct answer</div>}</div>)}</div>
                    </div>
                  ) : <div className="max-w-xl space-y-2"><GuidedLabel required help={editor.type === 'integer' ? 'Enter the exact whole-number answer.' : 'Enter the exact numerical answer.'}>Correct answer</GuidedLabel><Input value={editor.numericAnswer} onChange={(event) => setEditor((current) => ({ ...current, numericAnswer: event.target.value }))} placeholder="Enter the answer" className="border-[#E7ECEB]" /></div>}
                </CardContent>
              </Card>

              <Card className="gap-0 border-[#E7ECEB] bg-white shadow-none">
                <CardContent className="space-y-5 p-4 sm:p-5">
                  <SectionHeading number="4" title="Solution and assessment settings" description="Add the explanation, marking rules, examination eligibility and searchable metadata." />
                  <div className="grid gap-4 lg:grid-cols-2"><div className="space-y-2"><GuidedLabel help="Write the human-readable reasoning shown after the test when solutions are enabled.">Solution explanation</GuidedLabel><Textarea rows={6} value={editor.solution} onChange={(event) => setEditor((current) => ({ ...current, solution: event.target.value }))} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Add equations or scientific notation used in the solution.">Solution LaTeX</GuidedLabel><Textarea rows={6} value={editor.solutionLatex} onChange={(event) => setEditor((current) => ({ ...current, solutionLatex: event.target.value }))} className="border-[#E7ECEB] font-mono" /></div></div>
                  <div className="space-y-2"><GuidedLabel required help="Select every examination where this question is academically appropriate. Super Admin manages this list in Question Settings.">Applicable examinations</GuidedLabel><div className="flex flex-wrap gap-2">{exams.map((item) => <button type="button" key={item.id} onClick={() => toggleExam(item.value)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${editor.examTypes.includes(item.value) ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#6B7980] hover:border-[#0E5A5A]/40'}`}>{editor.examTypes.includes(item.value) && <CheckCircle2 className="mr-1 inline h-3 w-3" />}{item.label}</button>)}</div></div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><GuidedLabel help="Marks awarded for a correct answer.">Marks</GuidedLabel><Input type="number" step="0.25" value={editor.marks} onChange={(event) => setEditor((current) => ({ ...current, marks: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Marks deducted for an incorrect answer.">Negative marks</GuidedLabel><Input type="number" step="0.25" min="0" value={editor.negativeMarks} onChange={(event) => setEditor((current) => ({ ...current, negativeMarks: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Expected expert-solving time used for speed analytics.">Expected seconds</GuidedLabel><Input type="number" min="1" value={editor.estimatedSeconds} onChange={(event) => setEditor((current) => ({ ...current, estimatedSeconds: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div></div>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><GuidedLabel help="Learner-facing language.">Language</GuidedLabel><Select value={editor.language} onValueChange={(value) => setEditor((current) => ({ ...current, language: value }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Kannada">Kannada</SelectItem><SelectItem value="Hindi">Hindi</SelectItem><SelectItem value="Bilingual">Bilingual</SelectItem></SelectContent></Select></div><div className="space-y-2"><GuidedLabel help="Record NCERT, worksheet or previous-year paper source.">Source</GuidedLabel><Input value={editor.source} onChange={(event) => setEditor((current) => ({ ...current, source: event.target.value }))} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Optional source or examination year.">Source year</GuidedLabel><Input type="number" value={editor.sourceYear} onChange={(event) => setEditor((current) => ({ ...current, sourceYear: event.target.value }))} className="border-[#E7ECEB]" /></div><div className="space-y-2"><GuidedLabel help="Comma-separated keywords improve search.">Tags</GuidedLabel><Input value={editor.tags} onChange={(event) => setEditor((current) => ({ ...current, tags: event.target.value }))} placeholder="mechanics, vectors, PYQ" className="border-[#E7ECEB]" /></div></div>
                  {kind === 'admin' && role === 'super_admin' && <div className="space-y-3 rounded-2xl border border-[#DCE9E7] bg-[#F7F9F7] p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><div className="flex items-center gap-2"><h4 className="font-semibold text-[#14232B]">Previous-year paper occurrences</h4><HelpIcon text="Use this when the same question appeared in one or more official papers. These occurrences let Evidara rebuild an exact PYQ paper without storing duplicate questions." /></div><p className="mt-1 text-xs text-[#6B7980]">Examples: NEET 2026 · Main · Code 11, Re-NEET 2026 · Code 50, AIPMT 2016 · Phase I.</p></div>
                      <Button type="button" variant="outline" onClick={addPyqOccurrence} className="border-[#DCE9E7] bg-white"><Plus className="mr-2 h-4 w-4" />Add PYQ occurrence</Button>
                    </div>
                    {!editor.pyqOccurrences.length && <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-4 py-5 text-sm text-[#6B7980]">This question is not currently linked to an official PYQ paper.</div>}
                    {editor.pyqOccurrences.map((occurrence, index) => <div key={`${occurrence.paper_key || occurrence.display_name || 'pyq'}-${index}`} className="rounded-xl border border-[#E7ECEB] bg-white p-3">
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
                        <div className="space-y-1.5"><GuidedLabel help="Official examination name.">Exam</GuidedLabel><Input value={occurrence.exam_type} onChange={(event)=>updatePyqOccurrence(index,{exam_type:event.target.value})} placeholder="NEET" /></div>
                        <div className="space-y-1.5"><GuidedLabel help="The year printed on the official paper.">Year</GuidedLabel><Input type="number" min="1990" max="2100" value={occurrence.year || ''} onChange={(event)=>updatePyqOccurrence(index,{year:Number(event.target.value)})} /></div>
                        <div className="space-y-1.5"><GuidedLabel help="Main, Re-NEET, Phase I, Phase II, Session 1, etc.">Paper variant</GuidedLabel><Input value={occurrence.variant} onChange={(event)=>updatePyqOccurrence(index,{variant:event.target.value})} placeholder="Main / Re-NEET / Phase I" /></div>
                        <div className="space-y-1.5"><GuidedLabel help="Optional official set or paper code.">Paper code</GuidedLabel><Input value={occurrence.paper_code || ''} onChange={(event)=>updatePyqOccurrence(index,{paper_code:event.target.value})} placeholder="11 / C1 / AA" /></div>
                        <div className="space-y-1.5"><GuidedLabel help="Original position in this paper.">Question no.</GuidedLabel><Input type="number" min="1" value={occurrence.question_number || ''} onChange={(event)=>updatePyqOccurrence(index,{question_number:event.target.value ? Number(event.target.value) : undefined})} /></div>
                        <div className="flex items-end"><Button type="button" variant="outline" onClick={()=>removePyqOccurrence(index)} className="w-full border-[#E7ECEB] text-[#B54747]"><Trash2 className="mr-2 h-4 w-4" />Remove</Button></div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="space-y-1.5"><GuidedLabel help="Optional public label. If blank, Evidara creates one from exam/year/variant/code.">Display label</GuidedLabel><Input value={occurrence.display_name || ''} onChange={(event)=>updatePyqOccurrence(index,{display_name:event.target.value})} placeholder={`Example: ${occurrence.variant === 'Re-NEET' ? 'Re-NEET' : occurrence.exam_type || 'NEET'} ${occurrence.year || ''}`} /></div>
                        <div className="space-y-1.5"><GuidedLabel help="Optional subject label for preserving the original paper structure.">Original subject</GuidedLabel><Input value={occurrence.subject_label || ''} onChange={(event)=>updatePyqOccurrence(index,{subject_label:event.target.value})} placeholder={selectedSubject?.name || 'Physics'} /></div>
                        <div className="space-y-1.5"><GuidedLabel help="Total questions in that official paper. This lets Evidara know when the paper is complete enough to recreate.">Paper question count</GuidedLabel><Input type="number" min="1" value={occurrence.expected_question_count || ''} onChange={(event)=>updatePyqOccurrence(index,{expected_question_count:event.target.value?Number(event.target.value):undefined})} placeholder="180" /></div>
                      </div>
                    </div>)}
                  </div>}
                </CardContent>
              </Card>
            </div>

            <aside className="min-w-0 xl:sticky xl:top-0 xl:self-start">
              <QuestionDevicePreview value={{ stemText: editor.stem, stemLatex: editor.stemLatex, imageUrl: editor.imageUrl, passageText: editor.passage, questionType: editor.type, options: previewOptions, numericAnswer: editor.numericAnswer, subject: selectedSubject?.name, chapter: selectedChapter?.name, topic: selectedTopic?.name, difficulty: editor.difficulty, showCorrectAnswer: true }} />
            </aside>
          </div>
        </div>

        <DialogFooter className="border-t border-[#E7ECEB] bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="mr-auto hidden max-w-2xl text-xs text-[#6B7980] md:block">{validation.length ? `${validation.length} item${validation.length === 1 ? '' : 's'} require attention before saving.` : canPublish && editor.status === 'approved' ? 'This question will be published immediately.' : editor.status === 'in_review' ? 'This question will enter the administrator review queue.' : 'All required fields are ready.'}</div>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E7ECEB]">Cancel</Button>
          <Button onClick={() => void save()} disabled={saving || lockedDecision} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
            {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {editor.id ? 'Save Question' : editor.status === 'in_review' ? 'Send for Review' : editor.status === 'approved' ? 'Publish Question' : 'Save Draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
