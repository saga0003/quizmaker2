"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  CheckCircle2,
  Download,
  FileClock,
  FileOutput,
  LoaderCircle,
  MessageSquarePlus,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PaperWorkflowStatus } from "@/types/papers";

type ReviewRow = {
  id: string;
  paper_id: string;
  requested_by: string | null;
  assigned_reviewer_id: string | null;
  status: "submitted" | "in_review" | "changes_requested" | "approved" | "rejected" | "resolved";
  summary: string | null;
  decision_reason: string | null;
  created_at: string;
  decided_at: string | null;
};

type ReviewComment = {
  id: string;
  review_id: string;
  paper_id: string;
  section_id: string | null;
  paper_question_id: string | null;
  comment_type: string;
  body: string;
  is_resolved: boolean;
  created_at: string;
};

type SectionOption = { id: string; title: string; display_order: number };
type QuestionOption = {
  id: string;
  section_id: string;
  display_order: number;
  question_snapshot: { stem_text?: string } | null;
};
type VersionRow = {
  id: string;
  version_number: number;
  workflow_status: string;
  change_summary: string | null;
  created_at: string;
  published_at: string | null;
};

function friendlyError(message: string) {
  if (message.includes("Resolve all critical validation errors")) {
    return "Resolve every critical validation issue before approving or publishing this paper.";
  }
  if (message.includes("Resolve all review comments")) {
    return "Resolve all open reviewer comments before approving the paper.";
  }
  if (message.includes("must be approved")) {
    return "The paper must be approved before it can be published.";
  }
  if (message.includes("reason for accepting")) {
    return "Enter a clear reason for accepting the remaining validation warnings.";
  }
  if (message.includes("permission")) {
    return "Your current role does not have permission to complete this action.";
  }
  return message;
}

function workflowLabel(status: PaperWorkflowStatus) {
  return status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function PaperLifecyclePanel({
  paperId,
  workflowStatus,
  onWorkflowChange,
}: {
  paperId: string | null;
  workflowStatus: PaperWorkflowStatus;
  onWorkflowChange: (status: PaperWorkflowStatus) => void;
}) {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [comments, setComments] = useState<ReviewComment[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [questions, setQuestions] = useState<QuestionOption[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(Boolean(paperId));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reviewSummary, setReviewSummary] = useState("");
  const [commentType, setCommentType] = useState("general");
  const [commentBody, setCommentBody] = useState("");
  const [commentSection, setCommentSection] = useState("paper");
  const [commentQuestion, setCommentQuestion] = useState("none");
  const [decisionReason, setDecisionReason] = useState("");
  const [warningReason, setWarningReason] = useState("");
  const [versionSummary, setVersionSummary] = useState("");

  const currentReview = reviews[0] || null;
  const openComments = comments.filter((comment) => !comment.is_resolved);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !paperId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const [reviewResult, sectionResult, questionResult, versionResult] = await Promise.all([
      client
        .from("paper_reviews")
        .select("id,paper_id,requested_by,assigned_reviewer_id,status,summary,decision_reason,created_at,decided_at")
        .eq("paper_id", paperId)
        .order("created_at", { ascending: false }),
      client
        .from("paper_sections")
        .select("id,title,display_order")
        .eq("paper_id", paperId)
        .order("display_order"),
      client
        .from("paper_questions")
        .select("id,section_id,display_order,question_snapshot")
        .eq("paper_id", paperId)
        .order("display_order"),
      client
        .from("paper_versions")
        .select("id,version_number,workflow_status,change_summary,created_at,published_at")
        .eq("paper_id", paperId)
        .order("version_number", { ascending: false }),
    ]);

    const loadError = reviewResult.error || sectionResult.error || questionResult.error || versionResult.error;
    if (loadError) {
      setError(friendlyError(loadError.message));
      setLoading(false);
      return;
    }

    const reviewRows = (reviewResult.data || []) as ReviewRow[];
    setReviews(reviewRows);
    setSections((sectionResult.data || []) as SectionOption[]);
    setQuestions((questionResult.data || []) as QuestionOption[]);
    setVersions((versionResult.data || []) as VersionRow[]);

    if (reviewRows[0]) {
      const commentResult = await client
        .from("paper_review_comments")
        .select("id,review_id,paper_id,section_id,paper_question_id,comment_type,body,is_resolved,created_at")
        .eq("review_id", reviewRows[0].id)
        .order("created_at");
      if (commentResult.error) setError(friendlyError(commentResult.error.message));
      else setComments((commentResult.data || []) as ReviewComment[]);
    } else {
      setComments([]);
    }
    setLoading(false);
  }, [paperId]);

  useEffect(() => {
    void load();
  }, [load]);

  const questionOptions = useMemo(
    () =>
      questions.filter(
        (question) => commentSection === "paper" || question.section_id === commentSection,
      ),
    [questions, commentSection],
  );

  async function submitReview() {
    const client = supabase;
    if (!client || !paperId) return;
    setBusy("submit");
    setError("");
    setNotice("");
    const { error: submitError } = await client.rpc("submit_paper_review_v8", {
      p_paper_id: paperId,
      p_assigned_reviewer_id: null,
      p_summary: reviewSummary.trim() || null,
    });
    setBusy("");
    if (submitError) {
      setError(friendlyError(submitError.message));
      return;
    }
    onWorkflowChange("submitted_for_review");
    setReviewSummary("");
    setNotice("Paper submitted for academic review. It is still not published or available to students.");
    await load();
  }

  async function addComment() {
    const client = supabase;
    if (!client || !currentReview || !commentBody.trim()) return;
    setBusy("comment");
    setError("");
    const { error: commentError } = await client.rpc("add_paper_review_comment_v8", {
      p_review_id: currentReview.id,
      p_section_id: commentSection === "paper" ? null : commentSection,
      p_paper_question_id: commentQuestion === "none" ? null : commentQuestion,
      p_comment_type: commentType,
      p_body: commentBody.trim(),
    });
    setBusy("");
    if (commentError) {
      setError(friendlyError(commentError.message));
      return;
    }
    setCommentBody("");
    setCommentQuestion("none");
    setNotice("Review comment added.");
    await load();
  }

  async function resolveComment(commentId: string) {
    const client = supabase;
    if (!client) return;
    setBusy(`resolve:${commentId}`);
    setError("");
    const { error: resolveError } = await client.rpc("resolve_paper_review_comment_v8", {
      p_comment_id: commentId,
    });
    setBusy("");
    if (resolveError) {
      setError(friendlyError(resolveError.message));
      return;
    }
    setNotice("Review comment resolved.");
    await load();
  }

  async function decide(decision: "approved" | "changes_requested" | "rejected") {
    const client = supabase;
    if (!client || !currentReview) return;
    setBusy(`decision:${decision}`);
    setError("");
    const { data, error: decisionError } = await client.rpc("decide_paper_review_v8", {
      p_review_id: currentReview.id,
      p_decision: decision,
      p_reason: decisionReason.trim() || null,
    });
    setBusy("");
    if (decisionError) {
      setError(friendlyError(decisionError.message));
      return;
    }
    const result = data as { workflow_status: PaperWorkflowStatus };
    onWorkflowChange(result.workflow_status);
    setDecisionReason("");
    setNotice(decision === "approved" ? "Paper approved. An authorised admin may now publish the definition." : "Paper returned for changes.");
    await load();
  }

  async function publish() {
    const client = supabase;
    if (!client || !paperId) return;
    setBusy("publish");
    setError("");
    const { error: publishError } = await client.rpc("publish_paper_definition_v8", {
      p_paper_id: paperId,
      p_warning_acceptance_reason: warningReason.trim() || null,
    });
    setBusy("");
    if (publishError) {
      setError(friendlyError(publishError.message));
      return;
    }
    onWorkflowChange("published");
    setWarningReason("");
    setNotice("Paper definition published. No product, price, entitlement or student attempt was created.");
    await load();
  }

  async function createVersion() {
    const client = supabase;
    if (!client || !paperId) return;
    setBusy("version");
    setError("");
    const { data, error: versionError } = await client.rpc("create_paper_version_v8", {
      p_source_paper_id: paperId,
      p_change_summary: versionSummary.trim() || "New paper version",
    });
    setBusy("");
    if (versionError) {
      setError(friendlyError(versionError.message));
      return;
    }
    const result = data as { paper_id: string; version_number: number };
    window.location.assign(`${window.location.pathname}?id=${result.paper_id}`);
  }

  async function exportJson() {
    const client = supabase;
    if (!client || !paperId) return;
    setBusy("export");
    setError("");
    const { data, error: exportError } = await client.rpc("export_paper_definition_v8", {
      p_paper_id: paperId,
    });
    setBusy("");
    if (exportError) {
      setError(friendlyError(exportError.message));
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `evidara-paper-${paperId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Paper definition JSON exported.");
  }

  if (!paperId) {
    return (
      <div className="lifecycle-empty">
        <FileClock size={28} />
        <p>Save the paper draft before using review, version and export controls.</p>
        <LifecycleStyles />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="lifecycle-empty">
        <LoaderCircle className="spin" size={27} />
        <p>Loading review history and published versions…</p>
        <LifecycleStyles />
      </div>
    );
  }

  return (
    <section className="paper-lifecycle">
      <header>
        <div>
          <span className="rm-label">Paper lifecycle</span>
          <h2>Review, publish, version and export</h2>
          <p>Publishing here marks only the test-paper definition as reusable for the future Product Builder.</p>
        </div>
        <span className={`lifecycle-status ${workflowStatus}`}>{workflowLabel(workflowStatus)}</span>
      </header>

      {error && <div className="lifecycle-message error"><AlertCircle size={16} /> {error}</div>}
      {notice && <div className="lifecycle-message success"><CheckCircle2 size={16} /> {notice}</div>}

      <div className="lifecycle-grid">
        <article>
          <h3><Send size={17} /> Submit for review</h3>
          <p>Creates a tracked review record and stores the current validation result.</p>
          <textarea className="rm-input" rows={3} value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} placeholder="What should the reviewer focus on?" />
          <button className="rm-btn-primary" onClick={() => void submitReview()} disabled={busy === "submit" || workflowStatus === "published" || workflowStatus === "closed" || workflowStatus === "archived"}>
            {busy === "submit" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />} Submit paper
          </button>
        </article>

        <article>
          <h3><MessageSquarePlus size={17} /> Review comments</h3>
          {!currentReview ? <p>No review has been submitted yet.</p> : <>
            <div className="comment-targets">
              <select className="rm-input" value={commentSection} onChange={(event) => { setCommentSection(event.target.value); setCommentQuestion("none"); }}><option value="paper">Whole paper</option>{sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select>
              <select className="rm-input" value={commentQuestion} onChange={(event) => setCommentQuestion(event.target.value)}><option value="none">No specific question</option>{questionOptions.map((question) => <option key={question.id} value={question.id}>Q{question.display_order + 1}: {(question.question_snapshot?.stem_text || "Question").slice(0, 70)}</option>)}</select>
              <select className="rm-input" value={commentType} onChange={(event) => setCommentType(event.target.value)}><option value="general">General</option><option value="replacement_requested">Replacement requested</option><option value="syllabus_mismatch">Syllabus mismatch</option><option value="difficulty_mismatch">Difficulty mismatch</option><option value="duplicate_question">Duplicate question</option></select>
            </div>
            <textarea className="rm-input" rows={3} value={commentBody} onChange={(event) => setCommentBody(event.target.value)} placeholder="Add a clear, actionable review comment" />
            <button className="rm-btn-secondary" onClick={() => void addComment()} disabled={!commentBody.trim() || busy === "comment"}>{busy === "comment" ? <LoaderCircle className="spin" size={15} /> : <MessageSquarePlus size={15} />} Add comment</button>
            <div className="comment-list">{comments.length === 0 ? <p>No comments in this review.</p> : comments.map((comment) => <div key={comment.id} className={comment.is_resolved ? "resolved" : "open"}><div><strong>{comment.comment_type.replaceAll("_", " ")}</strong><span>{new Date(comment.created_at).toLocaleString()}</span></div><p>{comment.body}</p>{comment.is_resolved ? <span className="resolved-label"><CheckCircle2 size={13} /> Resolved</span> : <button onClick={() => void resolveComment(comment.id)} disabled={busy === `resolve:${comment.id}`}><CheckCircle2 size={14} /> Resolve</button>}</div>)}</div>
          </>}
        </article>

        <article>
          <h3><ShieldCheck size={17} /> Reviewer decision</h3>
          <p>{openComments.length} unresolved comment{openComments.length === 1 ? "" : "s"}. Approval also reruns critical validation.</p>
          <textarea className="rm-input" rows={3} value={decisionReason} onChange={(event) => setDecisionReason(event.target.value)} placeholder="Decision reason or required changes" />
          <div className="decision-actions">
            <button className="approve" disabled={!currentReview || Boolean(busy)} onClick={() => void decide("approved")}>{busy === "decision:approved" ? <LoaderCircle className="spin" size={15} /> : <ThumbsUp size={15} />} Approve</button>
            <button className="changes" disabled={!currentReview || Boolean(busy)} onClick={() => void decide("changes_requested")}>{busy === "decision:changes_requested" ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Request changes</button>
            <button className="reject" disabled={!currentReview || Boolean(busy)} onClick={() => void decide("rejected")}>{busy === "decision:rejected" ? <LoaderCircle className="spin" size={15} /> : <ThumbsDown size={15} />} Reject</button>
          </div>
        </article>

        <article>
          <h3><FileOutput size={17} /> Publish definition</h3>
          <p>Requires approval and zero critical errors. A warning acceptance reason is required only when warnings remain.</p>
          <textarea className="rm-input" rows={3} value={warningReason} onChange={(event) => setWarningReason(event.target.value)} placeholder="Reason for accepting remaining warnings, when applicable" />
          <button className="rm-btn-primary" disabled={busy === "publish" || workflowStatus === "published"} onClick={() => void publish()}>{busy === "publish" ? <LoaderCircle className="spin" size={15} /> : <FileOutput size={15} />} Publish paper definition</button>
          <div className="definition-boundary"><AlertCircle size={15} /><span>No product, price, bundle, entitlement, agent code or student attempt is created.</span></div>
        </article>

        <article>
          <h3><FileClock size={17} /> Create new version</h3>
          <p>Published papers are never silently overwritten. The new version is always a draft copy.</p>
          <input className="rm-input" value={versionSummary} onChange={(event) => setVersionSummary(event.target.value)} placeholder="What will change in the new version?" />
          <button className="rm-btn-secondary" disabled={busy === "version"} onClick={() => void createVersion()}>{busy === "version" ? <LoaderCircle className="spin" size={15} /> : <FileClock size={15} />} Create draft version</button>
          {versions.length > 0 && <div className="version-list">{versions.map((version) => <div key={version.id}><strong>Version {version.version_number}</strong><span>{version.workflow_status} · {version.published_at ? new Date(version.published_at).toLocaleDateString() : "Not published"}</span></div>)}</div>}
        </article>

        <article>
          <h3><Download size={17} /> Export and print</h3>
          <p>The JSON export contains paper configuration, sections, selected question snapshots, blueprint and validation.</p>
          <div className="export-actions"><button className="rm-btn-secondary" disabled={busy === "export"} onClick={() => void exportJson()}>{busy === "export" ? <LoaderCircle className="spin" size={15} /> : <Download size={15} />} Export JSON</button><button className="rm-btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print preview</button></div>
        </article>
      </div>
      <LifecycleStyles />
    </section>
  );
}

function LifecycleStyles() {
  return <style>{`
    .paper-lifecycle{margin:16px 0;border:1px solid #D9E8E5;border-radius:14px;padding:15px;background:#F9FCFB}.paper-lifecycle>header{display:flex;justify-content:space-between;gap:14px;align-items:start;margin-bottom:13px}.paper-lifecycle h2{margin:4px 0;font-size:20px}.paper-lifecycle header p{margin:0;color:#667085;font-size:12px}.lifecycle-status{padding:6px 9px;border-radius:999px;background:#F2F4F7;color:#667085;font-size:11px;font-weight:800;text-transform:capitalize}.lifecycle-status.approved,.lifecycle-status.published{background:#ECFDF3;color:#137A3A}.lifecycle-status.changes_requested{background:#FEF3F2;color:#B42318}.lifecycle-status.submitted_for_review{background:#EEF4FF;color:#3538CD}.lifecycle-message{display:flex;gap:7px;align-items:center;padding:10px 12px;border-radius:10px;margin-bottom:10px;font-size:12px;font-weight:650}.lifecycle-message.error{background:#FEF3F2;color:#B42318}.lifecycle-message.success{background:#ECFDF3;color:#137A3A}.lifecycle-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.lifecycle-grid>article{border:1px solid #E4E7EC;border-radius:12px;padding:12px;background:white;display:grid;gap:9px;align-content:start}.lifecycle-grid h3{display:flex;gap:7px;align-items:center;margin:0;font-size:15px}.lifecycle-grid article>p{margin:0;color:#667085;font-size:11px;line-height:1.5}.lifecycle-grid button{justify-self:start}.comment-targets{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}.comment-list{display:grid;gap:6px;max-height:280px;overflow:auto}.comment-list>div{border:1px solid #E4E7EC;border-radius:9px;padding:8px}.comment-list>div.open{border-color:#F2B84B;background:#FFFDF7}.comment-list>div.resolved{background:#F7F9F7}.comment-list>div>div{display:flex;justify-content:space-between;gap:8px}.comment-list strong{font-size:11px;text-transform:capitalize}.comment-list span{font-size:10px;color:#667085}.comment-list p{font-size:12px;margin:6px 0;line-height:1.45}.comment-list button,.resolved-label{display:inline-flex;gap:5px;align-items:center;border:0;background:transparent;color:#137A3A;font-size:11px;font-weight:700}.decision-actions,.export-actions{display:flex;gap:6px;flex-wrap:wrap}.decision-actions button{border:0;border-radius:8px;padding:8px 10px;display:inline-flex;gap:5px;align-items:center;font-weight:750}.decision-actions .approve{background:#ECFDF3;color:#137A3A}.decision-actions .changes{background:#FFF8E6;color:#8A5F00}.decision-actions .reject{background:#FEF3F2;color:#B42318}.decision-actions button:disabled{opacity:.45}.definition-boundary{display:flex;gap:6px;align-items:start;padding:8px;border-radius:8px;background:#EAF4F2;color:#0E5A5A;font-size:10px}.version-list{display:grid;gap:5px;max-height:140px;overflow:auto}.version-list>div{display:flex;justify-content:space-between;gap:8px;padding:6px;border-radius:7px;background:#F7F9F7}.version-list strong,.version-list span{font-size:10px}.version-list span{color:#667085}.lifecycle-empty{padding:26px;border:1px dashed #D0D5DD;border-radius:12px;text-align:center;color:#667085;margin:15px 0}
    @media(max-width:800px){.lifecycle-grid{grid-template-columns:1fr}.comment-targets{grid-template-columns:1fr}}
  `}</style>;
}
