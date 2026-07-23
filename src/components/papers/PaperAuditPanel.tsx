"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
  LoaderCircle,
  RefreshCw,
  Search,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuditRow = {
  id: number;
  paper_id: string;
  actor_id: string | null;
  actor_role: string | null;
  action: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  reason: string | null;
  created_at: string;
};

function actionLabel(action: string) {
  return action
    .replace(/^paper\./, "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function summarize(value: Record<string, unknown> | null) {
  if (!value) return "—";
  const entries = Object.entries(value).slice(0, 6);
  if (!entries.length) return "—";
  return entries
    .map(([key, item]) => {
      const rendered = typeof item === "object" ? JSON.stringify(item) : String(item);
      return `${key.replaceAll("_", " ")}: ${rendered}`;
    })
    .join(" · ");
}

export function PaperAuditPanel({ paperId }: { paperId: string | null }) {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(Boolean(paperId));
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const load = useCallback(async () => {
    const client = supabase;
    if (!client || !paperId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data, error: loadError } = await client
      .from("paper_audit_history")
      .select("id,paper_id,actor_id,actor_role,action,previous_value,new_value,reason,created_at")
      .eq("paper_id", paperId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (loadError) setError(loadError.message);
    else setRows((data || []) as AuditRow[]);
    setLoading(false);
  }, [paperId]);

  useEffect(() => {
    void load();
  }, [load]);

  const actions = useMemo(
    () => Array.from(new Set(rows.map((row) => row.action))).sort(),
    [rows],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const text = `${row.action} ${row.actor_role || ""} ${row.reason || ""} ${summarize(row.new_value)} ${summarize(row.previous_value)}`.toLowerCase();
      return (actionFilter === "all" || row.action === actionFilter) && (!query || text.includes(query));
    });
  }, [rows, search, actionFilter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  if (!paperId) return null;

  return (
    <section className="paper-audit-panel">
      <header>
        <div><span className="rm-label">Audit history</span><h2>Every important paper action</h2><p>Draft saves, duplication, generation, replacement, review, publication, versions and templates are recorded.</p></div>
        <button className="rm-btn-secondary" onClick={() => void load()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={15} /> : <RefreshCw size={15} />} Refresh</button>
      </header>
      {error && <div className="audit-error">{error}</div>}
      <div className="audit-filters">
        <div><Search size={15} /><input className="rm-input" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search action, role, reason or changed value" /></div>
        <label><Filter size={15} /><select className="rm-input" value={actionFilter} onChange={(event) => { setActionFilter(event.target.value); setPage(1); }}><option value="all">All actions</option>{actions.map((action) => <option key={action} value={action}>{actionLabel(action)}</option>)}</select></label>
      </div>
      {loading ? <div className="audit-empty"><LoaderCircle className="spin" size={24} /> Loading audit history…</div> : visible.length === 0 ? <div className="audit-empty"><Activity size={25} /><p>No matching audit records.</p></div> : <div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>Date</th><th>Action</th><th>Role</th><th>Reason</th><th>Previous value</th><th>New value</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{new Date(row.created_at).toLocaleString()}</td><td><strong>{actionLabel(row.action)}</strong></td><td>{row.actor_role?.replaceAll("_", " ") || "System"}</td><td>{row.reason || "—"}</td><td>{summarize(row.previous_value)}</td><td>{summarize(row.new_value)}</td></tr>)}</tbody></table></div>}
      <footer><span>{filtered.length} audit record{filtered.length === 1 ? "" : "s"}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={15} /> Previous</button><span>Page {page} of {pageCount}</span><button disabled={page >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>Next <ChevronRight size={15} /></button></div></footer>
      <style>{`
        .paper-audit-panel{margin-top:16px;border:1px solid #E4E7EC;border-radius:14px;padding:15px;background:white}.paper-audit-panel>header{display:flex;justify-content:space-between;gap:12px;align-items:start}.paper-audit-panel h2{font-size:19px;margin:4px 0}.paper-audit-panel header p{margin:0;color:#667085;font-size:12px}.audit-error{padding:10px;border-radius:9px;background:#FEF3F2;color:#B42318;margin-top:10px;font-size:12px}.audit-filters{display:grid;grid-template-columns:1fr 240px;gap:8px;margin-top:12px}.audit-filters>div,.audit-filters label{position:relative}.audit-filters svg{position:absolute;left:11px;top:12px;color:#98A2B3}.audit-filters input,.audit-filters select{padding-left:34px}.audit-table-wrap{overflow:auto;margin-top:10px;border:1px solid #EAECF0;border-radius:10px}.audit-table{width:100%;border-collapse:collapse;min-width:1100px}.audit-table th,.audit-table td{padding:9px 10px;border-bottom:1px solid #EAECF0;text-align:left;vertical-align:top;font-size:11px}.audit-table th{background:#F7F9F7;color:#667085}.audit-table td:nth-child(5),.audit-table td:nth-child(6){max-width:280px;color:#667085;line-height:1.4}.audit-empty{padding:28px;text-align:center;color:#667085;border:1px dashed #D0D5DD;border-radius:10px;margin-top:10px}.audit-empty p{margin:5px}.paper-audit-panel>footer{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:10px;font-size:11px;color:#667085}.paper-audit-panel>footer>div{display:flex;gap:7px;align-items:center}.paper-audit-panel footer button{border:1px solid #E4E7EC;background:white;border-radius:8px;padding:6px 8px;display:inline-flex;gap:4px;align-items:center}.paper-audit-panel footer button:disabled{opacity:.4}@media(max-width:650px){.audit-filters{grid-template-columns:1fr}.paper-audit-panel>header,.paper-audit-panel>footer{display:grid}}
      `}</style>
    </section>
  );
}
