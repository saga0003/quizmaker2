"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BlockMath } from "react-katex";
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare2,
  ListChecks,
  LoaderCircle,
  MessageSquareText,
  Square,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { QuestionRow } from "@/types/questions";

type ReviewDecision = "approved" | "rejected" | "changes_requested";

export function QuestionReviewQueue() {
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [comments, setComments] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkComment, setBulkComment] = useState("");

  const selectedCount = selectedIds.size;
  const allVisibleSelected = rows.length > 0 && selectedCount === rows.length;

  const selectedRows = useMemo(
    () => rows.filter((question) => selectedIds.has(question.id)),
    [rows, selectedIds],
  );

  async function load() {
    if (!supabase) {
      setRows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    const { data, error: queryError } = await supabase
      .from("questions")
      .select("*,subjects(name,code),chapters(name),question_options(*)")
      .eq("status", "in_review")
      .order("updated_at", { ascending: true });

    if (queryError) {
      setError(queryError.message);
    } else {
      setRows((data || []) as unknown as QuestionRow[]);
      setSelectedIds(new Set());
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  function toggleOne(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds(() =>
      allVisibleSelected ? new Set() : new Set(rows.map((question) => question.id)),
    );
  }

  async function decide(id: string, decision: ReviewDecision) {
    if (!supabase) return;

    setBusy(id);
    setError("");
    setMessage("");
    const { error: rpcError } = await supabase.rpc("review_question", {
      p_question_id: id,
      p_decision: decision,
      p_comment: comments[id] || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      setMessage(`Question ${decision.replaceAll("_", " ")}.`);
      setRows((current) => current.filter((question) => question.id !== id));
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
    setBusy("");
  }

  async function bulkDecide(decision: ReviewDecision) {
    if (!supabase || selectedCount === 0) return;

    const readableDecision = decision.replaceAll("_", " ");
    const confirmed = window.confirm(
      `${readableDecision.charAt(0).toUpperCase() + readableDecision.slice(1)} ${selectedCount} selected question${selectedCount === 1 ? "" : "s"}?`,
    );
    if (!confirmed) return;

    setBusy("bulk");
    setError("");
    setMessage("");

    const ids = selectedRows.map((question) => question.id);
    const { data, error: rpcError } = await supabase.rpc("bulk_review_questions_v13", {
      p_question_ids: ids,
      p_decision: decision,
      p_comment: bulkComment.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
    } else {
      const reviewed = Number(
        (data as { reviewed_count?: number } | null)?.reviewed_count ?? ids.length,
      );
      setMessage(`${reviewed} question${reviewed === 1 ? "" : "s"} ${readableDecision}.`);
      const reviewedSet = new Set(ids);
      setRows((current) => current.filter((question) => !reviewedSet.has(question.id)));
      setSelectedIds(new Set());
      setBulkComment("");
    }
    setBusy("");
  }

  return (
    <div>
      <div>
        <Link
          href="/admin/questions/"
          style={{
            display: "inline-flex",
            gap: 7,
            alignItems: "center",
            color: "#667085",
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          <ArrowLeft size={16} /> Back to question bank
        </Link>
        <span className="rm-label" style={{ display: "block", marginTop: 14 }}>
          Quality control
        </span>
        <h1 style={{ fontSize: 34, margin: "5px 0", color: "#131e35" }}>
          Question review queue
        </h1>
        <p style={{ margin: 0, color: "#667085" }}>
          Approve only after checking the answer, equation, diagram, scoring and solution.
        </p>
      </div>

      {(error || message) && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 10,
            background: error ? "#fef3f2" : "#ecfdf3",
            color: error ? "#b42318" : "#137a3a",
          }}
        >
          {error || message}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <section
          className="rm-card"
          style={{
            padding: 16,
            marginTop: 18,
            position: "sticky",
            top: 10,
            zIndex: 8,
            border: selectedCount > 0 ? "1px solid #f6b100" : undefined,
            boxShadow: "0 8px 24px rgba(19,30,53,.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="rm-btn-secondary"
              onClick={toggleAllVisible}
              disabled={busy === "bulk"}
            >
              {allVisibleSelected ? <CheckSquare2 size={17} /> : <Square size={17} />}
              {allVisibleSelected ? "Clear selection" : "Select all visible"}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ListChecks size={18} color="#775600" />
              <strong style={{ color: "#131e35" }}>{selectedCount}</strong>
              <span style={{ color: "#667085" }}>of {rows.length} selected</span>
            </div>
          </div>

          {selectedCount > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(220px,1fr) auto",
                gap: 12,
                alignItems: "end",
                marginTop: 12,
              }}
            >
              <label>
                <span className="rm-label">Bulk reviewer note</span>
                <textarea
                  className="rm-input"
                  rows={2}
                  style={{ marginTop: 6, resize: "vertical" }}
                  placeholder="Optional note applied to every selected question"
                  value={bulkComment}
                  onChange={(event) => setBulkComment(event.target.value)}
                />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="rm-btn-secondary"
                  style={{ color: "#b42318" }}
                  disabled={busy === "bulk"}
                  onClick={() => void bulkDecide("rejected")}
                >
                  <XCircle size={16} /> Reject selected
                </button>
                <button
                  type="button"
                  className="rm-btn-secondary"
                  disabled={busy === "bulk"}
                  onClick={() => void bulkDecide("changes_requested")}
                >
                  <MessageSquareText size={16} /> Request changes
                </button>
                <button
                  type="button"
                  className="rm-btn-primary"
                  disabled={busy === "bulk"}
                  onClick={() => void bulkDecide("approved")}
                >
                  {busy === "bulk" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <CheckCircle2 size={16} />
                  )}
                  Approve selected
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {loading ? (
        <div className="rm-card" style={{ padding: 35, marginTop: 18, textAlign: "center" }}>
          <LoaderCircle className="spin" /> Loading review queue…
        </div>
      ) : rows.length === 0 ? (
        <div className="rm-card" style={{ padding: 40, marginTop: 18, textAlign: "center" }}>
          <CheckCircle2 size={34} color="#137a3a" />
          <h2>Review queue is clear</h2>
          <p style={{ color: "#667085" }}>Questions submitted for review will appear here.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
          {rows.map((question) => {
            const selected = selectedIds.has(question.id);
            return (
              <article
                className="rm-card"
                style={{
                  padding: 20,
                  border: selected ? "2px solid #f6b100" : undefined,
                  background: selected ? "#fffdf5" : undefined,
                }}
                key={question.id}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    alignItems: "start",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => toggleOne(question.id)}
                      aria-label={selected ? "Deselect question" : "Select question"}
                      aria-pressed={selected}
                      style={{
                        border: 0,
                        background: "transparent",
                        padding: 0,
                        color: selected ? "#b76e00" : "#667085",
                        cursor: "pointer",
                        display: "inline-flex",
                      }}
                    >
                      {selected ? <CheckSquare2 size={22} /> : <Square size={22} />}
                    </button>
                    <span
                      className="rm-badge"
                      style={{
                        background: question.organization_id ? "#f4ebff" : "#fff6d8",
                        color: question.organization_id ? "#6941c6" : "#775600",
                      }}
                    >
                      {question.organization_id ? "School private" : "Evidara master"}
                    </span>
                    <span className="rm-badge" style={{ background: "#f2f4f7" }}>
                      {question.subjects?.name || "Unclassified"}
                    </span>
                  </div>
                  <Link
                    href={`/admin/questions/new/?id=${question.id}`}
                    style={{ fontWeight: 750, color: "#775600" }}
                  >
                    Open full editor →
                  </Link>
                </div>

                <h2 style={{ fontSize: 19, lineHeight: 1.55, margin: "16px 0 8px" }}>
                  {question.stem_text}
                </h2>
                {question.stem_latex && (
                  <div style={{ overflowX: "auto", background: "#fbfcfe", padding: 8, borderRadius: 10 }}>
                    <BlockMath math={question.stem_latex} />
                  </div>
                )}
                {question.question_image_url && (
                  <img
                    src={question.question_image_url}
                    alt="Question"
                    style={{
                      maxWidth: 420,
                      maxHeight: 250,
                      objectFit: "contain",
                      border: "1px solid #e4e7ec",
                      borderRadius: 10,
                      marginTop: 10,
                    }}
                  />
                )}

                <div style={{ display: "grid", gap: 7, marginTop: 14 }}>
                  {(question.question_options || [])
                    .sort((first, second) => first.display_order - second.display_order)
                    .map((option) => (
                      <div
                        key={option.option_key}
                        style={{
                          padding: 10,
                          borderRadius: 10,
                          border: `1px solid ${option.is_correct ? "#49a26c" : "#e4e7ec"}`,
                          background: option.is_correct ? "#f0fdf4" : "white",
                        }}
                      >
                        <strong>{option.option_key}.</strong> {option.content_text}
                        {option.content_latex && (
                          <span style={{ display: "block", overflowX: "auto" }}>
                            <BlockMath math={option.content_latex} />
                          </span>
                        )}
                        {option.image_url && (
                          <img
                            src={option.image_url}
                            alt={`Option ${option.option_key}`}
                            style={{ maxWidth: 280, maxHeight: 180, objectFit: "contain", marginTop: 8 }}
                          />
                        )}
                      </div>
                    ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    marginTop: 16,
                    alignItems: "end",
                  }}
                >
                  <label>
                    <span className="rm-label">Reviewer note</span>
                    <textarea
                      className="rm-input"
                      rows={2}
                      style={{ marginTop: 6, resize: "vertical" }}
                      placeholder="Optional approval note or required correction"
                      value={comments[question.id] || ""}
                      onChange={(event) =>
                        setComments((current) => ({ ...current, [question.id]: event.target.value }))
                      }
                    />
                  </label>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="rm-btn-secondary"
                      style={{ color: "#b42318" }}
                      disabled={busy === question.id || busy === "bulk"}
                      onClick={() => void decide(question.id, "rejected")}
                    >
                      <XCircle size={16} /> Reject
                    </button>
                    <button
                      type="button"
                      className="rm-btn-secondary"
                      disabled={busy === question.id || busy === "bulk"}
                      onClick={() => void decide(question.id, "changes_requested")}
                    >
                      <MessageSquareText size={16} /> Request changes
                    </button>
                    <button
                      type="button"
                      className="rm-btn-primary"
                      disabled={busy === question.id || busy === "bulk"}
                      onClick={() => void decide(question.id, "approved")}
                    >
                      {busy === question.id ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Approve
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        @media(max-width:720px){
          article>div:last-of-type{grid-template-columns:1fr!important}
          section.rm-card>div:last-child{grid-template-columns:1fr!important}
        }
      `}</style>
    </div>
  );
}
