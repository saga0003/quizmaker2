'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookCopy,
  CheckCircle2,
  Copy,
  FilePlus2,
  FolderOpen,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import { useQuestionScope } from '@/components/questions/useQuestionScope';
import { useAppStore } from '@/store/use-app-store';
import type {
  QuestionCollectionDetail,
  QuestionCollectionListPayload,
  QuestionCollectionStatus,
  QuestionCollectionSummary,
  QuestionCollectionVisibility,
} from '@/types/question-collections';
import type {
  QuestionDifficulty,
  QuestionRow,
  QuestionType,
  TaxonomyChapter,
  TaxonomySubject,
  TaxonomyTopic,
} from '@/types/questions';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';

const difficultyLabels: Record<QuestionDifficulty, string> = {
  very_easy: 'Very easy',
  easy: 'Easy',
  moderate: 'Moderate',
  difficult: 'Difficult',
  very_difficult: 'Very difficult',
};

const typeLabels: Record<QuestionType, string> = {
  single_correct: 'Single-correct MCQ',
  multiple_correct: 'Multiple-correct MCQ',
  numerical: 'Numerical value',
  integer: 'Integer answer',
  assertion_reason: 'Assertion and reason',
  match_following: 'Match the following',
  passage: 'Passage based',
  image_based: 'Image based',
};

const difficulties = Object.keys(difficultyLabels) as QuestionDifficulty[];
const questionTypes = Object.keys(typeLabels) as QuestionType[];

type Builder = {
  id: string | null;
  name: string;
  description: string;
  exam: string;
  classLevel: string;
  subjectId: string;
  chapterIds: string[];
  topicIds: string[];
  difficulties: QuestionDifficulty[];
  questionTypes: QuestionType[];
  visibility: QuestionCollectionVisibility;
  status: QuestionCollectionStatus;
  selectedIds: string[];
};

const emptyBuilder = (kind: 'admin' | 'school'): Builder => ({
  id: null,
  name: '',
  description: '',
  exam: '',
  classLevel: '',
  subjectId: 'all',
  chapterIds: [],
  topicIds: [],
  difficulties: [],
  questionTypes: [],
  visibility: kind === 'admin' ? 'private' : 'school',
  status: 'draft',
  selectedIds: [],
});

function shortDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toggle<T>(values: T[], value: T) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function QuestionCollectionsManager({ kind }: { kind: 'admin' | 'school' }) {
  const { configured, profile } = useAuth();
  const role = normalizeEvidaraRole(profile?.role);
  const { organizationId, organizationName, loading: scopeLoading, error: scopeError } = useQuestionScope(kind);
  const setView = useAppStore((state) => state.setView);
  const [collections, setCollections] = useState<QuestionCollectionSummary[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [chapters, setChapters] = useState<TaxonomyChapter[]>([]);
  const [topics, setTopics] = useState<TaxonomyTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [builder, setBuilder] = useState<Builder>(() => emptyBuilder(kind));
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionSubject, setQuestionSubject] = useState('all');
  const [questionChapter, setQuestionChapter] = useState('all');
  const [questionTopic, setQuestionTopic] = useState('all');
  const [questionDifficulty, setQuestionDifficulty] = useState('all');
  const [questionType, setQuestionType] = useState('all');
  const [deleteTarget, setDeleteTarget] = useState<QuestionCollectionSummary | null>(null);

  const platformAdmin = role === 'super_admin' || role === 'evidara_admin';

  const load = useCallback(async () => {
    if (!supabase || !configured) {
      setError('Supabase is not configured. Question Collections are live-data only.');
      setLoading(false);
      return;
    }
    if (kind === 'school' && scopeLoading) return;
    if (kind === 'school' && !organizationId) {
      setError(scopeError || 'This account is not linked to a school.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [collectionResult, questionResult, subjectResult, chapterResult, topicResult] = await Promise.all([
      supabase.rpc('list_question_collections_v13', { p_organization_id: kind === 'school' ? organizationId : null }),
      supabase
        .from('questions')
        .select('*,subjects(name,code),chapters(name),topics(name),question_options(option_key,content_text,content_latex,image_url,is_correct,display_order)')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(5000),
      supabase.from('subjects').select('id,name,code,organization_id').eq('is_active', true).order('name'),
      supabase.from('chapters').select('id,name,subject_id,organization_id').eq('is_active', true).order('name'),
      supabase.from('topics').select('id,name,chapter_id,organization_id').eq('is_active', true).order('name'),
    ]);
    const loadError = collectionResult.error || questionResult.error || subjectResult.error || chapterResult.error || topicResult.error;
    if (loadError) {
      setError(loadError.message.includes('list_question_collections_v13') ? 'Apply migrations 39 and 39a, then refresh.' : loadError.message);
    } else {
      const payload = collectionResult.data as QuestionCollectionListPayload;
      setCollections(payload?.collections || []);
      const allQuestions = (questionResult.data || []) as unknown as QuestionRow[];
      setQuestions(allQuestions.filter((question) => kind === 'admin'
        ? question.organization_id === null
        : question.organization_id === null || question.organization_id === organizationId));
      setSubjects((subjectResult.data || []) as TaxonomySubject[]);
      setChapters((chapterResult.data || []) as TaxonomyChapter[]);
      setTopics((topicResult.data || []) as TaxonomyTopic[]);
    }
    setLoading(false);
  }, [configured, kind, organizationId, scopeError, scopeLoading]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setQuestionChapter('all'); setQuestionTopic('all'); }, [questionSubject]);
  useEffect(() => { setQuestionTopic('all'); }, [questionChapter]);

  const filteredCollections = useMemo(() => collections.filter((collection) => {
    const term = search.trim().toLowerCase();
    if (term && !`${collection.name} ${collection.description || ''} ${(collection.subjects || []).join(' ')} ${(collection.exam_types || []).join(' ')}`.toLowerCase().includes(term)) return false;
    if (statusFilter !== 'all' && collection.status !== statusFilter) return false;
    if (visibilityFilter !== 'all' && collection.visibility !== visibilityFilter) return false;
    return true;
  }), [collections, search, statusFilter, visibilityFilter]);

  const chapterOptions = useMemo(() => chapters.filter((chapter) => questionSubject === 'all' || chapter.subject_id === questionSubject), [chapters, questionSubject]);
  const topicOptions = useMemo(() => topics.filter((topic) => questionChapter === 'all' || topic.chapter_id === questionChapter), [questionChapter, topics]);
  const builderChapters = useMemo(() => chapters.filter((chapter) => builder.subjectId === 'all' || chapter.subject_id === builder.subjectId), [builder.subjectId, chapters]);
  const builderTopics = useMemo(() => topics.filter((topic) => !builder.chapterIds.length || builder.chapterIds.includes(topic.chapter_id)), [builder.chapterIds, topics]);

  const filteredQuestions = useMemo(() => questions.filter((question) => {
    const term = questionSearch.trim().toLowerCase();
    const haystack = `${question.stem_text} ${question.subjects?.name || ''} ${question.chapters?.name || ''} ${question.topics?.name || ''} ${(question.tags || []).join(' ')}`.toLowerCase();
    if (term && !haystack.includes(term)) return false;
    if (questionSubject !== 'all' && question.subject_id !== questionSubject) return false;
    if (questionChapter !== 'all' && question.chapter_id !== questionChapter) return false;
    if (questionTopic !== 'all' && question.topic_id !== questionTopic) return false;
    if (questionDifficulty !== 'all' && question.difficulty !== questionDifficulty) return false;
    if (questionType !== 'all' && question.question_type !== questionType) return false;
    return true;
  }), [questionChapter, questionDifficulty, questionSearch, questionSubject, questionTopic, questionType, questions]);

  const selectedQuestions = builder.selectedIds.map((id) => questions.find((question) => question.id === id)).filter(Boolean) as QuestionRow[];
  const selectedTotalMarks = selectedQuestions.reduce((sum, question) => sum + Number(question.marks || 0), 0);

  function openCreate() {
    setBuilder(emptyBuilder(kind));
    setQuestionSearch('');
    setQuestionSubject('all');
    setQuestionChapter('all');
    setQuestionTopic('all');
    setQuestionDifficulty('all');
    setQuestionType('all');
    setDialogOpen(true);
  }

  async function openEdit(collection: QuestionCollectionSummary) {
    if (!supabase) return;
    setSaving(true);
    setError('');
    const { data, error: detailError } = await supabase.rpc('get_question_collection_v13', { p_collection_id: collection.id });
    setSaving(false);
    if (detailError) {
      setError(detailError.message);
      return;
    }
    const detail = data as QuestionCollectionDetail;
    setBuilder({
      id: detail.id,
      name: detail.name,
      description: detail.description || '',
      exam: detail.exam_types?.[0] || '',
      classLevel: detail.class_levels?.[0] || '',
      subjectId: detail.subject_id || 'all',
      chapterIds: detail.chapter_ids || [],
      topicIds: detail.topic_ids || [],
      difficulties: detail.difficulties || [],
      questionTypes: detail.question_types || [],
      visibility: detail.visibility,
      status: detail.status,
      selectedIds: (detail.items || []).sort((a, b) => a.display_order - b.display_order).map((item) => item.question_id),
    });
    setDialogOpen(true);
  }

  function addQuestion(questionId: string) {
    setBuilder((current) => current.selectedIds.includes(questionId) ? current : { ...current, selectedIds: [...current.selectedIds, questionId] });
  }

  function removeQuestion(questionId: string) {
    setBuilder((current) => ({ ...current, selectedIds: current.selectedIds.filter((id) => id !== questionId) }));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= builder.selectedIds.length) return;
    const next = [...builder.selectedIds];
    [next[index], next[target]] = [next[target], next[index]];
    setBuilder((current) => ({ ...current, selectedIds: next }));
  }

  async function saveCollection() {
    if (!supabase) return;
    if (builder.name.trim().length < 3) {
      setError('Enter a complete collection name.');
      return;
    }
    if (!builder.selectedIds.length) {
      setError('Select at least one approved question.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('save_question_collection_v13', {
      p_collection_id: builder.id,
      p_organization_id: builder.visibility === 'platform' ? null : kind === 'school' ? organizationId : null,
      p_payload: {
        name: builder.name.trim(),
        description: builder.description.trim(),
        exam_types: builder.exam ? [builder.exam] : [],
        class_levels: builder.classLevel ? [builder.classLevel] : [],
        subject_id: builder.subjectId === 'all' ? '' : builder.subjectId,
        chapter_ids: builder.chapterIds,
        topic_ids: builder.topicIds,
        difficulties: builder.difficulties,
        question_types: builder.questionTypes,
        visibility: builder.visibility,
        status: builder.status,
        metadata: { editor: 'question-collections-v13' },
      },
      p_question_ids: builder.selectedIds,
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setDialogOpen(false);
    setMessage(builder.id ? 'Question Collection updated.' : 'Question Collection created.');
    await load();
  }

  async function cloneCollection(collection: QuestionCollectionSummary) {
    if (!supabase) return;
    setSaving(true);
    const { error: cloneError } = await supabase.rpc('clone_question_collection_v13', { p_collection_id: collection.id, p_name: `${collection.name} Copy` });
    setSaving(false);
    if (cloneError) setError(cloneError.message); else { setMessage('Collection cloned as a private draft.'); await load(); }
  }

  async function archiveCollection(collection: QuestionCollectionSummary) {
    if (!supabase) return;
    setSaving(true);
    const { error: archiveError } = await supabase.rpc('archive_question_collection_v13', { p_collection_id: collection.id });
    setSaving(false);
    if (archiveError) setError(archiveError.message); else { setMessage('Collection archived.'); await load(); }
  }

  async function deleteCollection() {
    if (!supabase || !deleteTarget) return;
    setSaving(true);
    const { error: deleteError } = await supabase.rpc('delete_question_collection_v13', { p_collection_id: deleteTarget.id });
    setSaving(false);
    if (deleteError) setError(deleteError.message); else { setMessage('Collection deleted.'); setDeleteTarget(null); await load(); }
  }

  async function createPaper(collection: QuestionCollectionSummary) {
    if (!supabase) return;
    setSaving(true);
    setError('');
    const { data, error: paperError } = await supabase.rpc('create_paper_from_question_collection_v13', {
      p_collection_id: collection.id,
      p_title: `${collection.name} Paper`,
      p_duration_minutes: Math.max(15, Math.ceil(collection.question_count * 1.5)),
    });
    setSaving(false);
    if (paperError) {
      setError(paperError.message);
      return;
    }
    const paperId = String(data);
    window.history.replaceState({}, '', `${window.location.pathname}?id=${encodeURIComponent(paperId)}`);
    setView(kind === 'admin' ? 'admin-papers' : 'school-papers');
  }

  const stats = [
    { label: 'Collections', value: collections.length, icon: FolderOpen },
    { label: 'Active', value: collections.filter((collection) => collection.status === 'active').length, icon: CheckCircle2 },
    { label: 'Questions grouped', value: collections.reduce((sum, collection) => sum + collection.question_count, 0), icon: BookCopy },
    { label: 'Linked papers', value: collections.filter((collection) => collection.linked_paper_id).length, icon: FilePlus2 },
  ];

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#006B70]">Reusable question groups</div>
        <h1 className="mt-2 text-2xl font-bold text-[#071D34]">Question Collections</h1>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#536579]">Create named, ordered groups from approved questions and reuse them across papers, products and practice workflows without duplicating the question records.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        <Button onClick={openCreate} className="bg-[#006B70] text-white hover:bg-[#00575C]"><Plus className="mr-2 h-4 w-4" />Create collection</Button>
      </div>
    </div>

    {error && <div className="rounded-xl border border-[#DC4545]/20 bg-[#FFF0EF] p-4 text-sm text-[#B54747]">{error}</div>}
    {message && <div className="rounded-xl border border-[#178353]/20 bg-[#EAF7EF] p-4 text-sm text-[#176C48]">{message}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => <Card key={label} className="border-[#DFE6EC] shadow-[0_10px_30px_rgba(5,31,50,.045)]"><CardContent className="flex items-center gap-4 p-5"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#EAF6F4] text-[#006B70]"><Icon className="h-5 w-5" /></div><div><strong className="text-2xl text-[#071D34]">{value}</strong><p className="text-xs text-[#536579]">{label}</p></div></CardContent></Card>)}
    </section>

    <Card className="border-[#DFE6EC] shadow-none"><CardContent className="p-4"><div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_180px_180px]">
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-[#8998A8]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search collections, subjects or exams" className="pl-9" /></div>
      <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select>
      <Select value={visibilityFilter} onValueChange={setVisibilityFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All visibility</SelectItem><SelectItem value="private">Private</SelectItem><SelectItem value="school">School</SelectItem><SelectItem value="platform">Platform</SelectItem></SelectContent></Select>
    </div></CardContent></Card>

    {loading ? <div className="grid min-h-[300px] place-items-center text-sm text-[#536579]"><div><LoaderCircle className="mx-auto mb-3 h-7 w-7 animate-spin" />Loading Question Collections…</div></div> : !filteredCollections.length ? <Card className="border-dashed border-[#C6D1D9] shadow-none"><CardContent className="grid min-h-[280px] place-items-center text-center"><div><FolderOpen className="mx-auto mb-4 h-10 w-10 text-[#89AAAA]" /><h2 className="font-semibold text-[#071D34]">No Question Collections yet</h2><p className="mt-2 text-sm text-[#536579]">Create the first reusable question group from the approved Question Bank.</p><Button className="mt-5 bg-[#006B70] text-white" onClick={openCreate}>Create collection</Button></div></CardContent></Card> : <div className="grid gap-4 xl:grid-cols-2">
      {filteredCollections.map((collection) => <Card key={collection.id} className="border-[#DFE6EC] shadow-[0_10px_30px_rgba(5,31,50,.045)]"><CardContent className="p-5">
        <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-[#071D34]">{collection.name}</h2><Badge variant="outline">{collection.status}</Badge><Badge variant="outline">{collection.visibility}</Badge></div><p className="mt-2 line-clamp-2 text-sm leading-6 text-[#536579]">{collection.description || 'No description added.'}</p></div><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#EAF6F4] text-[#006B70]"><BookCopy className="h-5 w-5" /></div></div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Questions',collection.question_count],['Marks',collection.total_marks],['Subjects',collection.subjects?.length || 0],['Updated',shortDate(collection.updated_at)]].map(([label,value]) => <div key={String(label)} className="rounded-xl border border-[#E8EDF1] bg-[#FBFCFD] p-3"><span className="text-[10px] font-semibold uppercase tracking-wide text-[#8998A8]">{label}</span><strong className="mt-1 block text-sm text-[#071D34]">{value}</strong></div>)}</div>
        <div className="mt-4 flex flex-wrap gap-2">{(collection.subjects || []).map((subject) => <Badge key={subject} className="bg-[#EAF6F4] text-[#006B70]">{subject}</Badge>)}{(collection.exam_types || []).map((exam) => <Badge key={exam} variant="outline">{exam}</Badge>)}</div>
        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#E8EDF1] pt-4">
          <Button size="sm" variant="outline" onClick={() => void openEdit(collection)} disabled={!collection.can_manage}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
          <Button size="sm" variant="outline" onClick={() => void cloneCollection(collection)}><Copy className="mr-2 h-3.5 w-3.5" />Clone</Button>
          <Button size="sm" onClick={() => void createPaper(collection)} disabled={!collection.can_manage || saving} className="bg-[#006B70] text-white hover:bg-[#00575C]"><FilePlus2 className="mr-2 h-3.5 w-3.5" />Create draft paper</Button>
          {collection.can_manage && collection.status !== 'archived' && <Button size="sm" variant="ghost" onClick={() => void archiveCollection(collection)}><Archive className="mr-2 h-3.5 w-3.5" />Archive</Button>}
          {collection.can_manage && <Button size="sm" variant="ghost" className="text-[#B54747]" onClick={() => setDeleteTarget(collection)}><Trash2 className="mr-2 h-3.5 w-3.5" />Delete</Button>}
        </div>
      </CardContent></Card>)}
    </div>}

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-h-[94vh] max-w-[1180px] overflow-y-auto">
        <DialogHeader><DialogTitle>{builder.id ? 'Edit Question Collection' : 'Create Question Collection'}</DialogTitle><DialogDescription>Define the reusable group, filter the live Question Bank and arrange the selected questions.</DialogDescription></DialogHeader>
        <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4 rounded-2xl border border-[#DFE6EC] bg-[#FBFCFD] p-4">
            <div><Label>Name</Label><Input className="mt-2" value={builder.name} onChange={(event) => setBuilder((current) => ({ ...current, name: event.target.value }))} placeholder="NEET Physics — Mechanics Revision Pool" /></div>
            <div><Label>Description</Label><Textarea className="mt-2 min-h-24" value={builder.description} onChange={(event) => setBuilder((current) => ({ ...current, description: event.target.value }))} placeholder="Explain when and how this collection should be reused." /></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Exam</Label><Input className="mt-2" value={builder.exam} onChange={(event) => setBuilder((current) => ({ ...current, exam: event.target.value }))} placeholder="NEET" /></div><div><Label>Grade</Label><Input className="mt-2" value={builder.classLevel} onChange={(event) => setBuilder((current) => ({ ...current, classLevel: event.target.value }))} placeholder="Grade 11" /></div></div>
            <div><Label>Primary subject</Label><Select value={builder.subjectId} onValueChange={(value) => setBuilder((current) => ({ ...current, subjectId: value, chapterIds: [], topicIds: [] }))}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Multiple subjects</SelectItem>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Chapters</Label><div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-xl border border-[#DFE6EC] bg-white p-3">{builderChapters.length ? builderChapters.map((chapter) => <label key={chapter.id} className="flex items-center gap-2 text-xs text-[#354A5E]"><Checkbox checked={builder.chapterIds.includes(chapter.id)} onCheckedChange={() => setBuilder((current) => ({ ...current, chapterIds: toggle(current.chapterIds, chapter.id), topicIds: current.topicIds.filter((id) => topics.some((topic) => topic.id === id && topic.chapter_id !== chapter.id)) }))} />{chapter.name}</label>) : <span className="text-xs text-[#8998A8]">Select a subject or keep multiple subjects.</span>}</div></div>
            <div><Label>Topics</Label><div className="mt-2 max-h-36 space-y-2 overflow-y-auto rounded-xl border border-[#DFE6EC] bg-white p-3">{builderTopics.length ? builderTopics.map((topic) => <label key={topic.id} className="flex items-center gap-2 text-xs text-[#354A5E]"><Checkbox checked={builder.topicIds.includes(topic.id)} onCheckedChange={() => setBuilder((current) => ({ ...current, topicIds: toggle(current.topicIds, topic.id) }))} />{topic.name}</label>) : <span className="text-xs text-[#8998A8]">Select one or more chapters to narrow topics.</span>}</div></div>
            <div><Label>Difficulty coverage</Label><div className="mt-2 grid grid-cols-2 gap-2">{difficulties.map((difficulty) => <label key={difficulty} className="flex items-center gap-2 text-xs"><Checkbox checked={builder.difficulties.includes(difficulty)} onCheckedChange={() => setBuilder((current) => ({ ...current, difficulties: toggle(current.difficulties, difficulty) }))} />{difficultyLabels[difficulty]}</label>)}</div></div>
            <div><Label>Question types</Label><div className="mt-2 space-y-2">{questionTypes.map((type) => <label key={type} className="flex items-center gap-2 text-xs"><Checkbox checked={builder.questionTypes.includes(type)} onCheckedChange={() => setBuilder((current) => ({ ...current, questionTypes: toggle(current.questionTypes, type) }))} />{typeLabels[type]}</label>)}</div></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>Visibility</Label><Select value={builder.visibility} onValueChange={(value) => setBuilder((current) => ({ ...current, visibility: value as QuestionCollectionVisibility }))}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="private">Private</SelectItem>{kind === 'school' && <SelectItem value="school">School</SelectItem>}{platformAdmin && <SelectItem value="platform">Platform</SelectItem>}</SelectContent></Select></div><div><Label>Status</Label><Select value={builder.status} onValueChange={(value) => setBuilder((current) => ({ ...current, status: value as QuestionCollectionStatus }))}><SelectTrigger className="mt-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div></div>
          </div>

          <div className="min-w-0 space-y-4">
            <Card className="border-[#DFE6EC] shadow-none"><CardContent className="p-4"><div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6"><div className="relative md:col-span-3 xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-[#8998A8]" /><Input value={questionSearch} onChange={(event) => setQuestionSearch(event.target.value)} className="pl-9" placeholder="Search questions" /></div><Select value={questionSubject} onValueChange={setQuestionSubject}><SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem>{subjects.map((subject) => <SelectItem key={subject.id} value={subject.id}>{subject.name}</SelectItem>)}</SelectContent></Select><Select value={questionChapter} onValueChange={setQuestionChapter}><SelectTrigger><SelectValue placeholder="Chapter" /></SelectTrigger><SelectContent><SelectItem value="all">All chapters</SelectItem>{chapterOptions.map((chapter) => <SelectItem key={chapter.id} value={chapter.id}>{chapter.name}</SelectItem>)}</SelectContent></Select><Select value={questionTopic} onValueChange={setQuestionTopic}><SelectTrigger><SelectValue placeholder="Topic" /></SelectTrigger><SelectContent><SelectItem value="all">All topics</SelectItem>{topicOptions.map((topic) => <SelectItem key={topic.id} value={topic.id}>{topic.name}</SelectItem>)}</SelectContent></Select><Select value={questionDifficulty} onValueChange={setQuestionDifficulty}><SelectTrigger><SelectValue placeholder="Difficulty" /></SelectTrigger><SelectContent><SelectItem value="all">All difficulty</SelectItem>{difficulties.map((difficulty) => <SelectItem key={difficulty} value={difficulty}>{difficultyLabels[difficulty]}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>

            <div className="grid min-h-[520px] gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-[#DFE6EC]"><div className="flex items-center justify-between border-b border-[#DFE6EC] bg-[#FBFCFD] px-4 py-3"><div><strong className="text-sm text-[#071D34]">Question Bank</strong><p className="text-xs text-[#8998A8]">{filteredQuestions.length} approved matches</p></div><Select value={questionType} onValueChange={setQuestionType}><SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All question types</SelectItem>{questionTypes.map((type) => <SelectItem key={type} value={type}>{typeLabels[type]}</SelectItem>)}</SelectContent></Select></div><div className="max-h-[570px] overflow-y-auto p-3">{filteredQuestions.map((question) => <button key={question.id} type="button" onClick={() => addQuestion(question.id)} disabled={builder.selectedIds.includes(question.id)} className="mb-2 w-full rounded-xl border border-[#E8EDF1] bg-white p-3 text-left transition hover:border-[#82B8B4] hover:bg-[#F5FBFA] disabled:opacity-45"><div className="flex items-start justify-between gap-3"><p className="line-clamp-3 text-xs leading-5 text-[#173047]">{question.stem_text || 'Question'}</p><Plus className="h-4 w-4 shrink-0 text-[#006B70]" /></div><div className="mt-2 flex flex-wrap gap-1"><Badge variant="outline">{question.subjects?.name || 'Unassigned'}</Badge><Badge variant="outline">{difficultyLabels[question.difficulty]}</Badge><Badge variant="outline">{question.marks} marks</Badge></div></button>)}</div></div>

              <div className="overflow-hidden rounded-2xl border border-[#B7CECB] bg-[#F5FBFA]"><div className="flex items-center justify-between border-b border-[#CFE0DE] px-4 py-3"><div><strong className="text-sm text-[#071D34]">Selected questions</strong><p className="text-xs text-[#536579]">{selectedQuestions.length} questions · {selectedTotalMarks} marks</p></div><Button size="sm" variant="outline" onClick={() => setBuilder((current) => ({ ...current, selectedIds: [] }))} disabled={!selectedQuestions.length}>Clear</Button></div><div className="max-h-[570px] overflow-y-auto p-3">{selectedQuestions.length ? selectedQuestions.map((question, index) => <div key={question.id} className="mb-2 rounded-xl border border-[#CFE0DE] bg-white p-3"><div className="flex items-start gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#EAF6F4] text-xs font-bold text-[#006B70]">{index + 1}</span><p className="min-w-0 flex-1 line-clamp-3 text-xs leading-5 text-[#173047]">{question.stem_text}</p><div className="flex shrink-0"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQuestion(index, -1)} disabled={index === 0}><ArrowUp className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => moveQuestion(index, 1)} disabled={index === selectedQuestions.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-[#B54747]" onClick={() => removeQuestion(question.id)}><X className="h-3.5 w-3.5" /></Button></div></div><div className="mt-2 ml-9 flex flex-wrap gap-1"><Badge variant="outline">{question.subjects?.name || 'General'}</Badge><Badge variant="outline">{question.chapters?.name || 'No chapter'}</Badge><Badge variant="outline">{question.topics?.name || 'No topic'}</Badge></div></div>) : <div className="grid min-h-[420px] place-items-center text-center text-sm text-[#536579]"><div><BookCopy className="mx-auto mb-3 h-9 w-9 text-[#89AAAA]" />Select questions from the live bank.<br />They will remain linked to their original records.</div></div>}</div></div>
            </div>
          </div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => void saveCollection()} disabled={saving} className="bg-[#006B70] text-white hover:bg-[#00575C]">{saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Save collection</Button></DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}><DialogContent><DialogHeader><DialogTitle>Delete Question Collection?</DialogTitle><DialogDescription>This deletes only the collection and its links. The original questions and any paper already created from it remain untouched.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button onClick={() => void deleteCollection()} className="bg-[#B54747] text-white hover:bg-[#963B3B]" disabled={saving}>{saving && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Delete collection</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
