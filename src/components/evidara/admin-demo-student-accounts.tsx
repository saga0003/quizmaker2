'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, KeyRound, LoaderCircle, Search, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { AccessControlView } from '@/components/evidara/access-control-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type DemoAccount = {
  id: string;
  student_no: number;
  full_name: string;
  email: string;
  grade: number;
  section_code: string;
  academic_year: string;
  exam_track: string;
  status: string;
  auth_user_id: string | null;
  last_password_reset_at: string | null;
  provisioned: boolean;
};

type Payload = {
  school: { id: string; name: string };
  stats: { total: number; provisioned: number; pending: number; neet: number; jee: number };
  students: DemoAccount[];
};

type SortKey = 'student_no' | 'full_name' | 'exam_track' | 'grade' | 'section_code' | 'provisioned';

function compare(a: DemoAccount, b: DemoAccount, key: SortKey) {
  const av = a[key];
  const bv = b[key];
  if (typeof av === 'number' && typeof bv === 'number') return av - bv;
  if (typeof av === 'boolean' && typeof bv === 'boolean') return Number(av) - Number(bv);
  return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' });
}

function SortHead({
  label,
  value,
  sortKey,
  sortDirection,
  onSort,
}: {
  label: string;
  value: SortKey;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}) {
  return (
    <TableHead>
      <button type="button" className="inline-flex items-center gap-1 font-semibold" onClick={() => onSort(value)}>
        {label}
        {sortKey === value ? (sortDirection === 'asc' ? <ArrowDownAZ className="h-3.5 w-3.5" /> : <ArrowUpAZ className="h-3.5 w-3.5" />) : null}
      </button>
    </TableHead>
  );
}

export function AdminAccessWorkspace() {
  const { session } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [track, setTrack] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('student_no');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selected, setSelected] = useState<DemoAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');

  async function request(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    const token = session?.access_token;
    if (!token) throw new Error('Super Admin sign-in is required.');
    const response = await fetch('/api/admin/demo-student-accounts/', {
      method,
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Demo account request failed.');
    return payload as Payload & { created?: number; mapped?: number; errors?: string[]; ok?: boolean };
  }

  async function refresh() {
    setLoading(true); setError('');
    try { setData(await request('GET')); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to load demo accounts.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (session?.access_token) void refresh(); }, [session?.access_token]);

  async function provisionAll() {
    setWorking(true); setError(''); setMessage('Provisioning secure Supabase Auth accounts…');
    try {
      let latest = data;
      let totalCreated = 0;
      let safety = 0;
      while ((latest?.stats.pending || 0) > 0 && safety < 20) {
        const result = await request('POST', { action: 'provisionBatch', batchSize: 50 });
        latest = result;
        totalCreated += Number(result.created || 0) + Number(result.mapped || 0);
        setData(result);
        setMessage(`${result.stats.provisioned}/${result.stats.total} student logins ready…`);
        if (result.errors?.length && !result.created && !result.mapped) throw new Error(result.errors.join(' · '));
        safety += 1;
      }
      setMessage(`${latest?.stats.provisioned || 0} demo student logins are ready. ${totalCreated ? `${totalCreated} accounts were created or mapped in this run.` : ''}`);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Provisioning failed.');
    } finally { setWorking(false); }
  }

  async function resetPassword() {
    if (!selected) return;
    setWorking(true); setError(''); setMessage('');
    try {
      await request('POST', { action: 'resetPassword', demoStudentId: selected.id, newPassword });
      setMessage(`New password set for ${selected.full_name}. Evidara does not store or reveal the previous password.`);
      setNewPassword(''); setSelected(null); await refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Password reset failed.'); }
    finally { setWorking(false); }
  }

  function sortBy(key: SortKey) {
    if (sortKey === key) setSortDirection((value) => value === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = (data?.students || []).filter((row) =>
      (track === 'all' || row.exam_track === track) &&
      (!q || `${row.student_no} ${row.full_name} ${row.email} ${row.section_code} ${row.exam_track}`.toLowerCase().includes(q))
    );
    return [...filtered].sort((a, b) => compare(a, b, sortKey) * (sortDirection === 'asc' ? 1 : -1));
  }, [data?.students, search, sortDirection, sortKey, track]);

  const sortProps = { sortKey, sortDirection, onSort: sortBy };

  return <div className="space-y-6">
    <AccessControlView kind="admin" />
    <section className="space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--canvas)] p-4 md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--teal)]">Sales Demo identities</p><h2 className="mt-1 text-2xl font-bold">Demo Student Login Control</h2><p className="mt-1 max-w-3xl text-sm text-[var(--muted-foreground)]">The 500 Sales Demo roster records live in Supabase. Provisioning creates genuine Auth users, profiles and school memberships. Initial passwords are random and are never stored; set a password only for the account you want to demonstrate.</p></div>
        <Button onClick={() => void provisionAll()} disabled={working || !data?.stats.pending}><UserRoundPlus className="mr-2 h-4 w-4" />{data?.stats.pending ? `Provision ${data.stats.pending} pending logins` : 'All demo logins ready'}</Button>
      </div>

      {loading ? <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="h-4 w-4 animate-spin" />Loading demo account state…</div> : data && <>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ['Roster', data.stats.total], ['Auth ready', data.stats.provisioned], ['Pending', data.stats.pending], ['NEET', data.stats.neet], ['JEE', data.stats.jee],
          ].map(([label, value]) => <Card key={String(label)} className="rounded-xl shadow-sm"><CardContent className="p-4"><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-2xl font-bold">{Number(value).toLocaleString('en-IN')}</p></CardContent></Card>)}
        </div>

        {message && <div className="rounded-xl border border-[var(--teal)]/20 bg-[var(--teal)]/5 p-3 text-sm text-[var(--foreground)]"><ShieldCheck className="mr-2 inline h-4 w-4 text-[var(--teal)]" />{message}</div>}
        {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search name, email, student number or section" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          <select className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={track} onChange={(event) => setTrack(event.target.value)}><option value="all">All programs</option><option value="NEET">NEET</option><option value="JEE">JEE</option></select>
        </div>

        <Card className="rounded-xl shadow-sm"><CardContent className="max-h-[620px] overflow-auto p-0"><Table className="min-w-[960px]"><TableHeader><TableRow><SortHead label="#" value="student_no" {...sortProps} /><SortHead label="Student" value="full_name" {...sortProps} /><SortHead label="Program" value="exam_track" {...sortProps} /><SortHead label="Grade" value="grade" {...sortProps} /><SortHead label="Section" value="section_code" {...sortProps} /><SortHead label="Login" value="provisioned" {...sortProps} /><TableHead>Action</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id}><TableCell>{row.student_no}</TableCell><TableCell><button type="button" className="text-left" onClick={() => setSelected(row)}><strong className="block text-[var(--foreground)]">{row.full_name}</strong><small className="text-[var(--muted-foreground)]">{row.email}</small></button></TableCell><TableCell><Badge variant="outline">{row.exam_track}</Badge></TableCell><TableCell>{row.grade}</TableCell><TableCell>{row.section_code}</TableCell><TableCell>{row.provisioned ? <Badge className="bg-[var(--teal)] text-white">Ready</Badge> : <Badge variant="outline">Pending</Badge>}</TableCell><TableCell><Button size="sm" variant="outline" disabled={!row.provisioned} onClick={() => setSelected(row)}><KeyRound className="mr-1 h-4 w-4" />Set password</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <p className="text-xs text-[var(--muted-foreground)]">Showing {rows.length} matching students. Click any sortable header again to reverse the order.</p>
      </>}
    </section>

    {selected && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/40 p-4"><Card className="w-full max-w-lg rounded-2xl"><CardContent className="p-6"><h3 className="text-xl font-bold">Set demo login password</h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{selected.full_name} · {selected.email}</p><Input className="mt-5" type="password" autoComplete="new-password" placeholder="New password — minimum 12 characters" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /><p className="mt-2 text-xs text-[var(--muted-foreground)]">The new password goes directly to Supabase Auth. Evidara does not store a readable copy.</p><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => { setSelected(null); setNewPassword(''); }}>Cancel</Button><Button disabled={working || newPassword.length < 12} onClick={() => void resetPassword()}>{working && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}Set new password</Button></div></CardContent></Card></div>}
  </div>;
}
