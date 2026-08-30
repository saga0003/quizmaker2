'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert, FileUp, FolderOpen, LoaderCircle, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const CHUNK_SIZE = 25;
type ImportRow = Record<string, unknown>;
type ImportBatch = { batch: Record<string, unknown>; rows: ImportRow[] };
type V19Root = {
  format?: string;
  package_version?: string;
  question_count?: number;
  batches: ImportBatch[];
};
type V19Segment = { asset?: string; url?: string; viewBox?: number[]; page?: number };

type ReviewRow = {
  id: string;
  source_question_number: number | null;
  source_subject: string;
  source_exam_label: string;
  source_year: number | null;
  source_flag: string | null;
  working_stem_latex: string;
  source_answer_text: string | null;
  working_solution_latex: string | null;
  answer_status: string;
  workflow_status: string;
  review_priority: number;
  promoted_question_id: string | null;
};
type QueuePayload = {
  rows: ReviewRow[];
  batches: Array<{ id: string; external_batch_id: string; source_file_name: string; status: string; total_rows: number; imported_rows: number; failed_rows: number }>;
  page: number; total: number; totalPages: number;
  summary: { staged: number; promoted: number; flagged: number; taxonomyMapped: number; taxonomyReview: number };
};

async function accessToken() {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error(error?.message || 'Sign in again.');
  return data.session.access_token;
}

async function api(path: string, init?: RequestInit) {
  const token = await accessToken();
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'PYQ operation failed.');
  return payload;
}

function normalizeFilePayload(value: unknown): ImportBatch[] {
  if (!value || typeof value !== 'object') throw new Error('This is not an Evidara PYQ import file.');
  const root = value as Record<string, unknown>;
  if (Array.isArray(root.batches)) {
    return root.batches.map((item) => {
      const batch = item as Record<string, unknown>;
      if (!batch.batch || !Array.isArray(batch.rows)) throw new Error('One of the archive batches is invalid.');
      return { batch: batch.batch as Record<string, unknown>, rows: batch.rows as ImportRow[] };
    });
  }
  if (root.batch && Array.isArray(root.rows)) return [{ batch: root.batch as Record<string, unknown>, rows: root.rows as ImportRow[] }];
  throw new Error('Choose a valid Evidara PYQ archive. For V19, use the Choose V19 Folder button so the visual assets are uploaded together.');
}

function isV19Archive(value: unknown): value is V19Root {
  if (!value || typeof value !== 'object') return false;
  const root = value as Record<string, unknown>;
  return root.format === 'evidara-neet-pyq-archive-v19' && root.package_version === 'v19.0' && Array.isArray(root.batches);
}

function fileArchivePath(file: File) {
  const raw = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
  const normalized = raw.replaceAll('\\', '/');
  const assetIndex = normalized.indexOf('/assets/');
  if (assetIndex >= 0) return normalized.slice(assetIndex + 1);
  if (normalized.startsWith('assets/')) return normalized;
  return file.name;
}

function v19Assets(root: V19Root) {
  const assets = new Set<string>();
  for (const item of root.batches) for (const row of item.rows) {
    const render = row.v19_render && typeof row.v19_render === 'object' ? row.v19_render as Record<string, unknown> : {};
    for (const field of ['prompt_segments', 'solution_segments']) {
      const segments = Array.isArray(render[field]) ? render[field] as V19Segment[] : [];
      for (const segment of segments) if (segment.asset) assets.add(String(segment.asset).replaceAll('\\', '/'));
    }
  }
  return [...assets].sort();
}

function withV19AssetUrls(row: ImportRow, urls: Map<string, string>) {
  const render = row.v19_render && typeof row.v19_render === 'object' ? row.v19_render as Record<string, unknown> : {};
  const rewrite = (value: unknown) => (Array.isArray(value) ? value as V19Segment[] : []).map((segment) => ({
    ...segment,
    url: segment.asset ? urls.get(String(segment.asset).replaceAll('\\', '/')) : segment.url,
  }));
  return { ...row, v19_render: { ...render, prompt_segments: rewrite(render.prompt_segments), solution_segments: rewrite(render.solution_segments) } };
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}


export function NeetPyqImporter({ open, onOpenChange, onPromoted }: { open: boolean; onOpenChange: (value: boolean) => void; onPromoted?: () => void }) {
  const [tab, setTab] = useState('import');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [progress, setProgress] = useState({ done: 0, total: 0, batch: '' });
  const [queue, setQueue] = useState<QueuePayload | null>(null);
  const [page, setPage] = useState(1);
  const [year, setYear] = useState('all');
  const [subject, setSubject] = useState('all');
  const [flagged, setFlagged] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const loadQueue = useCallback(async () => {
    if (!open) return;
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '50', year, subject, flagged });
      const payload = await api(`/api/admin/pyq-staging-import/?${params.toString()}`) as QueuePayload;
      setQueue(payload);
      setSelected([]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load PYQ review queue.'); }
  }, [open, page, year, subject, flagged]);

  useEffect(() => { if (open) void loadQueue(); }, [open, loadQueue]);
  useEffect(() => { setPage(1); }, [year, subject, flagged]);

  async function importFile(file: File) {
    setBusy(true); setError(''); setMessage('');
    try {
      const text = await file.text();
      const batches = normalizeFilePayload(JSON.parse(text));
      const total = batches.reduce((sum, batch) => sum + batch.rows.length, 0);
      let done = 0;
      setProgress({ done: 0, total, batch: '' });
      for (const item of batches) {
        const label = String(item.batch.external_batch_id || item.batch.source_file_name || 'NEET PYQ');
        for (let offset = 0; offset < item.rows.length; offset += CHUNK_SIZE) {
          const chunk = item.rows.slice(offset, offset + CHUNK_SIZE);
          await api('/api/admin/pyq-staging-import/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'importChunk', batch: item.batch, rows: chunk }),
          });
          done += chunk.length;
          setProgress({ done, total, batch: label });
        }
      }
      setMessage(`${done.toLocaleString('en-IN')} questions transferred to the legacy staging queue. Use V19 folder import for the production workflow. Nothing was published automatically.`);
      setTab('review');
      setPage(1);
      await loadQueue();
    } catch (e) { setError(e instanceof Error ? e.message : 'Import failed.'); }
    finally { setBusy(false); }
  }

  async function importV19Folder(files: FileList | File[]) {
    setBusy(true); setError(''); setMessage('');
    try {
      const list = Array.from(files);
      const master = list.find((file) => file.name === 'NEET_2016_2026_ALL_BATCHES_PYQ_V19_READY.json')
        || list.find((file) => file.name.endsWith('_PYQ_V19_READY.json') && !(file as File & { webkitRelativePath?: string }).webkitRelativePath?.includes('/20'));
      if (!master) throw new Error('Select the extracted NEET_2016_2026_EVIDARA_PYQ_V19_READY folder. The V19 master JSON was not found.');
      const root = JSON.parse(await master.text()) as unknown;
      if (!isV19Archive(root)) throw new Error('The selected folder is not the Evidara V19 asset-aware NEET archive.');

      const requiredAssets = v19Assets(root);
      const fileMap = new Map<string, File>();
      for (const file of list) fileMap.set(fileArchivePath(file), file);
      const missing = requiredAssets.filter((path) => !fileMap.has(path));
      if (missing.length) throw new Error(`The V19 folder is incomplete: ${missing.length} visual asset${missing.length === 1 ? '' : 's'} are missing. Re-extract the complete V19 ZIP and select its root folder.`);

      const totalQuestions = root.batches.reduce((sum, item) => sum + item.rows.length, 0);
      const totalWork = requiredAssets.length + totalQuestions;
      let assetsDone = 0;
      const urls = new Map<string, string>();
      setProgress({ done: 0, total: totalWork, batch: `Uploading ${requiredAssets.length.toLocaleString('en-IN')} source-fidelity visual assets…` });

      await runWithConcurrency(requiredAssets, 4, async (path) => {
        const file = fileMap.get(path)!;
        const form = new FormData();
        form.append('file', file, file.name);
        form.append('path', path);
        const payload = await api('/api/admin/pyq-v19-assets/', { method: 'POST', body: form }) as { publicUrl: string };
        urls.set(path, payload.publicUrl);
        assetsDone += 1;
        setProgress({ done: assetsDone, total: totalWork, batch: `Uploading source-fidelity visual assets (${assetsDone.toLocaleString('en-IN')} / ${requiredAssets.length.toLocaleString('en-IN')})` });
      });

      let questionsDone = 0;
      for (const item of root.batches) {
        const label = String(item.batch.source_paper && typeof item.batch.source_paper === 'object'
          ? (item.batch.source_paper as Record<string, unknown>).display_name || item.batch.external_batch_id
          : item.batch.external_batch_id || 'NEET PYQ');
        for (let offset = 0; offset < item.rows.length; offset += CHUNK_SIZE) {
          const rows = item.rows.slice(offset, offset + CHUNK_SIZE).map((row) => withV19AssetUrls(row, urls));
          await api('/api/admin/pyq-staging-import/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'importV19Direct', batch: item.batch, rows }),
          });
          questionsDone += rows.length;
          setProgress({ done: requiredAssets.length + questionsDone, total: totalWork, batch: `${label}: ${questionsDone.toLocaleString('en-IN')} / ${totalQuestions.toLocaleString('en-IN')} questions` });
        }
      }
      setMessage(`V19 import complete: ${questionsDone.toLocaleString('en-IN')} NEET/AIPMT PYQs were created directly in Evidara Question Bank as In Review with their source-faithful cropped question and solution visuals. Nothing was approved or published.`);
      setProgress({ done: totalWork, total: totalWork, batch: 'V19 import complete' });
      onPromoted?.();
      await loadQueue();
    } catch (e) { setError(e instanceof Error ? e.message : 'V19 import failed.'); }
    finally { setBusy(false); }
  }

  async function promoteSelected() {
    if (!selected.length) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const payload = await api('/api/admin/pyq-staging-import/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'promote', ids: selected }),
      });
      const promoted = Number(payload.promoted || 0); const failed = Number(payload.failed || 0);
      setMessage(`${promoted} question${promoted === 1 ? '' : 's'} promoted to Evidara Question Bank as In Review.${failed ? ` ${failed} need more review before promotion.` : ''}`);
      await loadQueue();
      if (promoted) onPromoted?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Promotion failed.'); }
    finally { setBusy(false); }
  }

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return queue?.rows || [];
    return (queue?.rows || []).filter((row) => `${row.source_exam_label} ${row.source_question_number} ${row.source_subject} ${row.working_stem_latex}`.toLowerCase().includes(term));
  }, [queue?.rows, search]);
  const allSelectable = visibleRows.filter((row) => !row.promoted_question_id).map((row) => row.id);
  const allChecked = allSelectable.length > 0 && allSelectable.every((id) => selected.includes(id));

  return <Dialog open={open} onOpenChange={(value) => !busy && onOpenChange(value)}>
    <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Archive className="h-5 w-5 text-[var(--teal)]" />NEET Previous-Year Question Import</DialogTitle>
        <DialogDescription>V19 imports the complete prepared NEET/AIPMT archive directly into Evidara Question Bank as In Review, including source-faithful cropped question and solution visuals. Nothing is approved, published or exposed to SEO automatically.</DialogDescription>
      </DialogHeader>
      {error && <div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">{error}</div>}
      {message && <div className="rounded-xl border border-[var(--teal)]/20 bg-[var(--secondary)]/60 px-4 py-3 text-sm text-[var(--teal)]">{message}</div>}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList><TabsTrigger value="import">V19 one-click import</TabsTrigger><TabsTrigger value="review">Legacy staging trace{queue?.summary.staged ? ` (${queue.summary.staged})` : ''}</TabsTrigger></TabsList>
        <TabsContent value="import" className="mt-5 space-y-4">
          <Card className="border-[var(--line)] shadow-none"><CardContent className="p-5">
            <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
              <div><h3 className="font-semibold text-[var(--foreground)]">Select the extracted V19 archive folder</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">One selection uploads the physically cropped prompt/solution assets to R2, maps every question and solution, then creates all 2,620 PYQs directly in Question Bank as In Review. Year, Re-NEET/phase, paper code, original question number and taxonomy are retained. The process is retry-safe.</p></div>
              <div className="flex flex-col gap-2">
                <label className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-md bg-[var(--teal)] px-4 text-sm font-medium text-white ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                  <FolderOpen className="mr-2 h-4 w-4" />Choose V19 Folder
                  <input type="file" multiple className="hidden" disabled={busy} {...({ webkitdirectory: '', directory: '' } as { webkitdirectory: string; directory: string })} onChange={(event) => { const files = event.target.files; if (files?.length) void importV19Folder(files); event.currentTarget.value=''; }} />
                </label>
                <label className={`inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-[var(--line)] bg-white px-3 text-xs font-medium text-[var(--foreground)] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
                  <FileUp className="mr-2 h-3.5 w-3.5" />Legacy JSON staging importer
                  <input type="file" accept="application/json,.json" className="hidden" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.currentTarget.value=''; }} />
                </label>
              </div>
            </div>
            {busy && progress.total > 0 && <div className="mt-5 space-y-2"><div className="flex justify-between text-xs text-[var(--muted-foreground)]"><span className="truncate pr-4">{progress.batch}</span><span>{progress.done.toLocaleString('en-IN')} / {progress.total.toLocaleString('en-IN')}</span></div><div className="h-2 overflow-hidden rounded-full bg-[var(--line)]"><div className="h-full bg-[var(--teal)] transition-all" style={{width:`${Math.min(100,(progress.done/progress.total)*100)}%`}} /></div></div>}
          </CardContent></Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[var(--foreground)]">2,620</strong><p className="text-xs text-[var(--muted-foreground)]">Prepared questions</p></CardContent></Card>
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[var(--foreground)]">14</strong><p className="text-xs text-[var(--muted-foreground)]">NEET/AIPMT papers</p></CardContent></Card>
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[var(--foreground)]">2016–2026</strong><p className="text-xs text-[var(--muted-foreground)]">Year coverage</p></CardContent></Card>
          </div>
          <div className="rounded-xl border border-[var(--amber)]/30 bg-[var(--amber)]/10 p-4 text-sm text-[#6A5100]"><strong>Review-first protection:</strong> question, answer and solution text are preserved from the supplied archive, but uncertain taxonomy, missing answers and extracted-text warnings still require review in Question Bank before approval. The physically cropped source view remains the visual source of truth.</div>
        </TabsContent>

        <TabsContent value="review" className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[var(--foreground)]">{queue?.summary.staged || 0}</strong><p className="text-xs text-[var(--muted-foreground)]">In review staging</p></CardContent></Card>
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[var(--teal)]">{queue?.summary.promoted || 0}</strong><p className="text-xs text-[var(--muted-foreground)]">Promoted to Question Bank</p></CardContent></Card>
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[#237A57]">{queue?.summary.taxonomyMapped || 0}</strong><p className="text-xs text-[var(--muted-foreground)]">Chapter mapped</p></CardContent></Card>
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[#8A5F00]">{queue?.summary.taxonomyReview || 0}</strong><p className="text-xs text-[var(--muted-foreground)]">Taxonomy review</p></CardContent></Card>
            <Card className="border-[var(--line)] shadow-none"><CardContent className="p-4"><strong className="text-2xl text-[#8A5F00]">{queue?.summary.flagged || 0}</strong><p className="text-xs text-[var(--muted-foreground)]">Visual/answer review</p></CardContent></Card>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--muted-foreground)]" /><Input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search visible questions…" className="pl-9" /></div>
            <Select value={year} onValueChange={setYear}><SelectTrigger className="w-[130px]"><SelectValue placeholder="Year" /></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{[2026,2025,2024,2023,2022,2021,2020,2019,2018,2017,2016].map((value)=><SelectItem key={value} value={String(value)}>{value}</SelectItem>)}</SelectContent></Select>
            <Select value={subject} onValueChange={setSubject}><SelectTrigger className="w-[150px]"><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent><SelectItem value="all">All subjects</SelectItem><SelectItem value="Physics">Physics</SelectItem><SelectItem value="Chemistry">Chemistry</SelectItem><SelectItem value="Biology">Biology</SelectItem><SelectItem value="Botany">Botany</SelectItem><SelectItem value="Zoology">Zoology</SelectItem></SelectContent></Select>
            <Select value={flagged} onValueChange={setFlagged}><SelectTrigger className="w-[155px]"><SelectValue placeholder="Review" /></SelectTrigger><SelectContent><SelectItem value="all">All review states</SelectItem><SelectItem value="yes">Flagged only</SelectItem><SelectItem value="no">Clean parse only</SelectItem></SelectContent></Select>
            <Button variant="outline" onClick={()=>void loadQueue()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
          </div>
          <div className="flex items-center justify-between gap-3"><p className="text-sm text-[var(--muted-foreground)]">Promoting creates an <strong>In Review</strong> Evidara question. Final approval and taxonomy review still happen in the normal Question Bank.</p><Button onClick={()=>void promoteSelected()} disabled={busy||!selected.length} className="bg-[var(--teal)] text-white"><ShieldCheck className="mr-2 h-4 w-4" />Promote selected ({selected.length})</Button></div>
          <div className="overflow-hidden rounded-xl border border-[var(--line)]">
            <Table><TableHeader><TableRow><TableHead className="w-10"><Checkbox checked={allChecked} onCheckedChange={(checked)=>setSelected(checked ? allSelectable : [])} /></TableHead><TableHead>Paper / Q</TableHead><TableHead>Subject</TableHead><TableHead>Question</TableHead><TableHead>Answer</TableHead><TableHead>Review state</TableHead></TableRow></TableHeader>
            <TableBody>{visibleRows.map((row)=><TableRow key={row.id}><TableCell><Checkbox disabled={Boolean(row.promoted_question_id)} checked={selected.includes(row.id)} onCheckedChange={(checked)=>setSelected((current)=>checked?[...new Set([...current,row.id])]:current.filter((id)=>id!==row.id))} /></TableCell><TableCell className="whitespace-nowrap"><div className="font-medium text-[var(--foreground)]">{row.source_year} · Q{row.source_question_number}</div><div className="max-w-[180px] truncate text-xs text-[var(--muted-foreground)]">{row.source_exam_label}</div></TableCell><TableCell><Badge variant="outline">{row.source_subject}</Badge></TableCell><TableCell className="max-w-[420px]"><div className="line-clamp-2 text-sm text-[var(--foreground)]">{row.working_stem_latex}</div><div className="mt-1 text-xs text-[var(--muted-foreground)]">{row.working_solution_latex ? 'Solution present' : 'Solution missing'}</div></TableCell><TableCell className="font-semibold">{row.source_answer_text || '—'}</TableCell><TableCell>{row.promoted_question_id ? <Badge className="bg-[var(--secondary)] text-[var(--teal)]"><CheckCircle2 className="mr-1 h-3 w-3" />In Question Bank</Badge> : row.source_flag ? <Badge className="bg-[var(--amber)]/20 text-[#8A5F00]"><CircleAlert className="mr-1 h-3 w-3" />Review</Badge> : <Badge variant="outline">Ready for review</Badge>}</TableCell></TableRow>)}
            {!visibleRows.length && <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-[var(--muted-foreground)]">No staged NEET PYQ questions match these filters.</TableCell></TableRow>}</TableBody></Table>
          </div>
          <div className="flex items-center justify-between"><span className="text-xs text-[var(--muted-foreground)]">Page {queue?.page || 1} of {queue?.totalPages || 1} · {queue?.total || 0} filtered rows</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page<=1} onClick={()=>setPage((value)=>Math.max(1,value-1))}><ChevronLeft className="h-4 w-4" /></Button><Button size="sm" variant="outline" disabled={page>=(queue?.totalPages||1)} onClick={()=>setPage((value)=>value+1)}><ChevronRight className="h-4 w-4" /></Button></div></div>
        </TabsContent>
      </Tabs>
      {busy && <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg bg-white/30"><LoaderCircle className="h-7 w-7 animate-spin text-[var(--teal)]" /></div>}
    </DialogContent>
  </Dialog>;
}
