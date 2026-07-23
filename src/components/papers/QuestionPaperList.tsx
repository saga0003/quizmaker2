"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarClock,
  ClipboardCheck,
  Copy,
  Eye,
  FilePlus2,
  FileStack,
  LoaderCircle,
  Pencil,
  Search,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  PaperCopyScope,
  PaperDuplicateResult,
  PaperListRow,
  PaperWorkflowStatus,
} from "@/types/papers";
import { useQuestionScope } from "@/components/questions/useQuestionScope";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const demo: PaperListRow[] = [
  {
    id: "demo-paper",
    organization_id: null,
    title: "NEET Full Syllabus Mock 01",
    code: "NEET-FULL-001",
    description: "Demo V8 paper-definition preview",
    exam_type: "NEET",
    paper_type: "full_length_mock",
    programme_code: "NEET",
    workflow_status: "draft",
    creation_mode: "hybrid",
    version_number: 1,
    status: "draft",
    duration_minutes: 180,
    total_marks: 720,
    total_questions: 180,
    access_mode: "public",
    available_from: null,
    available_until: null,
    attempt_limit: 1,
    result_mode: "score_only",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
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

const paperTypeLabels: Record<string, string> = {
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

const copyScopeHelp: Record<PaperCopyScope, string> = {
  entire: "Copies paper settings, subjects, sections, blueprints and selected questions.",
  settings: "Copies only the paper details and selected subjects.",
  sections: "Copies paper settings, subjects and section structure without questions.",
  blueprint: "Copies settings, sections and automatic-generation blueprint without selected questions.",
  questions: "Copies settings, sections and selected questions without the blueprint.",
};

function statusOf(paper: PaperListRow): PaperWorkflowStatus {
  if (paper.workflow_status) return paper.workflow_status;
  if (paper.status === "published") return "published";
  if (paper.status === "archived") return "archived";
  return "draft";
}

function workflowTone(status: PaperWorkflowStatus) {
  if (status === "published" || status === "approved") {
    return { background: "#ECFDF3", color: "#137A3A" };
  }
  if (status === "changes_requested") {
    return { background: "#FEF3F2", color: "#B42318" };
  }
  if (status === "submitted_for_review") {
    return { background: "#EEF4FF", color: "#3538CD" };
  }
  if (status === "draft") {
    return { background: "#FFF8E6", color: "#8A5F00" };
  }
  return { background: "#F2F4F7", color: "#667085" };
}

export function QuestionPaperList({ kind }: { kind: "admin" | "school" }) {
  const {
    organizationId,
    organizationName,
    loading: scopeLoading,
    error: scopeError,
  } = useQuestionScope(kind);
  const [papers, setPapers] = useState<PaperListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [migrationReady, setMigrationReady] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [programme, setProgramme] = useState("all");
  const [paperType, setPaperType] = useState("all");
  const [creationMode, setCreationMode] = useState("all");
  const [duplicatePaper, setDuplicatePaper] = useState<PaperListRow | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState("");
  const [copyScope, setCopyScope] = useState<PaperCopyScope>("entire");
  const [duplicating, setDuplicating] = useState(false);
  const base = kind === "admin" ? "/admin/papers" : "/school/papers";

  async function load() {
    if (!supabase) {
      setPapers(demo);
      setLoading(false);
      return;
    }
    if (kind === "school" && scopeLoading) return;
    setLoading(true);
    setError("");

    const extendedColumns =
      "id,organization_id,title,code,description,exam_type,paper_type,programme_code,workflow_status,creation_mode,version_number,status,duration_minutes,total_marks,total_questions,access_mode,available_from,available_until,attempt_limit,result_mode,created_by,updated_by,created_at,updated_at";
    let query = supabase
      .from("question_papers")
      .select(extendedColumns)
      .order("updated_at", { ascending: false });
    query =
      kind === "admin"
        ? query.is("organization_id", null)
        : query.eq("organization_id", organizationId!);
    const extended = await query;

    if (!extended.error) {
      setMigrationReady(true);
      setPapers((extended.data || []) as unknown as PaperListRow[]);
      setLoading(false);
      return;
    }

    const legacyColumns =
      "id,organization_id,title,code,description,exam_type,status,duration_minutes,total_marks,total_questions,access_mode,available_from,available_until,attempt_limit,result_mode,created_at,updated_at";
    let legacyQuery = supabase
      .from("question_papers")
      .select(legacyColumns)
      .order("updated_at", { ascending: false });
    legacyQuery =
      kind === "admin"
        ? legacyQuery.is("organization_id", null)
        : legacyQuery.eq("organization_id", organizationId!);
    const legacy = await legacyQuery;
    if (legacy.error) {
      setError(legacy.error.message);
    } else {
      setMigrationReady(false);
      setPapers((legacy.data || []) as unknown as PaperListRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // organizationId becomes available asynchronously for school workspaces.
  }, [kind, organizationId, scopeLoading]);

  function openDuplicate(paper: PaperListRow) {
    setDuplicatePaper(paper);
    setDuplicateTitle(`${paper.title} Copy`);
    setCopyScope("entire");
    setError("");
    setNotice("");
  }

  async function duplicate() {
    if (!supabase || !duplicatePaper) return;
    if (!migrationReady) {
      setError("Run Supabase migration 32 before duplicating papers in V8.");
      return;
    }
    if (duplicateTitle.trim().length < 3) {
      setError("Enter a name of at least three characters for the draft copy.");
      return;
    }

    setDuplicating(true);
    setError("");
    const { data, error: duplicateError } = await supabase.rpc(
      "duplicate_question_paper_v8",
      {
        p_source_paper_id: duplicatePaper.id,
        p_copy_scope: copyScope,
        p_new_title: duplicateTitle.trim(),
      },
    );
    setDuplicating(false);

    if (duplicateError) {
      setError(duplicateError.message);
      return;
    }

    const result = data as PaperDuplicateResult;
    setDuplicatePaper(null);
    setNotice(
      `${result.title} was created as Draft with the new code ${result.code}. Nothing was published.`,
    );
    await load();
  }

  const filtered = useMemo(
    () =>
      papers.filter((paper) => {
        const haystack = `${paper.title} ${paper.code || ""} ${paper.exam_type} ${paper.description || ""}`.toLowerCase();
        return (
          (!search || haystack.includes(search.toLowerCase())) &&
          (status === "all" || statusOf(paper) === status) &&
          (programme === "all" || (paper.programme_code || paper.exam_type) === programme) &&
          (paperType === "all" || (paper.paper_type || "custom_test") === paperType) &&
          (creationMode === "all" || (paper.creation_mode || "manual") === creationMode)
        );
      }),
    [papers, search, status, programme, paperType, creationMode],
  );

  const programmes = useMemo(
    () =>
      Array.from(
        new Set(papers.map((paper) => paper.programme_code || paper.exam_type).filter(Boolean)),
      ).sort(),
    [papers],
  );
  const types = useMemo(
    () => Array.from(new Set(papers.map((paper) => paper.paper_type || "custom_test"))).sort(),
    [papers],
  );
  const stats = {
    total: papers.length,
    published: papers.filter((paper) => statusOf(paper) === "published").length,
    drafts: papers.filter((paper) => statusOf(paper) === "draft").length,
    questions: papers.reduce((sum, paper) => sum + paper.total_questions, 0),
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 14,
          alignItems: "end",
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="rm-label">{organizationName} · Evidara V8</span>
          <h1 style={{ margin: "5px 0", fontSize: 34, color: "#0B1324" }}>
            Test Paper Builder
          </h1>
          <p style={{ margin: 0, color: "#667085", maxWidth: 820 }}>
            Construct reusable paper definitions from approved questions. Products, prices,
            purchases, student access and examination delivery are outside this module.
          </p>
        </div>
        <Link className="rm-btn-primary" href={`${base}/new/`}>
          <FilePlus2 size={18} /> Create paper
        </Link>
      </div>

      {!migrationReady && (
        <div
          style={{
            marginTop: 14,
            padding: 13,
            borderRadius: 12,
            background: "#FFF8E6",
            color: "#8A5F00",
            fontWeight: 650,
          }}
        >
          V8 is showing legacy papers in read-only compatibility mode. Run migration 32 to
          activate programmes, workflow statuses, versions and draft duplication.
        </div>
      )}
      {(scopeError || error) && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#FEF3F2",
            color: "#B42318",
            fontWeight: 650,
          }}
        >
          {scopeError || error}
        </div>
      )}
      {notice && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 12,
            background: "#ECFDF3",
            color: "#137A3A",
            fontWeight: 700,
          }}
        >
          {notice}
        </div>
      )}

      <section
        className="paper-stats"
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 18 }}
      >
        {[
          ["Paper definitions", stats.total, "#131E35"],
          ["Published definitions", stats.published, "#137A3A"],
          ["Drafts", stats.drafts, "#8A5F00"],
          ["Questions placed", stats.questions, "#6941C6"],
        ].map(([label, value, color]) => (
          <div className="rm-card" key={String(label)} style={{ padding: 16 }}>
            <strong style={{ fontSize: 28, color: String(color) }}>{value}</strong>
            <div style={{ fontSize: 13, color: "#667085", marginTop: 5 }}>{label}</div>
          </div>
        ))}
      </section>

      <section
        className="rm-card paper-list-filters"
        style={{
          padding: 15,
          marginTop: 16,
          display: "grid",
          gridTemplateColumns: "minmax(260px,1fr) repeat(4,minmax(150px,190px))",
          gap: 10,
        }}
      >
        <div style={{ position: "relative" }}>
          <Search
            size={17}
            style={{ position: "absolute", left: 12, top: 13, color: "#98A2B3" }}
          />
          <input
            className="rm-input"
            style={{ paddingLeft: 38 }}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, code or description"
          />
        </div>
        <select className="rm-input" value={programme} onChange={(event) => setProgramme(event.target.value)}>
          <option value="all">All programmes</option>
          {programmes.map((value) => (
            <option value={value} key={value}>
              {value}
            </option>
          ))}
        </select>
        <select className="rm-input" value={paperType} onChange={(event) => setPaperType(event.target.value)}>
          <option value="all">All paper types</option>
          {types.map((value) => (
            <option value={value} key={value}>
              {paperTypeLabels[value] || value}
            </option>
          ))}
        </select>
        <select className="rm-input" value={creationMode} onChange={(event) => setCreationMode(event.target.value)}>
          <option value="all">All creation modes</option>
          <option value="manual">Manual</option>
          <option value="automatic">Automatic</option>
          <option value="hybrid">Hybrid</option>
        </select>
        <select className="rm-input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All workflow statuses</option>
          {Object.entries(workflowLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>

      <section className="rm-card" style={{ marginTop: 16, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#667085" }}>
            <LoaderCircle className="spin" /> Loading papers…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 45, textAlign: "center" }}>
            <ClipboardCheck size={30} color="#98A2B3" />
            <h3>No paper definitions found</h3>
            <p style={{ color: "#667085" }}>
              Create a paper or change the current filters.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="rm-table" style={{ minWidth: 1280 }}>
              <thead>
                <tr>
                  <th>Paper</th>
                  <th>Programme</th>
                  <th>Type</th>
                  <th>Mode</th>
                  <th>Questions</th>
                  <th>Marks</th>
                  <th>Duration</th>
                  <th>Version</th>
                  <th>Workflow</th>
                  <th>Last updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((paper) => {
                  const workflow = statusOf(paper);
                  const tone = workflowTone(workflow);
                  return (
                    <tr key={paper.id}>
                      <td>
                        <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap" }}>
                          <strong>{paper.title}</strong>
                          {kind === "school" && <span className="so-label free">SCHOOL</span>}
                        </div>
                        <div style={{ fontSize: 11, color: "#98A2B3", marginTop: 4 }}>
                          {paper.code || "Code generated on first save"}
                        </div>
                      </td>
                      <td>{paper.programme_code || paper.exam_type}</td>
                      <td>{paperTypeLabels[paper.paper_type || "custom_test"] || paper.paper_type}</td>
                      <td style={{ textTransform: "capitalize" }}>{paper.creation_mode || "manual"}</td>
                      <td>{paper.total_questions}</td>
                      <td>{paper.total_marks}</td>
                      <td>{paper.duration_minutes} min</td>
                      <td>V{paper.version_number || 1}</td>
                      <td>
                        <span className="rm-badge" style={tone}>
                          {workflowLabels[workflow]}
                        </span>
                      </td>
                      <td>{new Date(paper.updated_at).toLocaleString()}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {!paper.id.startsWith("demo") && (
                            <>
                              <Link
                                href={`${base}/new/?id=${paper.id}`}
                                title="Edit paper definition"
                                className="rm-btn-secondary"
                                style={{ padding: "8px 10px" }}
                              >
                                <Pencil size={15} />
                              </Link>
                              <Link
                                href={`${base}/preview/?id=${paper.id}`}
                                title="Preview paper"
                                className="rm-btn-secondary"
                                style={{ padding: "8px 10px" }}
                              >
                                <Eye size={15} />
                              </Link>
                              <button
                                title="Duplicate as a new draft"
                                className="rm-btn-secondary"
                                style={{ padding: "8px 10px", color: "#0E5A5A" }}
                                onClick={() => openDuplicate(paper)}
                                disabled={!migrationReady}
                              >
                                <Copy size={15} />
                              </button>
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
        )}
      </section>

      <div
        style={{
          marginTop: 13,
          fontSize: 12,
          color: "#667085",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <ShieldCheck size={14} /> Publishing in V8 marks only the paper definition as ready for
        future Product Builder assignment. It does not sell, schedule or grant access to a test.
      </div>

      <AlertDialog
        open={Boolean(duplicatePaper)}
        onOpenChange={(open) => {
          if (!open && !duplicating) setDuplicatePaper(null);
        }}
      >
        <AlertDialogContent className="overflow-hidden border-[#E7ECEB] p-0 sm:max-w-xl">
          <div className="bg-[#14232B] px-6 py-5 text-white">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0E5A5A]">
              <FileStack className="h-5 w-5" />
            </div>
            <AlertDialogHeader className="mt-4 text-left">
              <AlertDialogTitle className="text-xl text-white">
                Duplicate as a new draft
              </AlertDialogTitle>
              <AlertDialogDescription className="text-[#DCE9E7]">
                The copy receives a new paper code. Publication, availability dates and access
                settings are never carried into the duplicate.
              </AlertDialogDescription>
            </AlertDialogHeader>
          </div>
          <div className="space-y-5 px-6 py-5">
            <div className="space-y-2">
              <Label htmlFor="duplicate-title">Draft paper name</Label>
              <Input
                id="duplicate-title"
                value={duplicateTitle}
                onChange={(event) => setDuplicateTitle(event.target.value)}
                placeholder="Enter the new draft name"
              />
            </div>
            <div className="space-y-2">
              <Label>What should be copied?</Label>
              <Select value={copyScope} onValueChange={(value) => setCopyScope(value as PaperCopyScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entire">Entire paper</SelectItem>
                  <SelectItem value="settings">Paper settings only</SelectItem>
                  <SelectItem value="sections">Settings and sections</SelectItem>
                  <SelectItem value="blueprint">Settings, sections and blueprint</SelectItem>
                  <SelectItem value="questions">Settings, sections and selected questions</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs leading-relaxed text-[#6B7980]">{copyScopeHelp[copyScope]}</p>
            </div>
            <div className="rounded-xl border border-[#F2B84B]/50 bg-[#FFFDF7] p-4 text-sm text-[#8A5F00]">
              <strong>Draft-only safety</strong>
              <p className="mt-1 text-xs">
                The duplicated record is created with workflow status Draft and legacy status
                Draft, even when the source paper is already published.
              </p>
            </div>
          </div>
          <AlertDialogFooter className="border-t border-[#E7ECEB] px-6 py-4">
            <AlertDialogCancel disabled={duplicating}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              onClick={() => void duplicate()}
              disabled={duplicating}
              className="bg-[#0E5A5A] text-white hover:bg-[#0A4747]"
            >
              {duplicating ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              Create draft copy
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <style>{`
        @media(max-width:1100px){.paper-list-filters{grid-template-columns:1fr 1fr!important}}
        @media(max-width:760px){.paper-stats{grid-template-columns:1fr 1fr!important}.paper-list-filters{grid-template-columns:1fr!important}}
        @media(max-width:480px){.paper-stats{grid-template-columns:1fr!important}}
      `}</style>
    </div>
  );
}
