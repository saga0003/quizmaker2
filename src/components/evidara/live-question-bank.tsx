'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Edit3,
  FileQuestion,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { useQuestionScope } from '@/components/questions/useQuestionScope';
import type {
  QuestionDifficulty,
  QuestionRow,
  QuestionStatus,
  QuestionTestType,
  QuestionType,
  TaxonomyChapter,
  TaxonomySubject,
} from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpIcon } from '@/components/evidara/question-help';
import { QuestionEditorDialog } from '@/components/evidara/question-editor-dialog';
import { QuestionBulkImportDialog } from '@/components/evidara/question-bulk-import-dialog';

const PAGE_SIZE = 20;

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

const testTypeLabels: Record<QuestionTestType, string> = {
  full_length: 'Full Length Test',
  part_test: 'Part Test',
  chapter_test: 'Chapter Test',
  topic_test: 'Topic Test',
  custom: 'Custom',
};

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

function testType(question: QuestionRow) {
  return question.metadata?.test_type || 'custom';
}

function testTypeText(question: QuestionRow) {
  const value = testType(question);
  if (value === 'custom') return question.metadata?.custom_test_type || 'Custom';
  return testTypeLabels[value];
}

function organizationName(question: QuestionRow) {
  return question.organizations?.name || 'Unassigned school';
}

export function LiveQuestionBank({ kind }: { kind: 'admin' | 'school' }) {
  const { configured } = useAuth();
  const {
    organizationId,
    organizationName: currentOrganizationName,
    loading: scopeLoading,
    error: scopeError,
  } = useQuestionScope(kind);

  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [chapters, setChapters] = useState<TaxonomyChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionRow | null>(null);
  const [bank, setBank] = useState<'master' | 'school'>('master');
  const [selectedSchoolId, setSelectedSchoolId] = useState('all');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [testTypeFilter, setTestTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    if (!supabase || !configured) {
      setQuestions([]);
      setLoading(false);
      setError('Supabase is not configured. Question management is live-data only.');
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
    const [{ data: questionData, error: questionError }, { data: subjectData, error: subjectError }, { data: chapterData, error: chapterError }] = await Promise.all([
      supabase
        .from('questions')
        .select('*,subjects(name,code),chapters(name),organizations(id,name),question_options(option_key,content_text,content_latex,image_url,is_correct,display_order)')
        .order('updated_at', { ascending: false })
        .limit(2000),
      supabase.from('subjects').select('id,name,code,organization_id').eq('is_active', true).order('name'),
      supabase.from('chapters').select('id,name,subject_id,organization_id').eq('is_active', true).order('display_order'),
    ]);

    if (questionError || subjectError || chapterError) {
      setError(questionError?.message || subjectError?.message || chapterError?.message || 'Unable to load question data.');
    } else {
      const all = (questionData || []) as unknown as QuestionRow[];
      const visible = kind === 'admin'
        ? all
        : all.filter((question) =>
            (question.organization_id === null && question.status === 'approved')
            || question.organization_id === organizationId,
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
  }, [bank, selectedSchoolId, search, subjectFilter, statusFilter, difficultyFilter, gradeFilter, examFilter, testTypeFilter, dateFilter, sort]);

  const schoolGroups = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; count: number; review: number; updated: string }>();
    questions.filter((question) => question.organization_id).forEach((question) => {
      const id = question.organization_id!;
      const existing = byId.get(id);
      const updated = existing && existing.updated > question.updated_at ? existing.updated : question.updated_at;
      byId.set(id, {
        id,
        name: organizationName(question),
        count: (existing?.count || 0) + 1,
        review: (existing?.review || 0) + (question.status === 'in_review' ? 1 : 0),
        updated,
      });
    });
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [questions]);

  const gradeOptions = useMemo(() => [...new Set(questions.map((question) => question.class_level).filter(Boolean) as string[])].sort(), [questions]);
  const examOptions = useMemo(() => [...new Set(questions.flatMap((question) => question.exam_types || []))].sort(), [questions]);

  const bankQuestions = useMemo(() => questions.filter((question) => {
    if (bank === 'master') return question.organization_id === null;
    if (question.organization_id === null) return false;
    if (kind === 'school') return question.organization_id === organizationId;
    return selectedSchoolId === 'all' || question.organization_id === selectedSchoolId;
  }), [bank, kind, organizationId, questions, selectedSchoolId]);

  const filtered = useMemo(() => {
    const cutoff = dateFilter === 'all' ? null : Date.now() - Number(dateFilter) * 24 * 60 * 60 * 1000;
    const rows = bankQuestions.filter((question) => {
      const haystack = `${question.stem_text} ${question.subjects?.name || ''} ${question.chapters?.name || ''} ${(question.tags || []).join(' ')} ${(question.exam_types || []).join(' ')} ${question.class_level || ''} ${organizationName(question)}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return false;
      if (subjectFilter !== 'all' && question.subject_id !== subjectFilter) return false;
      if (statusFilter !== 'all' && question.status !== statusFilter) return false;
      if (difficultyFilter !== 'all' && question.difficulty !== difficultyFilter) return false;
      if (gradeFilter !== 'all' && question.class_level !== gradeFilter) return false;
      if (examFilter !== 'all' && !(question.exam_types || []).includes(examFilter)) return false;
      if (testTypeFilter !== 'all' && testType(question) !== testTypeFilter) return false;
      if (cutoff && new Date(question.updated_at).getTime() < cutoff) return false;
      return true;
    });

    return rows.sort((a, b) => {
      if (sort === 'oldest') return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      if (sort === 'subject') return (a.subjects?.name || '').localeCompare(b.subjects?.name || '');
      if (sort === 'grade') return (a.class_level || '').localeCompare(b.class_level || '');
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [bankQuestions, dateFilter, difficultyFilter, examFilter, gradeFilter, search, sort, statusFilter, subjectFilter, testTypeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const stats = {
    total: bankQuestions.length,
    approved: bankQuestions.filter((question) => question.status === 'approved').length,
    review: bankQuestions.filter((question) => question.status === 'in_review').length,
    match: bankQuestions.filter((question) => question.question_type === 'match_following').length,
  };

  const editable = (question: QuestionRow) => kind === 'admin' || question.organization_id === organizationId;

  function openCreate() {
    setSelectedQuestion(null);
    setError('');
    setMessage('');
    setEditorOpen(true);
  }

  function openEdit(question: QuestionRow) {
    if (!editable(question)) return;
    setSelectedQuestion(question);
    setError('');
    setMessage('');
    setEditorOpen(true);
  }

  async function archiveQuestion(question: QuestionRow) {
    if (!supabase || !editable(question)) return;
    if (!window.confirm(`Archive this question?\n\n${question.stem_text.slice(0, 140)}`)) return;
    setError('');
    const { error: archiveError } = await supabase.from('questions').update({ status: 'archived' }).eq('id', question.id);
    if (archiveError) setError(archiveError.message);
    else {
      setMessage('Question archived.');
      await load();
    }
  }

  const title = bank === 'master' ? 'Evidara Question Bank' : kind === 'admin' ? 'School-Created Questions' : 'My School Question Bank';
  const description = bank === 'master'
    ? 'Platform-owned questions available for approved reuse.'
    : 'School-created questions remain isolated from the Evidara master bank and retain school attribution.';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">
            <ShieldCheck className="h-4 w-4" />
            {kind === 'admin' ? 'Question governance' : currentOrganizationName}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <h1 className="text-2xl font-bold text-[#14232B]">{title}</h1>
            <HelpIcon text={description} />
          </div>
          <p className="mt-1 text-sm text-[#6B7980]">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-[#E7ECEB]">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)} className="border-[#E7ECEB]">
            <Upload className="mr-2 h-4 w-4" />Bulk Import
          </Button>
          <Button onClick={openCreate} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
            <Plus className="mr-2 h-4 w-4" />Add Question
          </Button>
        </div>
      </div>

      <Tabs value={bank} onValueChange={(value) => setBank(value as 'master' | 'school')}>
        <TabsList className="h-auto bg-[#E7ECEB]/60 p-1">
          <TabsTrigger value="master" className="px-4 py-2">Evidara Question Bank</TabsTrigger>
          <TabsTrigger value="school" className="px-4 py-2">{kind === 'admin' ? 'School-Created Questions' : 'My School Questions'}</TabsTrigger>
        </TabsList>
      </Tabs>

      {(scopeError || error) && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{scopeError || error}</div>}
      {message && <div className="rounded-xl border border-[#0E5A5A]/20 bg-[#DCE9E7]/60 px-4 py-3 text-sm text-[#0E5A5A]">{message}</div>}

      {kind === 'admin' && bank === 'school' && (
        <Card className="gap-0 border-[#E7ECEB] shadow-none">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <strong className="text-sm text-[#14232B]">Schools contributing questions</strong>
                <p className="text-xs text-[#6B7980]">Choose a school to open only that school’s question bank.</p>
              </div>
              <Button variant={selectedSchoolId === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedSchoolId('all')} className={selectedSchoolId === 'all' ? 'bg-[#0E5A5A]' : 'border-[#E7ECEB]'}>All schools</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {schoolGroups.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => setSelectedSchoolId(school.id)}
                  className={`rounded-xl border p-3 text-left transition ${selectedSchoolId === school.id ? 'border-[#0E5A5A] bg-[#DCE9E7]/40' : 'border-[#E7ECEB] bg-white hover:border-[#0E5A5A]/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#2E6D8B]/10 text-[#2E6D8B]"><Building2 className="h-4 w-4" /></div>
                    {school.review > 0 && <Badge className="bg-[#F2B84B]/20 text-[#8A5F00]">{school.review} review</Badge>}
                  </div>
                  <strong className="mt-3 block truncate text-sm text-[#14232B]">{school.name}</strong>
                  <span className="mt-1 block text-xs text-[#6B7980]">{school.count} question{school.count === 1 ? '' : 's'}</span>
                </button>
              ))}
              {!schoolGroups.length && <div className="col-span-full py-5 text-center text-sm text-[#6B7980]">No school has added questions yet.</div>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Questions in view', value: stats.total, icon: FileQuestion, tone: '#14232B' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle2, tone: '#0E5A5A' },
          { label: 'Awaiting review', value: stats.review, icon: CircleAlert, tone: '#8A5F00' },
          { label: 'Match following', value: stats.match, icon: ShieldCheck, tone: '#2E6D8B' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="gap-0 border-[#E7ECEB] shadow-none">
            <CardContent className="flex items-center justify-between p-4">
              <div><p className="text-xs font-medium text-[#6B7980]">{label}</p><p className="mt-1 text-2xl font-bold" style={{ color: tone }}>{value}</p></div>
              <div className="rounded-lg p-2.5" style={{ backgroundColor: `${tone}12`, color: tone }}><Icon className="h-5 w-5" /></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="gap-0 border-[#E7ECEB] shadow-none">
        <CardContent className="p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question, school, grade, chapter, exam or tag" className="border-[#E7ECEB] pl-9" />
            </div>
            <Select value={subjectFilter} onValueChange={setSubjectFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select>
            <Select value={gradeFilter} onValueChange={setGradeFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Grade" /></SelectTrigger><SelectContent><SelectItem value="all">All grades</SelectItem>{gradeOptions.map((grade) => <SelectItem key={grade} value={grade}>{grade}</SelectItem>)}</SelectContent></Select>
            <Select value={examFilter} onValueChange={setExamFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Exam" /></SelectTrigger><SelectContent><SelectItem value="all">All exams</SelectItem>{examOptions.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select>
            <Select value={testTypeFilter} onValueChange={setTestTypeFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Test type" /></SelectTrigger><SelectContent><SelectItem value="all">All test types</SelectItem>{Object.entries(testTypeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{(['draft', 'in_review', 'approved', 'rejected', 'archived'] as QuestionStatus[]).map((status) => <SelectItem key={status} value={status}>{statusLabel(status)}</SelectItem>)}</SelectContent></Select>
            <Select value={difficultyFilter} onValueChange={setDifficultyFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue placeholder="Difficulty" /></SelectTrigger><SelectContent><SelectItem value="all">All difficulty</SelectItem>{Object.entries(difficultyLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#E7ECEB] pt-3">
            <div className="flex flex-wrap gap-2">
              <Select value={dateFilter} onValueChange={setDateFilter}><SelectTrigger className="w-[160px] border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any date</SelectItem><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select>
              <Select value={sort} onValueChange={setSort}><SelectTrigger className="w-[170px] border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">Recently updated</SelectItem><SelectItem value="oldest">Oldest updated</SelectItem><SelectItem value="subject">Subject A-Z</SelectItem><SelectItem value="grade">Grade A-Z</SelectItem></SelectContent></Select>
            </div>
            <p className="text-xs text-[#6B7980]">{filtered.length} matching question{filtered.length === 1 ? '' : 's'}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden border-[#E7ECEB] shadow-none">
        <div className="overflow-x-auto">
          <Table className="min-w-[1280px]">
            <TableHeader>
              <TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]">
                <TableHead className="text-xs font-semibold text-[#6B7980]">Question</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">School / Ownership</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Subject / Grade</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Question Type</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Test Type</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Difficulty</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead>
                <TableHead className="text-xs font-semibold text-[#6B7980]">Updated</TableHead>
                <TableHead className="text-right text-xs font-semibold text-[#6B7980]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading question banks…</TableCell></TableRow>
              ) : visibleRows.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]">No questions match the current filters.</TableCell></TableRow>
              ) : visibleRows.map((question) => (
                <TableRow key={question.id} className="border-[#E7ECEB]">
                  <TableCell className="max-w-[380px]">
                    <p className="line-clamp-2 text-sm font-medium text-[#14232B]">{question.stem_text}</p>
                    <div className="mt-1 flex flex-wrap gap-1">{(question.exam_types || []).slice(0, 3).map((exam) => <Badge key={exam} variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">{exam}</Badge>)}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={question.organization_id ? 'bg-[#2E6D8B]/10 text-[#2E6D8B]' : 'bg-[#F2B84B]/20 text-[#8A5F00]'}>
                      {question.organization_id ? organizationName(question) : 'Evidara Master'}
                    </Badge>
                    <p className="mt-1 text-[11px] text-[#6B7980]">{question.organization_id ? 'School-created question' : 'Evidara-created question'}</p>
                  </TableCell>
                  <TableCell><p className="text-sm text-[#14232B]">{question.subjects?.name || 'Unclassified'}</p><p className="text-xs text-[#6B7980]">{question.class_level || 'No grade'} · {question.chapters?.name || 'No chapter'}</p></TableCell>
                  <TableCell className="text-sm text-[#14232B]">{questionTypeLabels[question.question_type]}</TableCell>
                  <TableCell className="text-sm text-[#14232B]">{testTypeText(question)}</TableCell>
                  <TableCell><Badge className={difficultyClass(question.difficulty)}>{difficultyLabels[question.difficulty]}</Badge></TableCell>
                  <TableCell><Badge className={statusClass(question.status)}>{statusLabel(question.status)}</Badge></TableCell>
                  <TableCell className="text-xs text-[#6B7980]">{new Date(question.updated_at).toLocaleDateString('en-IN')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {editable(question) ? (
                        <>
                          <Button variant="ghost" size="icon" title="Edit question" onClick={() => openEdit(question)} className="h-8 w-8 text-[#0E5A5A] hover:bg-[#0E5A5A]/10"><Edit3 className="h-4 w-4" /></Button>
                          {question.status !== 'archived' && <Button variant="ghost" size="icon" title="Archive question" onClick={() => void archiveQuestion(question)} className="h-8 w-8 text-[#B54747] hover:bg-[#B54747]/10"><Archive className="h-4 w-4" /></Button>}
                        </>
                      ) : <Badge variant="outline" className="border-[#E7ECEB] text-[10px] text-[#6B7980]">Read only</Badge>}
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

      <QuestionEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        kind={kind}
        organizationId={organizationId}
        subjects={subjects}
        chapters={chapters}
        question={selectedQuestion}
        onSaved={async () => {
          setMessage(selectedQuestion ? 'Question updated successfully.' : 'Question created successfully.');
          setSelectedQuestion(null);
          await load();
        }}
      />

      <QuestionBulkImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        kind={kind}
        organizationId={organizationId}
        subjects={subjects}
        chapters={chapters}
        onImported={async () => {
          setMessage('Question import completed.');
          await load();
        }}
      />
    </div>
  );
}
