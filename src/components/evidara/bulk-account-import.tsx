'use client';

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const targetFields = [
  ['fullName', 'Name', true], ['email', 'Email', true], ['phone', 'Phone', false], ['role', 'Role', false],
  ['grade', 'Grade', false], ['section', 'Section', false], ['academicYear', 'Academic year', false], ['board', 'Board', false],
  ['parentName', 'Parent name', false], ['parentPhone', 'Parent phone', false],
] as const;

type RawRow = Record<string, string>;
type ResultRow = { email?: string; fullName?: string; role?: string; status?: string; temporaryPassword?: string; error?: string };

function parseCsvRaw(text: string) {
  const records: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); if (row.some((v) => v.trim())) records.push(row); row = []; field = ''; }
    else field += ch;
  }
  row.push(field.replace(/\r$/, '')); if (row.some((v) => v.trim())) records.push(row);
  if (!records.length) return { headers: [] as string[], rows: [] as RawRow[] };
  const headers = records[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  return { headers, rows: records.slice(1).map((values) => Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))) };
}

function guess(target: string, headers: string[]) {
  const aliases: Record<string, string[]> = {
    fullName: ['name', 'student', 'student name', 'full name', 'teacher name'], email: ['email', 'mail', 'mail id', 'email id'],
    phone: ['phone', 'mobile', 'mobile no', 'phone number'], role: ['role', 'user role', 'type'], grade: ['grade', 'class', 'standard'],
    section: ['section', 'division', 'sec'], academicYear: ['academic year', 'year'], board: ['board', 'syllabus'],
    parentName: ['parent name', 'father name', 'mother name', 'guardian name'], parentPhone: ['parent phone', 'father mobile', 'guardian phone', 'parent mobile'],
  };
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const index = normalized.findIndex((h) => (aliases[target] || []).includes(h));
  return index >= 0 ? headers[index] : '';
}

function csvEscape(value: unknown) { const s = String(value ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }

export function BulkAccountImport({ organizationId, onCompleted }: { organizationId: string | null; onCompleted?: () => void }) {
  const [open, setOpen] = useState(false); const [headers, setHeaders] = useState<string[]>([]); const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [results, setResults] = useState<ResultRow[]>([]);
  const mapped = useMemo(() => rawRows.slice(0, 1000).map((row) => Object.fromEntries(targetFields.map(([key]) => [key, mapping[key] ? row[mapping[key]] ?? '' : '']))), [mapping, rawRows]);
  const ready = Boolean(mapping.fullName && mapping.email && rawRows.length);

  async function choose(file: File | null) {
    if (!file) return; setError(''); setResults([]);
    const parsed = parseCsvRaw(await file.text()); setHeaders(parsed.headers); setRawRows(parsed.rows);
    setMapping(Object.fromEntries(targetFields.map(([key]) => [key, guess(key, parsed.headers)])));
  }
  async function upload() {
    if (!ready) return; if (!supabase) { setError('Supabase is not configured.'); return; }
    setBusy(true); setError(''); setResults([]);
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) throw new Error('Sign in again.');
      const response = await fetch('/api/access-control/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'bulkCreateAccounts', organizationId, rows: mapped }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Bulk upload failed.');
      setResults(payload.results || []); onCompleted?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Bulk upload failed.'); } finally { setBusy(false); }
  }
  function downloadResults() {
    if (!results.length) return; const keys = ['email', 'fullName', 'role', 'status', 'temporaryPassword', 'error'];
    const csv = [keys.join(','), ...results.map((r) => keys.map((k) => csvEscape(r[k as keyof ResultRow])).join(','))].join('\n');
    const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); link.download = 'evidara-account-import-results.csv'; link.click(); URL.revokeObjectURL(link.href);
  }
  return <>
    <Button variant="outline" onClick={() => setOpen(true)} className="border-[var(--line)]"><FileSpreadsheet className="mr-2 h-4 w-4" />Bulk CSV</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Bulk account import</DialogTitle><DialogDescription>Upload any CSV, map its headers to Evidara fields, preview the data, then verify and create the accounts. Up to 1,000 rows per upload.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--teal)]/40 bg-[var(--canvas)] p-5 text-sm font-medium text-[var(--teal)]"><Upload className="mr-2 h-4 w-4" />Choose CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void choose(e.target.files?.[0] || null)} /></label>
        {headers.length > 0 && <Card className="shadow-sm rounded-xl"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{targetFields.map(([key, label, required]) => <div key={key}><Label className="text-xs">{label}{required ? ' *' : ''}</Label><Select value={mapping[key] || 'none'} onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v === 'none' ? '' : v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not mapped</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select></div>)}</CardContent></Card>}
        {mapped.length > 0 && <div><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Preview · first 5 of {mapped.length}</p><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Grade</TableHead><TableHead>Section</TableHead></TableRow></TableHeader><TableBody>{mapped.slice(0, 5).map((r, i) => <TableRow key={i}><TableCell>{String(r.fullName || '')}</TableCell><TableCell>{String(r.email || '')}</TableCell><TableCell>{String(r.role || 'student')}</TableCell><TableCell>{String(r.grade || '')}</TableCell><TableCell>{String(r.section || '')}</TableCell></TableRow>)}</TableBody></Table></div></div>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {results.length > 0 && <div className="rounded-xl border border-[var(--secondary)] bg-[var(--canvas)] p-4"><div className="flex items-center justify-between"><div><strong>{results.filter((r) => r.status === 'created').length} created</strong><p className="text-xs text-[var(--muted-foreground)]">Download the result file to securely distribute temporary passwords.</p></div><Button variant="outline" onClick={downloadResults}><Download className="mr-2 h-4 w-4" />Results CSV</Button></div></div>}
      </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button disabled={!ready || busy} onClick={() => void upload()} className="bg-[var(--teal)] text-white">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Verify & upload</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
