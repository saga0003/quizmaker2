'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Edit3,
  Eye,
  FilePlus2,
  FileQuestion,
  KeyRound,
  Layers3,
  LoaderCircle,
  PlayCircle,
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
import type { QuestionRow, TaxonomySubject } from '@/types/questions';
import type {
  PaperAccessMode,
  PaperListRow,
  PaperPayload,
  PaperQuestionInput,
  PaperSectionInput,
  PaperStatus,
  ResultMode,
} from '@/types/papers';
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
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

const examTypes = ['NEET', 'JEE Main', 'JEE Advanced', 'KCET', 'School MCQ', 'Olympiad', 'Foundation', 'Scholarship Exam', 'Custom'];

function createClientId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `section-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptySection(order = 0): PaperSectionInput {
  return {
    client_id: createClientId(),
    title: `Section ${String.fromCharCode(65 + order)}`,
    display_order: order,
  };
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}

function toLocal(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : '';
}

function statusClass(status: PaperStatus) {
  if (status === 'published') return 'bg-[#DCE9E7] text-[#0E5A5A]';
  if (status === 'draft') return 'bg-[#F2B84B]/20 text-[#8A5F00]';
  return 'bg-[#E7ECEB] text-[#6B7980]';
}

type SelectedQuestion = PaperQuestionInput & { question: QuestionRow };

type BuilderState = {
  id: string | null;
  title: string;
  code: string;
  description: string;
  examType: string;
  duration: number;
  instructions: string;
  accessMode: PaperAccessMode;
  accessCode: string;
  availableFrom: string;
  availableUntil: string;
  attemptLimit: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  resultMode: ResultMode;
};

function emptyBuilder(): BuilderState {
  return {
    id: null,
    title: '',
    code: '',
    description: '',
    examType: 'NEET',
    duration: 180,
    instructions: 'Read every question carefully. Answers are autosaved. Submit before the timer reaches zero.',
    accessMode: 'organization',
    accessCode: '',
    availableFrom: '',
    availableUntil: '',
    attemptLimit: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
    resultMode: 'score_only',
  };
}

export function LivePaperCatalogue({ kind }: { kind: 'admin' | 'school' }) {
  const { configured } = useAuth();
  const {
    organizationId,
    organizationName,
    loading: scopeLoading,
    error: scopeError,
  } = useQuestionScope(kind);
  const [papers, setPapers] = useState<PaperListRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [examFilter, setExamFilter] = useState('all');
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builder, setBuilder] = useState<BuilderState>(emptyBuilder);
  const [sections, setSections] = useState<PaperSectionInput[]>([emptySection()]);
  const [activeSection, setActiveSection] = useState('');
  const [selected, setSelected] = useState<SelectedQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubject, setQuestionSubject] = useState('all');
  const [questionDifficulty, setQuestionDifficulty] = useState('all');

  const load = useCallback(async () => {
    if (!supabase || !configured) {
      setPapers([]);
      setQuestions([]);
      setLoading(false);
      setError('Supabase is not configured. V7 paper management is live-data only.');
      return;
    }
    if (kind === 'school' && scopeLoading) return;
    if (kind === 'school' && !organizationId) {
      setLoading(false);
      setError(scopeError || 'This account is not linked to a school organization.');
      return;
    }

    setLoading(true);
    setError('');
    let paperQuery = supabase
      .from('question_papers')
      .select('id,organization_id,title,code,description,exam_type,status,duration_minutes,total_marks,total_questions,access_mode,available_from,available_until,attempt_limit,result_mode,created_at,updated_at')
      .order('updated_at', { ascending: false });
    paperQuery = kind === 'admin'
      ? paperQuery.is('organization_id', null)
      : paperQuery.eq('organization_id', organizationId as string);

    const [{ data: paperData, error: paperError }, { data: questionData, error: questionError }, { data: subjectData, error: subjectError }] = await Promise.all([
      paperQuery,
      supabase
        .from('questions')
        .select('*,subjects(name,code),chapters(name),question_options(option_key,content_text,content_latex,image_url,is_correct,display_order)')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(1500),
      supabase.from('subjects').select('id,name,code,organization_id').eq('is_active', true).order('name'),
    ]);

    if (paperError || questionError || subjectError) {
      setError(paperError?.message || questionError?.message || subjectError?.message || 'Unable to load paper data.');
    } else {
      const visibleQuestions = ((questionData || []) as unknown as QuestionRow[]).filter((question) =>
        kind === 'admin'
          ? question.organization_id === null
          : question.organization_id === null || question.organization_id === organizationId,
      );
      setPapers((paperData || []) as PaperListRow[]);
      setQuestions(visibleQuestions);
      setSubjects((subjectData || []) as TaxonomySubject[]);
    }
    setLoading(false);
  }, [configured, kind, organizationId, scopeError, scopeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!activeSection && sections[0]) setActiveSection(sections[0].client_id);
  }, [activeSection, sections]);

  const filteredPapers = useMemo(() => papers.filter((paper) => {
    const haystack = `${paper.title} ${paper.code || ''} ${paper.exam_type}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && paper.status !== statusFilter) return false;
    if (examFilter !== 'all' && paper.exam_type !== examFilter) return false;
    return true;
  }), [examFilter, papers, search, statusFilter]);

  const filteredQuestions = useMemo(() => questions.filter((question) => {
    const haystack = `${question.stem_text} ${question.subjects?.name || ''} ${question.chapters?.name || ''} ${(question.tags || []).join(' ')}`.toLowerCase();
    if (questionSearch && !haystack.includes(questionSearch.toLowerCase())) return false;
    if (questionSubject !== 'all' && question.subject_id !== questionSubject) return false;
    if (questionDifficulty !== 'all' && question.difficulty !== questionDifficulty) return false;
    return true;
  }), [questionDifficulty, questionSearch, questionSubject, questions]);

  const paperExamTypes = Array.from(new Set(papers.map((paper) => paper.exam_type))).sort();
  const selectedIds = new Set(selected.map((item) => item.question_id));
  const totalMarks = selected.reduce((sum, item) => sum + Number(item.marks || 0), 0);
  const stats = {
    total: papers.length,
    published: papers.filter((paper) => paper.status === 'published').length,
    drafts: papers.filter((paper) => paper.status === 'draft').length,
    questions: papers.reduce((sum, paper) => sum + paper.total_questions, 0),
  };

  function resetBuilder() {
    const firstSection = emptySection();
    setBuilder({ ...emptyBuilder(), accessMode: kind === 'admin' ? 'public' : 'organization' });
    setSections([firstSection]);
    setActiveSection(firstSection.client_id);
    setSelected([]);
    setQuestionSearch('');
    setQuestionSubject('all');
    setQuestionDifficulty('all');
  }

  function openCreate() {
    resetBuilder();
    setError('');
    setMessage('');
    setBuilderOpen(true);
  }

  async function openEdit(paper: PaperListRow) {
    if (!supabase) return;
    setBuilderOpen(true);
    setBuilderLoading(true);
    setError('');
    setMessage('');

    const [{ data: paperData, error: paperError }, { data: sectionData, error: sectionError }, { data: itemData, error: itemError }] = await Promise.all([
      supabase.from('question_papers').select('*').eq('id', paper.id).single(),
      supabase.from('paper_sections').select('*').eq('paper_id', paper.id).order('display_order'),
      supabase.from('paper_questions').select('question_id,section_id,display_order,marks,negative_marks,is_mandatory').eq('paper_id', paper.id).order('display_order'),
    ]);

    if (paperError || sectionError || itemError || !paperData) {
      setError(paperError?.message || sectionError?.message || itemError?.message || 'Unable to open this paper.');
      setBuilderLoading(false);
      return;
    }

    const loadedSections: PaperSectionInput[] = (sectionData || []).map((section, index) => ({
      client_id: section.id,
      id: section.id,
      title: section.title,
      subject_id: section.subject_id || undefined,
      instructions: section.instructions || undefined,
      questions_to_attempt: section.questions_to_attempt || undefined,
      display_order: index,
    }));
    const sectionRows = loadedSections.length ? loadedSections : [emptySection()];
    const loadedItems: SelectedQuestion[] = (itemData || []).map((item) => {
      const question = questions.find((candidate) => candidate.id === item.question_id);
      if (!question) return null;
      return {
        question_id: item.question_id,
        section_client_id: item.section_id,
        display_order: item.display_order,
        marks: Number(item.marks),
        negative_marks: Number(item.negative_marks),
        is_mandatory: Boolean(item.is_mandatory),
        question,
      };
    }).filter(Boolean) as SelectedQuestion[];

    setBuilder({
      id: paperData.id,
      title: paperData.title,
      code: paperData.code || '',
      description: paperData.description || '',
      examType: paperData.exam_type,
      duration: Number(paperData.duration_minutes),
      instructions: paperData.instructions || '',
      accessMode: paperData.access_mode,
      accessCode: paperData.access_code || '',
      availableFrom: toLocal(paperData.available_from),
      availableUntil: toLocal(paperData.available_until),
      attemptLimit: Number(paperData.attempt_limit),
      shuffleQuestions: Boolean(paperData.shuffle_questions),
      shuffleOptions: Boolean(paperData.shuffle_options),
      resultMode: paperData.result_mode,
    });
    setSections(sectionRows);
    setActiveSection(sectionRows[0].client_id);
    setSelected(loadedItems);
    setBuilderLoading(false);
  }

  function addSection() {
    const section = emptySection(sections.length);
    setSections((current) => [...current, section]);
    setActiveSection(section.client_id);
  }

  function updateSection(clientId: string, patch: Partial<PaperSectionInput>) {
    setSections((current) => current.map((section) => section.client_id === clientId ? { ...section, ...patch } : section));
  }

  function removeSection(clientId: string) {
    if (sections.length === 1) {
      setError('A paper must contain at least one section.');
      return;
    }
    const next = sections.filter((section) => section.client_id !== clientId).map((section, index) => ({ ...section, display_order: index }));
    setSections(next);
    setSelected((current) => current.filter((item) => item.section_client_id !== clientId).map((item, index) => ({ ...item, display_order: index })));
    if (activeSection === clientId) setActiveSection(next[0].client_id);
  }

  function addQuestion(question: QuestionRow) {
    if (selectedIds.has(question.id)) return;
    const sectionId = activeSection || sections[0]?.client_id;
    if (!sectionId) return;
    setSelected((current) => [...current, {
      question_id: question.id,
      section_client_id: sectionId,
      display_order: current.length,
      marks: Number(question.marks),
      negative_marks: Number(question.negative_marks),
      is_mandatory: true,
      question,
    }]);
  }

  function updateSelected(questionId: string, patch: Partial<PaperQuestionInput>) {
    setSelected((current) => current.map((item) => item.question_id === questionId ? { ...item, ...patch } : item));
  }

  function removeSelected(questionId: string) {
    setSelected((current) => current.filter((item) => item.question_id !== questionId).map((item, index) => ({ ...item, display_order: index })));
  }

  function moveSelected(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    const next = [...selected];
    [next[index], next[target]] = [next[target], next[index]];
    setSelected(next.map((item, itemIndex) => ({ ...item, display_order: itemIndex })));
  }

  function validateBuilder() {
    if (builder.title.trim().length < 3) return 'Enter a complete paper title.';
    if (builder.duration < 1) return 'Duration must be at least one minute.';
    if (!sections.length || sections.some((section) => !section.title.trim())) return 'Every paper section needs a title.';
    if (!selected.length) return 'Add at least one approved question.';
    if (builder.accessMode === 'code' && builder.accessCode.trim().length < 4) return 'Access code must contain at least four characters.';
    if (builder.availableFrom && builder.availableUntil && new Date(builder.availableUntil) <= new Date(builder.availableFrom)) return 'Closing time must be later than opening time.';
    return '';
  }

  async function savePaper(status: PaperStatus) {
    if (!supabase) return;
    const validation = validateBuilder();
    if (validation) {
      setError(validation);
      return;
    }
    if (kind === 'school' && !organizationId) {
      setError('This account is not linked to a school organization.');
      return;
    }

    const payload: PaperPayload = {
      title: builder.title.trim(),
      code: builder.code.trim() || undefined,
      description: builder.description.trim() || undefined,
      exam_type: builder.examType,
      status,
      duration_minutes: Number(builder.duration),
      instructions: builder.instructions.trim() || undefined,
      access_mode: builder.accessMode,
      access_code: builder.accessMode === 'code' ? builder.accessCode.trim() : undefined,
      available_from: toIso(builder.availableFrom),
      available_until: toIso(builder.availableUntil),
      attempt_limit: Number(builder.attemptLimit),
      shuffle_questions: builder.shuffleQuestions,
      shuffle_options: builder.shuffleOptions,
      result_mode: builder.resultMode,
      sections: sections.map((section, index) => ({ ...section, display_order: index })),
      questions: selected.map((item, index) => ({
        question_id: item.question_id,
        section_client_id: item.section_client_id,
        display_order: index,
        marks: Number(item.marks),
        negative_marks: Number(item.negative_marks),
        is_mandatory: item.is_mandatory,
      })),
    };

    setSaving(true);
    setError('');
    setMessage('');
    const { error: saveError } = await supabase.rpc('save_question_paper', {
      p_paper_id: builder.id,
      p_organization_id: kind === 'admin' ? null : organizationId,
      p_payload: payload,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setMessage(status === 'published' ? 'Question paper published successfully.' : 'Question paper draft saved successfully.');
    setBuilderOpen(false);
    await load();
  }

  async function setPaperStatus(paper: PaperListRow, status: PaperStatus) {
    if (!supabase) return;
    setError('');
    const { error: statusError } = await supabase.rpc('set_question_paper_status', {
      p_paper_id: paper.id,
      p_status: status,
    });
    if (statusError) setError(statusError.message);
    else await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">
            <ShieldCheck className="h-4 w-4" />
            {kind === 'admin' ? 'Evidara assessment catalogue' : organizationName}
          </div>
          <h1 className="mt-2 text-2xl font-bold text-[#14232B]">Tests and Question Papers</h1>
          <p className="mt-1 text-sm text-[#6B7980]">Build sections, select approved questions, configure access and publish live timed assessments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-[#E7ECEB]">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh
          </Button>
          <Button onClick={openCreate} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]">
            <FilePlus2 className="mr-2 h-4 w-4" />Create Paper
          </Button>
        </div>
      </div>

      {(scopeError || error) && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{scopeError || error}</div>}
      {message && <div className="rounded-xl border border-[#0E5A5A]/20 bg-[#DCE9E7]/60 px-4 py-3 text-sm text-[#0E5A5A]">{message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total papers', value: stats.total, icon: FileQuestion, tone: '#14232B' },
          { label: 'Published', value: stats.published, icon: CheckCircle2, tone: '#0E5A5A' },
          { label: 'Drafts', value: stats.drafts, icon: Edit3, tone: '#8A5F00' },
          { label: 'Questions placed', value: stats.questions, icon: Layers3, tone: '#2E6D8B' },
        ].map(({ label, value, icon: Icon, tone }) => (
          <Card key={label} className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-[#6B7980]">{label}</p><p className="mt-1 text-2xl font-bold" style={{ color: tone }}>{value}</p></div><div className="rounded-lg p-2.5" style={{ backgroundColor: `${tone}12`, color: tone }}><Icon className="h-5 w-5" /></div></CardContent></Card>
        ))}
      </div>

      <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="grid gap-3 md:grid-cols-3"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search paper title, code or exam" className="border-[#E7ECEB] pl-9" /></div><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select><Select value={examFilter} onValueChange={setExamFilter}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All exam types</SelectItem>{paperExamTypes.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>

      <Card className="gap-0 overflow-hidden border-[#E7ECEB] shadow-none">
        <div className="overflow-x-auto">
          <Table className="min-w-[1040px]">
            <TableHeader><TableRow className="border-[#E7ECEB] bg-[#F7F9F7] hover:bg-[#F7F9F7]"><TableHead className="text-xs font-semibold text-[#6B7980]">Paper</TableHead><TableHead className="text-xs font-semibold text-[#6B7980]">Exam</TableHead><TableHead className="text-xs font-semibold text-[#6B7980]">Questions</TableHead><TableHead className="text-xs font-semibold text-[#6B7980]">Marks</TableHead><TableHead className="text-xs font-semibold text-[#6B7980]">Duration</TableHead><TableHead className="text-xs font-semibold text-[#6B7980]">Access</TableHead><TableHead className="text-xs font-semibold text-[#6B7980]">Results</TableHead><TableHead className="text-xs font-semibold text-[#6B7980]">Status</TableHead><TableHead className="text-right text-xs font-semibold text-[#6B7980]">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading live question papers…</TableCell></TableRow> : filteredPapers.length === 0 ? <TableRow><TableCell colSpan={9} className="py-14 text-center text-sm text-[#6B7980]">No question papers match the current filters.</TableCell></TableRow> : filteredPapers.map((paper) => (
                <TableRow key={paper.id} className="border-[#E7ECEB]">
                  <TableCell><p className="text-sm font-semibold text-[#14232B]">{paper.title}</p><p className="mt-1 text-xs text-[#6B7980]">{paper.code || 'No paper code'} · Updated {new Date(paper.updated_at).toLocaleDateString('en-IN')}</p></TableCell>
                  <TableCell className="text-sm text-[#14232B]">{paper.exam_type}</TableCell>
                  <TableCell className="text-sm text-[#14232B]">{paper.total_questions}</TableCell>
                  <TableCell className="text-sm text-[#14232B]">{paper.total_marks}</TableCell>
                  <TableCell className="text-sm text-[#14232B]">{paper.duration_minutes} min</TableCell>
                  <TableCell><Badge variant="outline" className="border-[#E7ECEB] capitalize text-[#6B7980]">{paper.access_mode}</Badge></TableCell>
                  <TableCell className="text-sm capitalize text-[#6B7980]">{paper.result_mode.replaceAll('_', ' ')}</TableCell>
                  <TableCell><Badge className={statusClass(paper.status)}>{paper.status.charAt(0).toUpperCase() + paper.status.slice(1)}</Badge></TableCell>
                  <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => void openEdit(paper)} className="h-8 w-8 text-[#0E5A5A] hover:bg-[#0E5A5A]/10"><Edit3 className="h-4 w-4" /></Button>{paper.status !== 'published' ? <Button variant="ghost" size="icon" onClick={() => void setPaperStatus(paper, 'published')} className="h-8 w-8 text-[#0E5A5A] hover:bg-[#0E5A5A]/10"><PlayCircle className="h-4 w-4" /></Button> : <Button variant="ghost" size="icon" onClick={() => void setPaperStatus(paper, 'archived')} className="h-8 w-8 text-[#B54747] hover:bg-[#B54747]/10"><Archive className="h-4 w-4" /></Button>}</div></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex items-center gap-2 rounded-xl border border-[#E7ECEB] bg-white px-4 py-3 text-xs text-[#6B7980]"><CalendarClock className="h-4 w-4 text-[#0E5A5A]" />Published papers are shown to eligible students according to the selected access mode, schedule and attempt limit.</div>

      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-h-[94vh] max-w-[96vw] overflow-y-auto border-[#E7ECEB] p-0 xl:max-w-7xl">
          <DialogHeader className="border-b border-[#E7ECEB] px-6 py-5"><DialogTitle className="text-[#14232B]">{builder.id ? 'Edit Question Paper' : 'Create Question Paper'}</DialogTitle><DialogDescription>Use approved live questions, organise sections and publish without changing the V7 interface.</DialogDescription></DialogHeader>

          {builderLoading ? <div className="grid min-h-[420px] place-items-center text-sm text-[#6B7980]"><div className="text-center"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading paper builder…</div></div> : <div className="space-y-6 px-6 py-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2 md:col-span-2"><Label>Paper title *</Label><Input value={builder.title} onChange={(event) => setBuilder((current) => ({ ...current, title: event.target.value }))} placeholder="NEET Full Syllabus Mock 01" className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Paper code</Label><Input value={builder.code} onChange={(event) => setBuilder((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="NEET-M01" className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Exam type</Label><Select value={builder.examType} onValueChange={(value) => setBuilder((current) => ({ ...current, examType: value }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{examTypes.map((exam) => <SelectItem key={exam} value={exam}>{exam}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2 md:col-span-2 xl:col-span-4"><Label>Description</Label><Textarea rows={2} value={builder.description} onChange={(event) => setBuilder((current) => ({ ...current, description: event.target.value }))} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Duration (minutes)</Label><Input type="number" min="1" value={builder.duration} onChange={(event) => setBuilder((current) => ({ ...current, duration: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Attempts allowed</Label><Input type="number" min="1" value={builder.attemptLimit} onChange={(event) => setBuilder((current) => ({ ...current, attemptLimit: Number(event.target.value) }))} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Access mode</Label><Select value={builder.accessMode} onValueChange={(value) => setBuilder((current) => ({ ...current, accessMode: value as PaperAccessMode }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">All logged-in students</SelectItem>{kind === 'school' && <SelectItem value="organization">Linked school only</SelectItem>}<SelectItem value="code">Access code</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Result display</Label><Select value={builder.resultMode} onValueChange={(value) => setBuilder((current) => ({ ...current, resultMode: value as ResultMode }))}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="score_only">Score only</SelectItem><SelectItem value="score_and_answers">Score and answers</SelectItem><SelectItem value="after_close">After test closes</SelectItem><SelectItem value="hidden">Hidden</SelectItem></SelectContent></Select></div>
              {builder.accessMode === 'code' && <div className="space-y-2"><Label>Access code</Label><Input value={builder.accessCode} onChange={(event) => setBuilder((current) => ({ ...current, accessCode: event.target.value.toUpperCase() }))} className="border-[#E7ECEB]" /></div>}
              <div className="space-y-2"><Label>Opens at</Label><Input type="datetime-local" value={builder.availableFrom} onChange={(event) => setBuilder((current) => ({ ...current, availableFrom: event.target.value }))} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Closes at</Label><Input type="datetime-local" value={builder.availableUntil} onChange={(event) => setBuilder((current) => ({ ...current, availableUntil: event.target.value }))} className="border-[#E7ECEB]" /></div>
              <div className="flex items-center justify-between rounded-xl border border-[#E7ECEB] px-3 py-2"><div><Label>Shuffle questions</Label><p className="text-xs text-[#6B7980]">Different order per attempt</p></div><Switch checked={builder.shuffleQuestions} onCheckedChange={(value) => setBuilder((current) => ({ ...current, shuffleQuestions: value }))} /></div>
              <div className="flex items-center justify-between rounded-xl border border-[#E7ECEB] px-3 py-2"><div><Label>Shuffle options</Label><p className="text-xs text-[#6B7980]">Randomise MCQ options</p></div><Switch checked={builder.shuffleOptions} onCheckedChange={(value) => setBuilder((current) => ({ ...current, shuffleOptions: value }))} /></div>
              <div className="space-y-2 md:col-span-2 xl:col-span-4"><Label>Instructions</Label><Textarea rows={3} value={builder.instructions} onChange={(event) => setBuilder((current) => ({ ...current, instructions: event.target.value }))} className="border-[#E7ECEB]" /></div>
            </div>

            <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-[#14232B]">Paper Sections</h3><p className="text-xs text-[#6B7980]">Questions are assigned to the active section.</p></div><Button variant="outline" size="sm" onClick={addSection} className="border-[#E7ECEB]"><Plus className="mr-1 h-4 w-4" />Add Section</Button></div><div className="mt-4 flex flex-wrap gap-2">{sections.map((section) => <button type="button" key={section.client_id} onClick={() => setActiveSection(section.client_id)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${activeSection === section.client_id ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#6B7980]'}`}>{section.title}</button>)}</div>{sections.map((section) => section.client_id === activeSection && <div key={section.client_id} className="mt-4 grid gap-3 md:grid-cols-[1fr_220px_auto]"><Input value={section.title} onChange={(event) => updateSection(section.client_id, { title: event.target.value })} className="border-[#E7ECEB]" /><Select value={section.subject_id || 'all'} onValueChange={(value) => updateSection(section.client_id, { subject_id: value === 'all' ? undefined : value })}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Any subject</SelectItem>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select><Button variant="ghost" onClick={() => removeSection(section.client_id)} disabled={sections.length === 1} className="text-[#B54747] hover:bg-[#B54747]/10"><Trash2 className="mr-1 h-4 w-4" />Remove</Button></div>)}</CardContent></Card>

            <div className="grid gap-5 xl:grid-cols-[1fr_1.05fr]">
              <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div><h3 className="font-semibold text-[#14232B]">Approved Question Bank</h3><p className="text-xs text-[#6B7980]">Add questions to {sections.find((section) => section.client_id === activeSection)?.title || 'the active section'}.</p></div><div className="mt-4 grid gap-2 md:grid-cols-3"><div className="relative md:col-span-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" /><Input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} placeholder="Search questions" className="border-[#E7ECEB] pl-9" /></div><Select value={questionSubject} onValueChange={setQuestionSubject}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select><Select value={questionDifficulty} onValueChange={setQuestionDifficulty}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All levels</SelectItem><SelectItem value="very_easy">Very easy</SelectItem><SelectItem value="easy">Easy</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="difficult">Difficult</SelectItem><SelectItem value="very_difficult">Very difficult</SelectItem></SelectContent></Select></div><div className="mt-4 max-h-[460px] space-y-2 overflow-y-auto pr-1">{filteredQuestions.map((question) => <div key={question.id} className="rounded-xl border border-[#E7ECEB] p-3"><div className="flex items-start justify-between gap-3"><div><p className="line-clamp-2 text-sm font-medium text-[#14232B]">{question.stem_text}</p><p className="mt-1 text-xs text-[#6B7980]">{question.subjects?.name || 'Unclassified'} · {question.difficulty.replaceAll('_', ' ')} · {question.marks} marks</p></div><Button size="sm" disabled={selectedIds.has(question.id)} onClick={() => addQuestion(question)} className={selectedIds.has(question.id) ? 'bg-[#E7ECEB] text-[#6B7980]' : 'bg-[#0E5A5A] text-white hover:bg-[#0A4747]'}>{selectedIds.has(question.id) ? 'Added' : 'Add'}</Button></div></div>)}{filteredQuestions.length === 0 && <div className="py-10 text-center text-sm text-[#6B7980]">No approved questions match the filters.</div>}</div></CardContent></Card>

              <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-4"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-[#14232B]">Selected Questions</h3><p className="text-xs text-[#6B7980]">{selected.length} questions · {totalMarks} total marks</p></div><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{sections.length} sections</Badge></div><div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">{selected.map((item, index) => <div key={item.question_id} className="rounded-xl border border-[#E7ECEB] p-3"><div className="flex items-start gap-2"><div className="flex flex-col gap-1"><Button variant="ghost" size="icon" disabled={index === 0} onClick={() => moveSelected(index, -1)} className="h-6 w-6"><ChevronUp className="h-3 w-3" /></Button><Button variant="ghost" size="icon" disabled={index === selected.length - 1} onClick={() => moveSelected(index, 1)} className="h-6 w-6"><ChevronDown className="h-3 w-3" /></Button></div><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium text-[#14232B]">{index + 1}. {item.question.stem_text}</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><Select value={item.section_client_id} onValueChange={(value) => updateSelected(item.question_id, { section_client_id: value })}><SelectTrigger className="h-8 border-[#E7ECEB] text-xs"><SelectValue /></SelectTrigger><SelectContent>{sections.map((section) => <SelectItem key={section.client_id} value={section.client_id}>{section.title}</SelectItem>)}</SelectContent></Select><Input type="number" step="0.25" value={item.marks} onChange={(event) => updateSelected(item.question_id, { marks: Number(event.target.value) })} className="h-8 border-[#E7ECEB] text-xs" title="Marks" /><Input type="number" step="0.25" min="0" value={item.negative_marks} onChange={(event) => updateSelected(item.question_id, { negative_marks: Number(event.target.value) })} className="h-8 border-[#E7ECEB] text-xs" title="Negative marks" /></div></div><Button variant="ghost" size="icon" onClick={() => removeSelected(item.question_id)} className="h-8 w-8 text-[#B54747] hover:bg-[#B54747]/10"><Trash2 className="h-4 w-4" /></Button></div></div>)}{selected.length === 0 && <div className="py-12 text-center text-sm text-[#6B7980]">Add approved questions from the question bank.</div>}</div></CardContent></Card>
            </div>
          </div>}

          <DialogFooter className="border-t border-[#E7ECEB] px-6 py-4"><div className="mr-auto text-sm text-[#6B7980]">{selected.length} questions · {totalMarks} marks · {builder.duration} minutes</div><Button variant="outline" onClick={() => setBuilderOpen(false)} className="border-[#E7ECEB]">Cancel</Button><Button variant="outline" onClick={() => void savePaper('draft')} disabled={saving || builderLoading} className="border-[#0E5A5A] text-[#0E5A5A]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft</Button><Button onClick={() => void savePaper('published')} disabled={saving || builderLoading} className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]"><CheckCircle2 className="mr-2 h-4 w-4" />Save and Publish</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
