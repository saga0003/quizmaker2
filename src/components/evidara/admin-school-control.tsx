'use client';

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { Building2, Check, CheckCircle2, ChevronLeft, ChevronRight, CreditCard, Edit3, Plus, RefreshCw, Search, ShieldCheck, ShieldOff, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Subscription = {
  id?: string; plan_name: string; status: string; starts_at: string; ends_at: string; seat_limit: number;
  resource_access: string; annual_price_per_student_paise: number; manual_amount_paise: number | null;
  payment_date: string | null; payment_method: string | null; payment_reference: string | null;
  invoice_reference: string | null; payment_notes: string | null; payment_status: string;
};

type SchoolRow = {
  id: string; name: string; slug: string; institute_type: string; board: string;
  address_line1: string | null; address_line2: string | null; city: string; state: string; postal_code: string | null;
  contact_name: string | null; contact_email: string | null; phone: string; secondary_phone: string | null;
  website: string | null; status: string; is_demo: boolean; subscription: Subscription | null;
  usage: { activeStudents: number; questions: number; papers: number; attempts: number };
};

type Payload = {
  generatedAt: string;
  stats: { schools: number; activeSchools: number; licensedSeats: number; activeStudents: number; manualRevenuePaise: number };
  schools: SchoolRow[];
};

type OnboardingResponse = {
  ok: boolean;
  onboarding: { organization_id?: string; subscription_id?: string; slug?: string } | null;
  firstAdmin: { userId: string; email: string; fullName: string; created: boolean; invitationSent: boolean };
};

const RATE_PAISE = 19900;
const steps = ['Institution', 'First admin', 'Licence', 'Review'] as const;
const money = (paise: number) => `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
const today = () => new Date().toISOString().slice(0, 10);
const nextYear = () => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10); };

const blankSchool = {
  name: '', institute_type: 'School', board: 'Other', address_line1: '', address_line2: '', city: '', state: 'Karnataka',
  postal_code: '', contact_name: '', contact_email: '', phone: '', secondary_phone: '', website: '', status: 'active',
};
const blankSub = {
  id: '', status: 'active', starts_at: today(), ends_at: nextYear(), seat_limit: '50', resource_access: 'full',
  manual_amount_rupees: '', payment_date: '', payment_method: '', payment_reference: '', invoice_reference: '', payment_notes: '', payment_status: 'unpaid',
};
const blankAdmin = { fullName: '', email: '', phone: '' };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-5"><h3 className="mb-4 text-sm font-bold uppercase tracking-[0.12em] text-[var(--teal)]">{title}</h3><div className="grid gap-4 sm:grid-cols-2">{children}</div></CardContent></Card>;
}
function Field({ label, value, onChange, type = 'text', placeholder = '', disabled = false }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; disabled?: boolean }) {
  return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}</span><Input type={type} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} /></label>;
}
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: Array<string | { value: string; label: string }> }) {
  return <label className="space-y-1.5 text-sm"><span className="font-medium">{label}</span><select className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => { const item = typeof o === 'string' ? { value: o, label: o } : o; return <option key={item.value} value={item.value}>{item.label}</option>; })}</select></label>;
}
function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex flex-col gap-1 border-b border-[var(--line)] pb-3 sm:flex-row sm:justify-between sm:gap-6"><span className="text-sm text-[var(--muted-foreground)]">{label}</span><strong className="text-sm sm:max-w-[65%] sm:text-right">{value || '—'}</strong></div>;
}

export function AdminSchoolControlView() {
  const { session } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SchoolRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState(0);
  const [school, setSchool] = useState<Record<string, string>>({ ...blankSchool });
  const [sub, setSub] = useState<Record<string, string>>({ ...blankSub });
  const [admin, setAdmin] = useState<Record<string, string>>({ ...blankAdmin });
  const [created, setCreated] = useState<OnboardingResponse | null>(null);

  async function schoolRequest(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    if (!session?.access_token) throw new Error('Super Admin sign-in is required.');
    const response = await fetch('/api/admin/school-control/', { method, cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'School control request failed.');
    return payload;
  }
  async function refresh() { setLoading(true); setError(''); try { setData(await schoolRequest('GET')); } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load institutions.'); } finally { setLoading(false); } }
  useEffect(() => { if (session?.access_token) void refresh(); }, [session?.access_token]);

  const rows = useMemo(() => (data?.schools || []).filter((r) => !search || `${r.name} ${r.city} ${r.state} ${r.contact_name || ''} ${r.contact_email || ''} ${r.phone}`.toLowerCase().includes(search.toLowerCase())), [data?.schools, search]);
  const annual = Math.max(0, Number(sub.seat_limit || 0)) * RATE_PAISE;
  const signedInEmail = String(session?.user?.email || '').trim().toLowerCase();
  const adminEmailMatchesSuperAdmin = Boolean(signedInEmail && admin.email.trim().toLowerCase() === signedInEmail);

  function close() { setSelected(null); setCreating(false); setStep(0); setCreated(null); setError(''); }
  function startCreate() { setCreating(true); setSelected(null); setStep(0); setSchool({ ...blankSchool }); setSub({ ...blankSub }); setAdmin({ ...blankAdmin }); setCreated(null); setError(''); }
  function open(row: SchoolRow) {
    setCreating(false); setSelected(row); setCreated(null); setError('');
    setSchool({ name: row.name, institute_type: row.institute_type, board: row.board, address_line1: row.address_line1 || '', address_line2: row.address_line2 || '', city: row.city, state: row.state, postal_code: row.postal_code || '', contact_name: row.contact_name || '', contact_email: row.contact_email || '', phone: row.phone || '', secondary_phone: row.secondary_phone || '', website: row.website || '', status: row.status });
    const s = row.subscription;
    setSub({ id: s?.id || '', status: s?.status || 'active', starts_at: s?.starts_at || today(), ends_at: s?.ends_at || nextYear(), seat_limit: String(s?.seat_limit || 0), resource_access: s?.resource_access || 'full', manual_amount_rupees: s?.manual_amount_paise == null ? '' : String(Number(s.manual_amount_paise) / 100), payment_date: s?.payment_date || '', payment_method: s?.payment_method || '', payment_reference: s?.payment_reference || '', invoice_reference: s?.invoice_reference || '', payment_notes: s?.payment_notes || '', payment_status: s?.payment_status || 'unpaid' });
  }
  function canContinue() {
    if (step === 0) return Boolean(school.name?.trim() && school.city?.trim() && school.state?.trim());
    if (step === 1) return admin.fullName?.trim().length >= 2 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email?.trim() || '') && !adminEmailMatchesSuperAdmin;
    if (step === 2) return Number(sub.seat_limit || 0) > 0 && Boolean(sub.starts_at && sub.ends_at) && sub.ends_at > sub.starts_at;
    return true;
  }

  async function save() {
    setSaving(true); setError('');
    try {
      if (creating) {
        if (!session?.access_token) throw new Error('Super Admin sign-in is required.');
        const response = await fetch('/api/admin/institution-onboarding/', { method: 'POST', cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ school, firstAdmin: admin, subscription: { seat_limit: Number(sub.seat_limit || 0), starts_at: sub.starts_at, ends_at: sub.ends_at, resource_access: sub.resource_access } }) });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Institution onboarding failed.');
        setCreated(payload as OnboardingResponse); await refresh(); return;
      }
      if (!selected) return;
      if (!school.name.trim() || !school.city.trim() || !school.state.trim()) throw new Error('Institution name, city and state are required.');
      const seatLimit = Number(sub.seat_limit || 0); if (!Number.isInteger(seatLimit) || seatLimit < 1) throw new Error('Licensed student count must be at least 1.');
      if (!sub.starts_at || !sub.ends_at || sub.ends_at <= sub.starts_at) throw new Error('Licence end date must be after its start date.');
      const rupees = sub.manual_amount_rupees.trim() === '' ? null : Number(sub.manual_amount_rupees);
      if (rupees != null && (!Number.isFinite(rupees) || rupees < 0)) throw new Error('Payment amount must be zero or greater.');
      await schoolRequest('POST', { action: 'save', organizationId: selected.id, school, subscription: { id: sub.id, plan_name: 'Evidara Institution Licence', status: sub.status, starts_at: sub.starts_at, ends_at: sub.ends_at, seat_limit: seatLimit, resource_access: sub.resource_access, manual_amount_paise: rupees == null ? null : Math.round(rupees * 100), payment_date: sub.payment_date, payment_method: sub.payment_method, payment_reference: sub.payment_reference, invoice_reference: sub.invoice_reference, payment_notes: sub.payment_notes, payment_status: sub.payment_status } });
      close(); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : 'Save failed.'); } finally { setSaving(false); }
  }
  async function access(action: 'suspend' | 'activate' | 'revoke') { if (!selected) return; setSaving(true); setError(''); try { await schoolRequest('POST', { action, organizationId: selected.id }); close(); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Access change failed.'); } finally { setSaving(false); } }

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading School & Licence Control…</div>;
  const cards: Array<[string, number | string, ElementType]> = [['Institutions', data?.stats.schools || 0, Building2], ['Active', data?.stats.activeSchools || 0, ShieldCheck], ['Licences', data?.stats.licensedSeats || 0, CreditCard], ['Students', data?.stats.activeStudents || 0, Users], ['Recorded revenue', money(data?.stats.manualRevenuePaise || 0), CreditCard]];

  return <div className="space-y-5 p-4 md:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h1 className="text-2xl font-bold">School & Licence Control</h1><p className="text-sm text-[var(--muted-foreground)]">Onboard institutions, create their first School Admin, control licences and record payments.</p></div><div className="flex gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Onboard institution</Button></div></div>
    {error && !selected && !creating && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map(([label, value, Icon]) => <Card key={label}><CardContent className="p-4"><Icon className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-xl font-bold">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search institution, city, contact or phone" value={search} onChange={(e) => setSearch(e.target.value)} /></div></CardContent></Card>
    <Card><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Institution</TableHead><TableHead>Contact</TableHead><TableHead>Usage</TableHead><TableHead>Licence</TableHead><TableHead>Access</TableHead><TableHead>Payment</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.id} className="cursor-pointer" onClick={() => open(r)}><TableCell><div className="font-semibold">{r.name}</div><div className="text-xs text-[var(--muted-foreground)]">{r.city}, {r.state}{r.is_demo ? ' · Demo' : ''}</div></TableCell><TableCell><div>{r.contact_name || '—'}</div><div className="text-xs text-[var(--muted-foreground)]">{r.phone || r.contact_email || '—'}</div></TableCell><TableCell><strong>{r.usage.activeStudents}</strong> students<div className="text-xs text-[var(--muted-foreground)]">{r.usage.papers} tests · {r.usage.attempts.toLocaleString('en-IN')} attempts</div></TableCell><TableCell>{r.usage.activeStudents}/{r.subscription?.seat_limit || 0}<div className="text-xs text-[var(--muted-foreground)]">{r.subscription?.ends_at || 'No expiry'}</div></TableCell><TableCell><Badge className={r.subscription?.status === 'active' && r.status === 'active' ? 'bg-[var(--teal)] text-white' : 'bg-destructive text-white'}>{r.subscription?.status || r.status}</Badge></TableCell><TableCell>{r.subscription?.payment_status === 'paid' ? money(r.subscription.manual_amount_paise || 0) : (r.subscription?.payment_status || 'unpaid')}</TableCell><TableCell><Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); open(r); }}><Edit3 className="mr-1 h-4 w-4" />Edit</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

    {(selected || creating) && <div className="fixed inset-0 z-[90] flex items-start justify-end bg-black/35"><div className="h-full w-full max-w-3xl overflow-y-auto bg-[var(--canvas)] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-white p-4"><div><h2 className="text-xl font-bold">{creating ? 'Onboard institution' : selected?.name}</h2><p className="text-xs text-[var(--muted-foreground)]">{creating ? 'Institution, first School Admin and annual licence in one guided setup' : 'Institution, licence and payment control'}</p></div><Button variant="ghost" size="icon" onClick={close}><X className="h-5 w-5" /></Button></div><div className="space-y-5 p-4 md:p-6">
      {creating ? created ? <Card className="border-[var(--teal)]/30"><CardContent className="space-y-4 p-6"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 h-6 w-6 text-[var(--teal)]" /><div><h3 className="text-xl font-bold">Institution created</h3><p className="text-sm text-[var(--muted-foreground)]">Licence and first School Admin membership are active.</p></div></div><ReviewRow label="Institution" value={school.name} /><ReviewRow label="School Admin" value={`${created.firstAdmin.fullName} · ${created.firstAdmin.email}`} /><ReviewRow label="Admin access" value={created.firstAdmin.invitationSent ? 'Invitation email sent' : 'Existing School Admin linked'} /><ReviewRow label="Licence" value={`${Number(sub.seat_limit || 0).toLocaleString('en-IN')} students × ₹199 / year`} /><div className="flex justify-end"><Button onClick={close}>Done</Button></div></CardContent></Card> : <>
        <div className="grid grid-cols-4 gap-2">{steps.map((label, i) => <div key={label} className={`rounded-lg border p-2 text-center text-xs font-semibold ${i === step ? 'border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)]' : i < step ? 'bg-white' : 'text-[var(--muted-foreground)]'}`}>{i < step ? <Check className="mx-auto mb-1 h-4 w-4" /> : <span className="mb-1 block">{i + 1}</span>}{label}</div>)}</div>
        {step === 0 && <><Section title="Institution details"><Field label="Institution name *" value={school.name} onChange={(v) => setSchool((s) => ({ ...s, name: v }))} placeholder="e.g. St. Mary's ISC, Chikmagalur" /><SelectField label="Institution type" value={school.institute_type} onChange={(v) => setSchool((s) => ({ ...s, institute_type: v }))} options={['School', 'PU College', 'College', 'Coaching Institute', 'University', 'Other']} /><Field label="Board / curriculum" value={school.board} onChange={(v) => setSchool((s) => ({ ...s, board: v }))} placeholder="e.g. ISC / Integrated NEET-JEE-KCET" /><Field label="Primary phone" value={school.phone} onChange={(v) => setSchool((s) => ({ ...s, phone: v }))} /><Field label="Address line 1" value={school.address_line1} onChange={(v) => setSchool((s) => ({ ...s, address_line1: v }))} /><Field label="Address line 2" value={school.address_line2} onChange={(v) => setSchool((s) => ({ ...s, address_line2: v }))} /><Field label="City *" value={school.city} onChange={(v) => setSchool((s) => ({ ...s, city: v }))} /><Field label="State *" value={school.state} onChange={(v) => setSchool((s) => ({ ...s, state: v }))} /><Field label="PIN / postal code" value={school.postal_code} onChange={(v) => setSchool((s) => ({ ...s, postal_code: v }))} /><Field label="Secondary phone" value={school.secondary_phone} onChange={(v) => setSchool((s) => ({ ...s, secondary_phone: v }))} /><Field label="Website" value={school.website} onChange={(v) => setSchool((s) => ({ ...s, website: v }))} placeholder="smis.edu.in" /></Section><Section title="Primary contact"><Field label="Contact person" value={school.contact_name} onChange={(v) => setSchool((s) => ({ ...s, contact_name: v }))} /><Field label="Contact email" type="email" value={school.contact_email} onChange={(v) => setSchool((s) => ({ ...s, contact_email: v }))} /></Section></>}
        {step === 1 && <Section title="First School Admin"><Field label="Full name *" value={admin.fullName} onChange={(v) => setAdmin((s) => ({ ...s, fullName: v }))} /><Field label="Email *" type="email" value={admin.email} onChange={(v) => { setAdmin((s) => ({ ...s, email: v })); setError(''); }} /><Field label="Mobile number" value={admin.phone} onChange={(v) => setAdmin((s) => ({ ...s, phone: v }))} />{adminEmailMatchesSuperAdmin ? <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Please use a different email for the School Admin.</div> : <div className="rounded-xl border bg-white p-3 text-xs leading-5 text-[var(--muted-foreground)]">The School Admin will receive the account invitation at the email entered above.</div>}</Section>}
        {step === 2 && <Section title="Annual institution licence"><Field label="Licensed students *" type="number" value={sub.seat_limit} onChange={(v) => setSub((s) => ({ ...s, seat_limit: v }))} /><Field label="Institution rate" value="₹199 / student / year" onChange={() => {}} disabled /><Field label="Start date *" type="date" value={sub.starts_at} onChange={(v) => setSub((s) => ({ ...s, starts_at: v }))} /><Field label="End date *" type="date" value={sub.ends_at} onChange={(v) => setSub((s) => ({ ...s, ends_at: v }))} /><SelectField label="Study resources" value={sub.resource_access} onChange={(v) => setSub((s) => ({ ...s, resource_access: v }))} options={[{ value: 'full', label: 'Full access' }, { value: 'limited', label: 'Limited access' }]} /><Field label="Estimated annual licence" value={money(annual)} onChange={() => {}} disabled /></Section>}
        {step === 3 && <Card><CardContent className="space-y-4 p-5"><h3 className="font-bold">Review before onboarding</h3><ReviewRow label="Institution" value={`${school.name} · ${school.city}, ${school.state}`} /><ReviewRow label="Type / curriculum" value={`${school.institute_type} · ${school.board || 'Other'}`} /><ReviewRow label="Address" value={[school.address_line1, school.address_line2, school.postal_code].filter(Boolean).join(', ')} /><ReviewRow label="Primary contact" value={`${school.contact_name || admin.fullName} · ${school.contact_email || admin.email}`} /><ReviewRow label="First School Admin" value={`${admin.fullName} · ${admin.email}${admin.phone ? ` · ${admin.phone}` : ''}`} /><ReviewRow label="Annual licence" value={`${Number(sub.seat_limit || 0).toLocaleString('en-IN')} × ₹199 = ${money(annual)} / year`} /><ReviewRow label="Term" value={`${sub.starts_at} → ${sub.ends_at}`} /><div className="rounded-lg border border-[var(--teal)]/25 bg-[var(--teal)]/5 p-3 text-sm">Please confirm the details above. The School Admin will receive an invitation by email after the institution is created.</div></CardContent></Card>}
        {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm font-medium text-destructive">{error}</div>}
        <div className="sticky bottom-0 flex items-center justify-between border-t bg-[var(--canvas)] py-4"><Button variant="outline" disabled={saving || step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}><ChevronLeft className="mr-2 h-4 w-4" />Back</Button>{step < 3 ? <Button disabled={!canContinue()} onClick={() => { setError(''); setStep((s) => Math.min(3, s + 1)); }}>Continue<ChevronRight className="ml-2 h-4 w-4" /></Button> : <Button disabled={saving} onClick={() => void save()}>{saving ? 'Onboarding…' : 'Create institution'}</Button>}</div>
      </> : <>
        <Section title="Institution details"><Field label="Institution name" value={school.name} onChange={(v) => setSchool((s) => ({ ...s, name: v }))} /><SelectField label="Institution type" value={school.institute_type} onChange={(v) => setSchool((s) => ({ ...s, institute_type: v }))} options={['School', 'PU College', 'College', 'Coaching Institute', 'University', 'Other']} /><Field label="Board / curriculum" value={school.board} onChange={(v) => setSchool((s) => ({ ...s, board: v }))} /><SelectField label="Status" value={school.status} onChange={(v) => setSchool((s) => ({ ...s, status: v }))} options={['active', 'pending', 'suspended']} /><Field label="Address line 1" value={school.address_line1} onChange={(v) => setSchool((s) => ({ ...s, address_line1: v }))} /><Field label="Address line 2" value={school.address_line2} onChange={(v) => setSchool((s) => ({ ...s, address_line2: v }))} /><Field label="City" value={school.city} onChange={(v) => setSchool((s) => ({ ...s, city: v }))} /><Field label="State" value={school.state} onChange={(v) => setSchool((s) => ({ ...s, state: v }))} /><Field label="PIN / postal code" value={school.postal_code} onChange={(v) => setSchool((s) => ({ ...s, postal_code: v }))} /><Field label="Website" value={school.website} onChange={(v) => setSchool((s) => ({ ...s, website: v }))} /></Section>
        <Section title="Primary contact"><Field label="Contact person" value={school.contact_name} onChange={(v) => setSchool((s) => ({ ...s, contact_name: v }))} /><Field label="Email" type="email" value={school.contact_email} onChange={(v) => setSchool((s) => ({ ...s, contact_email: v }))} /><Field label="Phone" value={school.phone} onChange={(v) => setSchool((s) => ({ ...s, phone: v }))} /><Field label="Secondary phone" value={school.secondary_phone} onChange={(v) => setSchool((s) => ({ ...s, secondary_phone: v }))} /></Section>
        <Section title="Licence & access"><Field label="Plan" value="Evidara Institution Licence" onChange={() => {}} disabled /><Field label="Institution rate" value="₹199 / student / year" onChange={() => {}} disabled /><Field label="Student licences" type="number" value={sub.seat_limit} onChange={(v) => setSub((s) => ({ ...s, seat_limit: v }))} /><Field label="Annual licence amount" value={money(annual)} onChange={() => {}} disabled /><Field label="Start date" type="date" value={sub.starts_at} onChange={(v) => setSub((s) => ({ ...s, starts_at: v }))} /><Field label="Expiry date" type="date" value={sub.ends_at} onChange={(v) => setSub((s) => ({ ...s, ends_at: v }))} /><SelectField label="Licence status" value={sub.status} onChange={(v) => setSub((s) => ({ ...s, status: v }))} options={['active', 'trial', 'expired', 'suspended', 'cancelled']} /><SelectField label="Resources" value={sub.resource_access} onChange={(v) => setSub((s) => ({ ...s, resource_access: v }))} options={[{ value: 'full', label: 'Full access' }, { value: 'limited', label: 'Limited access' }]} /></Section>
        <Section title="Payment record"><SelectField label="Payment status" value={sub.payment_status} onChange={(v) => setSub((s) => ({ ...s, payment_status: v }))} options={['unpaid', 'paid', 'partial', 'waived']} /><Field label="Amount received (₹)" type="number" value={sub.manual_amount_rupees} onChange={(v) => setSub((s) => ({ ...s, manual_amount_rupees: v }))} /><Field label="Payment date" type="date" value={sub.payment_date} onChange={(v) => setSub((s) => ({ ...s, payment_date: v }))} /><Field label="Payment method" value={sub.payment_method} onChange={(v) => setSub((s) => ({ ...s, payment_method: v }))} /><Field label="Payment reference" value={sub.payment_reference} onChange={(v) => setSub((s) => ({ ...s, payment_reference: v }))} /><Field label="Invoice reference" value={sub.invoice_reference} onChange={(v) => setSub((s) => ({ ...s, invoice_reference: v }))} /></Section>
        {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm font-medium text-destructive">{error}</div>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"><div className="flex gap-2"><Button variant="outline" disabled={saving} onClick={() => void access('suspend')}><ShieldOff className="mr-2 h-4 w-4" />Suspend</Button><Button variant="outline" disabled={saving} onClick={() => void access('activate')}><ShieldCheck className="mr-2 h-4 w-4" />Activate</Button></div><Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save changes'}</Button></div>
      </>}
    </div></div></div>}
  </div>;
}
