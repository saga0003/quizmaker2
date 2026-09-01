'use client';

import { useEffect, useMemo, useState, type ElementType, type ReactNode } from 'react';
import { Building2, Check, ChevronLeft, ChevronRight, CreditCard, Edit3, Plus, RefreshCw, Search, ShieldOff, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthProvider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Subscription = {
  id?: string;
  plan_name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  seat_limit: number;
  resource_access: string;
  annual_price_per_student_paise: number;
  manual_amount_paise: number | null;
  payment_date: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  invoice_reference: string | null;
  payment_notes: string | null;
  payment_status: string;
};

type SchoolRow = {
  id: string;
  name: string;
  slug: string;
  institute_type: string;
  board: string;
  address_line1: string | null;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string;
  secondary_phone: string | null;
  website: string | null;
  status: string;
  is_demo: boolean;
  subscription: Subscription | null;
  usage: { activeStudents: number; questions: number; papers: number; attempts: number };
};

type Payload = {
  generatedAt: string;
  stats: { schools: number; activeSchools: number; licensedSeats: number; activeStudents: number; manualRevenuePaise: number };
  schools: SchoolRow[];
};

const onboardingSteps = ['Institution', 'First admin', 'Licence', 'Review'] as const;
const ANNUAL_RATE_PAISE = 19900;

function money(paise: number) {
  return `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
}

const blankSchool: Omit<SchoolRow, 'id' | 'slug' | 'usage' | 'is_demo'> = {
  name: '', institute_type: 'School', board: 'Other', address_line1: '', address_line2: '', city: '', state: '', postal_code: '', contact_name: '', contact_email: '', phone: '', secondary_phone: '', website: '', status: 'active', subscription: null,
};

const blankSubscription: Subscription = {
  plan_name: 'Evidara ₹199 Student Licence', status: 'active',
  starts_at: new Date().toISOString().slice(0, 10),
  ends_at: `${new Date().getFullYear() + 1}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`,
  seat_limit: 100, resource_access: 'full', annual_price_per_student_paise: ANNUAL_RATE_PAISE,
  manual_amount_paise: null, payment_date: null, payment_method: null, payment_reference: null,
  invoice_reference: null, payment_notes: null, payment_status: 'unpaid',
};

export function AdminSchoolControlView() {
  const { session } = useAuth();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SchoolRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [firstAdminUserId, setFirstAdminUserId] = useState('');
  const [schoolForm, setSchoolForm] = useState<Record<string, string>>({});
  const [subForm, setSubForm] = useState<Record<string, string>>({});

  async function request(method: 'GET' | 'POST', body?: Record<string, unknown>) {
    const token = session?.access_token;
    if (!token) throw new Error('Super Admin sign-in is required.');
    const response = await fetch('/api/admin/school-control/', {
      method, cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'School control request failed.');
    return payload;
  }

  async function onboardInstitution() {
    const token = session?.access_token;
    if (!token) throw new Error('Super Admin sign-in is required.');
    const response = await fetch('/api/admin/institution-onboarding/', {
      method: 'POST', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        school: schoolForm,
        subscription: {
          seat_limit: Number(subForm.seat_limit || 0),
          starts_at: subForm.starts_at,
          ends_at: subForm.ends_at,
        },
        firstAdminUserId: firstAdminUserId.trim(),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Institution onboarding failed.');
    return payload;
  }

  async function refresh() {
    setLoading(true); setError('');
    try { setData(await request('GET')); }
    catch (value) { setError(value instanceof Error ? value.message : 'Unable to load schools.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (session?.access_token) void refresh(); }, [session?.access_token]);

  const rows = useMemo(() => (data?.schools || []).filter((row) => !search || `${row.name} ${row.city} ${row.contact_name || ''} ${row.contact_email || ''} ${row.phone}`.toLowerCase().includes(search.toLowerCase())), [data?.schools, search]);

  function open(row: SchoolRow) {
    setCreating(false); setSelected(row); setWizardStep(0); setFirstAdminUserId('');
    setSchoolForm({
      name: row.name, institute_type: row.institute_type, board: row.board, address_line1: row.address_line1 || '',
      address_line2: row.address_line2 || '', city: row.city, state: row.state, postal_code: row.postal_code || '',
      contact_name: row.contact_name || '', contact_email: row.contact_email || '', phone: row.phone,
      secondary_phone: row.secondary_phone || '', website: row.website || '', status: row.status,
    });
    const sub = row.subscription || blankSubscription;
    setSubForm({
      id: sub.id || '', plan_name: sub.plan_name, status: sub.status, starts_at: sub.starts_at, ends_at: sub.ends_at,
      seat_limit: String(sub.seat_limit), resource_access: sub.resource_access,
      annual_price_per_student_paise: String(ANNUAL_RATE_PAISE),
      manual_amount_paise: sub.manual_amount_paise == null ? '' : String(sub.manual_amount_paise),
      payment_date: sub.payment_date || '', payment_method: sub.payment_method || '', payment_reference: sub.payment_reference || '',
      invoice_reference: sub.invoice_reference || '', payment_notes: sub.payment_notes || '', payment_status: sub.payment_status,
    });
  }

  function createNew() {
    setCreating(true); setSelected(null); setWizardStep(0); setFirstAdminUserId(''); setError('');
    setSchoolForm(Object.fromEntries(Object.entries(blankSchool).filter(([key]) => key !== 'subscription').map(([key, value]) => [key, String(value ?? '')])));
    setSubForm(Object.fromEntries(Object.entries(blankSubscription).map(([key, value]) => [key, value == null ? '' : String(value)])));
  }

  function wizardCanContinue() {
    if (wizardStep === 0) return Boolean(schoolForm.name?.trim() && schoolForm.city?.trim() && schoolForm.state?.trim());
    if (wizardStep === 1) return Boolean(firstAdminUserId.trim());
    if (wizardStep === 2) return Number(subForm.seat_limit || 0) > 0 && Boolean(subForm.starts_at && subForm.ends_at) && subForm.ends_at > subForm.starts_at;
    return true;
  }

  async function save() {
    setSaving(true); setError('');
    try {
      if (creating) {
        await onboardInstitution();
      } else {
        const school = { ...schoolForm };
        const subscription = {
          ...subForm,
          seat_limit: Number(subForm.seat_limit || 0),
          annual_price_per_student_paise: ANNUAL_RATE_PAISE,
          manual_amount_paise: subForm.manual_amount_paise === '' ? null : Number(subForm.manual_amount_paise || 0),
        };
        await request('POST', { action: 'save', organizationId: selected?.id, school, subscription });
      }
      setSelected(null); setCreating(false); setWizardStep(0); setFirstAdminUserId('');
      await refresh();
    } catch (value) { setError(value instanceof Error ? value.message : 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function accessAction(action: 'suspend' | 'activate' | 'revoke') {
    if (!selected) return;
    setSaving(true); setError('');
    try { await request('POST', { action, organizationId: selected.id }); setSelected(null); await refresh(); }
    catch (value) { setError(value instanceof Error ? value.message : 'Access change failed.'); }
    finally { setSaving(false); }
  }

  if (loading) return <div className="p-6 text-sm text-[var(--muted-foreground)]">Loading School & Licence Control…</div>;

  const summaryCards: Array<[string, number | string, ElementType]> = [
    ['Schools', data?.stats.schools || 0, Building2], ['Active', data?.stats.activeSchools || 0, Building2],
    ['Licences', data?.stats.licensedSeats || 0, CreditCard], ['Students', data?.stats.activeStudents || 0, Users],
    ['Manual revenue', money(data?.stats.manualRevenuePaise || 0), CreditCard],
  ];

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold text-[var(--foreground)]">School & Licence Control</h1><p className="text-sm text-[var(--muted-foreground)]">Register schools, edit institution details, control student licences and record payments manually.</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => void refresh()}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button><Button onClick={createNew}><Plus className="mr-2 h-4 w-4" />Onboard institution</Button></div>
      </div>
      {error && <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{summaryCards.map(([label, value, Icon]) => <Card key={label} className="rounded-xl shadow-sm"><CardContent className="p-4"><Icon className="mb-2 h-5 w-5 text-[var(--teal)]" /><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-xl font-bold">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</p></CardContent></Card>)}</div>
      <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" /><Input className="pl-9" placeholder="Search school, city, contact or phone" value={search} onChange={(event) => setSearch(event.target.value)} /></div></CardContent></Card>
      <Card className="rounded-xl shadow-sm"><CardContent className="overflow-x-auto p-0"><Table><TableHeader><TableRow><TableHead>Institution</TableHead><TableHead>Contact</TableHead><TableHead>Usage</TableHead><TableHead>Licence</TableHead><TableHead>Access</TableHead><TableHead>Payment</TableHead><TableHead /></TableRow></TableHeader><TableBody>{rows.map((row) => <TableRow key={row.id} className="cursor-pointer" onClick={() => open(row)}><TableCell><div className="font-semibold">{row.name}</div><div className="text-xs text-[var(--muted-foreground)]">{row.city}, {row.state}{row.is_demo ? ' · Demo' : ''}</div></TableCell><TableCell><div>{row.contact_name || '—'}</div><div className="text-xs text-[var(--muted-foreground)]">{row.phone || row.contact_email || '—'}</div></TableCell><TableCell><strong>{row.usage.activeStudents}</strong> students<div className="text-xs text-[var(--muted-foreground)]">{row.usage.papers} tests · {row.usage.attempts.toLocaleString('en-IN')} attempts</div></TableCell><TableCell>{row.usage.activeStudents}/{row.subscription?.seat_limit || 0}<div className="text-xs text-[var(--muted-foreground)]">{row.subscription?.ends_at || 'No expiry'}</div></TableCell><TableCell><Badge className={row.subscription?.status === 'active' && row.status === 'active' ? 'bg-[var(--teal)] text-white' : 'bg-destructive text-white'}>{row.subscription?.status || row.status}</Badge></TableCell><TableCell>{row.subscription?.payment_status === 'paid' ? <><strong>{money(row.subscription.manual_amount_paise || 0)}</strong><div className="text-xs text-[var(--muted-foreground)]">Paid manually</div></> : <span className="text-[var(--muted-foreground)]">Unpaid</span>}</TableCell><TableCell><Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); open(row); }}><Edit3 className="mr-1 h-4 w-4" />Edit</Button></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>

      {(selected || creating) && <div className="fixed inset-0 z-[90] flex items-start justify-end bg-black/35"><div className="h-full w-full max-w-3xl overflow-y-auto bg-[var(--canvas)] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--line)] bg-white p-4"><div><h2 className="text-xl font-bold">{creating ? 'Onboard institution' : selected?.name}</h2><p className="text-xs text-[var(--muted-foreground)]">{creating ? 'One guided setup for institution, first School Admin and annual licences' : 'Super Admin full school, subscription and payment control'}</p></div><Button variant="ghost" size="icon" onClick={() => { setSelected(null); setCreating(false); setWizardStep(0); }}><X className="h-5 w-5" /></Button></div>
        <div className="space-y-5 p-4 md:p-6">
          {creating ? <>
            <div className="grid grid-cols-4 gap-2">{onboardingSteps.map((label, index) => <div key={label} className={`rounded-lg border p-2 text-center text-xs font-semibold ${index === wizardStep ? 'border-[var(--teal)] bg-[var(--teal)]/10 text-[var(--teal)]' : index < wizardStep ? 'border-[var(--line)] bg-white' : 'border-[var(--line)] text-[var(--muted-foreground)]'}`}>{index < wizardStep ? <Check className="mx-auto mb-1 h-4 w-4" /> : <span className="mb-1 block">{index + 1}</span>}{label}</div>)}</div>
            {wizardStep === 0 && <><Section title="Institution details"><Field label="School name *" value={schoolForm.name} onChange={(v) => setSchoolForm((s) => ({ ...s, name: v }))} /><Field label="Institution type" value={schoolForm.institute_type} onChange={(v) => setSchoolForm((s) => ({ ...s, institute_type: v }))} /><Field label="Board / curriculum" value={schoolForm.board} onChange={(v) => setSchoolForm((s) => ({ ...s, board: v }))} /><Field label="City *" value={schoolForm.city} onChange={(v) => setSchoolForm((s) => ({ ...s, city: v }))} /><Field label="State *" value={schoolForm.state} onChange={(v) => setSchoolForm((s) => ({ ...s, state: v }))} /><Field label="Phone" value={schoolForm.phone} onChange={(v) => setSchoolForm((s) => ({ ...s, phone: v }))} /><Field label="Contact person" value={schoolForm.contact_name} onChange={(v) => setSchoolForm((s) => ({ ...s, contact_name: v }))} /><Field label="Contact email" value={schoolForm.contact_email} onChange={(v) => setSchoolForm((s) => ({ ...s, contact_email: v }))} /></Section><p className="text-xs text-[var(--muted-foreground)]">Required: school name, city and state. Additional address details can be added after onboarding.</p></>}
            {wizardStep === 1 && <Section title="First School Admin"><div className="space-y-2 sm:col-span-2"><Field label="Existing Evidara user ID *" value={firstAdminUserId} onChange={setFirstAdminUserId} /><p className="text-xs text-[var(--muted-foreground)]">Use the UUID of the existing Evidara account that will become this institution's first School Admin. The server verifies the account and rejects incompatible platform roles.</p></div></Section>}
            {wizardStep === 2 && <Section title="Annual licence"><Field label="Licensed students *" type="number" value={subForm.seat_limit} onChange={(v) => setSubForm((s) => ({ ...s, seat_limit: v }))} /><Field label="Price / student / year" value="₹199" onChange={() => {}} disabled /><Field label="Start date *" type="date" value={subForm.starts_at} onChange={(v) => setSubForm((s) => ({ ...s, starts_at: v }))} /><Field label="End date *" type="date" value={subForm.ends_at} onChange={(v) => setSubForm((s) => ({ ...s, ends_at: v }))} /></Section>}
            {wizardStep === 3 && <Card className="rounded-xl shadow-sm"><CardContent className="space-y-4 p-5"><h3 className="text-base font-bold">Review before onboarding</h3><ReviewRow label="Institution" value={`${schoolForm.name} · ${schoolForm.city}, ${schoolForm.state}`} /><ReviewRow label="First School Admin" value={firstAdminUserId} mono /><ReviewRow label="Annual licence" value={`${Number(subForm.seat_limit || 0).toLocaleString('en-IN')} students × ₹199 / year`} /><ReviewRow label="Term" value={`${subForm.starts_at} → ${subForm.ends_at}`} /><div className="rounded-lg border border-[var(--teal)]/25 bg-[var(--teal)]/5 p-3 text-sm">Creating the institution uses the transactional onboarding service: institution, licence, first School Admin membership/defaults and audit either all succeed together or all roll back.</div></CardContent></Card>}
            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[var(--line)] bg-[var(--canvas)] py-4"><Button variant="outline" disabled={saving || wizardStep === 0} onClick={() => setWizardStep((step) => Math.max(0, step - 1))}><ChevronLeft className="mr-2 h-4 w-4" />Back</Button>{wizardStep < onboardingSteps.length - 1 ? <Button disabled={!wizardCanContinue()} onClick={() => setWizardStep((step) => Math.min(onboardingSteps.length - 1, step + 1))}>Continue<ChevronRight className="ml-2 h-4 w-4" /></Button> : <Button disabled={saving} onClick={() => void save()}>{saving ? 'Onboarding…' : 'Create institution'}</Button>}</div>
          </> : <>
            {selected && <div className="grid gap-3 sm:grid-cols-4">{([['Active students', selected.usage.activeStudents], ['Questions', selected.usage.questions], ['Tests', selected.usage.papers], ['Attempts', selected.usage.attempts]] as Array<[string, number]>).map(([label, value]) => <div key={label} className="rounded-xl border border-[var(--line)] bg-white p-3"><span className="text-xs text-[var(--muted-foreground)]">{label}</span><strong className="mt-1 block text-xl">{value.toLocaleString('en-IN')}</strong></div>)}</div>}
            <Section title="Institution details"><Field label="School name" value={schoolForm.name} onChange={(v) => setSchoolForm((s) => ({ ...s, name: v }))} /><Field label="Institution type" value={schoolForm.institute_type} onChange={(v) => setSchoolForm((s) => ({ ...s, institute_type: v }))} /><Field label="Board / curriculum" value={schoolForm.board} onChange={(v) => setSchoolForm((s) => ({ ...s, board: v }))} /><SelectField label="School status" value={schoolForm.status} onChange={(v) => setSchoolForm((s) => ({ ...s, status: v }))} options={['active', 'pending', 'suspended']} /><Field label="Address line 1" value={schoolForm.address_line1} onChange={(v) => setSchoolForm((s) => ({ ...s, address_line1: v }))} /><Field label="Address line 2" value={schoolForm.address_line2} onChange={(v) => setSchoolForm((s) => ({ ...s, address_line2: v }))} /><Field label="City" value={schoolForm.city} onChange={(v) => setSchoolForm((s) => ({ ...s, city: v }))} /><Field label="State" value={schoolForm.state} onChange={(v) => setSchoolForm((s) => ({ ...s, state: v }))} /><Field label="PIN / postal code" value={schoolForm.postal_code} onChange={(v) => setSchoolForm((s) => ({ ...s, postal_code: v }))} /></Section>
            <Section title="Primary contact"><Field label="Contact person" value={schoolForm.contact_name} onChange={(v) => setSchoolForm((s) => ({ ...s, contact_name: v }))} /><Field label="Email" value={schoolForm.contact_email} onChange={(v) => setSchoolForm((s) => ({ ...s, contact_email: v }))} /><Field label="Phone" value={schoolForm.phone} onChange={(v) => setSchoolForm((s) => ({ ...s, phone: v }))} /><Field label="Secondary phone" value={schoolForm.secondary_phone} onChange={(v) => setSchoolForm((s) => ({ ...s, secondary_phone: v }))} /><Field label="Website" value={schoolForm.website} onChange={(v) => setSchoolForm((s) => ({ ...s, website: v }))} /></Section>
            <Section title="Licence & access"><Field label="Plan name" value={subForm.plan_name} onChange={(v) => setSubForm((s) => ({ ...s, plan_name: v }))} /><Field label="Number of student licences" type="number" value={subForm.seat_limit} onChange={(v) => setSubForm((s) => ({ ...s, seat_limit: v }))} /><Field label="Start date" type="date" value={subForm.starts_at} onChange={(v) => setSubForm((s) => ({ ...s, starts_at: v }))} /><Field label="Expiry date" type="date" value={subForm.ends_at} onChange={(v) => setSubForm((s) => ({ ...s, ends_at: v }))} /><SelectField label="Licence status" value={subForm.status} onChange={(v) => setSubForm((s) => ({ ...s, status: v }))} options={['active', 'trial', 'expired', 'suspended', 'cancelled']} /><SelectField label="Resources" value={subForm.resource_access} onChange={(v) => setSubForm((s) => ({ ...s, resource_access: v }))} options={['full', 'limited']} /><Field label="Price / student / year" value="₹199" onChange={() => {}} disabled /><Field label="Annual licence amount" value={money(Math.max(0, Number(subForm.seat_limit || 0)) * ANNUAL_RATE_PAISE)} onChange={() => {}} disabled /></Section>
            <Section title="Manual payment record"><SelectField label="Payment status" value={subForm.payment_status} onChange={(v) => setSubForm((s) => ({ ...s, payment_status: v }))} options={['unpaid', 'paid', 'partial', 'waived']} /><Field label="Amount paid (paise)" type="number" value={subForm.manual_amount_paise} onChange={(v) => setSubForm((s) => ({ ...s, manual_amount_paise: v }))} /><Field label="Payment date" type="date" value={subForm.payment_date} onChange={(v) => setSubForm((s) => ({ ...s, payment_date: v }))} /><Field label="Payment method" value={subForm.payment_method} onChange={(v) => setSubForm((s) => ({ ...s, payment_method: v }))} /><Field label="Payment reference" value={subForm.payment_reference} onChange={(v) => setSubForm((s) => ({ ...s, payment_reference: v }))} /><Field label="Invoice reference" value={subForm.invoice_reference} onChange={(v) => setSubForm((s) => ({ ...s, invoice_reference: v }))} /><Field label="Internal payment notes" value={subForm.payment_notes} onChange={(v) => setSubForm((s) => ({ ...s, payment_notes: v }))} /></Section>
            <div className="sticky bottom-0 flex flex-wrap justify-between gap-2 border-t border-[var(--line)] bg-[var(--canvas)] py-4"><div className="flex flex-wrap gap-2">{selected && <><Button variant="outline" disabled={saving} onClick={() => void accessAction('suspend')}><ShieldOff className="mr-2 h-4 w-4" />Suspend access</Button><Button variant="outline" disabled={saving} onClick={() => void accessAction('activate')}>Reactivate</Button><Button variant="destructive" disabled={saving} onClick={() => void accessAction('revoke')}>Revoke licence</Button></>}</div><Button disabled={saving || !schoolForm.name} onClick={() => void save()}>{saving ? 'Saving…' : 'Save all changes'}</Button></div>
          </>}
        </div>
      </div></div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="rounded-xl shadow-sm"><CardContent className="p-4"><h3 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--teal)]">{title}</h3><div className="grid gap-4 sm:grid-cols-2">{children}</div></CardContent></Card>;
}

function Field({ label, value = '', onChange, type = 'text', disabled = false }: { label: string; value?: string; onChange: (value: string) => void; type?: string; disabled?: boolean }) {
  return <label className="space-y-1"><span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span><Input type={type} value={value || ''} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SelectField({ label, value = '', onChange, options }: { label: string; value?: string; onChange: (value: string) => void; options: string[] }) {
  return <label className="space-y-1"><span className="text-xs font-medium text-[var(--muted-foreground)]">{label}</span><select className="min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={value || ''} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>;
}

function ReviewRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="flex flex-col gap-1 border-b border-[var(--line)] pb-3 sm:flex-row sm:items-start sm:justify-between"><span className="text-sm text-[var(--muted-foreground)]">{label}</span><strong className={`text-sm sm:text-right ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</strong></div>;
}
