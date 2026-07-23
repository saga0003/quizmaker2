"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, Copy, History, LoaderCircle, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";

type GenerationRun = {
  id: string;
  paper_version: number;
  random_seed: string;
  generation_mode: "automatic" | "hybrid" | "regeneration" | "replacement";
  selected_question_ids: string[] | null;
  regenerated_sections: string[] | null;
  replaced_questions: Array<unknown> | null;
  shortages: Array<unknown> | null;
  created_at: string;
};

export function PaperGenerationHistory({
  paperId,
  refreshKey,
  onReuseSeed,
}: {
  paperId: string | null;
  refreshKey?: string;
  onReuseSeed: (seed: string) => void;
}) {
  const [runs, setRuns] = useState<GenerationRun[]>([]);
  const [loading, setLoading] = useState(Boolean(paperId));
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !paperId) { setLoading(false); return; }
    setLoading(true); setError("");
    const result = await supabase
      .from("paper_generation_runs")
      .select("id,paper_version,random_seed,generation_mode,selected_question_ids,regenerated_sections,replaced_questions,shortages,created_at")
      .eq("paper_id", paperId)
      .order("created_at", { ascending: false })
      .limit(12);
    if (result.error) setError(result.error.message);
    else setRuns((result.data || []) as GenerationRun[]);
    setLoading(false);
  }, [paperId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  async function copySeed(seed: string) {
    await navigator.clipboard.writeText(seed);
    setCopied(seed);
    window.setTimeout(() => setCopied(""), 1200);
  }

  if (!paperId) return null;

  return <section className="generation-history">
    <header><div><span className="rm-label">Generation history</span><h2>Reproducible runs</h2><p>Every automatic, hybrid, regeneration and replacement run stores its seed and scope.</p></div><button className="rm-btn-secondary" onClick={() => void load()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15}/> : <RotateCcw size={15}/>}Refresh</button></header>
    {error && <div className="history-error">{error}</div>}
    {loading ? <div className="history-empty"><LoaderCircle className="spin"/>Loading generation history…</div> : runs.length === 0 ? <div className="history-empty"><History size={25}/><span>No generation run has been recorded yet.</span></div> : <div className="history-list">{runs.map((run) => <article key={run.id}><div className="history-icon"><Clock3 size={16}/></div><div className="history-main"><strong>{run.generation_mode.replaceAll("_", " ")}</strong><span>Version {run.paper_version} · {new Date(run.created_at).toLocaleString()}</span><code>{run.random_seed}</code></div><div className="history-metrics"><span>{run.selected_question_ids?.length || 0} selected</span><span>{run.regenerated_sections?.length || 0} sections</span><span>{run.replaced_questions?.length || 0} replaced</span><span>{run.shortages?.length || 0} shortages</span></div><div className="history-actions"><button title="Use this seed" onClick={() => onReuseSeed(run.random_seed)}><RotateCcw size={14}/>Use seed</button><button title="Copy seed" onClick={() => void copySeed(run.random_seed)}><Copy size={14}/>{copied === run.random_seed ? "Copied" : "Copy"}</button></div></article>)}</div>}
    <style>{`.generation-history{margin-top:14px;border:1px solid #D9E8E5;border-radius:14px;padding:14px;background:#F9FCFB}.generation-history>header{display:flex;justify-content:space-between;gap:12px;align-items:start}.generation-history h2{margin:4px 0;font-size:19px}.generation-history header p{margin:0;color:#667085;font-size:12px}.history-error{margin-top:10px;padding:10px;border-radius:9px;background:#FEF3F2;color:#B42318;font-size:12px}.history-empty{display:flex;gap:8px;align-items:center;justify-content:center;padding:26px;color:#667085}.history-list{display:grid;gap:8px;margin-top:12px}.history-list article{display:grid;grid-template-columns:34px minmax(190px,1fr) auto auto;gap:10px;align-items:center;border:1px solid #E4E7EC;border-radius:11px;padding:10px;background:white}.history-icon{display:grid;height:32px;width:32px;place-items:center;border-radius:9px;background:#EAF4F2;color:#0E5A5A}.history-main{display:grid;gap:2px}.history-main strong{text-transform:capitalize}.history-main span{font-size:10px;color:#667085}.history-main code{width:max-content;max-width:240px;overflow:hidden;text-overflow:ellipsis;font-size:10px;color:#475467}.history-metrics{display:flex;gap:5px;flex-wrap:wrap}.history-metrics span{border-radius:999px;background:#F2F4F7;padding:3px 7px;font-size:9px;color:#667085}.history-actions{display:flex;gap:5px}.history-actions button{display:inline-flex;gap:4px;align-items:center;border:1px solid #E4E7EC;border-radius:8px;background:white;padding:6px 8px;font-size:10px;font-weight:700;color:#0E5A5A}@media(max-width:850px){.history-list article{grid-template-columns:34px 1fr}.history-metrics,.history-actions{grid-column:2}}`}</style>
  </section>;
}
