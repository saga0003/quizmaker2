"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  CopyPlus,
  FileStack,
  LoaderCircle,
  Plus,
  Save,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { PaperCopyScope } from "@/types/papers";

type TemplateRow = {
  id: string;
  organization_id: string | null;
  name: string;
  description: string | null;
  programme_code: string | null;
  paper_type: string | null;
  template_definition: {
    copy_scope?: PaperCopyScope;
    source_paper_id?: string;
    source_version_number?: number;
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

function friendly(message: string) {
  if (message.includes("source paper")) {
    return "This template's source paper no longer exists. Save a new template from an active paper.";
  }
  if (message.includes("permission")) {
    return "Your current role does not have permission to manage this template.";
  }
  return message;
}

export function PaperTemplatePanel({
  paperId,
  kind,
  organizationId,
  base,
}: {
  paperId: string | null;
  kind: "admin" | "school";
  organizationId: string | null;
  base: string;
}) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [copyScope, setCopyScope] = useState<PaperCopyScope>("entire");
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || (kind === "school" && !organizationId)) {
      setLoading(false);
      return;
    }
    setLoading(true);
    let query = client
      .from("paper_templates")
      .select("id,organization_id,name,description,programme_code,paper_type,template_definition,is_active,created_at,updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false });
    query = kind === "admin" ? query.is("organization_id", null) : query.eq("organization_id", organizationId!);
    const { data, error: loadError } = await query;
    if (loadError) setError(friendly(loadError.message));
    else setTemplates((data || []) as TemplateRow[]);
    setLoading(false);
  }, [kind, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTemplate() {
    const client = supabase;
    if (!client || !paperId) return;
    if (templateName.trim().length < 3) {
      setError("Enter a template name of at least three characters.");
      return;
    }
    setBusy("save");
    setError("");
    setNotice("");
    const { error: saveError } = await client.rpc("save_paper_as_template_v8", {
      p_paper_id: paperId,
      p_name: templateName.trim(),
      p_description: templateDescription.trim() || null,
      p_copy_scope: copyScope,
    });
    setBusy("");
    if (saveError) {
      setError(friendly(saveError.message));
      return;
    }
    setTemplateName("");
    setTemplateDescription("");
    setNotice("Template saved. Building from it will always create a new draft paper.");
    await load();
  }

  async function buildDraft(template: TemplateRow) {
    const client = supabase;
    if (!client) return;
    setBusy(`build:${template.id}`);
    setError("");
    setNotice("");
    const { data, error: buildError } = await client.rpc("create_paper_from_template_v8", {
      p_template_id: template.id,
      p_new_title: draftTitle.trim() || `${template.name} Draft`,
    });
    setBusy("");
    if (buildError) {
      setError(friendly(buildError.message));
      return;
    }
    const result = data as { paper_id: string; workflow_status: "draft" };
    window.location.assign(`${base}/new/?id=${result.paper_id}`);
  }

  async function archiveTemplate(templateId: string) {
    const client = supabase;
    if (!client) return;
    setBusy(`archive:${templateId}`);
    setError("");
    const { error: archiveError } = await client
      .from("paper_templates")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", templateId);
    setBusy("");
    if (archiveError) {
      setError(friendly(archiveError.message));
      return;
    }
    setNotice("Template archived. Existing papers created from it are unchanged.");
    if (selectedTemplate === templateId) setSelectedTemplate(null);
    await load();
  }

  return (
    <section className="paper-template-panel">
      <header>
        <div>
          <span className="rm-label">Reusable paper templates</span>
          <h2>Save once, create draft papers repeatedly</h2>
          <p>Templates never publish a paper and never create student access.</p>
        </div>
        <FileStack size={24} />
      </header>

      {error && <div className="template-message error">{error}</div>}
      {notice && <div className="template-message success">{notice}</div>}

      {paperId && (
        <div className="save-template-form">
          <input className="rm-input" value={templateName} onChange={(event) => setTemplateName(event.target.value)} placeholder="Template name" />
          <input className="rm-input" value={templateDescription} onChange={(event) => setTemplateDescription(event.target.value)} placeholder="Optional description" />
          <select className="rm-input" value={copyScope} onChange={(event) => setCopyScope(event.target.value as PaperCopyScope)}>
            <option value="entire">Entire paper</option>
            <option value="settings">Settings only</option>
            <option value="sections">Settings and sections</option>
            <option value="blueprint">Settings, sections and blueprint</option>
            <option value="questions">Settings, sections and selected questions</option>
          </select>
          <button className="rm-btn-primary" disabled={busy === "save"} onClick={() => void saveTemplate()}>
            {busy === "save" ? <LoaderCircle className="spin" size={15} /> : <Save size={15} />} Save as template
          </button>
        </div>
      )}

      {loading ? (
        <div className="template-empty"><LoaderCircle className="spin" size={24} /> Loading templates…</div>
      ) : templates.length === 0 ? (
        <div className="template-empty"><FileStack size={26} /><p>No active templates in this workspace.</p></div>
      ) : (
        <div className="template-list">
          {templates.map((template) => {
            const selected = selectedTemplate === template.id;
            return (
              <article key={template.id} className={selected ? "selected" : ""}>
                <div className="template-summary">
                  <div>
                    <strong>{template.name}</strong>
                    <p>{template.description || "Reusable paper definition"}</p>
                    <span>{template.programme_code || "Custom"} · {(template.paper_type || "custom_test").replaceAll("_", " ")} · {template.template_definition.copy_scope || "entire"}</span>
                  </div>
                  <div>
                    <button className="rm-btn-secondary" onClick={() => { setSelectedTemplate(selected ? null : template.id); setDraftTitle(`${template.name} Draft`); }}><CopyPlus size={15} /> Build draft</button>
                    <button className="template-archive" title="Archive template" disabled={busy === `archive:${template.id}`} onClick={() => void archiveTemplate(template.id)}>{busy === `archive:${template.id}` ? <LoaderCircle className="spin" size={15} /> : <Archive size={15} />}</button>
                  </div>
                </div>
                {selected && (
                  <div className="template-build-form">
                    <input className="rm-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="New draft paper name" />
                    <button className="rm-btn-primary" disabled={busy === `build:${template.id}`} onClick={() => void buildDraft(template)}>{busy === `build:${template.id}` ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Create draft paper</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <style>{`
        .paper-template-panel{margin-top:16px;border:1px solid #D9E8E5;border-radius:14px;padding:15px;background:#F9FCFB}.paper-template-panel>header{display:flex;justify-content:space-between;gap:12px;align-items:start}.paper-template-panel h2{font-size:19px;margin:4px 0}.paper-template-panel header p{margin:0;color:#667085;font-size:12px}.paper-template-panel header>svg{color:#0E5A5A}.template-message{padding:10px 12px;border-radius:10px;margin-top:10px;font-size:12px;font-weight:650}.template-message.error{background:#FEF3F2;color:#B42318}.template-message.success{background:#ECFDF3;color:#137A3A}.save-template-form{display:grid;grid-template-columns:1fr 1.3fr 220px auto;gap:8px;margin-top:13px}.template-list{display:grid;gap:8px;margin-top:12px}.template-list>article{border:1px solid #E4E7EC;border-radius:11px;background:white;overflow:hidden}.template-list>article.selected{border-color:#0E5A5A}.template-summary{display:flex;justify-content:space-between;gap:12px;padding:11px}.template-summary p{margin:3px 0;color:#667085;font-size:11px}.template-summary span{font-size:10px;color:#98A2B3;text-transform:capitalize}.template-summary>div:last-child{display:flex;gap:5px;align-items:start}.template-archive{border:1px solid #E4E7EC;background:white;color:#B42318;border-radius:8px;padding:7px;display:grid;place-items:center}.template-build-form{display:grid;grid-template-columns:1fr auto;gap:8px;padding:10px;border-top:1px solid #E7ECEB;background:#F7F9F7}.template-empty{padding:26px;text-align:center;color:#667085;border:1px dashed #D0D5DD;border-radius:11px;margin-top:12px}.template-empty p{margin:5px 0}
        @media(max-width:900px){.save-template-form{grid-template-columns:1fr 1fr}.template-summary{display:grid}.template-summary>div:last-child{justify-content:start}}
        @media(max-width:520px){.save-template-form,.template-build-form{grid-template-columns:1fr}}
      `}</style>
    </section>
  );
}
