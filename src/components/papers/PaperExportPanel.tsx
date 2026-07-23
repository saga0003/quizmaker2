"use client";

import { useState } from "react";
import {
  Download,
  FileJson,
  FileSpreadsheet,
  KeyRound,
  ListChecks,
  LoaderCircle,
  Printer,
  ScrollText,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type ExportQuestion = {
  id: string;
  display_order: number;
  marks: number;
  negative_marks: number;
  is_mandatory: boolean;
  question_snapshot: {
    id?: string;
    stem_text?: string;
    stem_latex?: string | null;
    question_image_url?: string | null;
    question_type?: string;
    difficulty?: string;
    correct_answer?: unknown;
    solution_text?: string | null;
    solution_latex?: string | null;
    subject_id?: string | null;
    chapter_id?: string | null;
    topic_id?: string | null;
    options?: Array<{
      option_key?: string;
      content_text?: string | null;
      content_latex?: string | null;
      image_url?: string | null;
      is_correct?: boolean;
    }>;
  };
  question_bank?: {
    id?: string;
    external_question_id?: string | null;
    subject_id?: string | null;
    chapter_id?: string | null;
    topic_id?: string | null;
    status?: string;
    version_number?: number;
  };
};

type ExportSection = {
  id: string;
  title: string;
  code?: string | null;
  instructions?: string | null;
  display_order: number;
  questions: ExportQuestion[];
};

type ExportDefinition = {
  schema_version: string;
  exported_at: string;
  paper: {
    id: string;
    title: string;
    code?: string | null;
    programme_code?: string | null;
    paper_type?: string | null;
    duration_minutes?: number;
    reading_time_minutes?: number;
    grace_time_minutes?: number;
    total_marks?: number;
    total_questions?: number;
    instructions?: string | null;
    language?: string | null;
    workflow_status?: string;
  };
  subjects: Array<{ id: string; name: string; code: string; display_order: number }>;
  sections: ExportSection[];
  blueprint: Array<Record<string, unknown>>;
  latest_validation: Record<string, unknown> | null;
  versions: Array<Record<string, unknown>>;
};

type ExportKind =
  | "paper-html"
  | "answer-html"
  | "solutions-html"
  | "question-csv"
  | "answer-csv"
  | "blueprint-csv"
  | "excel"
  | "json"
  | "validation";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function csv(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function filenamePart(value: string | null | undefined) {
  return (value || "paper")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "paper";
}

function download(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function allQuestions(definition: ExportDefinition) {
  return definition.sections.flatMap((section) =>
    (section.questions || []).map((question) => ({ section, question })),
  );
}

function htmlDocument(definition: ExportDefinition, mode: "paper" | "answer" | "solutions") {
  const paper = definition.paper;
  const title = mode === "paper" ? paper.title : mode === "answer" ? `${paper.title} — Answer Key` : `${paper.title} — Solutions`;
  const sections = definition.sections
    .map((section) => {
      const questions = (section.questions || [])
        .map((question, index) => {
          const snapshot = question.question_snapshot || {};
          const number = question.display_order + 1 || index + 1;
          const options = (snapshot.options || [])
            .map((option) => `<div class="option"><strong>${escapeHtml(option.option_key)}</strong><span>${escapeHtml(option.content_text || option.content_latex || "")}</span>${option.image_url ? `<img src="${escapeHtml(option.image_url)}" alt="Option image"/>` : ""}</div>`)
            .join("");
          const image = snapshot.question_image_url ? `<img class="question-image" src="${escapeHtml(snapshot.question_image_url)}" alt="Question illustration"/>` : "";
          const answer = mode !== "paper" ? `<div class="answer"><strong>Correct answer:</strong> ${escapeHtml(typeof snapshot.correct_answer === "string" ? snapshot.correct_answer : JSON.stringify(snapshot.correct_answer ?? ""))}</div>` : "";
          const solution = mode === "solutions" ? `<div class="solution"><strong>Solution:</strong><div>${escapeHtml(snapshot.solution_text || snapshot.solution_latex || "No solution provided")}</div></div>` : "";
          return `<article class="question"><div class="number">${number}.</div><div class="content"><div class="stem">${escapeHtml(snapshot.stem_text || "Question")}</div>${snapshot.stem_latex ? `<pre>${escapeHtml(snapshot.stem_latex)}</pre>` : ""}${image}${mode === "paper" ? options : ""}${answer}${solution}</div><div class="marks">+${escapeHtml(question.marks)} / −${escapeHtml(question.negative_marks)}</div></article>`;
        })
        .join("");
      return `<section><header><div><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.instructions || "")}</p></div><span>${section.questions?.length || 0} questions</span></header>${questions}</section>`;
    })
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
    *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#14232b;margin:0;background:#fff}.page{max-width:900px;margin:auto;padding:34px}.paper-header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #14232b;padding-bottom:16px}.paper-header h1{margin:4px 0;font-size:28px}.paper-header p,.paper-header span{color:#667085}.meta{text-align:right;display:grid;gap:5px}section{margin-top:26px}section>header{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #98a2b3;padding-bottom:8px}section h2{margin:0}section p{margin:4px 0 0;color:#667085}.question{display:grid;grid-template-columns:32px minmax(0,1fr) auto;gap:8px;padding:15px 0;border-bottom:1px solid #e4e7ec;page-break-inside:avoid}.number{font-weight:700}.stem{line-height:1.55}.marks{font-size:12px;color:#8a5f00;white-space:nowrap}.option{display:grid;grid-template-columns:28px 1fr;gap:7px;margin-top:9px}.question-image,.option img{max-width:420px;max-height:300px;object-fit:contain;margin-top:10px}.answer,.solution{margin-top:10px;padding:10px;border-left:4px solid #0e5a5a;background:#eef8f6}.solution{border-color:#f2b84b;background:#fffdf7}pre{white-space:pre-wrap;background:#f7f9f7;padding:8px}@media print{.page{max-width:none;padding:12mm}.question{break-inside:avoid}}
  </style></head><body><main class="page"><div class="paper-header"><div><span>${escapeHtml(paper.code || "Draft")}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(paper.programme_code || "Custom")} · ${escapeHtml((definition.subjects || []).map((subject) => subject.name).join(", "))}</p></div><div class="meta"><strong>${escapeHtml(paper.duration_minutes || 0)} minutes</strong><strong>${escapeHtml(paper.total_marks || 0)} marks</strong><span>${escapeHtml(paper.language || "English")}</span></div></div>${paper.instructions && mode === "paper" ? `<div class="answer"><strong>Instructions</strong><div>${escapeHtml(paper.instructions)}</div></div>` : ""}${sections}</main></body></html>`;
}

function excelHtml(definition: ExportDefinition) {
  const rows = allQuestions(definition)
    .map(({ section, question }) => {
      const snapshot = question.question_snapshot || {};
      return `<tr><td>${question.display_order + 1}</td><td>${escapeHtml(section.title)}</td><td>${escapeHtml(question.question_bank?.id || snapshot.id || "")}</td><td>${escapeHtml(question.question_bank?.external_question_id || "")}</td><td>${escapeHtml(snapshot.stem_text || "")}</td><td>${escapeHtml(snapshot.question_type || "")}</td><td>${escapeHtml(snapshot.difficulty || "")}</td><td>${question.marks}</td><td>${question.negative_marks}</td><td>${escapeHtml(typeof snapshot.correct_answer === "string" ? snapshot.correct_answer : JSON.stringify(snapshot.correct_answer ?? ""))}</td></tr>`;
    })
    .join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><thead><tr><th>S.No.</th><th>Section</th><th>Question ID</th><th>External ID</th><th>Question</th><th>Type</th><th>Difficulty</th><th>Marks</th><th>Negative</th><th>Correct Answer</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
}

export function PaperExportPanel({ paperId }: { paperId: string | null }) {
  const [busy, setBusy] = useState<ExportKind | "">("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function getDefinition() {
    const client = supabase;
    if (!client || !paperId) return null;
    const { data, error: exportError } = await client.rpc("export_paper_definition_v8", {
      p_paper_id: paperId,
    });
    if (exportError) {
      setError(exportError.message);
      return null;
    }
    return data as ExportDefinition;
  }

  async function run(kind: ExportKind) {
    if (!paperId) {
      setError("Save the paper draft before exporting it.");
      return;
    }
    setBusy(kind);
    setError("");
    setNotice("");
    const definition = await getDefinition();
    setBusy("");
    if (!definition) return;
    const base = filenamePart(definition.paper.code || definition.paper.title);
    const questions = allQuestions(definition);

    if (kind === "json") {
      download(JSON.stringify(definition, null, 2), `${base}-backup.json`, "application/json;charset=utf-8");
    } else if (kind === "validation") {
      download(JSON.stringify(definition.latest_validation || {}, null, 2), `${base}-validation.json`, "application/json;charset=utf-8");
    } else if (kind === "paper-html") {
      download(htmlDocument(definition, "paper"), `${base}-question-paper.html`, "text/html;charset=utf-8");
    } else if (kind === "answer-html") {
      download(htmlDocument(definition, "answer"), `${base}-answer-key.html`, "text/html;charset=utf-8");
    } else if (kind === "solutions-html") {
      download(htmlDocument(definition, "solutions"), `${base}-solutions.html`, "text/html;charset=utf-8");
    } else if (kind === "excel") {
      download(excelHtml(definition), `${base}-question-list.xls`, "application/vnd.ms-excel;charset=utf-8");
    } else if (kind === "question-csv") {
      const header = ["S.No.","Section","Question ID","External ID","Question","Question Type","Difficulty","Marks","Negative Marks","Mandatory","Locked","Generation Source"];
      const rows = questions.map(({ section, question }) => [question.display_order + 1,section.title,question.question_bank?.id || question.question_snapshot.id || "",question.question_bank?.external_question_id || "",question.question_snapshot.stem_text || "",question.question_snapshot.question_type || "",question.question_snapshot.difficulty || "",question.marks,question.negative_marks,question.is_mandatory,(question as unknown as { is_locked?: boolean }).is_locked ?? false,(question as unknown as { generation_source?: string }).generation_source || "manual"]);
      download([header, ...rows].map((row) => row.map(csv).join(",")).join("\n"), `${base}-question-list.csv`, "text/csv;charset=utf-8");
    } else if (kind === "answer-csv") {
      const header = ["S.No.","Section","Question ID","Correct Answer","Solution","Solution LaTeX"];
      const rows = questions.map(({ section, question }) => [question.display_order + 1,section.title,question.question_bank?.id || question.question_snapshot.id || "",question.question_snapshot.correct_answer ?? "",question.question_snapshot.solution_text || "",question.question_snapshot.solution_latex || ""]);
      download([header, ...rows].map((row) => row.map(csv).join(",")).join("\n"), `${base}-answer-key-solutions.csv`, "text/csv;charset=utf-8");
    } else if (kind === "blueprint-csv") {
      const rows = (definition.blueprint || []).map((rule, index) => [index + 1,rule.section_id ?? "",rule.subject_id ?? "",rule.chapter_id ?? "",rule.topic_id ?? "",rule.difficulty ?? "",rule.question_type ?? "",rule.requested_count ?? 0,rule.selected_count ?? 0,rule.locked_count ?? 0,rule.availability_count ?? 0,rule.rule_status ?? ""]);
      const header = ["Rule","Section ID","Subject ID","Chapter ID","Topic ID","Difficulty","Question Type","Requested","Selected","Locked","Available","Status"];
      download([header, ...rows].map((row) => row.map(csv).join(",")).join("\n"), `${base}-blueprint.csv`, "text/csv;charset=utf-8");
    }
    setNotice("Export created from the current database-backed paper definition.");
  }

  const buttons: Array<{ kind: ExportKind; label: string; icon: typeof Download }> = [
    { kind: "paper-html", label: "Question paper HTML", icon: ScrollText },
    { kind: "answer-html", label: "Answer key HTML", icon: KeyRound },
    { kind: "solutions-html", label: "Solutions HTML", icon: ListChecks },
    { kind: "excel", label: "Excel question list", icon: FileSpreadsheet },
    { kind: "question-csv", label: "Question list CSV", icon: FileSpreadsheet },
    { kind: "answer-csv", label: "Answers & solutions CSV", icon: KeyRound },
    { kind: "blueprint-csv", label: "Blueprint CSV", icon: ListChecks },
    { kind: "validation", label: "Validation report", icon: FileJson },
    { kind: "json", label: "Complete JSON backup", icon: FileJson },
  ];

  return (
    <section className="paper-export-panel">
      <header><div><span className="rm-label">Paper exports</span><h2>Printable, spreadsheet and backup formats</h2><p>PDF-ready HTML can be opened and printed to PDF without adding a server-side PDF dependency.</p></div><Download size={23} /></header>
      {error && <div className="export-message error">{error}</div>}
      {notice && <div className="export-message success">{notice}</div>}
      <div className="export-grid">
        {buttons.map(({ kind, label, icon: Icon }) => <button key={kind} className="rm-btn-secondary" disabled={Boolean(busy)} onClick={() => void run(kind)}>{busy === kind ? <LoaderCircle className="spin" size={15} /> : <Icon size={15} />} {label}</button>)}
        <button className="rm-btn-secondary" onClick={() => window.print()}><Printer size={15} /> Print current preview</button>
      </div>
      <style>{`
        .paper-export-panel{margin-top:16px;border:1px solid #E4E7EC;border-radius:14px;padding:15px;background:white}.paper-export-panel>header{display:flex;justify-content:space-between;gap:12px;align-items:start}.paper-export-panel h2{font-size:19px;margin:4px 0}.paper-export-panel header p{margin:0;color:#667085;font-size:12px}.paper-export-panel header>svg{color:#6941C6}.export-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:13px}.export-grid button{justify-content:flex-start}.export-message{padding:10px 12px;border-radius:9px;margin-top:10px;font-size:12px;font-weight:650}.export-message.error{background:#FEF3F2;color:#B42318}.export-message.success{background:#ECFDF3;color:#137A3A}@media(max-width:800px){.export-grid{grid-template-columns:1fr 1fr}}@media(max-width:480px){.export-grid{grid-template-columns:1fr}}
      `}</style>
    </section>
  );
}
