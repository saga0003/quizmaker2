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
  ['fullName', 'Student name', true], ['email', 'Email', true], ['grade', 'Grade / class', true], ['academicYear', 'Academic year', true],
  ['section', 'Section', false], ['phone', 'Phone', false], ['board', 'Board', false],
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
type LicencePreview = {
  licensed: number;
  used: number;
  available: number;
  requested: number;
  remaining: number;
  enough: boolean;
};
type SchoolPlatformPayload = {
  state?: {
    school?: { subscription?: { seatLimit?: number } };
    students?: Array<{ status?: string }>;
  };
  error?: string;
};

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

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function guess(target: string, headers: string[]) {
  const aliases: Record<string, string[]> = {
    fullName: ['name', 'student', 'student name', 'full name', 'student_name', 'studentname'],
    email: ['email', 'email address', 'student email', 'mail', 'mail id', 'email id'],
    phone: ['phone', 'mobile', 'mobile no', 'phone number', 'student phone', 'student mobile'],
    grade: ['grade', 'class', 'standard', 'std', 'grade class'],
    section: ['section', 'division', 'sec'],
    academicYear: ['academic year', 'year', 'academic_year', 'school year', 'academicyear'],
    board: ['board', 'syllabus'],
    parentName: ['parent name', 'father name', 'mother name', 'guardian name', 'parent_name'],
    parentPhone: ['parent phone', 'father mobile', 'guardian phone', 'parent mobile', 'parent_phone'],
  };
  const accepted = new Set((aliases[target] || []).map(normalizeHeader));
  return headers.find((header) => accepted.has(normalizeHeader(header))) || '';
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
  if (!Number.isInteger(grade) || grade < 1 || grade > 12) return { ok: false, error: 'Grade must be a number from 1 to 12.' };
  if (!/^\d{4}(?:-\d{2,4})?$/.test(academicYear)) return { ok: false, error: 'Academic year should look like 2026 or 2026-27.' };
  return { ok: true, error: '' };
}

function downloadCsv(filename: string, rows: ResultRow[], keys: string[]) {
  if (!rows.length) return;
  const csv = [keys.join(','), ...rows.map((r) => keys.map((k) => csvEscape(r[k as keyof ResultRow])).join(','))].join('\n');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  link.download = filename; link.click(); URL.revokeObjectURL(link.href);
}

function downloadTemplate() {
  const link = document.createElement('a');
  link.href = '/templates/student-import-template.csv';
  link.download = 'evidara-student-import-template.csv';
  link.click();
}

export function BulkAccountImport({ organizationId, onCompleted }: { organizationId: string | null; onCompleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [licencePreview, setLicencePreview] = useState<LicencePreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);

  const mapped = useMemo<ImportRow[]>(() => rawRows.map((row, index) => ({
    rowNumber: index + 2,
    ...Object.fromEntries(targetFields.map(([key]) => [key, mapping[key] ? row[mapping[key]] ?? '' : ''])),
  })), [mapping, rawRows]);

  const validations = useMemo(() => {
    const seenEmails = new Set<string>();
    return mapped.map((row) => {
      const base = validateRow(row);
      if (!base.ok) return base;
      const email = String(row.email || '').trim().toLowerCase();
      if (seenEmails.has(email)) return { ok: false, error: 'This email appears more than once in the CSV.' };
      seenEmails.add(email);
      return base;
    });
  }, [mapped]);

  const invalidCount = validations.filter((v) => !v.ok).length;
  const requiredMapped = Boolean(mapping.fullName && mapping.email && mapping.grade && mapping.academicYear);
  const ready = Boolean(organizationId && requiredMapped && rawRows.length && rawRows.length <= 1000 && invalidCount === 0);
  const failedRows = results.filter((r) => r.status !== 'created');
  const createdRows = results.filter((r) => r.status === 'created');

  function resetFile() {
    setHeaders([]); setRawRows([]); setMapping({}); setFileName(''); setReviewing(false); setLicencePreview(null); setError('');
  }

  async function choose(file: File | null) {
    if (!file) return;
    setError(''); setResults([]); setReviewing(false); setLicencePreview(null); setFileName(file.name);
    const parsed = parseCsvRaw(await file.text());
    if (!parsed.headers.length) { resetFile(); setError('This CSV does not contain a header row.'); return; }
    if (parsed.rows.length > 1000) {
      setHeaders([]); setRawRows([]); setMapping({}); setReviewing(false); setLicencePreview(null);
      setError(`This file has ${parsed.rows.length.toLocaleString('en-IN')} students. Please split it into files of at most 1,000 students.`);
      return;
    }
    if (!parsed.rows.length) { setHeaders(parsed.headers); setRawRows([]); setMapping({}); setError('The CSV has headings but no student rows.'); return; }
    setHeaders(parsed.headers); setRawRows(parsed.rows);
    setMapping(Object.fromEntries(targetFields.map(([key]) => [key, guess(key, parsed.headers)])));
  }

  async function loadLicencePreview(): Promise<LicencePreview> {
    if (!organizationId) throw new Error('Choose an institution first.');
    if (!supabase) throw new Error('Evidara cloud is not configured.');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error('Please sign in again.');
    const response = await fetch('/api/school-platform/', {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'X-Evidara-Organization-Id': organizationId },
    });
    const payload = await response.json().catch(() => ({})) as SchoolPlatformPayload;
    if (!response.ok) throw new Error(payload.error || 'Unable to check available licences.');
    const licensed = Math.max(0, Number(payload.state?.school?.subscription?.seatLimit || 0));
    const used = (payload.state?.students || []).filter((student) => student.status === 'active').length;
    const available = Math.max(0, licensed - used);
    const requested = mapped.length;
    return { licensed, used, available, requested, remaining: Math.max(0, available - requested), enough: licensed > 0 && requested <= available };
  }

  async function beginReview() {
    if (!ready) return;
    setBusy(true); setError('');
    try {
      setLicencePreview(await loadLicencePreview());
      setReviewing(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to prepare the student review.');
    } finally { setBusy(false); }
  }

  async function upload() {
    if (!ready || !licencePreview?.enough) return;
    if (!supabase) { setError('Evidara cloud is not configured.'); return; }
    setBusy(true); setError(''); setResults([]);
    try {
      const latest = await loadLicencePreview();
      setLicencePreview(latest);
      if (!latest.enough) throw new Error(`Only ${latest.available} student licence${latest.available === 1 ? '' : 's'} are available now. Review the licensed quantity before adding these students.`);
      const { data } = await supabase.auth.getSession(); const token = data.session?.access_token; if (!token) throw new Error('Please sign in again.');
      const response = await fetch('/api/access-control/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'bulkImportStudents', organizationId, rows: mapped }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Students could not be added.');
      setResults(payload.results || []);
      setHeaders([]); setRawRows([]); setMapping({}); setFileName(''); setReviewing(false); setLicencePreview(null);
      onCompleted?.();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Students could not be added.');
    } finally { setBusy(false); }
  }

  const failureKeys = ['rowNumber', 'fullName', 'email', 'phone', 'grade', 'section', 'academicYear', 'board', 'parentName', 'parentPhone', 'error'];
  const credentialKeys = ['rowNumber', 'fullName', 'email', 'grade', 'section', 'temporaryPassword'];

  return <>
    <Button variant="outline" onClick={() => setOpen(true)} className="border-[var(--line)]"><FileSpreadsheet className="mr-2 h-4 w-4" />Import students</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import students</DialogTitle>
          <DialogDescription>Upload a CSV, match the columns, review the students, then add them.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {!organizationId && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">Choose an institution before importing students.</p>}

          {!reviewing && results.length === 0 && <>
            <div className="rounded-xl border border-[var(--line)] bg-[var(--canvas)] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">Required columns</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">Student name · Email · Grade / class · Academic year</p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">Section, phone, board and parent details are optional.</p>
                </div>
                <Button type="button" variant="outline" onClick={downloadTemplate}><Download className="mr-2 h-4 w-4" />Download CSV template</Button>
              </div>
            </div>

            <label className="flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[var(--teal)]/40 bg-[var(--canvas)] p-5 text-sm font-medium text-[var(--teal)]">
              <Upload className="mr-2 h-4 w-4" />{fileName ? `Choose a different CSV · ${fileName}` : 'Choose CSV file'}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void choose(event.target.files?.[0] || null)} />
            </label>

            {headers.length > 0 && <Card className="rounded-xl shadow-sm">
              <CardContent className="p-4">
                <div className="mb-4">
                  <p className="font-semibold text-[var(--foreground)]">Match columns</p>
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">We matched the headings we recognised. If your CSV uses different or misspelled headings, simply choose the correct column below.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {targetFields.map(([key, label, required]) => <div key={key}>
                    <Label className="text-xs">{label}{required ? ' *' : ' (optional)'}</Label>
                    <Select value={mapping[key] || 'none'} onValueChange={(value) => { setReviewing(false); setLicencePreview(null); setMapping((current) => ({ ...current, [key]: value === 'none' ? '' : value })); }}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="none">Not mapped</SelectItem>{headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>)}
                </div>
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">* Required before students can be added.</p>
              </CardContent>
            </Card>}

            {mapped.length > 0 && <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-semibold text-[var(--foreground)]">Check students</p><p className="text-xs text-[var(--muted-foreground)]">Showing the first 8 of {mapped.length} students.</p></div>
                <Badge className={invalidCount ? 'bg-amber-600 text-white' : 'bg-[var(--teal)] text-white'}>{invalidCount ? `${invalidCount} need${invalidCount === 1 ? 's' : ''} attention` : `${mapped.length} ready`}</Badge>
              </div>
              <div className="overflow-x-auto rounded-xl border"><Table>
                <TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Grade</TableHead><TableHead>Academic year</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{mapped.slice(0, 8).map((row, index) => <TableRow key={row.rowNumber}>
                  <TableCell>{row.rowNumber}</TableCell><TableCell>{String(row.fullName || '')}</TableCell><TableCell>{String(row.email || '')}</TableCell><TableCell>{String(row.grade || '')}</TableCell><TableCell>{String(row.academicYear || '')}</TableCell>
                  <TableCell>{validations[index]?.ok ? <span className="inline-flex items-center text-[var(--teal)]"><CheckCircle2 className="mr-1 h-4 w-4" />Ready</span> : <span className="inline-flex items-center text-amber-700"><AlertTriangle className="mr-1 h-4 w-4" />{validations[index]?.error}</span>}</TableCell>
                </TableRow>)}</TableBody>
              </Table></div>
              {invalidCount > 0 && <p className="mt-2 text-xs text-[var(--muted-foreground)]">Fix the CSV and choose it again, or change the column matching above. No students or licences have been added yet.</p>}
            </div>}
          </>}

          {reviewing && licencePreview && <div className="space-y-4">
            <Card className="rounded-xl shadow-sm"><CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-lg font-bold text-[var(--foreground)]">Review before adding</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">Nothing has been added yet. Confirm the student count and licence usage below.</p></div>
                <Badge className="bg-[var(--teal)] text-white">{mapped.length} student{mapped.length === 1 ? '' : 's'} ready</Badge>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-[var(--canvas)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Licensed students</p><p className="mt-1 text-xl font-bold">{licencePreview.licensed}</p></div>
                <div className="rounded-lg bg-[var(--canvas)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Currently used</p><p className="mt-1 text-xl font-bold">{licencePreview.used}</p></div>
                <div className="rounded-lg bg-[var(--canvas)] p-3"><p className="text-xs text-[var(--muted-foreground)]">Available now</p><p className="mt-1 text-xl font-bold">{licencePreview.available}</p></div>
              </div>
              {licencePreview.enough ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline h-4 w-4" />Adding {licencePreview.requested} student{licencePreview.requested === 1 ? '' : 's'} will use {licencePreview.requested} licence{licencePreview.requested === 1 ? '' : 's'}. {licencePreview.remaining} will remain available.</div>
              ) : (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><AlertTriangle className="mr-2 inline h-4 w-4" />You need {Math.max(0, licencePreview.requested - licencePreview.available)} more student licence{Math.max(0, licencePreview.requested - licencePreview.available) === 1 ? '' : 's'} before these students can be added.</div>
              )}
            </CardContent></Card>
            <div className="overflow-x-auto rounded-xl border"><Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Grade</TableHead><TableHead>Section</TableHead><TableHead>Academic year</TableHead></TableRow></TableHeader>
              <TableBody>{mapped.slice(0, 10).map((row) => <TableRow key={row.rowNumber}><TableCell>{String(row.fullName || '')}</TableCell><TableCell>{String(row.email || '')}</TableCell><TableCell>{String(row.grade || '')}</TableCell><TableCell>{String(row.section || '—')}</TableCell><TableCell>{String(row.academicYear || '')}</TableCell></TableRow>)}</TableBody>
            </Table></div>
            {mapped.length > 10 && <p className="text-xs text-[var(--muted-foreground)]">Showing 10 of {mapped.length} students. All {mapped.length} rows passed the checks above.</p>}
          </div>}

          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {results.length > 0 && <div className="rounded-xl border border-[var(--secondary)] bg-[var(--canvas)] p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><strong>{createdRows.length} added · {failedRows.length} not added</strong><p className="text-xs text-[var(--muted-foreground)]">Download credentials for added students or the rows that need correction.</p></div>
              <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!createdRows.length} onClick={() => downloadCsv('evidara-student-import-credentials.csv', createdRows, credentialKeys)}><Download className="mr-2 h-4 w-4" />Credentials</Button><Button variant="outline" disabled={!failedRows.length} onClick={() => downloadCsv('evidara-student-import-failures.csv', failedRows, failureKeys)}><Download className="mr-2 h-4 w-4" />Rows to fix</Button></div>
            </div>
          </div>}
        </div>

        <DialogFooter>
          {results.length > 0 ? <Button onClick={() => setOpen(false)}>Done</Button> : reviewing ? <>
            <Button variant="outline" disabled={busy} onClick={() => { setReviewing(false); setLicencePreview(null); setError(''); }}>Back to columns</Button>
            <Button disabled={!licencePreview?.enough || busy} onClick={() => void upload()} className="bg-[var(--teal)] text-white">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Add {mapped.length} student{mapped.length === 1 ? '' : 's'} & assign {mapped.length} licence{mapped.length === 1 ? '' : 's'}</Button>
          </> : <>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button disabled={!ready || busy} onClick={() => void beginReview()} className="bg-[var(--teal)] text-white">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}Review students</Button>
          </>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
