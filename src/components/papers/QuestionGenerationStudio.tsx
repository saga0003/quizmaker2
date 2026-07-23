"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  FileQuestion,
  LoaderCircle,
  Lock,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Unlock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuestionScope } from "@/components/questions/useQuestionScope";
import { PaperGenerationPanel } from "@/components/papers/PaperGenerationPanel";
import { PaperGenerationHistory } from "@/components/papers/PaperGenerationHistory";
import type { TaxonomyChapter, TaxonomySubject, TaxonomyTopic } from "@/types/questions";

type PaperOption = {
  id: string;
  title: string;
  code: string | null;
  programme_code: string | null;
  workflow_status: string | null;
  creation_mode: string | null;
  total_questions: number;
  total_marks: number;
  updated_at: string;
};

type SectionRow = {
  id: string;
  title: string;
  code: string | null;
  subject_id: string | null;
  selection_mode: "manual" | "automatic" | "hybrid";
  display_order: number;
};

type BankQuestion = {
  id: string;
  external_question_id: string | null;
  stem_text: string;
  question_image_url: string | null;
  subject_id: string | null;
  subject_name: string | null;
  chapter_id: string | null;
  chapter_name: string | null;
  topic_id: string | null;
  topic_name: string | null;
  difficulty: string;
  question_type: string;
  marks: number;
  negative_marks: number;
  estimated_seconds: number | null;
  language: string;
  usage_count: number;
  total_count: number;
};

type PaperQuestion = {
  id: string;
  question_id: string;
  section_id: string;
  display_order: number;
  marks: number;
  negative_marks: number;
  is_locked: boolean;
  generation_source: string;
  blueprint_rule_id: string | null;
  question_snapshot: {
    stem_text?: string;
    subject_name?: string;
    chapter_name?: string;
    topic_name?: string;
    difficulty?: string;
    question_type?: string;
  } | null;
};

type Availability = {
  total_approved: number;
  unused: number;
  previously_used: number;
  by_difficulty: Record<string, number>;
  by_question_type: Record<string, number>;
  status: string;
};

const pageSize = 25;
const readable = (value: string | null | undefined) =>
  value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Any";

export function QuestionGenerationStudio({ kind }: { kind: "admin" | "school" }) {
  const { organizationId, organizationName, loading: scopeLoading, error: scopeError } = useQuestionScope(kind);
  const base = kind === "admin" ? "/admin/papers" : "/school/papers";

  const [papers, setPapers] = useState<PaperOption[]>([]);
  const [paperId, setPaperId] = useState("");
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [destinationSection, setDestinationSection] = useState("");
  const [paperQuestions, setPaperQuestions] = useState<PaperQuestion[]>([]);
  const [subjects, setSubjects] = useState<TaxonomySubject[]>([]);
  const [chapters, setChapters] = useState<TaxonomyChapter[]>([]);
  const [topics, setTopics] = useState<TaxonomyTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [paperLoading, setPaperLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"manual" | "blueprint" | "history">("manual");

  const [bankRows, setBankRows] = useState<BankQuestion[]>([]);
  const [bankCache, setBankCache] = useState<Map<string, BankQuestion>>(new Map());
  const [bankSelection, setBankSelection] = useState<Set<string>>(new Set());
  const [bankLoading, setBankLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [subjectId, setSubjectId] = useState("all");
  const [chapterId, setChapterId] = useState("all");
  const [topicId, setTopicId] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [questionType, setQuestionType] = useState("all");
  const [usageRule, setUsageRule] = useState<"allow" | "prefer_unused" | "only_unused">("prefer_unused");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [adding, setAdding] = useState(false);
  const [lockingId, setLockingId] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState("");
  const [historySeed, setHistorySeed] = useState("");

  const selectedPaper = useMemo(() => papers.find((paper) => paper.id === paperId) || null, [paperId, papers]);
  const existingQuestionIds = useMemo(() => new Set(paperQuestions.map((question) => question.question_id)), [paperQuestions]);
  const filteredChapters = useMemo(
    () => (subjectId === "all" ? chapters : chapters.filter((chapter) => chapter.subject_id === subjectId)),
    [chapters, subjectId],
  );
  const filteredTopics = useMemo(
    () => (chapterId === "all" ? topics : topics.filter((topic) => topic.chapter_id === chapterId)),
    [chapterId, topics],
  );
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadWorkspace = useCallback(async () => {
    if (!supabase) {
      setError("Connect a V8 Supabase test project to use the Question Bank & Generation Studio.");
      setLoading(false);
      return;
    }
    if (kind === "school" && scopeLoading) return;
    if (kind === "school" && !organizationId) {
      setError("School workspace not found.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    let paperQuery = supabase
      .from("question_papers")
      .select("id,title,code,programme_code,workflow_status,creation_mode,total_questions,total_marks,updated_at")
      .is("deleted_at", null)
      .in("workflow_status", ["draft", "changes_requested"])
      .order("updated_at", { ascending: false });
    paperQuery = kind === "admin" ? paperQuery.is("organization_id", null) : paperQuery.eq("organization_id", organizationId!);

    const [paperResult, subjectResult, chapterResult, topicResult] = await Promise.all([
      paperQuery,
      supabase.from("subjects").select("id,name,code").order("name"),
      supabase.from("chapters").select("id,name,subject_id").order("name"),
      supabase.from("topics").select("id,name,chapter_id").order("name"),
    ]);
    const loadError = paperResult.error || subjectResult.error || chapterResult.error || topicResult.error;
    if (loadError) {
      setError(loadError.message);
    } else {
      const loadedPapers = (paperResult.data || []) as PaperOption[];
      setPapers(loadedPapers);
      setSubjects((subjectResult.data || []) as TaxonomySubject[]);
      setChapters((chapterResult.data || []) as TaxonomyChapter[]);
      setTopics((topicResult.data || []) as TaxonomyTopic[]);
      if (!paperId && loadedPapers[0]) setPaperId(loadedPapers[0].id);
    }
    setLoading(false);
  }, [kind, organizationId, paperId, scopeLoading]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const loadPaper = useCallback(async () => {
    if (!supabase || !paperId) {
      setSections([]);
      setPaperQuestions([]);
      return;
    }
    setPaperLoading(true);
    setError("");
    const [sectionResult, questionResult] = await Promise.all([
      supabase.from("paper_sections").select("id,title,code,subject_id,selection_mode,display_order").eq("paper_id", paperId).order("display_order"),
      supabase.from("paper_questions").select("id,question_id,section_id,display_order,marks,negative_marks,is_locked,generation_source,blueprint_rule_id,question_snapshot").eq("paper_id", paperId).order("display_order"),
    ]);
    if (sectionResult.error || questionResult.error) {
      setError(sectionResult.error?.message || questionResult.error?.message || "Unable to load paper.");
    } else {
      const loadedSections = (sectionResult.data || []) as SectionRow[];
      setSections(loadedSections);
      setPaperQuestions((questionResult.data || []) as PaperQuestion[]);
      if (!loadedSections.some((section) => section.id === destinationSection)) setDestinationSection(loadedSections[0]?.id || "");
    }
    setPaperLoading(false);
  }, [destinationSection, paperId]);

  useEffect(() => {
    void loadPaper();
  }, [loadPaper]);

  useEffect(() => {
    setBankSelection(new Set());
    setBankCache(new Map());
    setPage(1);
    setNotice("");
  }, [paperId]);

  const loadBank = useCallback(async () => {
    if (!supabase || !paperId || !selectedPaper) {
      setBankRows([]);
      setTotal(0);
      return;
    }
    setBankLoading(true);
    setError("");
    const result = await supabase.rpc("search_eligible_questions_v8", {
      p_organization_id: kind === "admin" ? null : organizationId,
      p_programme_code: selectedPaper.programme_code || null,
      p_subject_id: subjectId === "all" ? null : subjectId,
      p_chapter_id: chapterId === "all" ? null : chapterId,
      p_topic_id: topicId === "all" ? null : topicId,
      p_difficulty: difficulty === "all" ? null : difficulty,
      p_question_type: questionType === "all" ? null : questionType,
      p_language: null,
      p_search: debouncedSearch || null,
      p_usage_rule: usageRule,
      p_excluded_ids: Array.from(existingQuestionIds),
      p_page: page,
      p_page_size: pageSize,
    });
    if (result.error) {
      setError(result.error.message);
      setBankRows([]);
      setTotal(0);
    } else {
      const rows = (result.data || []) as BankQuestion[];
      setBankRows(rows);
      setBankCache((current) => {
        const next = new Map(current);
        rows.forEach((question) => next.set(question.id, question));
        return next;
      });
      setTotal(rows.length ? Number(rows[0].total_count || rows.length) : 0);
    }
    setBankLoading(false);
  }, [chapterId, debouncedSearch, difficulty, existingQuestionIds, kind, organizationId, page, paperId, questionType, selectedPaper, subjectId, topicId, usageRule]);

  useEffect(() => {
    void loadBank();
  }, [loadBank]);

  useEffect(() => {
    if (!supabase || !paperId || !selectedPaper) return;
    const timer = window.setTimeout(async () => {
      const result = await supabase.rpc("paper_question_availability_v8", {
        p_organization_id: kind === "admin" ? null : organizationId,
        p_programme_code: selectedPaper.programme_code || null,
        p_subject_id: subjectId === "all" ? null : subjectId,
        p_chapter_id: chapterId === "all" ? null : chapterId,
        p_topic_id: topicId === "all" ? null : topicId,
        p_difficulty: difficulty === "all" ? null : difficulty,
        p_question_type: questionType === "all" ? null : questionType,
        p_excluded_ids: Array.from(existingQuestionIds),
      });
      if (result.data) setAvailability(result.data as Availability);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [chapterId, difficulty, existingQuestionIds, kind, organizationId, paperId, questionType, selectedPaper, subjectId, topicId]);

  async function addSelected() {
    if (!supabase || !paperId || !destinationSection) {
      setError("Select a paper and destination section first.");
      return;
    }
    const ids = Array.from(bankSelection).filter((id) => bankCache.has(id) && !existingQuestionIds.has(id));
    if (ids.length === 0) {
      setError("Select at least one available question across the current pages.");
      return;
    }
    setAdding(true);
    setError("");
    setNotice("");
    const result = await supabase.rpc("append_questions_to_paper_v8", {
      p_paper_id: paperId,
      p_section_id: destinationSection,
      p_question_ids: ids,
    });
    setAdding(false);
    if (result.error) {
      setError(result.error.message.includes("append_questions_to_paper_v8") ? "Apply migration 37 before adding questions from this studio." : result.error.message);
      return;
    }
    const summary = result.data as { added_count: number; skipped_count: number };
    setBankSelection(new Set());
    setNotice(`${summary.added_count} approved question${summary.added_count === 1 ? "" : "s"} added. ${summary.skipped_count || 0} duplicate or unavailable selection${summary.skipped_count === 1 ? "" : "s"} skipped.`);
    await loadPaper();
    await loadBank();
  }

  async function toggleLock(item: PaperQuestion) {
    if (!supabase) return;
    setLockingId(item.id);
    setError("");
    const result = await supabase.rpc("set_paper_question_lock_v8", {
      p_paper_question_id: item.id,
      p_locked: !item.is_locked,
    });
    setLockingId("");
    if (result.error) {
      setError(result.error.message.includes("set_paper_question_lock_v8") ? "Apply migration 37 before changing hybrid locks." : result.error.message);
      return;
    }
    setPaperQuestions((current) => current.map((question) => (question.id === item.id ? { ...question, is_locked: !item.is_locked } : question)));
    setNotice(!item.is_locked ? "Question locked. Hybrid regeneration will preserve it." : "Question unlocked. It may be replaced during regeneration.");
  }

  function toggleVisible(checked: boolean) {
    setBankSelection((current) => {
      const next = new Set(current);
      bankRows.forEach((question) => {
        if (checked) next.add(question.id);
        else next.delete(question.id);
      });
      return next;
    });
  }

  if (loading) {
    return <div className="grid min-h-72 place-items-center text-[#6B7980]"><LoaderCircle className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="paper-generation-workspace space-y-4">
      <header className="paper-workspace-card flex flex-col gap-5 rounded-2xl border bg-white p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Link href={`${base}/`} className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-[#6B7980] hover:text-[#0E5A5A]"><ArrowLeft size={15} />Papers</Link>
          <span className="mt-2 block text-[10px] font-bold uppercase tracking-[0.18em] text-[#0E5A5A]">{organizationName} · Generation workspace</span>
          <h1 className="paper-page-title mt-1 text-2xl font-bold sm:text-3xl">Question Bank & Generation Studio</h1>
          <p className="paper-page-copy mt-1 max-w-3xl text-sm">Import approved questions into a Draft, preserve compulsory hybrid questions, build exact blueprints and reuse generation seeds.</p>
        </div>
        {selectedPaper && (
          <div className="grid grid-cols-2 gap-2">
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DCE9E7] bg-white px-4 text-sm font-semibold text-[#0E5A5A]" href={`${base}/new/?id=${selectedPaper.id}`}><Pencil size={15} />Edit</Link>
            <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DCE9E7] bg-[#EDF6F4] px-4 text-sm font-semibold text-[#0E5A5A]" href={`${base}/preview/?id=${selectedPaper.id}`}><FileQuestion size={15} />Preview</Link>
          </div>
        )}
      </header>

      {(scopeError || error) && <div className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{scopeError || error}</div>}
      {notice && <div className="rounded-xl bg-[#ECFDF3] px-4 py-3 text-sm font-semibold text-[#137A3A]">{notice}</div>}

      <section className="paper-workspace-card grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <label className="grid gap-1 text-xs font-semibold text-[#475467]">
          Editable draft paper
          <select className="rm-input" value={paperId} onChange={(event) => setPaperId(event.target.value)}>
            <option value="">Select a paper</option>
            {papers.map((paper) => <option key={paper.id} value={paper.id}>{paper.title} · {paper.code || "No code"} · {paper.programme_code || "Custom"}</option>)}
          </select>
        </label>
        {selectedPaper && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-[#F7F9F7] p-2.5"><strong className="block text-lg">{paperQuestions.length}</strong><span className="text-[9px] text-[#6B7980]">Questions</span></div>
            <div className="rounded-lg bg-[#FFF8E6] p-2.5 text-[#8A5F00]"><strong className="block text-lg">{paperQuestions.filter((question) => question.is_locked).length}</strong><span className="text-[9px]">Locked</span></div>
            <div className="rounded-lg bg-[#EDF6F4] p-2.5 text-[#0E5A5A]"><strong className="block text-lg">{sections.length}</strong><span className="text-[9px]">Sections</span></div>
          </div>
        )}
      </section>

      {papers.length === 0 ? (
        <div className="paper-workspace-card rounded-xl border border-dashed bg-white p-10 text-center sm:p-12">
          <FileQuestion className="mx-auto h-9 w-9 text-[#98A2B3]" />
          <h2 className="mt-3 font-semibold">No editable Draft paper found</h2>
          <p className="mt-1 text-sm text-[#6B7980]">Create a paper or create a new Draft version before opening the Generation Studio.</p>
          <Link href={`${base}/new/`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0E5A5A] px-4 text-sm font-semibold text-white"><Plus size={16} />Create paper</Link>
        </div>
      ) : (
        <>
          <nav className="paper-scroll-region flex gap-2 overflow-x-auto rounded-xl border border-[#E7ECEB] bg-white p-2" aria-label="Generation Studio sections">
            {(["manual", "blueprint", "history"] as const).map((value) => (
              <button
                key={value}
                className={`min-h-11 min-w-max rounded-lg px-4 text-sm font-semibold ${tab === value ? "bg-[#0E5A5A] text-white" : "text-[#6B7980] hover:bg-[#F7F9F7]"}`}
                onClick={() => setTab(value)}
              >
                {value === "manual" ? "Manual Question Bank" : value === "blueprint" ? "Blueprint & Generate" : "Generation History"}
              </button>
            ))}
          </nav>

          {tab === "manual" && (
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className="paper-workspace-card min-w-0 rounded-xl border bg-white p-3 sm:p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div><span className="rm-label">Approved Question Bank</span><h2 className="mt-1 text-xl font-bold">Select across pages</h2><p className="text-xs leading-relaxed text-[#6B7980]">Selections stay cached while you browse. Questions already in the paper are excluded server-side.</p></div>
                  <label className="grid min-w-0 gap-1 text-xs font-semibold lg:min-w-56">Add to section<select className="rm-input" value={destinationSection} onChange={(event) => setDestinationSection(event.target.value)}>{sections.map((section) => <option key={section.id} value={section.id}>{section.title} · {readable(section.selection_mode)}</option>)}</select></label>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="relative sm:col-span-2 lg:col-span-3"><Search className="absolute left-3 top-3.5 h-4 w-4 text-[#98A2B3]" /><input className="rm-input w-full pl-9" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Question text, ID, chapter or topic" /></div>
                  <select className="rm-input" value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setChapterId("all"); setTopicId("all"); setPage(1); }}><option value="all">All subjects</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
                  <select className="rm-input" value={chapterId} onChange={(event) => { setChapterId(event.target.value); setTopicId("all"); setPage(1); }}><option value="all">All chapters</option>{filteredChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select>
                  <select className="rm-input" value={topicId} onChange={(event) => { setTopicId(event.target.value); setPage(1); }}><option value="all">All topics</option>{filteredTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select>
                  <select className="rm-input" value={difficulty} onChange={(event) => { setDifficulty(event.target.value); setPage(1); }}><option value="all">All difficulties</option>{["very_easy", "easy", "moderate", "difficult", "very_difficult"].map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select>
                  <select className="rm-input" value={questionType} onChange={(event) => { setQuestionType(event.target.value); setPage(1); }}><option value="all">All question types</option>{["single_correct", "multiple_correct", "numerical", "integer", "assertion_reason", "match_following", "passage", "image_based"].map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select>
                  <select className="rm-input" value={usageRule} onChange={(event) => { setUsageRule(event.target.value as typeof usageRule); setPage(1); }}><option value="allow">Allow reused</option><option value="prefer_unused">Prefer unused</option><option value="only_unused">Only unused</option></select>
                </div>

                <div className="mt-3 flex flex-col gap-3 border-y border-[#E7ECEB] py-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex min-h-10 items-center gap-2 font-semibold"><input type="checkbox" checked={bankRows.length > 0 && bankRows.every((question) => bankSelection.has(question.id))} onChange={(event) => toggleVisible(event.target.checked)} />Select visible page</label>
                  <span className="text-[#6B7980]">{bankSelection.size} selected across pages</span>
                  <button className="rm-btn-primary w-full justify-center sm:w-auto" disabled={adding || bankSelection.size === 0 || !destinationSection} onClick={() => void addSelected()}>{adding ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />}Add selected</button>
                </div>

                {bankLoading ? (
                  <div className="grid min-h-56 place-items-center"><LoaderCircle className="h-5 w-5 animate-spin" /></div>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {bankRows.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-[#D0D5DD] p-10 text-center text-sm text-[#6B7980]">No approved questions match these filters.</div>
                    ) : (
                      bankRows.map((question) => {
                        const checked = bankSelection.has(question.id);
                        return (
                          <article key={question.id} className={`grid grid-cols-[24px_minmax(0,1fr)] gap-3 rounded-xl border p-3 ${checked ? "border-[#0E5A5A] bg-[#F4FAF8]" : "border-[#E7ECEB]"}`}>
                            <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => setBankSelection((current) => { const next = new Set(current); if (event.target.checked) next.add(question.id); else next.delete(question.id); return next; })} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap gap-1">{[question.subject_name, question.chapter_name, question.topic_name, readable(question.difficulty), readable(question.question_type)].filter(Boolean).map((value) => <span key={String(value)} className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[9px] text-[#667085]">{value}</span>)}</div>
                              <strong className="mt-2 block text-sm leading-relaxed">{question.stem_text}</strong>
                              {question.question_image_url && <img src={question.question_image_url} alt="Question illustration" className="mt-3 max-h-56 max-w-full rounded-lg object-contain" />}
                              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-[#6B7980]"><span>ID {question.external_question_id || question.id.slice(0, 8)}</span><span>+{question.marks} / −{question.negative_marks}</span><span>Used {question.usage_count}×</span>{question.estimated_seconds && <span>{question.estimated_seconds}s expected</span>}</div>
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 items-center gap-2 text-xs text-[#6B7980]">
                  <span className="col-span-2 text-center">Page {page} of {pageCount} · {total} available</span>
                  <button className="rm-btn-secondary justify-center" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} />Previous</button>
                  <button className="rm-btn-secondary justify-center" disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next<ChevronRight size={15} /></button>
                </div>
              </section>

              <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
                <section className="paper-workspace-card rounded-xl border bg-white p-4">
                  <span className="rm-label">Current availability</span>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-[#F7F9F7] p-2.5"><strong className="block text-lg">{availability?.total_approved ?? total}</strong><span className="text-[9px] text-[#6B7980]">Approved</span></div>
                    <div className="rounded-lg bg-[#ECFDF3] p-2.5 text-[#137A3A]"><strong className="block text-lg">{availability?.unused ?? 0}</strong><span className="text-[9px]">Unused</span></div>
                    <div className="rounded-lg bg-[#FFF8E6] p-2.5 text-[#8A5F00]"><strong className="block text-lg">{availability?.previously_used ?? 0}</strong><span className="text-[9px]">Used</span></div>
                  </div>
                </section>
                <section className="paper-workspace-card rounded-xl border bg-white p-4">
                  <span className="rm-label">Paper questions & hybrid locks</span>
                  <div className="paper-scroll-region mt-3 max-h-[620px] space-y-2 overflow-auto pr-1">
                    {paperLoading ? <LoaderCircle className="animate-spin" /> : paperQuestions.length === 0 ? <p className="text-xs text-[#6B7980]">No questions added yet.</p> : paperQuestions.map((item, index) => (
                      <article key={item.id} className="rounded-lg border border-[#E7ECEB] p-2.5">
                        <div className="flex items-start justify-between gap-2"><strong className="text-xs leading-relaxed">Q{index + 1}. {item.question_snapshot?.stem_text || "Question"}</strong><button title={item.is_locked ? "Unlock" : "Lock for hybrid generation"} aria-label={item.is_locked ? `Unlock question ${index + 1}` : `Lock question ${index + 1}`} disabled={lockingId === item.id} className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg ${item.is_locked ? "bg-[#FFF2CC] text-[#8A5F00]" : "bg-[#F2F4F7] text-[#667085]"}`} onClick={() => void toggleLock(item)}>{lockingId === item.id ? <LoaderCircle className="animate-spin" size={14} /> : item.is_locked ? <Lock size={14} /> : <Unlock size={14} />}</button></div>
                        <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-[#6B7980]"><span>{readable(item.generation_source)}</span><span>+{item.marks}/−{item.negative_marks}</span>{item.is_locked && <span className="font-bold text-[#8A5F00]">Locked</span>}</div>
                      </article>
                    ))}
                  </div>
                </section>
              </aside>
            </div>
          )}

          {tab === "blueprint" && selectedPaper && (
            <section className="paper-workspace-card rounded-xl border bg-white p-3 sm:p-4">
              <PaperGenerationPanel paperId={paperId} organizationId={kind === "admin" ? null : organizationId} programmeCode={selectedPaper.programme_code || ""} subjects={subjects} chapters={chapters} topics={topics} onGenerated={() => { setHistoryRefresh(crypto.randomUUID()); void loadPaper(); }} />
              {historySeed && <div className="mt-3 rounded-lg bg-[#EDF6F4] p-3 text-xs text-[#0E5A5A]"><Sparkles size={14} className="mr-1 inline" />History seed selected: <code className="break-all">{historySeed}</code>. Paste it into the reproducible seed field above.</div>}
            </section>
          )}

          {tab === "history" && <PaperGenerationHistory paperId={paperId || null} refreshKey={historyRefresh} onReuseSeed={(seed) => { setHistorySeed(seed); setTab("blueprint"); navigator.clipboard.writeText(seed).catch(() => undefined); setNotice(`Seed ${seed} copied. Paste it into the blueprint seed field to reproduce the eligible ordering.`); }} />}
        </>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-[#DCE9E7] bg-[#EDF6F4] px-3 py-3 text-xs leading-relaxed text-[#587077]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0E5A5A]" /><p>This studio builds paper definitions from approved Question Bank content. It never publishes products, grants student access or starts an examination.</p></div>
    </div>
  );
}
