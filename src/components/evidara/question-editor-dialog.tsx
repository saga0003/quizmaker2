'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  GripVertical,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type {
  MatchFollowingPair,
  QuestionDifficulty,
  QuestionOptionInput,
  QuestionPayload,
  QuestionRow,
  QuestionStatus,
  QuestionTestType,
  QuestionType,
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { GuidedLabel, HelpIcon } from '@/components/evidara/question-help';
import { QuestionImageField } from '@/components/evidara/question-image-field';
import { QuestionMathPreview } from '@/components/questions/QuestionMathPreview';

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
  match_following: 'Build two columns. Each left entry is mapped to one numbered right entry. Evidara stores the mapping as A-1, B-2 and so on.',
  passage: 'Add the common passage first, then the question and answer options that depend on it.',
  image_based: 'Add a public image URL or upload an image, then create the answer options. The image preview appears immediately.',
};

const difficultyLabels: Record<QuestionDifficulty, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  very_difficult: 'Very difficult',
};

const testTypeLabels: Record<QuestionTestType, string> = {
  full_length: 'Full Length Test',
  part_test: 'Part Test',
  chapter_test: 'Chapter Test',
  topic_test: 'Topic Test',
  custom: 'Custom',
};

const choiceTypes: QuestionType[] = [
  'single_correct',
  'multiple_correct',
  'assertion_reason',
  'passage',
  'image_based',
];

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
  type: QuestionType;
  status: QuestionStatus;
  difficulty: QuestionDifficulty;
  testType: QuestionTestType;
  customTestType: string;
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
  customExamType: string;
  classLevel: string;
  language: string;
  source: string;
  sourceYear: string;
  tags: string;
  numericAnswer: string;
  options: QuestionOptionInput[];
  matchPairs: MatchFollowingPair[];
};

function emptyEditor(kind: 'admin' | 'school'): EditorState {
  return {
    id: null,
    subjectId: '',
    chapterId: '',
    type: 'single_correct',
    status: kind === 'admin' ? 'approved' : 'draft',
    difficulty: 'moderate',
    testType: 'chapter_test',
    customTestType: '',
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
    customExamType: '',
    classLevel: 'Class 11-12',
    language: 'English',
    source: '',
    sourceYear: '',
    tags: '',
    numericAnswer: '',
    options: seedOptions(),
    matchPairs: seedMatchPairs(),
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

function editorFromQuestion(kind: 'admin' | 'school', question?: QuestionRow | null): EditorState {
  if (!question) return emptyEditor(kind);
  const answer = Array.isArray(question.correct_answer)
    ? question.correct_answer.join(',')
    : String(question.correct_answer ?? '');
  const options = (question.question_options || []).slice().sort((a, b) => a.display_order - b.display_order);
  const metadata = question.metadata || {};
  return {
    id: question.id,
    subjectId: question.subject_id || '',
    chapterId: question.chapter_id || '',
    type: question.question_type,
    status: question.status,
    difficulty: question.difficulty,
    testType: metadata.test_type || 'custom',
    customTestType: metadata.custom_test_type || '',
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
    customExamType: '',
    classLevel: question.class_level || '',
    language: question.language || 'English',
    source: question.source || '',
    sourceYear: question.source_year ? String(question.source_year) : '',
    tags: (question.tags || []).join(', '),
    numericAnswer: answer,
    options: options.length ? options : seedOptions(),
    matchPairs: metadataMatchPairs(question),
  };
}

function testTypeBadge(value: QuestionTestType, custom: string) {
  return value === 'custom' ? custom || 'Custom' : testTypeLabels[value];
}

export function QuestionEditorDialog({
  open,
  onOpenChange,
  kind,
  organizationId,
  subjects,
  chapters,
  question,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: 'admin' | 'school';
  organizationId: string | null;
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  question?: QuestionRow | null;
  onSaved: () => Promise<void> | void;
}) {
  const [editor, setEditor] = useState<EditorState>(() => editorFromQuestion(kind, question));
  const [tab, setTab] = useState('content');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setEditor(editorFromQuestion(kind, question));
    setError('');
    setTab('content');
  }, [kind, open, question]);

  const visibleChapters = chapters.filter((chapter) => !editor.subjectId || chapter.subject_id === editor.subjectId);
  const isChoice = choiceTypes.includes(editor.type);
  const isMatch = editor.type === 'match_following';
  const isNumeric = editor.type === 'numerical' || editor.type === 'integer';

  const usableOptions = editor.options.filter((option) => option.content_text.trim() || option.content_latex?.trim() || option.image_url?.trim());
  const correctOptions = usableOptions.filter((option) => option.is_correct);
  const usablePairs = editor.matchPairs.filter((pair) =>
    pair.left_text.trim() || pair.left_latex?.trim() || pair.left_image_url?.trim() ||
    pair.right_text.trim() || pair.right_latex?.trim() || pair.right_image_url?.trim(),
  );

  const validation = useMemo(() => {
    const problems: string[] = [];
    if (editor.stem.trim().length < 5) problems.push('Enter a complete question.');
    if (!editor.subjectId) problems.push('Select a subject.');
    if (editor.testType === 'custom' && !editor.customTestType.trim()) problems.push('Enter the custom test type.');
    if (!editor.examTypes.length && !editor.customExamType.trim()) problems.push('Select or enter at least one examination.');
    if (kind === 'school' && !organizationId) problems.push('This account is not linked to a school organization.');
    if (isChoice && usableOptions.length < 2) problems.push('Enter at least two answer options.');
    if (isChoice && correctOptions.length < 1) problems.push('Mark the correct answer.');
    if (isChoice && editor.type !== 'multiple_correct' && correctOptions.length !== 1) problems.push('This question type requires exactly one correct option.');
    if (isNumeric && !editor.numericAnswer.trim()) problems.push('Enter the numerical or integer answer.');
    if (isMatch && usablePairs.length < 2) problems.push('Add at least two complete match pairs.');
    if (isMatch && usablePairs.some((pair) => (!pair.left_text.trim() && !pair.left_latex?.trim() && !pair.left_image_url?.trim()) || (!pair.right_text.trim() && !pair.right_latex?.trim() && !pair.right_image_url?.trim()))) {
      problems.push('Every match row needs content on both sides.');
    }
    return problems;
  }, [correctOptions.length, editor, isChoice, isMatch, isNumeric, kind, organizationId, usableOptions.length, usablePairs]);

  function updateOption(index: number, patch: Partial<QuestionOptionInput>) {
    setEditor((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option),
    }));
  }

  function markCorrect(index: number) {
    setEditor((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => ({
        ...option,
        is_correct: current.type === 'multiple_correct'
          ? optionIndex === index ? !option.is_correct : option.is_correct
          : optionIndex === index,
      })),
    }));
  }

  function addOption() {
    setEditor((current) => {
      if (current.options.length >= 6) return current;
      const key = String.fromCharCode(65 + current.options.length);
      return {
        ...current,
        options: [...current.options, { option_key: key, content_text: '', content_latex: '', image_url: '', is_correct: false, display_order: current.options.length }],
      };
    });
  }

  function removeOption(index: number) {
    setEditor((current) => ({
      ...current,
      options: current.options
        .filter((_option, optionIndex) => optionIndex !== index)
        .map((option, optionIndex) => ({ ...option, option_key: String.fromCharCode(65 + optionIndex), display_order: optionIndex })),
    }));
  }

  function updatePair(index: number, patch: Partial<MatchFollowingPair>) {
    setEditor((current) => ({
      ...current,
      matchPairs: current.matchPairs.map((pair, pairIndex) => pairIndex === index ? { ...pair, ...patch } : pair),
    }));
  }

  function addPair() {
    setEditor((current) => {
      if (current.matchPairs.length >= 6) return current;
      const index = current.matchPairs.length;
      return {
        ...current,
        matchPairs: [...current.matchPairs, {
          id: crypto.randomUUID(),
          left_key: String.fromCharCode(65 + index),
          left_text: '',
          left_latex: '',
          left_image_url: '',
          right_key: String(index + 1),
          right_text: '',
          right_latex: '',
          right_image_url: '',
        }],
      };
    });
  }

  function removePair(index: number) {
    setEditor((current) => ({
      ...current,
      matchPairs: current.matchPairs
        .filter((_pair, pairIndex) => pairIndex !== index)
        .map((pair, pairIndex) => ({ ...pair, left_key: String.fromCharCode(65 + pairIndex), right_key: String(pairIndex + 1) })),
    }));
  }

  function toggleExam(exam: string) {
    setEditor((current) => ({
      ...current,
      examTypes: current.examTypes.includes(exam)
        ? current.examTypes.filter((value) => value !== exam)
        : [...current.examTypes, exam],
    }));
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
    if (editor.customExamType.trim()) examTypes.push(editor.customExamType.trim());
    const matchOptions: QuestionOptionInput[] = usablePairs.map((pair, display_order) => ({
      option_key: pair.right_key,
      content_text: pair.right_text,
      content_latex: pair.right_latex,
      image_url: pair.right_image_url,
      is_correct: false,
      display_order,
    }));
    const correctAnswer = isMatch
      ? usablePairs.map((pair) => `${pair.left_key}-${pair.right_key}`)
      : isChoice
        ? correctOptions.map((option) => option.option_key)
        : editor.numericAnswer.trim();

    const payload: QuestionPayload = {
      subject_id: editor.subjectId,
      chapter_id: editor.chapterId || undefined,
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
        editor: 'evidara_v7_advanced_question_editor',
        test_type: editor.testType,
        custom_test_type: editor.testType === 'custom' ? editor.customTestType.trim() : undefined,
        match_pairs: isMatch ? usablePairs : undefined,
      },
      options: isMatch ? matchOptions : isChoice ? usableOptions : [],
      change_note: editor.id ? 'Updated from Evidara V7 advanced question editor' : 'Created from Evidara V7 advanced question editor',
    };

    setSaving(true);
    const { error: saveError } = await supabase.rpc('save_question', {
      p_question_id: editor.id,
      p_organization_id: kind === 'admin' ? null : organizationId,
      p_payload: payload,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[96vh] w-[96vw] max-w-[1440px] overflow-hidden border-[#E7ECEB] p-0">
        <DialogHeader className="border-b border-[#E7ECEB] px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div>
              <DialogTitle className="text-xl text-[#14232B]">{editor.id ? 'Edit Question' : 'Add Question'}</DialogTitle>
              <DialogDescription className="mt-1">
                Create a reusable live question. School questions remain in the selected school bank and never enter the Evidara master bank.
              </DialogDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{questionTypeLabels[editor.type]}</Badge>
              <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{testTypeBadge(editor.testType, editor.customTestType)}</Badge>
              <Badge variant="outline" className="border-[#E7ECEB] text-[#6B7980]">{kind === 'admin' ? 'Evidara Master Bank' : 'School Question Bank'}</Badge>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-[#E7ECEB] px-6 pt-3">
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger value="content" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-[#0E5A5A] data-[state=active]:bg-transparent data-[state=active]:text-[#0E5A5A]">Question Content</TabsTrigger>
              <TabsTrigger value="answer" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-[#0E5A5A] data-[state=active]:bg-transparent data-[state=active]:text-[#0E5A5A]">Answer & Solution</TabsTrigger>
              <TabsTrigger value="classification" className="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-[#0E5A5A] data-[state=active]:bg-transparent data-[state=active]:text-[#0E5A5A]">Classification & Use</TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {error && <div className="mb-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{error}</div>}

            <TabsContent value="content" className="m-0">
              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)]">
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <GuidedLabel required help="The question type controls how answers are entered and evaluated. Open the information icon after selecting a type for the exact rule.">Question type</GuidedLabel>
                      <Select value={editor.type} onValueChange={(value) => setEditor((current) => ({ ...current, type: value as QuestionType, options: seedOptions(), matchPairs: seedMatchPairs(), numericAnswer: '' }))}>
                        <SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(questionTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="flex items-start gap-1.5 rounded-lg bg-[#F7F9F7] p-2 text-xs leading-relaxed text-[#6B7980]"><HelpIcon text={questionTypeHelp[editor.type]} /><span>{questionTypeHelp[editor.type]}</span></div>
                    </div>
                    <div className="space-y-2">
                      <GuidedLabel required help="Choose the academic subject. Chapter choices are filtered automatically from this subject.">Subject</GuidedLabel>
                      <Select value={editor.subjectId || undefined} onValueChange={(value) => setEditor((current) => ({ ...current, subjectId: value, chapterId: '' }))}>
                        <SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Select subject" /></SelectTrigger>
                        <SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <GuidedLabel help="Chapter classification enables chapter tests, filters and analytics. Leave blank only when the question is genuinely cross-chapter.">Chapter</GuidedLabel>
                      <Select value={editor.chapterId || undefined} onValueChange={(value) => setEditor((current) => ({ ...current, chapterId: value }))}>
                        <SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Select chapter" /></SelectTrigger>
                        <SelectContent>{visibleChapters.map((chapter) => <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {editor.type === 'passage' && (
                    <div className="space-y-2">
                      <GuidedLabel required help="Enter the shared reading passage, case, graph description or experiment. The question below should refer to this content.">Passage</GuidedLabel>
                      <Textarea rows={6} value={editor.passage} onChange={(event) => setEditor((current) => ({ ...current, passage: event.target.value }))} className="border-[#E7ECEB]" />
                    </div>
                  )}

                  <div className="space-y-2">
                    <GuidedLabel required help="Enter the complete learner-facing question. Do not put answer keys or internal notes in this field.">Question text</GuidedLabel>
                    <Textarea rows={7} value={editor.stem} onChange={(event) => setEditor((current) => ({ ...current, stem: event.target.value }))} placeholder="Enter the complete question" className="border-[#E7ECEB] text-base leading-relaxed" />
                  </div>
                  <div className="space-y-2">
                    <GuidedLabel help="Use LaTeX only for mathematical or scientific notation. The plain-text question remains available for accessibility and search.">Question LaTeX</GuidedLabel>
                    <Textarea rows={4} value={editor.stemLatex} onChange={(event) => setEditor((current) => ({ ...current, stemLatex: event.target.value }))} placeholder="Example: R=\\frac{u^2\\sin 2\\theta}{g}" className="border-[#E7ECEB] font-mono" />
                  </div>
                  <QuestionImageField
                    label="Question image"
                    value={editor.imageUrl}
                    onChange={(imageUrl) => setEditor((current) => ({ ...current, imageUrl }))}
                    help="Paste a public Cloudflare Images, R2, Supabase Storage or other HTTPS URL, or upload a local image. Evidara previews the exact learner-facing image immediately."
                  />
                </div>

                <div className="xl:sticky xl:top-0 xl:self-start">
                  <div className="rounded-2xl border border-[#E7ECEB] bg-[#F7F9F7] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <strong className="text-sm text-[#14232B]">Live learner preview</strong>
                      <Badge variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">Preview only</Badge>
                    </div>
                    <QuestionMathPreview text={editor.stem || 'Your question preview will appear here.'} latex={editor.stemLatex} imageUrl={editor.imageUrl} />
                    {editor.type === 'passage' && editor.passage && <div className="mt-3 rounded-xl border border-[#E7ECEB] bg-white p-3 text-sm leading-relaxed text-[#14232B] whitespace-pre-wrap">{editor.passage}</div>}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="answer" className="m-0 space-y-6">
              {isMatch ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-semibold text-[#14232B]">Match columns</h3><HelpIcon text="Each row defines the correct mapping. The right column may be shuffled during an exam, but Evidara retains the A-1, B-2 mapping for evaluation." /></div>
                      <p className="mt-1 text-sm text-[#6B7980]">Add text, LaTeX or an image to both sides. Empty rows are ignored.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addPair} disabled={editor.matchPairs.length >= 6} className="border-[#E7ECEB]"><Plus className="mr-2 h-4 w-4" />Add pair</Button>
                  </div>
                  <div className="space-y-3">
                    {editor.matchPairs.map((pair, index) => (
                      <div key={pair.id} className="rounded-2xl border border-[#E7ECEB] bg-white p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#6B7980]"><GripVertical className="h-4 w-4" />Correct mapping {pair.left_key} → {pair.right_key}</div>
                          <Button type="button" variant="ghost" size="icon" disabled={editor.matchPairs.length <= 2} onClick={() => removePair(index)} className="h-8 w-8 text-[#B54747]"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        <div className="grid gap-4 lg:grid-cols-2">
                          <div className="rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] p-3">
                            <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">{pair.left_key}</span><strong className="text-sm text-[#14232B]">Left item</strong></div>
                            <div className="space-y-2">
                              <Input value={pair.left_text} onChange={(event) => updatePair(index, { left_text: event.target.value })} placeholder="Left-side text" className="border-[#E7ECEB] bg-white" />
                              <Input value={pair.left_latex || ''} onChange={(event) => updatePair(index, { left_latex: event.target.value })} placeholder="Optional LaTeX" className="border-[#E7ECEB] bg-white font-mono text-xs" />
                              <QuestionImageField compact label="Left image" value={pair.left_image_url || ''} onChange={(left_image_url) => updatePair(index, { left_image_url })} help="Optional image for this left-side match item." />
                            </div>
                          </div>
                          <div className="rounded-xl border border-[#F2B84B]/40 bg-[#FFFDF7] p-3">
                            <div className="mb-2 flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F2B84B] text-xs font-bold text-[#14232B]">{pair.right_key}</span><strong className="text-sm text-[#14232B]">Correct right item</strong></div>
                            <div className="space-y-2">
                              <Input value={pair.right_text} onChange={(event) => updatePair(index, { right_text: event.target.value })} placeholder="Right-side text" className="border-[#E7ECEB] bg-white" />
                              <Input value={pair.right_latex || ''} onChange={(event) => updatePair(index, { right_latex: event.target.value })} placeholder="Optional LaTeX" className="border-[#E7ECEB] bg-white font-mono text-xs" />
                              <QuestionImageField compact label="Right image" value={pair.right_image_url || ''} onChange={(right_image_url) => updatePair(index, { right_image_url })} help="Optional image for the right-side item mapped to this left item." />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : isChoice ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2"><h3 className="font-semibold text-[#14232B]">Answer options</h3><HelpIcon text={editor.type === 'multiple_correct' ? 'Click every correct option letter. All selected answers are stored as the correct set.' : 'Click one option letter to mark it as the correct answer.'} /></div>
                      <p className="mt-1 text-sm text-[#6B7980]">Options may contain text, LaTeX and a linked or uploaded image.</p>
                    </div>
                    <Button type="button" variant="outline" onClick={addOption} disabled={editor.options.length >= 6} className="border-[#E7ECEB]"><Plus className="mr-2 h-4 w-4" />Add option</Button>
                  </div>
                  <div className="grid gap-4 xl:grid-cols-2">
                    {editor.options.map((option, index) => (
                      <div key={option.option_key} className={`rounded-2xl border p-4 ${option.is_correct ? 'border-[#0E5A5A] bg-[#DCE9E7]/35' : 'border-[#E7ECEB] bg-white'}`}>
                        <div className="flex items-start gap-3">
                          <button type="button" onClick={() => markCorrect(index)} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-bold ${option.is_correct ? 'border-[#0E5A5A] bg-[#0E5A5A] text-white' : 'border-[#D0D5DD] bg-white text-[#14232B]'}`}>{option.option_key}</button>
                          <div className="min-w-0 flex-1 space-y-3">
                            <Input value={option.content_text} onChange={(event) => updateOption(index, { content_text: event.target.value })} placeholder={`Option ${option.option_key} text`} className="border-[#E7ECEB]" />
                            <Input value={option.content_latex || ''} onChange={(event) => updateOption(index, { content_latex: event.target.value })} placeholder="Optional LaTeX" className="border-[#E7ECEB] font-mono text-xs" />
                            <QuestionImageField compact label={`Option ${option.option_key} image`} value={option.image_url || ''} onChange={(image_url) => updateOption(index, { image_url })} help="Optional learner-facing image for this answer option." />
                          </div>
                          <Button type="button" variant="ghost" size="icon" disabled={editor.options.length <= 2} onClick={() => removeOption(index)} className="h-8 w-8 shrink-0 text-[#B54747]"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        {option.is_correct && <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[#0E5A5A]"><CheckCircle2 className="h-4 w-4" />Correct answer</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="max-w-xl space-y-2">
                  <GuidedLabel required help={editor.type === 'integer' ? 'Enter the exact whole-number answer used for automatic evaluation.' : 'Enter the numerical answer. Use the same decimal precision the learner is expected to provide.'}>Correct answer</GuidedLabel>
                  <Input value={editor.numericAnswer} onChange={(event) => setEditor((current) => ({ ...current, numericAnswer: event.target.value }))} placeholder="Enter the answer" className="border-[#E7ECEB]" />
                </div>
              )}

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2"><GuidedLabel help="Write the human-readable reasoning shown after the test when solutions are enabled.">Solution explanation</GuidedLabel><Textarea rows={6} value={editor.solution} onChange={(event) => setEditor((current) => ({ ...current, solution: event.target.value }))} className="border-[#E7ECEB]" /></div>
                <div className="space-y-2"><GuidedLabel help="Add equations or scientific notation used in the solution. Keep the explanation field for searchable plain text.">Solution LaTeX</GuidedLabel><Textarea rows={6} value={editor.solutionLatex} onChange={(event) => setEditor((current) => ({ ...current, solutionLatex: event.target.value }))} className="border-[#E7ECEB] font-mono" /></div>
              </div>
            </TabsContent>

            <TabsContent value="classification" className="m-0 space-y-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2"><GuidedLabel required help="This describes where the question is intended to be used: full syllabus, part syllabus, chapter, topic or a named custom test.">Test type</GuidedLabel><Select value={editor.testType} onValueChange={(value) => setEditor((current) => ({ ...current, testType: value as QuestionTestType }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(testTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                {editor.testType === 'custom' && <div className="space-y-2"><GuidedLabel required help="Enter the exact custom category, for example Weekly Revision, Scholarship Screening or Diagnostic Test.">Custom test type</GuidedLabel><Input value={editor.customTestType} onChange={(event) => setEditor((current) => ({ ...current, customTestType: event.target.value }))} placeholder="Enter custom test type" className="border-[#E7ECEB]" /></div>}
                <div className="space-y-2"><GuidedLabel help="Difficulty supports paper balancing and analytics. It should describe the question, not the learner.">Difficulty</GuidedLabel><Select value={editor.difficulty} onValueChange={(value) => setEditor((current) => ({ ...current, difficulty: value as QuestionDifficulty }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(difficultyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><GuidedLabel help="Draft stays editable. In Review enters the school review queue. Approved can be selected directly only for the Evidara master bank.">Status</GuidedLabel><Select value={editor.status} onValueChange={(value) => setEditor((current) => ({ ...current, status: value as QuestionStatus }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{(kind === 'admin' ? ['draft', 'in_review', 'approved', 'rejected'] : ['draft', 'in_review']).map((value) => <SelectItem key={value} value={value}>{value.replaceAll('_', ' ')}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><GuidedLabel help="The learner-facing language. Choose Bilingual when both languages are present in the same question.">Language</GuidedLabel><Select value={editor.language} onValueChange={(value) => setEditor((current) => ({ ...current, language: value }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Kannada">Kannada</SelectItem><SelectItem value="Hindi">Hindi</SelectItem><SelectItem value="Bilingual">Bilingual</SelectItem></SelectContent></Select></div>
              </div>

              <div className="space-y-2">
                <GuidedLabel required help="Select every examination where this question is academically appropriate. Use Custom for a school or programme-specific examination.">Applicable examinations</GuidedLabel>
                <div className="flex flex-wrap gap-2">{['NEET', 'JEE Main', 'JEE Advanced', 'KCET', 'Olympiad', 'Foundation', 'Board'].map((exam) => <button type="button" key={exam} onClick={() => toggleExam(exam)} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${editor.examTypes.includes(exam) ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#6B7980] hover:border-[#0E5A5A]/40'}`}>{editor.examTypes.includes(exam) && <CheckCircle2 className="mr-1 inline h-3 w-3" />}{exam}</button>)}</div>
                <Input value={editor.customExamType} onChange={(event) => setEditor((current) => ({ ...current, customExamType: event.target.value }))} placeholder="Optional custom examination name" className="mt-2 max-w-md border-[#E7ECEB]" />
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2"><GuidedLabel help="Marks awarded for a correct answer.">Marks</GuidedLabel><Input type="number" step="0.25" value={editor.marks} onChange={(event) => setEditor((current) => ({ ...current, marks: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
                <div className="space-y-2"><GuidedLabel help="Marks deducted for an incorrect answer. Enter zero when there is no negative marking.">Negative marks</GuidedLabel><Input type="number" step="0.25" min="0" value={editor.negativeMarks} onChange={(event) => setEditor((current) => ({ ...current, negativeMarks: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
                <div className="space-y-2"><GuidedLabel help="A reasonable expert-solving time used for speed analytics. It is not a label of student ability.">Expected time in seconds</GuidedLabel><Input type="number" min="1" value={editor.estimatedSeconds} onChange={(event) => setEditor((current) => ({ ...current, estimatedSeconds: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
                <div className="space-y-2"><GuidedLabel help="Grade or class used for filters and eligibility, for example Grade 10 or Class 11-12.">Class level</GuidedLabel><Input value={editor.classLevel} onChange={(event) => setEditor((current) => ({ ...current, classLevel: event.target.value }))} className="border-[#E7ECEB]" /></div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2"><GuidedLabel help="Record the source, such as NCERT, a school worksheet or a previous-year paper.">Source</GuidedLabel><Input value={editor.source} onChange={(event) => setEditor((current) => ({ ...current, source: event.target.value }))} className="border-[#E7ECEB]" /></div>
                <div className="space-y-2"><GuidedLabel help="Optional publication or examination year used for filtering.">Source year</GuidedLabel><Input type="number" value={editor.sourceYear} onChange={(event) => setEditor((current) => ({ ...current, sourceYear: event.target.value }))} className="border-[#E7ECEB]" /></div>
                <div className="space-y-2"><GuidedLabel help="Comma-separated keywords improve search and automatic paper selection.">Tags</GuidedLabel><Input value={editor.tags} onChange={(event) => setEditor((current) => ({ ...current, tags: event.target.value }))} placeholder="mechanics, vectors, PYQ" className="border-[#E7ECEB]" /></div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="sticky bottom-0 border-t border-[#E7ECEB] bg-white px-6 py-4">
          <div className="mr-auto hidden max-w-2xl text-xs text-[#6B7980] md:block">{validation.length ? `${validation.length} item${validation.length === 1 ? '' : 's'} require attention before saving.` : 'All required fields are ready.'}</div>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-[#E7ECEB]">Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
            {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {editor.id ? 'Save New Version' : 'Save Question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
