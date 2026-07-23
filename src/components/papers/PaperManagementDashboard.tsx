"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileClock,
  FilePlus2,
  FileText,
  Filter,
  LoaderCircle,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  Undo2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useQuestionScope } from "@/components/questions/useQuestionScope";
import { PaperTemplatePanel } from "@/components/papers/PaperTemplatePanel";
import type { PaperCopyScope, PaperDuplicateResult, PaperListRow, PaperWorkflowStatus } from "@/types/papers";

type ManagedPaper = PaperListRow & {
  deleted_at?: string | null;
  deletion_reason?: string | null;
  published_at?: string | null;
  change_summary?: string | null;
};

type Action = "archive" | "restore" | "delete" | "restore_deleted";

const demo: ManagedPaper[] = [
  {
    id: "demo-paper",
    organization_id: null,
    title: "Foundation Grade 8 Diagnostic Test",
    code: "FND8-DIAG-001",
    description: "Responsive V8 paper workspace sample",
    exam_type: "Foundation Grade 8",
    paper_type: "diagnostic_test",
    programme_code: "FND8",
    workflow_status: "draft",
    creation_mode: "hybrid",
    version_number: 1,
    status: "draft",
    duration_minutes: 90,
    total_marks: 100,
    total_questions: 50,
    access_mode: "public",
    available_from: null,
    available_until: null,
    attempt_limit: 1,
    result_mode: "score_only",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
  },
];

const workflowLabels: Record<PaperWorkflowStatus, string> = {
  draft: "Draft",
  submitted_for_review: "Submitted for review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published definition",
  paused: "Paused",
  closed: "Closed",
  archived: "Archived",
};

const typeLabels: Record<string, string> = {
  full_length_mock: "Full-length mock",
  subject_test: "Subject test",
  chapter_test: "Chapter test",
  topic_test: "Topic test",
  unit_test: "Unit test",
  diagnostic_test: "Diagnostic test",
  scholarship_test: "Scholarship test",
  previous_year_paper: "Previous-year paper",
  practice_test: "Practice test",
  foundation_test: "Foundation test",
  school_test: "School test",
  custom_test: "Custom test",
};

function paperStatus(paper: ManagedPaper): PaperWorkflowStatus {
  if (paper.workflow_status) return paper.workflow_status;
  if (paper.status === "published") return "published";
  if (paper.status === "archived") return "archived";
  return "draft";
}

function statusClass(status: PaperWorkflowStatus) {
  if (["published", "approved"].includes(status)) return "bg-[#ECFDF3] text-[#137A3A]";
  if (status === "changes_requested") return "bg-[#FEF3F2] text-[#B42318]";
  if (status === "submitted_for_review") return "bg-[#EEF4FF] text-[#3538CD]";
  if (status === "draft") return "bg-[#FFF8E6] text-[#8A5F00]";
  return "bg-[#F2F4F7] text-[#667085]";
}

function friendly(message: string) {
  if (message.includes("Create a new version")) return "This definition has published history. Create a new draft version instead.";
  if (message.includes("cannot be deleted")) return "This paper is protected by review or publication history. Archive it instead.";
  if (message.toLowerCase().includes("permission")) return "Your role does not have permission for this paper-management action.";
  return message;
}

function formatUpdated(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function PaperManagementDashboard({ kind }: { kind: "admin" | "school" }) {
  const { organizationId, organizationName, loading: scopeLoading, error: scopeError } = useQuestionScope(kind);
  const base = kind === "admin" ? "/admin/papers" : "/school/papers";
  const [papers, setPapers] = useState<ManagedPaper[]>([]);
  const [loading, setLoading] = useState(true);
  const [v8Ready, setV8Ready] = useState(true);
  const [phase2Ready, setPhase2Ready] = useState(true);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [programme, setProgramme] = useState("all");
  const [mode, setMode] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedPaperId, setExpandedPaperId] = useState("");
  const [duplicatePaper, setDuplicatePaper] = useState<ManagedPaper | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [copyScope, setCopyScope] = useState<PaperCopyScope>("entire");
  const [versionPaper, setVersionPaper] = useState<ManagedPaper | null>(null);
  const [versionSummary, setVersionSummary] = useState("");
  const [action, setAction] = useState<{ paper: ManagedPaper; type: Action } | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setPapers(demo);
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
    const baseColumns = "id,organization_id,title,code,description,exam_type,paper_type,programme_code,workflow_status,creation_mode,version_number,status,duration_minutes,total_marks,total_questions,access_mode,available_from,available_until,attempt_limit,result_mode,created_at,updated_at,published_at,change_summary";
    let query = supabase.from("question_papers").select(`${baseColumns},deleted_at,deletion_reason`).order("updated_at", { ascending: false });
    query = kind === "admin" ? query.is("organization_id", null) : query.eq("organization_id", organizationId!);
    if (!includeDeleted) query = query.is("deleted_at", null);
    const phase2 = await query;

    if (!phase2.error) {
      setV8Ready(true);
      setPhase2Ready(true);
      setPapers((phase2.data || []) as unknown as ManagedPaper[]);
      setLoading(false);
      return;
    }

    let v8Query = supabase.from("question_papers").select(baseColumns).order("updated_at", { ascending: false });
    v8Query = kind === "admin" ? v8Query.is("organization_id", null) : v8Query.eq("organization_id", organizationId!);
    const v8 = await v8Query;
    if (!v8.error) {
      setV8Ready(true);
      setPhase2Ready(false);
      setPapers((v8.data || []) as unknown as ManagedPaper[]);
      setLoading(false);
      return;
    }

    const legacyColumns = "id,organization_id,title,code,description,exam_type,status,duration_minutes,total_marks,total_questions,access_mode,available_from,available_until,attempt_limit,result_mode,created_at,updated_at";
    let legacyQuery = supabase.from("question_papers").select(legacyColumns).order("updated_at", { ascending: false });
    legacyQuery = kind === "admin" ? legacyQuery.is("organization_id", null) : legacyQuery.eq("organization_id", organizationId!);
    const legacy = await legacyQuery;
    if (legacy.error) setError(friendly(legacy.error.message));
    else {
      setV8Ready(false);
      setPhase2Ready(false);
      setPapers((legacy.data || []) as unknown as ManagedPaper[]);
    }
    setLoading(false);
  }, [includeDeleted, kind, organizationId, scopeLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  const clear = () => {
    setError("");
    setNotice("");
  };

  async function duplicate() {
    if (!supabase || !duplicatePaper) return;
    if (!v8Ready) {
      setError("Apply migration 32 before duplicating papers.");
      return;
    }
    if (duplicateTitle.trim().length < 3) {
      setError("Enter a draft name of at least three characters.");
      return;
    }
    setBusy("duplicate");
    clear();
    const result = await supabase.rpc("duplicate_question_paper_v8", {
      p_source_paper_id: duplicatePaper.id,
      p_copy_scope: copyScope,
      p_new_title: duplicateTitle.trim(),
    });
    setBusy("");
    if (result.error) {
      setError(friendly(result.error.message));
      return;
    }
    const copy = result.data as PaperDuplicateResult;
    setDuplicatePaper(null);
    setNotice(`${copy.title} was created as Draft with code ${copy.code}. Nothing was published.`);
    await load();
  }

  async function createVersion() {
    if (!supabase || !versionPaper) return;
    setBusy("version");
    clear();
    const result = await supabase.rpc("create_paper_version_v8", {
      p_source_paper_id: versionPaper.id,
      p_change_summary: versionSummary.trim() || "New editable paper version",
    });
    setBusy("");
    if (result.error) {
      setError(friendly(result.error.message));
      return;
    }
    const created = result.data as { paper_id: string };
    window.location.assign(`${base}/new/?id=${created.paper_id}`);
  }

  async function confirmAction() {
    if (!supabase || !action) return;
    if (!phase2Ready) {
      setError("Apply migration 36 before using archive, restore or recoverable deletion.");
      return;
    }
    setBusy("action");
    clear();
    let result;
    if (action.type === "archive" || action.type === "restore") {
      result = await supabase.rpc("manage_paper_status_v8", {
        p_paper_id: action.paper.id,
        p_next_status: action.type === "archive" ? "archived" : "draft",
        p_reason: reason.trim() || null,
      });
    } else if (action.type === "delete") {
      result = await supabase.rpc("soft_delete_paper_definition_v8", {
        p_paper_id: action.paper.id,
        p_reason: reason.trim() || null,
      });
    } else {
      result = await supabase.rpc("restore_deleted_paper_definition_v8", {
        p_paper_id: action.paper.id,
        p_reason: reason.trim() || null,
      });
    }
    setBusy("");
    if (result.error) {
      setError(friendly(result.error.message));
      return;
    }
    const messages: Record<Action, string> = {
      archive: "Paper archived with history intact.",
      restore: "Paper restored to Draft.",
      delete: "Paper moved to recoverable deleted records.",
      restore_deleted: "Deleted paper restored as Draft.",
    };
    setAction(null);
    setNotice(messages[action.type]);
    await load();
  }

  const programmes = useMemo(
    () => Array.from(new Set(papers.map((paper) => paper.programme_code || paper.exam_type))).sort(),
    [papers],
  );

  const filtered = useMemo(
    () =>
      papers.filter((paper) => {
        const hay = `${paper.title} ${paper.code || ""} ${paper.description || ""}`.toLowerCase();
        return (
          (!search || hay.includes(search.toLowerCase())) &&
          (status === "all" || paperStatus(paper) === status) &&
          (programme === "all" || (paper.programme_code || paper.exam_type) === programme) &&
          (mode === "all" || (paper.creation_mode || "manual") === mode)
        );
      }),
    [mode, papers, programme, search, status],
  );

  const active = papers.filter((paper) => !paper.deleted_at);
  const stats = [
    { label: "Active", value: active.length, icon: FileText, iconClass: "bg-[#EDF6F4] text-[#0E5A5A]" },
    { label: "Published", value: active.filter((paper) => paperStatus(paper) === "published").length, icon: CheckCircle2, iconClass: "bg-[#ECFDF3] text-[#137A3A]" },
    { label: "Drafts", value: active.filter((paper) => paperStatus(paper) === "draft").length, icon: FileClock, iconClass: "bg-[#FFF8E6] text-[#8A5F00]" },
    { label: "Archived", value: active.filter((paper) => paperStatus(paper) === "archived").length, icon: Archive, iconClass: "bg-[#F2F4F7] text-[#667085]" },
  ];

  function openDuplicate(paper: ManagedPaper) {
    clear();
    setDuplicatePaper(paper);
    setDuplicateTitle(`${paper.title} Copy`);
    setCopyScope("entire");
  }

  function openVersion(paper: ManagedPaper) {
    clear();
    setVersionPaper(paper);
    setVersionSummary("");
  }

  function openAction(paper: ManagedPaper, type: Action) {
    clear();
    setReason("");
    setAction({ paper, type });
  }

  return (
    <div className="space-y-4">
      {!v8Ready && <div className="rounded-xl border border-[#F2B84B]/45 bg-[#FFF9E8] px-4 py-3 text-sm font-semibold text-[#7A5200]">Apply migrations 32–35 to activate V8 paper workflows.</div>}
      {v8Ready && !phase2Ready && <div className="rounded-xl border border-[#F2B84B]/45 bg-[#FFF9E8] px-4 py-3 text-sm font-semibold text-[#7A5200]">Apply migration 36 to activate archive, restore and recoverable deletion.</div>}
      {(scopeError || error) && <div className="rounded-xl bg-[#FEF3F2] px-4 py-3 text-sm font-semibold text-[#B42318]">{scopeError || error}</div>}
      {notice && <div className="rounded-xl bg-[#ECFDF3] px-4 py-3 text-sm font-semibold text-[#137A3A]">{notice}</div>}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, iconClass }) => (
          <article key={label} className="paper-workspace-card flex min-h-24 items-center gap-3 rounded-xl border bg-white p-4">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${iconClass}`}><Icon size={18} /></span>
            <div><strong className="block text-2xl text-[#14232B]">{value}</strong><span className="text-xs text-[#6B7980]">{label}</span></div>
          </article>
        ))}
      </section>

      <section className="paper-workspace-card rounded-xl border bg-white p-3 sm:p-4">
        <button
          type="button"
          className="flex min-h-11 w-full items-center justify-between gap-3 text-left md:hidden"
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#14232B]"><Filter size={16} className="text-[#0E5A5A]" />Filters and search</span>
          {filtersOpen ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        <div className={`${filtersOpen ? "grid" : "hidden"} gap-2 pt-3 md:grid md:grid-cols-2 md:pt-0 xl:grid-cols-[minmax(260px,1fr)_180px_180px_190px]`}>
          <div className="relative md:col-span-2 xl:col-span-1">
            <Search className="absolute left-3 top-3.5 h-4 w-4 text-[#98A2B3]" />
            <input className="rm-input w-full pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search paper name, code or description" />
          </div>
          <select className="rm-input" value={programme} onChange={(event) => setProgramme(event.target.value)}>
            <option value="all">All programmes</option>
            {programmes.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select className="rm-input" value={mode} onChange={(event) => setMode(event.target.value)}>
            <option value="all">All creation modes</option>
            <option value="manual">Manual</option>
            <option value="automatic">Automatic</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <select className="rm-input" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All workflow statuses</option>
            {Object.entries(workflowLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-[#475467] md:col-span-2 xl:col-span-4">
            <input type="checkbox" checked={includeDeleted} disabled={!phase2Ready} onChange={(event) => setIncludeDeleted(event.target.checked)} />
            Include recoverable deleted papers
          </label>
        </div>
      </section>

      <PaperTemplatePanel paperId={null} kind={kind} organizationId={kind === "admin" ? null : organizationId} base={base} />

      <section className="paper-workspace-card overflow-hidden rounded-xl border bg-white">
        {loading ? (
          <div className="grid min-h-56 place-items-center text-[#6B7980]"><LoaderCircle className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="grid min-h-64 place-items-center px-6 text-center">
            <div><FileText className="mx-auto h-9 w-9 text-[#B8C3C6]" /><h2 className="mt-3 font-semibold text-[#14232B]">No paper definitions found</h2><p className="mt-1 text-sm text-[#6B7980]">Change the filters or create your first paper.</p><Link href={`${base}/new/`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0E5A5A] px-4 text-sm font-semibold text-white"><FilePlus2 size={16} />Create paper</Link></div>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto xl:block">
              <table className="rm-table min-w-[1120px]">
                <thead><tr><th>Paper</th><th>Programme</th><th>Mode</th><th>Questions</th><th>Marks</th><th>Duration</th><th>Workflow</th><th>Updated</th><th>Actions</th></tr></thead>
                <tbody>
                  {filtered.map((paper) => {
                    const workflow = paperStatus(paper);
                    const deleted = Boolean(paper.deleted_at);
                    const published = Boolean(paper.published_at) || workflow === "published";
                    const editable = !deleted && ["draft", "changes_requested"].includes(workflow);
                    const deletable = !deleted && !published && ["draft", "changes_requested", "paused", "closed", "archived"].includes(workflow);
                    return (
                      <tr key={paper.id} className={deleted ? "bg-[#FEF8F7] opacity-80" : ""}>
                        <td><strong>{paper.title}</strong>{deleted && <span className="ml-2 rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[9px] font-bold text-[#B42318]">DELETED</span>}<div className="mt-1 text-[11px] text-[#98A2B3]">{paper.code || "Code generated on save"} · V{paper.version_number || 1}</div></td>
                        <td>{paper.programme_code || paper.exam_type}</td>
                        <td className="capitalize">{paper.creation_mode || "manual"}</td>
                        <td>{paper.total_questions}</td>
                        <td>{paper.total_marks}</td>
                        <td>{paper.duration_minutes} min</td>
                        <td><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass(workflow)}`}>{workflowLabels[workflow]}</span></td>
                        <td className="text-xs">{formatUpdated(paper.updated_at)}</td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            {deleted ? (
                              <button title="Restore deleted paper" className="paper-action text-[#137A3A]" onClick={() => openAction(paper, "restore_deleted")}><Undo2 size={15} /></button>
                            ) : (
                              <>
                                {editable && <Link title="Edit draft" className="paper-action text-[#0E5A5A]" href={`${base}/new/?id=${paper.id}`}><Pencil size={15} /></Link>}
                                <Link title="Preview" className="paper-action text-[#2E6D8B]" href={`${base}/preview/?id=${paper.id}`}><Eye size={15} /></Link>
                                <button title="Duplicate as draft" className="paper-action text-[#0E5A5A]" onClick={() => openDuplicate(paper)}><Copy size={15} /></button>
                                <button title="Create draft version" className="paper-action text-[#6941C6]" onClick={() => openVersion(paper)}><FileClock size={15} /></button>
                                {workflow === "archived" && !published ? <button title="Restore archive to Draft" className="paper-action text-[#137A3A]" onClick={() => openAction(paper, "restore")}><ArchiveRestore size={15} /></button> : workflow !== "archived" ? <button title="Archive" className="paper-action text-[#8A5F00]" onClick={() => openAction(paper, "archive")}><Archive size={15} /></button> : null}
                                {deletable && <button title="Recoverable delete" className="paper-action text-[#B42318]" onClick={() => openAction(paper, "delete")}><Trash2 size={15} /></button>}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 p-3 sm:p-4 xl:hidden">
              {filtered.map((paper) => {
                const workflow = paperStatus(paper);
                const deleted = Boolean(paper.deleted_at);
                const published = Boolean(paper.published_at) || workflow === "published";
                const editable = !deleted && ["draft", "changes_requested"].includes(workflow);
                const deletable = !deleted && !published && ["draft", "changes_requested", "paused", "closed", "archived"].includes(workflow);
                const expanded = expandedPaperId === paper.id;
                return (
                  <article key={paper.id} className={`rounded-xl border p-4 ${deleted ? "border-[#F4C7C1] bg-[#FEF8F7]" : "border-[#E7ECEB] bg-white"}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-bold text-[#14232B]">{paper.title}</h2>{deleted && <span className="rounded-full bg-[#FEF3F2] px-2 py-0.5 text-[9px] font-bold text-[#B42318]">DELETED</span>}</div>
                        <p className="mt-1 text-[11px] text-[#98A2B3]">{paper.code || "Code generated on save"} · V{paper.version_number || 1}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold ${statusClass(workflow)}`}>{workflowLabels[workflow]}</span>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                      <div className="rounded-lg bg-[#F7F9F7] p-2.5"><span className="block text-[9px] uppercase tracking-wide text-[#98A2B3]">Programme</span><strong className="mt-1 block truncate text-[#344054]">{paper.programme_code || paper.exam_type}</strong></div>
                      <div className="rounded-lg bg-[#F7F9F7] p-2.5"><span className="block text-[9px] uppercase tracking-wide text-[#98A2B3]">Mode</span><strong className="mt-1 block capitalize text-[#344054]">{paper.creation_mode || "manual"}</strong></div>
                      <div className="rounded-lg bg-[#F7F9F7] p-2.5"><span className="block text-[9px] uppercase tracking-wide text-[#98A2B3]">Questions</span><strong className="mt-1 block text-[#344054]">{paper.total_questions}</strong></div>
                      <div className="rounded-lg bg-[#F7F9F7] p-2.5"><span className="block text-[9px] uppercase tracking-wide text-[#98A2B3]">Marks / time</span><strong className="mt-1 block text-[#344054]">{paper.total_marks} · {paper.duration_minutes}m</strong></div>
                    </div>

                    <p className="mt-3 text-[11px] text-[#6B7980]">Updated {formatUpdated(paper.updated_at)}</p>

                    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {deleted ? (
                        <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#A6D8C8] bg-[#ECFDF3] px-3 text-xs font-semibold text-[#137A3A]" onClick={() => openAction(paper, "restore_deleted")}><Undo2 size={15} />Restore Draft</button>
                      ) : (
                        <>
                          {editable && <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#0E5A5A] px-3 text-xs font-semibold text-white" href={`${base}/new/?id=${paper.id}`}><Pencil size={15} />Edit</Link>}
                          <Link className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#DCE9E7] bg-[#EDF6F4] px-3 text-xs font-semibold text-[#0E5A5A]" href={`${base}/preview/?id=${paper.id}`}><Eye size={15} />Preview</Link>
                          <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#E7ECEB] bg-white px-3 text-xs font-semibold text-[#475467]" onClick={() => openDuplicate(paper)}><Copy size={15} />Duplicate</button>
                        </>
                      )}
                    </div>

                    {!deleted && (
                      <>
                        <button type="button" className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold text-[#6B7980] hover:bg-[#F7F9F7]" onClick={() => setExpandedPaperId(expanded ? "" : paper.id)} aria-expanded={expanded}>{expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}{expanded ? "Hide more actions" : "More actions"}</button>
                        {expanded && (
                          <div className="grid grid-cols-1 gap-2 border-t border-[#E7ECEB] pt-3 sm:grid-cols-3">
                            <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#E7ECEB] px-3 text-xs font-semibold text-[#6941C6]" onClick={() => openVersion(paper)}><FileClock size={15} />New version</button>
                            {workflow === "archived" && !published ? <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#A6D8C8] px-3 text-xs font-semibold text-[#137A3A]" onClick={() => openAction(paper, "restore")}><ArchiveRestore size={15} />Restore</button> : workflow !== "archived" ? <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#F2D18A] px-3 text-xs font-semibold text-[#8A5F00]" onClick={() => openAction(paper, "archive")}><Archive size={15} />Archive</button> : null}
                            {deletable && <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#F4C7C1] px-3 text-xs font-semibold text-[#B42318]" onClick={() => openAction(paper, "delete")}><Trash2 size={15} />Delete</button>}
                          </div>
                        )}
                      </>
                    )}
                  </article>
                );
              })}
            </div>
          </>
        )}
      </section>

      <div className="flex items-start gap-2 rounded-xl border border-[#DCE9E7] bg-[#EDF6F4] px-3 py-3 text-xs leading-relaxed text-[#587077]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#0E5A5A]" /><p>Duplicates and new versions always begin as Draft. Deleted papers remain recoverable and auditable.</p></div>

      {duplicatePaper && (
        <div className="paper-modal" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDuplicatePaper(null); }}>
          <div className="paper-modal-card" role="dialog" aria-modal="true" aria-labelledby="duplicate-paper-title">
            <h2 id="duplicate-paper-title">Duplicate as new draft</h2>
            <p>The copy receives a fresh code and never inherits publication or student access.</p>
            <label>Draft name<input className="rm-input" value={duplicateTitle} onChange={(event) => setDuplicateTitle(event.target.value)} /></label>
            <label>Copy scope<select className="rm-input" value={copyScope} onChange={(event) => setCopyScope(event.target.value as PaperCopyScope)}><option value="entire">Entire paper</option><option value="settings">Settings only</option><option value="sections">Settings and sections</option><option value="blueprint">Settings, sections and blueprint</option><option value="questions">Settings, sections and questions</option></select></label>
            <div className="paper-modal-actions"><button onClick={() => setDuplicatePaper(null)}>Cancel</button><button className="primary" disabled={busy === "duplicate"} onClick={() => void duplicate()}>{busy === "duplicate" ? "Creating…" : "Create draft copy"}</button></div>
          </div>
        </div>
      )}

      {versionPaper && (
        <div className="paper-modal" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setVersionPaper(null); }}>
          <div className="paper-modal-card" role="dialog" aria-modal="true" aria-labelledby="version-paper-title">
            <h2 id="version-paper-title">Create editable draft version</h2>
            <p>Published history is preserved. The new version opens as Draft.</p>
            <label>Change summary<input className="rm-input" value={versionSummary} onChange={(event) => setVersionSummary(event.target.value)} placeholder="What will change?" /></label>
            <div className="paper-modal-actions"><button onClick={() => setVersionPaper(null)}>Cancel</button><button className="primary purple" disabled={busy === "version"} onClick={() => void createVersion()}>{busy === "version" ? "Creating…" : "Create version"}</button></div>
          </div>
        </div>
      )}

      {action && (
        <div className="paper-modal" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setAction(null); }}>
          <div className="paper-modal-card" role="dialog" aria-modal="true" aria-labelledby="paper-action-title">
            <h2 id="paper-action-title">{action.type === "archive" ? "Archive paper" : action.type === "restore" ? "Restore paper to Draft" : action.type === "delete" ? "Move to deleted records" : "Restore deleted paper"}</h2>
            <p>{action.type === "delete" ? "This is recoverable soft deletion. Published and review-active papers are protected." : "The action is recorded in paper audit history."}</p>
            <label>Reason or note<input className="rm-input" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Optional audit note" /></label>
            <div className="paper-modal-actions"><button onClick={() => setAction(null)}>Cancel</button><button className={action.type === "delete" ? "danger" : "primary"} disabled={busy === "action"} onClick={() => void confirmAction()}>{busy === "action" ? "Saving…" : "Confirm"}</button></div>
          </div>
        </div>
      )}

      <style>{`.paper-action{display:grid;height:38px;width:38px;place-items:center;border:1px solid #E4E7EC;border-radius:8px;background:white}.paper-action:hover{background:#F7F9F7}.paper-modal{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(20,35,43,.55);padding:18px}.paper-modal-card{width:min(520px,100%);display:grid;gap:14px;border-radius:16px;background:white;padding:22px;box-shadow:0 24px 70px rgba(20,35,43,.25)}.paper-modal-card h2{margin:0;font-size:21px}.paper-modal-card p{margin:0;color:#667085;font-size:13px;line-height:1.55}.paper-modal-card label{display:grid;gap:6px;font-size:12px;font-weight:700;color:#344054}.paper-modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:4px}.paper-modal-actions button{min-height:44px;border:1px solid #D0D5DD;border-radius:9px;background:white;padding:9px 13px;font-weight:700}.paper-modal-actions .primary{border-color:#0E5A5A;background:#0E5A5A;color:white}.paper-modal-actions .purple{border-color:#6941C6;background:#6941C6}.paper-modal-actions .danger{border-color:#B42318;background:#B42318;color:white}`}</style>
    </div>
  );
}
