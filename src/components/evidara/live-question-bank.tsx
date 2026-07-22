'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  FileQuestion,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useQuestionScope } from '@/components/questions/useQuestionScope';
import type {
  QuestionDifficulty,
  QuestionOptionInput,
  QuestionPayload,
  QuestionRow,
  QuestionStatus,
  QuestionType,
  TaxonomyChapter,
  TaxonomySubject,
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const PAGE_SIZE = 20;
const choiceTypes: QuestionType[] = [
  'single_correct',
  'multiple_correct',
  'assertion_reason',
  'match_following',
  'passage',
  'image_based',
];

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

const difficultyLabels: Record<QuestionDifficulty, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  very_difficult: 'Very difficult',
};

type EditorState = {
  id: string | null;
  subjectId: string;
  chapterId: string;
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
  language: string;
  source: string;
  sourceYear: string;
  tags: string;
  numericAnswer: string;
  options: QuestionOptionInput[];
};

function newOptions(): QuestionOptionInput[] {
  return ['A', 'B', 'C', 'D'].map((option_key, display_order) => ({
    option_key,
    content_text: '',
    content_latex: '',
    image_url: '',
    is_correct: false,
    display_order,
  }));
}

function emptyEditor(kind: 'admin' | 'school'): EditorState {
  return {
    id: null,
    subjectId: '',
    chapterId: '',
    type: 'single_correct',
    status: kind === 'admin' ? 'approved' : 'draft',
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
    classLevel: 'Class 11-12',
    language: 'English',
    source: '',
    sourceYear: '',
    tags: '',
    numericAnswer: '',
    options: newOptions(),
  };
}

function statusLabel(status: QuestionStatus) {
  return status.replaceAll('_', ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function statusClass(status: QuestionStatus) {
  if (status === 'approved') return 'bg-[#DCE9E7] text-[#0E5A5A]';
  if (status === 'in_review') return 'bg-[#F2B84B]/20 text-[#8A5F00]';
  if (status === 'rejected') return 'bg-[#B54747]/10 text-[#B54747]';
  return 'bg-[#E7ECEB] text-[#6B7980]';
}

function difficultyClass(difficulty: QuestionDifficulty) {
  if (difficulty === 'very_easy' || difficulty === 'easy') return 'bg-[#DCE9E7] text-[#0E5A5A]';
  if (difficulty === 'moderate') return 'bg-[#F2B84B]/20 text-[#8A5F00]';
  return 'bg-[#B54747]/10 text-[#B54747]';
}

export function LiveQuestionBank({ kind }: { kind: 'admin' | 'school' }) {
  const { configured } = useAuth();
  const {
    organizationId,
    organizationName,
    loading: scopeLoading,
    error: scopeError,
  } = useQuestionScope(kind);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [chapters, setChapters] = useState<TaxonomyChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(() => emptyEditor(kind));
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [ownershipFilter, setOwnershipFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!supabase || !configured) {
      setQuestions([]);
      setLoading(false);
      setError('Supabase is not configured. V7 question management is live-data only.');
      return;
    }
    if (kind === 'school' && scopeLoading) return;
    if (kind === 'school' && !organizationId) {
      setQuestions([]);
      setLoading(false);
      setError(scopeError || 'This account is not linked to a school organization.');
      return;
    }

    setLoading(true);
    setError('');
    const questionQuery = supabase
      .from('questions')
      .select('*,subjects(name,code),chapters(name),question_options(option_key,content_text,content_latex,image_url,is_correct,display_order)')
      .order('updated_at', { ascending: false })
      .limit(1000);

    const [{ data: questionData, error: questionError }, { data: subjectData, error: subjectError }, { data: chapterData, error: chapterError }] = await Promise.all([
      questionQuery,
      supabase.from('subjects').select('id,name,code,organization_id').eq('is_active', true).order('name'),
      supabase.from('chapters').select('id,name,subject_id,organization_id').eq('is_active', true).order('display_order'),
    ]);

    if (questionError || subjectError || chapterError) {
      setError(questionError?.message || subjectError?.message || chapterError?.message || 'Unable to load question data.');
    } else {
      const visible = ((questionData || []) as unknown as QuestionRow[]).filter((question) =>
        kind === 'admin'
          ? true
          : question.organization_id === null || question.organization_id === organizationId,
      );
      setQuestions(visible);
      setSubjects((subjectData || []) as TaxonomySubject[]);
      setChapters((chapterData || []) as TaxonomyChapter[]);
    }
    setLoading(false);
  }, [configured, kind, organizationId, scopeError, scopeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, subjectFilter, statusFilter, difficultyFilter, ownershipFilter, sort]);

  const filtered = useMemo(() => {
    const rows = questions.filter((question) => {
      const haystack = `${question.stem_text} ${question.subjects?.name || ''} ${question.chapters?.name || ''} ${(question.tags || []).join(' ')} ${(question.exam_types || []).join(' ')}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      if (subjectFilter !== 'all' && question.subject_id !== subjectFilter) return false;
      if (statusFilter !== 'all' && question.status !== statusFilter) return false;
      if (difficultyFilter !== 'all' && question.difficulty !== difficultyFilter) return false;
      if (ownershipFilter === 'master' && question.organization_id !== null) return false;
      if (ownershipFilter === 'school' && question.organization_id === null) return false;
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sort === 'subject') return (a.subjects?.name || '').localeCompare(b.subjects?.name || '');
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [difficultyFilter, ownershipFilter, questions, search, sort, statusFilter, subjectFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = {
    total: questions.length,
    approved: questions.filter((question) => question.status === 'approved').length,
    review: questions.filter((question) => question.status === 'in_review').length,
    private: questions.filter((question) => question.organization_id !== null).length,
  };

  const visibleChapters = chapters.filter((chapter) => !editor.subjectId || chapter.subject_id === editor.subjectId);
  const isChoice = choiceTypes.includes(editor.type);

  function openCreate() {
    setEditor(emptyEditor(kind));
    setError('');
    setMessage('');
    setEditorOpen(true);
  }

  function openEdit(question: QuestionRow) {
    const loadedOptions = (question.question_options || [])
      .slice()
      .sort((a, b) => a.display_order - b.display_order);
    const answer = Array.isArray(question.correct_answer)
      ? question.correct_answer.join(',')
      : String(question.correct_answer ?? '');
    setEditor({
      id: question.id,
      subjectId: question.subject_id || '',
      chapterId: question.chapter_id || '',
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
      classLevel: question.class_level || '',
      language: question.language || 'English',
      source: question.source || '',
      sourceYear: question.source_year ? String(question.source_year) : '',
      tags: (question.tags || []).join(', '),
      numericAnswer: answer,
      options: loadedOptions.length ? loadedOptions : newOptions(),
    });
    setError('');
    setMessage('');
    setEditorOpen(true);
  }

  function updateOption(index: number, patch: Partial<QuestionOptionInput>) {
    setEditor((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option),
    }));
  }

  function toggleCorrect(index: number) {
    setEditor((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => ({
        ...option,
        is_correct:
          current.type === 'multiple_correct'
            ? optionIndex === index ? !option.is_correct : option.is_correct
            : optionIndex === index,
      })),
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

  async function saveQuestion() {
    setError('');
    setMessage('');
    if (!supabase) return;
    if (editor.stem.trim().length < 5) {
      setError('Enter a complete question.');
      return;
    }
    if (!editor.subjectId) {
      setError('Select a subject.');
      return;
    }
    if (kind === 'school' && !organizationId) {
      setError('This account is not linked to a school organization.');
      return;
    }
    const usableOptions = editor.options.filter((option) => option.content_text.trim() || option.content_latex?.trim() || option.image_url?.trim());
    if (isChoice && usableOptions.length < 2) {
      setError('Enter at least two answer options.');
      return;
    }
    const correct = usableOptions.filter((option) => option.is_correct);
    if (isChoice && correct.length < 1) {
      setError('Select at least one correct answer.');
      return;
    }
    if (isChoice && editor.type !== 'multiple_correct' && correct.length !== 1) {
      setError('This question type requires exactly one correct answer.');
      return;
    }
    if (!isChoice && !editor.numericAnswer.trim()) {
      setError('Enter the numerical or integer answer.');
      return;
    }

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
      correct_answer: isChoice
        ? correct.map((option) => option.option_key)
        : editor.numericAnswer.trim(),
      exam_types: editor.examTypes,
      class_level: editor.classLevel.trim() || undefined,
      source: editor.source.trim() || undefined,
      source_year: editor.sourceYear ? Number(editor.sourceYear) : undefined,
      language: editor.language,
      tags: editor.tags.split(',').map((value) => value.trim()).filter(Boolean),
      metadata: { editor: 'v7_live_question_table' },
      options: isChoice ? usableOptions : [],
      change_note: editor.id ? 'Updated from Evidara V7 question table' : 'Created from Evidara V7 question table',
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
    setMessage(editor.id ? 'Question updated successfully.' : 'Question created successfully.');
    setEditorOpen(false);
    await load();
  }

  async function archiveQuestion(question: QuestionRow) {
    if (!supabase) return;
    if (!window.confirm(`Archive this question?\n\n${question.stem_text.slice(0, 120)}`)) return;
    setError('');
    const { error: archiveError } = await supabase
      .from('questions')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', question.id);
    if (archiveError) setError(archiveError.message);
    else await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">
            <ShieldCheck className="h-4 w-4" />
            {kind === 'admin' ? 'Evidara master and school banks' : organizationName}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-[#14232B]">Question Bank</h1>
          <p className="mt-1 text-sm text-[#6B7980]">Create, classify, review and reuse live Supabase questions without leaving the V7 workspace.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-[#E7ECEB]">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreate} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
            <Plus className="mr-2 h-4 w-4" />
            Add Question
          </Button>
        </div>
      </div>

      {(scopeError || error) && (
        <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">
          {scopeError || error}
        </div>
      )}
      {message && (
        <div className="rounded-xl border border-[#0E5A5A]/20 bg-[#DCE9E7]/60 px-4 py-3 text-sm text-[#0E5A5A]">
          {message}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Visible questions', value: stats.total, icon: FileQuestion, tone: '#14232B' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: '#0E5A5A' },
          { label: 'Awaiting review', value: stats.review, icon: CircleAlert, tone: '#8A5F00' },
          { label: 'School-owned', value: stats.private, icon: ShieldCheck, tone: '#2E6D8B' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="gap-0 border-[#E7ECEB] shadow-none">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-[#6B7980]">{label}</p>
                <p className="mt-1 text-2xl font-bold" style={{ color: tone }}>{value}</p>
              </div>
              <div className="rounded-lg p-2.5" style={{ backgroundColor: `${tone}12`, color: tone }}>
                <Icon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-0 border-[#E7ECEB] shadow-none">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative md:col-span-2 xl:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question, chapter, exam or tag" className="border-[#E7ECEB] pl-9" />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Subject" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All statuses</SelectItem>{(['draft', 'in_review', 'approved', 'rejected', 'archived'] as QuestionStatus[]).map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
              <SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Difficulty" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All levels</SelectItem>{Object.entries(difficultyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={ownershipFilter} onValueChange={setOwnershipFilter}>
              <SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Ownership" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All ownership</SelectItem><SelectItem value="master">Evidara master</SelectItem><SelectItem value="school">School-owned</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-[#E7ECEB] pt-3">
            <p className="text-xs text-[#6B7980]">Showing {filtered.length} matching questions</p>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[160px] border-[#E7ECEB]"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="oldest">Oldest updated</SelectItem><SelectItem value="subject">Subject A-Z</SelectItem></SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden border-[#E7ECEB] shadow-none">
        <div className="overflow-x-auto">
          <Table className="min-w-[1120px]">
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                <TableHead className="text-xs font-semibold text-[#6B7980]">Question</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Subject / Chapter</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Type</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Difficulty</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Ownership</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Marks</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Version</TableHead>
                <TableHead className="text-right text-xs font-semibold text-[#6B7980]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading live question bank…</TableCell></TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]">No questions match the current filters.</TableCell></TableRow>
              ) : visibleRows.map((question) => (
                <TableRow key={question.id} className="border-[#E7ECEB]">
                  <TableCell className="max-w-[360px]">
                    <p className="line-clamp-2 text-sm font-medium text-[#14232B]">{question.stem_text}</p>
                    <div className="mt-1 flex flex-wrap gap-1">{(question.exam_types || []).slice(0, 3).map((exam) => <Badge key={exam} variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">{exam}</Badge>)}</div>
                  </TableCell>
                  <TableCell><p className="text-sm text-[#14232B]">{question.subjects?.name || 'Unclassified'}</p><p className="text-xs text-[#6B7980]">{question.chapters?.name || 'No chapter'}</p></TableCell>
                  <TableCell className="text-sm text-[#14232B]">{questionTypeLabels[question.question_type]}</TableCell>
                  <TableCell><Badge className={difficultyClass(question.difficulty)}>{difficultyLabels[question.difficulty]}</Badge></TableCell>
                  <TableCell><Badge className={question.organization_id ? 'bg-[#2E6D8B]/10 text-[#2E6D8B]' : 'bg-[#F2B84B]/20 text-[#8A5F00]'}>{question.organization_id ? 'School' : 'Evidara'}</Badge></TableCell>
                  <TableCell><Badge className={statusClass(question.status)}>{statusLabel(question.status)}</Badge></TableCell>
                  <TableCell className="text-sm text-[#14232B]">{question.marks} / −{question.negative_marks}</TableCell>
                  <TableCell className="text-sm text-[#6B7980]">v{question.version_number}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(question)} className="h-8 w-8 text-[#0E5A5A] hover:bg-[#0E5A5A]/10"><Edit3 className="h-4 w-4" /></Button>
                      {question.status !== 'archived' && <Button variant="ghost" size="icon" onClick={() => void archiveQuestion(question)} className="h-8 w-8 text-[#B54747] hover:bg-[#B54747]/10"><Archive className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-between border-t border-[#E7ECEB] px-4 py-3">
          <p className="text-xs text-[#6B7980]">Page {Math.min(page, totalPages)} of {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="border-[#E7ECEB]"><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="border-[#E7ECEB]">Next<ChevronRight className="ml-1 h-4 w-4" /></Button>
          </div>
        </div>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto border-[#E7ECEB] p-0">
          <DialogHeader className="border-b border-[#E7ECEB] px-6 py-5">
            <DialogTitle className="text-[#14232B]">{editor.id ? 'Edit Question' : 'Add Question'}</DialogTitle>
            <DialogDescription>Save directly to the live Supabase question bank while preserving the V7 design system.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Subject *</Label><Select value={editor.subjectId || undefined} onValueChange={(value) => setEditor((current) => ({ ...current, subjectId: value, chapterId: '' }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Select subject" /></SelectTrigger><SelectContent>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Chapter</Label><Select value={editor.chapterId || undefined} onValueChange={(value) => setEditor((current) => ({ ...current, chapterId: value }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Select chapter" /></SelectTrigger><SelectContent>{visibleChapters.map((chapter) => <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Question type</Label><Select value={editor.type} onValueChange={(value) => setEditor((current) => ({ ...current, type: value as QuestionType, options: newOptions(), numericAnswer: '' }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(questionTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Difficulty</Label><Select value={editor.difficulty} onValueChange={(value) => setEditor((current) => ({ ...current, difficulty: value as QuestionDifficulty }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(difficultyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Status</Label><Select value={editor.status} onValueChange={(value) => setEditor((current) => ({ ...current, status: value as QuestionStatus }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{(kind === 'admin' ? ['draft', 'in_review', 'approved', 'rejected'] : ['draft', 'in_review']).map((value) => <SelectItem key={value} value={value}>{statusLabel(value as QuestionStatus)}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Language</Label><Select value={editor.language} onValueChange={(value) => setEditor((current) => ({ ...current, language: value }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Kannada">Kannada</SelectItem><SelectItem value="Hindi">Hindi</SelectItem><SelectItem value="Bilingual">Bilingual</SelectItem></SelectContent></Select></div>
            </div>

            {editor.type === 'passage' && <div className="space-y-2"><Label>Passage</Label><Textarea rows={4} value={editor.passage} onChange={(event) => setEditor((current) => ({ ...current, passage: event.target.value }))} className="border-[#E7ECEB]" /></div>}
            <div className="space-y-2"><Label>Question text *</Label><Textarea rows={5} value={editor.stem} onChange={(event) => setEditor((current) => ({ ...current, stem: event.target.value }))} placeholder="Enter the complete question" className="border-[#E7ECEB]" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Question LaTeX</Label><Textarea rows={3} value={editor.stemLatex} onChange={(event) => setEditor((current) => ({ ...current, stemLatex: event.target.value }))} placeholder="Optional LaTeX" className="border-[#E7ECEB] font-mono" /></div>
              <div className="space-y-2"><Label>Question image URL</Label><Input value={editor.imageUrl} onChange={(event) => setEditor((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="Optional Supabase Storage or public image URL" className="border-[#E7ECEB]" /></div>
            </div>

            {isChoice ? (
              <div className="space-y-3">
                <div><Label>Answer options *</Label><p className="mt-1 text-xs text-[#6B7980]">Click the letter to mark the correct answer. Multiple-correct questions allow more than one answer.</p></div>
                <div className="grid gap-3 md:grid-cols-2">
                  {editor.options.map((option, index) => (
                    <div key={option.option_key} className={`rounded-xl border p-3 ${option.is_correct ? 'border-[#0E5A5A] bg-[#DCE9E7]/35' : 'border-[#E7ECEB] bg-white'}`}>
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => toggleCorrect(index)} className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold ${option.is_correct ? 'border-[#0E5A5A] bg-[#0E5A5A] text-white' : 'border-[#D0D5DD] text-[#14232B]'}`}>{option.option_key}</button>
                        <div className="grid flex-1 gap-2">
                          <Input value={option.content_text} onChange={(event) => updateOption(index, { content_text: event.target.value })} placeholder={`Option ${option.option_key}`} className="border-[#E7ECEB]" />
                          <Input value={option.content_latex || ''} onChange={(event) => updateOption(index, { content_latex: event.target.value })} placeholder="Optional LaTeX" className="border-[#E7ECEB] font-mono text-xs" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2"><Label>Correct answer *</Label><Input value={editor.numericAnswer} onChange={(event) => setEditor((current) => ({ ...current, numericAnswer: event.target.value }))} placeholder="Enter the numerical or integer answer" className="border-[#E7ECEB]" /></div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Marks</Label><Input type="number" step="0.25" value={editor.marks} onChange={(event) => setEditor((current) => ({ ...current, marks: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Negative marks</Label><Input type="number" step="0.25" min="0" value={editor.negativeMarks} onChange={(event) => setEditor((current) => ({ ...current, negativeMarks: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Expected time (seconds)</Label><Input type="number" min="1" value={editor.estimatedSeconds} onChange={(event) => setEditor((current) => ({ ...current, estimatedSeconds: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
            </div>

            <div className="space-y-2"><Label>Applicable examinations</Label><div className="flex flex-wrap gap-2">{['NEET', 'JEE Main', 'JEE Advanced', 'KCET', 'Olympiad', 'Foundation', 'Board', 'Custom'].map((exam) => <button type="button" key={exam} onClick={() => toggleExam(exam)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${editor.examTypes.includes(exam) ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#6B7980]'}`}>{editor.examTypes.includes(exam) && <CheckCircle2 className="mr-1 inline h-3 w-3" />}{exam}</button>)}</div></div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2"><Label>Class level</Label><Input value={editor.classLevel} onChange={(event) => setEditor((current) => ({ ...current, classLevel: event.target.value }))} placeholder="Grade 10 or Class 11-12" className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Source</Label><Input value={editor.source} onChange={(event) => setEditor((current) => ({ ...current, source: event.target.value }))} placeholder="NCERT, school bank, NEET 2025" className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Source year</Label><Input type="number" value={editor.sourceYear} onChange={(event) => setEditor((current) => ({ ...current, sourceYear: event.target.value }))} placeholder="2026" className="border-[#E7ECEB]" /></div>
            </div>
            <div className="space-y-2"><Label>Tags</Label><Input value={editor.tags} onChange={(event) => setEditor((current) => ({ ...current, tags: event.target.value }))} placeholder="Comma-separated tags" className="border-[#E7ECEB]" /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Solution explanation</Label><Textarea rows={4} value={editor.solution} onChange={(event) => setEditor((current) => ({ ...current, solution: event.target.value }))} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Solution LaTeX</Label><Textarea rows={4} value={editor.solutionLatex} onChange={(event) => setEditor((current) => ({ ...current, solutionLatex: event.target.value }))} className="border-[#E7ECEB] font-mono" /></div>
            </div>
          </div>

          <DialogFooter className="border-t border-[#E7ECEB] px-6 py-4">
            <Button variant="outline" onClick={() => setEditorOpen(false)} className="border-[#E7ECEB]">Cancel</Button>
            <Button onClick={() => void saveQuestion()} disabled={saving} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
              {saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editor.id ? 'Save New Version' : 'Save Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
