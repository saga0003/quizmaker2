'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, LoaderCircle, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const targetFields = [
  ['fullName', 'Student name', true], ['email', 'Email', true], ['phone', 'Phone', false],
  ['grade', 'Grade', true], ['section', 'Section', false], ['academicYear', 'Academic year', true], ['board', 'Board', false],
  ['parentName', 'Parent name', false], ['parentPhone', 'Parent phone', false],
] as const;

type RawRow = Record<string, string>;
type ImportRow = Record<string, string | number> & { rowNumber: number };
type ResultRow = {
  rowNumber?: number; email?: string; fullName?: string; phone?: string; grade?: string | number; section?: string;
  academicYear?: string; board?: string; parentName?: string; parentPhone?: string; status?: string;
  temporaryPassword?: string; error?: string;
};

type Validation = { ok: boolean; error: string };

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
    fullName: ['name', 'student', 'student name', 'full name'], email: ['email', 'mail', 'mail id', 'email id'],
    phone: ['phone', 'mobile', 'mobile no', 'phone number'], grade: ['grade', 'class', 'standard'], section: ['section', 'division', 'sec'],
    academicYear: ['academic year', 'year', 'academic_year'], board: ['board', 'syllabus'],
    parentName: ['parent name', 'father name', 'mother name', 'guardian name'], parentPhone: ['parent phone', 'father mobile', 'guardian phone', 'parent mobile'],
  };
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const index = normalized.findIndex((h) => (aliases[target] || []).includes(h));
  return index >= 0 ? headers[index] : '';
}

function csvEscape(value: unknown) { const s = String(value ?? ''); return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s; }
function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim().toLowerCase()); }

function validateRow(row: ImportRow): Validation {
  const fullName = String(row.fullName || '').trim();
  const email = String(row.email || '').trim();
  const grade = Number(row.grade);
  const academicYear = String(row.academicYear || '').trim();
  if (fullName.length < 2) return { ok: false, error: 'Student name is required.' };
  if (!validEmail(email)) return { ok: false, error: 'A valid email is required.' };
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { ok: false, error: 'Grade must be an integer from 1 to 12.' };
  if (!/^\d{4}(?:-\d{2,4})?$/.test(academicYear)) return { ok: false, error: 'Academic year must look like 2026 or 2026-27.' };
  return { ok: true, error: '' };
}

function downloadCsv(filename: string, rows: ResultRow[], keys: string[]) {
  if (!rows.length) return;
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => csvEscape(r[k as keyof ResultRow])).join(','))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}

export function BulkAccountImport({ organizationId, onCompleted }: { organizationId: string | null; onCompleted?: () => void }) {
  const [open, setOpen] = useState(false); const [headers, setHeaders] = useState<string[]>([]); const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [results, setResults] = useState<ResultRow[]>([]);

  const mapped = useMemo<ImportRow[]>(() => rawRows.map((row, index) => ({
    rowNumber: index + 2,
    ...Object.fromEntries(targetFields.map(([key]) => [key, mapping[key] ? row[mapping[key]] ?? '' : ''])),
  })), [mapping, rawRows]);
  const validations = useMemo(() => mapped.map(validateRow), [mapped]);
  const invalidCount = validations.filter((v) => !v.ok).length;
  const ready = Boolean(organizationId && mapping.fullName && mapping.email && mapping.grade && mapping.academicYear && rawRows.length && rawRows.length <= 1000 && invalidCount === 0);
  const failedRows = results.filter((r) => r.status !== 'created');
  const createdRows = results.filter((r) => r.status === 'created');

  async function choose(file: File | null) {
    if (!file) return; setError(''); setResults([]);
    const parsed = parseCsvRaw(await file.text());
    if (parsed.rows.length > 1000) { setHeaders([]); setRawRows([]); setMapping({}); setError(`This file has ${parsed.rows.length.toLocaleString('en-IN')} data rows. Split it into files of at most 1,000 rows; Evidara will not silently truncate a student roster.`); return; }
    setHeaders(parsed.headers); setRawRows(parsed.rows);
    setMapping(Object.fromEntries(targetFields.map(([key]) => [key, guess(key, parsed.headers)])));
  }

  async function upload() {
    if (!ready) return; if (!supabase) { setError('Supabase is not configured.'); return; }
    setBusy(true); setError(''); setResults([]);
    try {
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) throw new Error('Sign in again.');
      const response = await fetch('/api/access-control/', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'bulkImportStudents', organizationId, rows: mapped }) });
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error || 'Student import failed.');
      setResults(payload.results || []); onCompleted?.();
    } catch (e) { setError(e instanceof Error ? e.message : 'Student import failed.'); } finally { setBusy(false); }
  }

  const failureKeys = ['rowNumber', 'fullName', 'email', 'phone', 'grade', 'section', 'academicYear', 'board', 'parentName', 'parentPhone', 'error'];
  const credentialKeys = ['rowNumber', 'fullName', 'email', 'grade', 'section', 'temporaryPassword'];

  return <>
    <Button variant="outline" onClick={() => setOpen(true)} className="border-[var(--line)]"><FileSpreadsheet className="mr-2 h-4 w-4" />Import students</Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Bulk student import</DialogTitle><DialogDescription>Upload a CSV, map the roster fields, validate every row, then import up to 1,000 students into the selected institution. Required fields: name, email, grade and academic year.</DialogDescription></DialogHeader>
      <div className="space-y-5">
        {!organizationId && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Choose an institution before importing students.</p>}
        <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--teal)]/40 bg-[var(--canvas)] p-5 text-sm font-medium text-[var(--teal)]"><Upload className="mr-2 h-4 w-4" />Choose student CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => void choose(e.target.files?.[0] || null)} /></label>
        {headers.length > 0 && <Card className="rounded-xl shadow-sm"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">{targetFields.map(([key, label, required]) => <div key={key}><Label className="text-xs">{label}{required ? ' *' : ''}</Label><Select value={mapping[key] || 'none'} onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v === 'none' ? '' : v }))}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not mapped</SelectItem>{headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select></div>)}</CardContent></Card>}
        {mapped.length > 0 && <div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Validation preview · first 8 of {mapped.length}</p><Badge className={invalidCount ? 'bg-amber-600 text-white' : 'bg-[var(--teal)] text-white'}>{invalidCount ? `${invalidCount} row${invalidCount === 1 ? '' : 's'} need fixing` : 'All rows valid'}</Badge></div><div className="overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Grade</TableHead><TableHead>Academic year</TableHead><TableHead>Validation</TableHead></TableRow></TableHeader><TableBody>{mapped.slice(0, 8).map((r, i) => <TableRow key={r.rowNumber}><TableCell>{r.rowNumber}</TableCell><TableCell>{String(r.fullName || '')}</TableCell><TableCell>{String(r.email || '')}</TableCell><TableCell>{String(r.grade || '')}</TableCell><TableCell>{String(r.academicYear || '')}</TableCell><TableCell>{validations[i]?.ok ? <span className="inline-flex items-center text-[var(--teal)]"><CheckCircle2 className="mr-1 h-4 w-4" />Ready</span> : <span className="inline-flex items-center text-amber-700"><AlertTriangle className="mr-1 h-4 w-4" />{validations[i]?.error}</span>}</TableCell></TableRow>)}</TableBody></Table></div></div>}
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {results.length > 0 && <div className="rounded-xl border border-[var(--secondary)] bg-[var(--canvas)] p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><strong>{createdRows.length} created · {failedRows.length} failed</strong><p className="text-xs text-[var(--muted-foreground)]">Failures retain the original row number and values so they can be corrected and re-imported.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!createdRows.length} onClick={() => downloadCsv('evidara-student-import-credentials.csv', createdRows, credentialKeys)}><Download className="mr-2 h-4 w-4" />Credentials</Button><Button variant="outline" disabled={!failedRows.length} onClick={() => downloadCsv('evidara-student-import-failures.csv', failedRows, failureKeys)}><Download className="mr-2 h-4 w-4" />Failed rows</Button></div></div></div>}
      </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button disabled={!ready || busy} onClick={() => void upload()} className="bg-[var(--teal)] text-white">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Validate & import students</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
