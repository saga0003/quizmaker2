"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDashed,
  LoaderCircle,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { TaxonomyChapter, TaxonomySubject, TaxonomyTopic } from "@/types/questions";
import type { PaperCreationMode } from "@/types/papers";

type SectionRow = {
  id: string;
  title: string;
  code: string | null;
  subject_id: string | null;
  selection_mode: PaperCreationMode;
  display_order: number;
};

type BlueprintRule = {
  client_id: string;
  id?: string;
  section_id: string;
  rule_order: number;
  subject_id: string;
  chapter_id: string;
  topic_id: string;
  difficulty: string;
  question_type: string;
  positive_marks: string;
  negative_marks: string;
  estimated_seconds_min: string;
  estimated_seconds_max: string;
  language: string;
  required_tags: string;
  previous_usage_rule: "allow" | "prefer_unused" | "only_unused";
  requested_count: number;
};

type MatrixRow = {
  id: string;
  section_id: string;
  rule_order: number;
  subject_id: string | null;
  chapter_id: string | null;
  topic_id: string | null;
  difficulty: string | null;
  question_type: string | null;
  language: string | null;
  requested_count: number;
  selected_count: number;
  locked_count: number;
  available_count: number;
  candidate_count: number;
  previously_used_candidates: number;
  remaining_needed: number;
  shortage: number;
  surplus: number;
  status: "ready" | "warning" | "insufficient" | "no_questions";
};

type MatrixResult = {
  paper_id: string;
  rules: MatrixRow[];
  ready: boolean;
  refreshed_at: string;
};

type GenerationResult = {
  paper_id: string;
  generation_run_id: string;
  seed: string;
  generated_count: number;
  total_questions: number;
  total_marks: number;
  rules: Array<{
    rule_id: string;
    section_id?: string;
    requested?: number;
    locked?: number;
    generated?: number;
    status: string;
    message?: string;
  }>;
};

const newRule = (section: SectionRow, order: number): BlueprintRule => ({
  client_id: crypto.randomUUID(),
  section_id: section.id,
  rule_order: order,
  subject_id: section.subject_id || "",
  chapter_id: "",
  topic_id: "",
  difficulty: "",
  question_type: "",
  positive_marks: "",
  negative_marks: "",
  estimated_seconds_min: "",
  estimated_seconds_max: "",
  language: "English",
  required_tags: "",
  previous_usage_rule: "allow",
  requested_count: 1,
});

function readable(value: string | null | undefined) {
  return value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Any";
}

function displayError(message: string) {
  if (message.includes("Generation stopped because the blueprint has shortages")) {
    return "Generation stopped. Resolve the highlighted shortages before generating the paper.";
  }
  if (message.includes("not found or permission denied")) {
    return "This paper is unavailable or you no longer have permission to manage it.";
  }
  if (message.includes("Create a new version")) {
    return "This definition is already published or closed. Create a new version before changing its blueprint.";
  }
  return message;
}

export function PaperGenerationPanel({
  paperId,
  subjects,
  chapters,
  topics,
  onGenerated,
}: {
  paperId: string | null;
  organizationId: string | null;
  programmeCode: string;
  subjects: TaxonomySubject[];
  chapters: TaxonomyChapter[];
  topics: TaxonomyTopic[];
  onGenerated: () => void;
}) {
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [rules, setRules] = useState<BlueprintRule[]>([]);
  const [matrix, setMatrix] = useState<MatrixResult | null>(null);
  const [loading, setLoading] = useState(Boolean(paperId));
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [seed, setSeed] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [lastRun, setLastRun] = useState<GenerationResult | null>(null);

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !paperId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [sectionResult, ruleResult] = await Promise.all([
      client
        .from("paper_sections")
        .select("id,title,code,subject_id,selection_mode,display_order")
        .eq("paper_id", paperId)
        .order("display_order"),
      client
        .from("paper_blueprints")
        .select("id,section_id,rule_order,subject_id,chapter_id,topic_id,difficulty,question_type,positive_marks,negative_marks,estimated_seconds_min,estimated_seconds_max,language,required_tags,previous_usage_rule,requested_count")
        .eq("paper_id", paperId)
        .order("rule_order"),
    ]);
    if (sectionResult.error || ruleResult.error) {
      setError(displayError(sectionResult.error?.message || ruleResult.error?.message || "Unable to load the generation blueprint."));
      setLoading(false);
      return;
    }
    const loadedSections = (sectionResult.data || []) as SectionRow[];
    setSections(loadedSections);
    const loadedRules: BlueprintRule[] = (ruleResult.data || []).map((rule) => ({
      client_id: rule.id,
      id: rule.id,
      section_id: rule.section_id,
      rule_order: Number(rule.rule_order || 0),
      subject_id: rule.subject_id || "",
      chapter_id: rule.chapter_id || "",
      topic_id: rule.topic_id || "",
      difficulty: rule.difficulty || "",
      question_type: rule.question_type || "",
      positive_marks: rule.positive_marks === null ? "" : String(rule.positive_marks),
      negative_marks: rule.negative_marks === null ? "" : String(rule.negative_marks),
      estimated_seconds_min: rule.estimated_seconds_min === null ? "" : String(rule.estimated_seconds_min),
      estimated_seconds_max: rule.estimated_seconds_max === null ? "" : String(rule.estimated_seconds_max),
      language: rule.language || "English",
      required_tags: (rule.required_tags || []).join(", "),
      previous_usage_rule: (rule.previous_usage_rule || "allow") as BlueprintRule["previous_usage_rule"],
      requested_count: Number(rule.requested_count || 1),
    }));
    setRules(loadedRules);
    setExpanded(new Set(loadedRules.map((rule) => rule.client_id)));
    if (loadedRules.length > 0) {
      const { data, error: matrixError } = await client.rpc("refresh_paper_blueprint_availability_v8", {
        p_paper_id: paperId,
      });
      if (matrixError) setError(displayError(matrixError.message));
      else setMatrix(data as MatrixResult);
    } else {
      setMatrix(null);
    }
    setLoading(false);
  }, [paperId]);

  useEffect(() => {
    void load();
  }, [load]);

  const generationSections = useMemo(
    () => sections.filter((section) => section.selection_mode === "automatic" || section.selection_mode === "hybrid"),
    [sections],
  );

  const rulesBySection = useMemo(() => {
    const grouped = new Map<string, BlueprintRule[]>();
    sections.forEach((section) => grouped.set(section.id, []));
    rules.forEach((rule) => grouped.set(rule.section_id, [...(grouped.get(rule.section_id) || []), rule]));
    return grouped;
  }, [sections, rules]);

  const matrixByRule = useMemo(
    () => new Map((matrix?.rules || []).map((row) => [row.id, row])),
    [matrix],
  );

  function updateRule(clientId: string, patch: Partial<BlueprintRule>) {
    setRules((current) =>
      current.map((rule) => (rule.client_id === clientId ? { ...rule, ...patch } : rule)),
    );
    setMatrix(null);
    setNotice("");
  }

  function addRule(section: SectionRow) {
    const rule = newRule(section, rules.length);
    setRules((current) => [...current, rule]);
    setExpanded((current) => new Set(current).add(rule.client_id));
    setMatrix(null);
  }

  function removeRule(clientId: string) {
    setRules((current) =>
      current
        .filter((rule) => rule.client_id !== clientId)
        .map((rule, index) => ({ ...rule, rule_order: index })),
    );
    setExpanded((current) => {
      const next = new Set(current);
      next.delete(clientId);
      return next;
    });
    setMatrix(null);
  }

  function moveRule(clientId: string, direction: -1 | 1) {
    const index = rules.findIndex((rule) => rule.client_id === clientId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rules.length) return;
    const next = [...rules];
    [next[index], next[target]] = [next[target], next[index]];
    setRules(next.map((rule, order) => ({ ...rule, rule_order: order })));
    setMatrix(null);
  }

  async function updateSectionMode(sectionId: string, mode: PaperCreationMode) {
    const client = supabase;
    if (!client || !paperId) return;
    setError("");
    const { error: updateError } = await client
      .from("paper_sections")
      .update({ selection_mode: mode })
      .eq("id", sectionId)
      .eq("paper_id", paperId);
    if (updateError) {
      setError(displayError(updateError.message));
      return;
    }
    setSections((current) =>
      current.map((section) => (section.id === sectionId ? { ...section, selection_mode: mode } : section)),
    );
    if (mode === "automatic" || mode === "hybrid") {
      const section = sections.find((value) => value.id === sectionId);
      if (section && !(rulesBySection.get(sectionId) || []).length) addRule({ ...section, selection_mode: mode });
    }
    setNotice(`Section mode changed to ${readable(mode)}.`);
  }

  async function saveBlueprint(showNotice = true) {
    const client = supabase;
    if (!client || !paperId) return false;
    if (rules.some((rule) => !rule.section_id || rule.requested_count < 1)) {
      setError("Every blueprint row needs a section and a requested count of at least one question.");
      return false;
    }
    setSaving(true);
    setError("");
    if (showNotice) setNotice("");
    const payload = rules.map((rule, index) => ({
      id: rule.id || null,
      section_id: rule.section_id,
      rule_order: index,
      subject_id: rule.subject_id || null,
      chapter_id: rule.chapter_id || null,
      topic_id: rule.topic_id || null,
      difficulty: rule.difficulty || null,
      question_type: rule.question_type || null,
      positive_marks: rule.positive_marks || null,
      negative_marks: rule.negative_marks || null,
      estimated_seconds_min: rule.estimated_seconds_min || null,
      estimated_seconds_max: rule.estimated_seconds_max || null,
      language: rule.language || null,
      required_tags: rule.required_tags.split(/[,|]/).map((tag) => tag.trim()).filter(Boolean),
      excluded_question_ids: [],
      previous_usage_rule: rule.previous_usage_rule,
      requested_count: rule.requested_count,
      metadata: {},
    }));
    const { data, error: saveError } = await client.rpc("save_paper_blueprints_v8", {
      p_paper_id: paperId,
      p_rules: payload,
    });
    setSaving(false);
    if (saveError) {
      setError(displayError(saveError.message));
      return false;
    }
    setMatrix(data as MatrixResult);
    if (showNotice) setNotice("Blueprint saved and availability recalculated.");
    await load();
    return true;
  }

  async function generate(sectionId?: string, ruleId?: string) {
    const client = supabase;
    if (!client || !paperId) return;
    const saved = await saveBlueprint(false);
    if (!saved) return;
    const key = ruleId ? `rule:${ruleId}` : sectionId ? `section:${sectionId}` : "all";
    setGenerating(key);
    setError("");
    setNotice("");
    const { data, error: generationError } = await client.rpc("generate_paper_from_blueprint_v8", {
      p_paper_id: paperId,
      p_section_id: sectionId || null,
      p_rule_id: ruleId || null,
      p_seed: seed.trim() || null,
    });
    setGenerating("");
    if (generationError) {
      setError(displayError(generationError.message));
      await load();
      return;
    }
    const result = data as GenerationResult;
    setLastRun(result);
    setSeed(result.seed);
    setNotice(`${result.generated_count} question${result.generated_count === 1 ? "" : "s"} generated. Seed ${result.seed} can reproduce this selection.`);
    await load();
    onGenerated();
  }

  if (!paperId) {
    return (
      <div>
        <div className="generation-heading">
          <div>
            <span className="rm-label">Step 5</span>
            <h1>Automatic and hybrid blueprint</h1>
            <p>Save the paper draft once before creating database-backed generation rules.</p>
          </div>
        </div>
        <div className="generation-empty">
          <Save size={30} />
          <h3>Save this paper first</h3>
          <p>The first draft save creates the paper and section IDs required for a reproducible blueprint.</p>
        </div>
        <GenerationStyles />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="generation-empty">
        <LoaderCircle className="spin" size={28} />
        <p>Loading blueprint and exact Question Bank availability…</p>
        <GenerationStyles />
      </div>
    );
  }

  return (
    <section>
      <div className="generation-heading">
        <div>
          <span className="rm-label">Step 5</span>
          <h1>Automatic and hybrid blueprint</h1>
          <p>Requested counts are checked against approved Question Bank records before anything is generated.</p>
        </div>
        <div className="generation-actions">
          <button className="rm-btn-secondary" onClick={() => void saveBlueprint()} disabled={saving || rules.length === 0}>
            {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />} Save blueprint
          </button>
          <button className="rm-btn-primary" onClick={() => void generate()} disabled={Boolean(generating) || generationSections.length === 0 || rules.length === 0 || matrix?.ready === false}>
            {generating === "all" ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />} Generate paper
          </button>
        </div>
      </div>

      {error && <div className="generation-message error"><AlertCircle size={17} /> {error}</div>}
      {notice && <div className="generation-message success"><CheckCircle2 size={17} /> {notice}</div>}

      <div className="seed-panel">
        <div>
          <strong>Reproducible random seed</strong>
          <p>Leave blank for a secure new seed. Reuse a previous seed to reproduce the same eligible ordering.</p>
        </div>
        <input className="rm-input" value={seed} onChange={(event) => setSeed(event.target.value)} placeholder="Generated automatically" />
      </div>

      <div className="generation-guide">
        <div><strong>Automatic</strong><span>Every unlocked question in the section may be regenerated from its blueprint.</span></div>
        <div><strong>Hybrid</strong><span>Locked manual questions stay fixed and reduce the number the generator must add.</span></div>
        <div><strong>Manual</strong><span>No blueprint generation runs for that section.</span></div>
      </div>

      {sections.length === 0 ? (
        <div className="generation-empty"><AlertCircle size={28} /><p>Create and save at least one paper section.</p></div>
      ) : (
        <div className="generation-sections">
          {sections.map((section) => {
            const sectionRules = rulesBySection.get(section.id) || [];
            const generative = section.selection_mode === "automatic" || section.selection_mode === "hybrid";
            const sectionMatrix = matrix?.rules.filter((row) => row.section_id === section.id) || [];
            const sectionShortage = sectionMatrix.reduce((sum, row) => sum + row.shortage, 0);
            return (
              <article key={section.id} className={generative ? "generative" : "manual"}>
                <header>
                  <div>
                    <span>{section.code || `Section ${section.display_order + 1}`}</span>
                    <h2>{section.title}</h2>
                    <p>{sectionRules.length} blueprint row{sectionRules.length === 1 ? "" : "s"} · {sectionShortage ? `${sectionShortage} question shortage` : "No current shortage"}</p>
                  </div>
                  <div className="section-generation-controls">
                    <select className="rm-input" value={section.selection_mode} onChange={(event) => void updateSectionMode(section.id, event.target.value as PaperCreationMode)}>
                      <option value="manual">Manual</option>
                      <option value="automatic">Automatic</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                    {generative && (
                      <button className="rm-btn-secondary" disabled={Boolean(generating) || sectionRules.length === 0 || sectionShortage > 0} onClick={() => void generate(section.id)}>
                        {generating === `section:${section.id}` ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Regenerate section
                      </button>
                    )}
                  </div>
                </header>

                {!generative ? (
                  <div className="manual-section-note">This section uses exact manual selection. Change its mode to Automatic or Hybrid to add blueprint rows.</div>
                ) : (
                  <>
                    <div className="blueprint-rules">
                      {sectionRules.map((rule, sectionRuleIndex) => {
                        const metrics = rule.id ? matrixByRule.get(rule.id) : undefined;
                        const open = expanded.has(rule.client_id);
                        const filteredChapters = rule.subject_id ? chapters.filter((chapter) => chapter.subject_id === rule.subject_id) : chapters;
                        const filteredTopics = rule.chapter_id ? topics.filter((topic) => topic.chapter_id === rule.chapter_id) : topics;
                        return (
                          <article key={rule.client_id} className={`blueprint-rule ${metrics?.status || "pending"}`}>
                            <div className="rule-summary">
                              <button type="button" className="expand-rule" onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(rule.client_id)) next.delete(rule.client_id); else next.add(rule.client_id); return next; })}>
                                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                              <div className="rule-title">
                                <strong>Rule {sectionRuleIndex + 1}</strong>
                                <span>{subjects.find((subject) => subject.id === rule.subject_id)?.name || "Any subject"} · {readable(rule.difficulty)} · {readable(rule.question_type)}</span>
                              </div>
                              <div className="rule-metrics">
                                <span><strong>{rule.requested_count}</strong> requested</span>
                                <span><strong>{metrics?.locked_count ?? 0}</strong> locked</span>
                                <span><strong>{metrics?.candidate_count ?? "–"}</strong> candidates</span>
                                <span className={metrics?.shortage ? "shortage" : "ready"}><strong>{metrics?.shortage ?? "–"}</strong> shortage</span>
                              </div>
                              <div className="rule-actions">
                                <button title="Move rule up" onClick={() => moveRule(rule.client_id, -1)}><ChevronUp size={15} /></button>
                                <button title="Move rule down" onClick={() => moveRule(rule.client_id, 1)}><ChevronDown size={15} /></button>
                                {rule.id && <button title="Regenerate this blueprint row" disabled={Boolean(generating) || Boolean(metrics?.shortage)} onClick={() => void generate(undefined, rule.id)}>{generating === `rule:${rule.id}` ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />}</button>}
                                <button title="Remove rule" className="danger" onClick={() => removeRule(rule.client_id)}><Trash2 size={15} /></button>
                              </div>
                            </div>

                            {open && (
                              <div className="rule-fields">
                                <label><span>Subject</span><select className="rm-input" value={rule.subject_id} onChange={(event) => updateRule(rule.client_id, { subject_id: event.target.value, chapter_id: "", topic_id: "" })}><option value="">Any subject</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                                <label><span>Chapter</span><select className="rm-input" value={rule.chapter_id} onChange={(event) => updateRule(rule.client_id, { chapter_id: event.target.value, topic_id: "" })}><option value="">Any chapter</option>{filteredChapters.map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.name}</option>)}</select></label>
                                <label><span>Topic</span><select className="rm-input" value={rule.topic_id} onChange={(event) => updateRule(rule.client_id, { topic_id: event.target.value })}><option value="">Any topic</option>{filteredTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.name}</option>)}</select></label>
                                <label><span>Difficulty</span><select className="rm-input" value={rule.difficulty} onChange={(event) => updateRule(rule.client_id, { difficulty: event.target.value })}><option value="">Any difficulty</option>{["very_easy","easy","moderate","difficult","very_difficult"].map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></label>
                                <label><span>Question type</span><select className="rm-input" value={rule.question_type} onChange={(event) => updateRule(rule.client_id, { question_type: event.target.value })}><option value="">Any type</option>{["single_correct","multiple_correct","numerical","integer","assertion_reason","match_following","passage","image_based"].map((value) => <option key={value} value={value}>{readable(value)}</option>)}</select></label>
                                <label><span>Questions required</span><input type="number" min={1} className="rm-input" value={rule.requested_count} onChange={(event) => updateRule(rule.client_id, { requested_count: Math.max(1, Number(event.target.value)) })} /></label>
                                <label><span>Positive marks override</span><input type="number" step="0.25" className="rm-input" value={rule.positive_marks} onChange={(event) => updateRule(rule.client_id, { positive_marks: event.target.value })} placeholder="Question Bank marks" /></label>
                                <label><span>Negative marks override</span><input type="number" step="0.25" className="rm-input" value={rule.negative_marks} onChange={(event) => updateRule(rule.client_id, { negative_marks: event.target.value })} placeholder="Question Bank marks" /></label>
                                <label><span>Previous use rule</span><select className="rm-input" value={rule.previous_usage_rule} onChange={(event) => updateRule(rule.client_id, { previous_usage_rule: event.target.value as BlueprintRule["previous_usage_rule"] })}><option value="allow">Allow previously used</option><option value="prefer_unused">Prefer unused</option><option value="only_unused">Use only unused</option></select></label>
                                <label><span>Language</span><select className="rm-input" value={rule.language} onChange={(event) => updateRule(rule.client_id, { language: event.target.value })}>{["English","Kannada","Hindi","Bilingual"].map((value) => <option key={value}>{value}</option>)}</select></label>
                                <label className="wide"><span>Required tags</span><input className="rm-input" value={rule.required_tags} onChange={(event) => updateRule(rule.client_id, { required_tags: event.target.value })} placeholder="mechanics, numerical" /></label>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                    <button className="add-rule" onClick={() => addRule(section)}><Plus size={16} /> Add blueprint row</button>
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}

      {matrix && (
        <div className={`matrix-summary ${matrix.ready ? "ready" : "blocked"}`}>
          {matrix.ready ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <div>
            <strong>{matrix.ready ? "Blueprint is ready to generate" : "Blueprint has shortages"}</strong>
            <span>{matrix.rules.reduce((sum, row) => sum + row.requested_count, 0)} requested · {matrix.rules.reduce((sum, row) => sum + row.locked_count, 0)} locked · {matrix.rules.reduce((sum, row) => sum + row.shortage, 0)} shortage</span>
          </div>
        </div>
      )}

      {lastRun && (
        <div className="last-run">
          <Sparkles size={19} />
          <div><strong>Generation run completed</strong><span>{lastRun.generated_count} generated · {lastRun.total_questions} total questions · {lastRun.total_marks} marks · Seed {lastRun.seed}</span></div>
        </div>
      )}
      <GenerationStyles />
    </section>
  );
}

function GenerationStyles() {
  return (
    <style>{`
      .generation-heading{display:flex;justify-content:space-between;gap:14px;align-items:start;margin-bottom:16px}.generation-heading h1{font-size:25px;margin:4px 0}.generation-heading p{margin:0;color:#667085;line-height:1.5}.generation-actions{display:flex;gap:8px;flex-wrap:wrap}.generation-message{display:flex;gap:8px;align-items:center;padding:11px 13px;border-radius:11px;margin-bottom:12px;font-weight:650}.generation-message.error{background:#FEF3F2;color:#B42318}.generation-message.success{background:#ECFDF3;color:#137A3A}.generation-empty{padding:44px;text-align:center;border:1px dashed #D0D5DD;border-radius:14px;color:#667085}.generation-empty h3{color:#14232B;margin:8px 0 4px}.seed-panel{display:grid;grid-template-columns:1fr minmax(220px,360px);gap:14px;align-items:center;padding:13px;border:1px solid #E7ECEB;border-radius:13px;background:#F7F9F7}.seed-panel p{margin:4px 0 0;color:#667085;font-size:12px}.generation-guide{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.generation-guide>div{padding:11px;border:1px solid #E4E7EC;border-radius:11px}.generation-guide strong{display:block;font-size:13px}.generation-guide span{display:block;margin-top:3px;color:#667085;font-size:11px;line-height:1.45}.generation-sections{display:grid;gap:13px;margin-top:14px}.generation-sections>article{border:1px solid #E4E7EC;border-radius:14px;overflow:hidden}.generation-sections>article.generative{border-color:#A6D8C8}.generation-sections>article>header{display:flex;justify-content:space-between;gap:12px;padding:13px 14px;background:#F7F9F7}.generation-sections>article.generative>header{background:#EAF4F2}.generation-sections header span{font-size:10px;color:#667085}.generation-sections header h2{margin:3px 0;font-size:18px}.generation-sections header p{margin:0;color:#667085;font-size:11px}.section-generation-controls{display:flex;gap:7px;align-items:center;flex-wrap:wrap}.section-generation-controls select{min-width:125px}.manual-section-note{padding:15px;color:#667085;font-size:12px}.blueprint-rules{display:grid;gap:8px;padding:10px}.blueprint-rule{border:1px solid #E4E7EC;border-radius:11px;overflow:hidden}.blueprint-rule.insufficient,.blueprint-rule.no_questions{border-color:#E5B5B5}.blueprint-rule.warning{border-color:#F2B84B}.blueprint-rule.ready{border-color:#A6D8C8}.rule-summary{display:grid;grid-template-columns:30px minmax(160px,1fr) auto auto;gap:8px;align-items:center;padding:10px;background:white}.expand-rule{border:0;background:#F2F4F7;border-radius:8px;width:28px;height:28px;display:grid;place-items:center}.rule-title{display:grid}.rule-title span{font-size:10px;color:#667085;margin-top:2px}.rule-metrics{display:flex;gap:6px;flex-wrap:wrap}.rule-metrics span{padding:5px 7px;border-radius:8px;background:#F2F4F7;font-size:10px;color:#667085}.rule-metrics span strong{color:#14232B}.rule-metrics span.shortage{background:#FEF3F2;color:#B42318}.rule-metrics span.shortage strong{color:#B42318}.rule-metrics span.ready{background:#ECFDF3;color:#137A3A}.rule-actions{display:flex;gap:4px}.rule-actions button{border:1px solid #E4E7EC;background:white;border-radius:7px;padding:5px;display:grid;place-items:center}.rule-actions button.danger{color:#B42318}.rule-actions button:disabled{opacity:.4}.rule-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:12px;border-top:1px solid #E7ECEB;background:#FDFEFE}.rule-fields label{display:grid;gap:5px;font-size:10px;color:#667085;font-weight:650}.rule-fields label.wide{grid-column:1/-1}.add-rule{margin:0 10px 10px;border:1px dashed #98A2B3;background:white;border-radius:9px;padding:8px 11px;display:inline-flex;gap:6px;align-items:center;color:#0E5A5A;font-weight:700}.matrix-summary,.last-run{display:flex;gap:9px;align-items:center;margin-top:13px;padding:12px;border-radius:12px}.matrix-summary>div,.last-run>div{display:grid}.matrix-summary span,.last-run span{font-size:11px;margin-top:2px}.matrix-summary.ready,.last-run{background:#ECFDF3;color:#137A3A}.matrix-summary.blocked{background:#FEF3F2;color:#B42318}
      @media(max-width:900px){.rule-summary{grid-template-columns:30px 1fr}.rule-metrics,.rule-actions{grid-column:2}.rule-fields{grid-template-columns:1fr 1fr}.generation-guide{grid-template-columns:1fr}.seed-panel{grid-template-columns:1fr}}
      @media(max-width:560px){.generation-heading,.generation-sections>article>header{display:grid}.rule-fields{grid-template-columns:1fr}.rule-fields label.wide{grid-column:1}.rule-summary{grid-template-columns:30px 1fr}.section-generation-controls{display:grid}.generation-actions{display:grid}}
    `}</style>
  );
}
