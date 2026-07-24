'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Edit3,
  LoaderCircle,
  Plus,
  RefreshCw,
  School,
  Search,
  ShieldCheck,
  TicketPercent,
  XCircle,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { AdminProduct } from '@/types/commerce';
import { rupees } from '@/types/commerce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import styles from '@/components/commerce/commerce-prototype.module.css';

const emptyForm = {
  id: '',
  code: '',
  description: '',
  discountPercent: '5',
  purpose: 'promotion',
  productId: 'all',
  organizationId: 'none',
  allowedEmail: '',
  seatCount: '',
  usageLimit: '',
  perUserLimit: '1',
  startsAt: '',
  endsAt: '',
  offlineReference: '',
  offlineAmountRupees: '',
  internalNote: '',
  active: true,
};

type VoucherRow = {
  id: string;
  code: string;
  description: string | null;
  discount_percent: number;
  purpose: string;
  product_id: string | null;
  allowed_email: string | null;
  organization_id: string | null;
  seat_count: number | null;
  usage_limit: number | null;
  per_user_limit: number;
  used_count: number;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  offline_payment_reference: string | null;
  offline_amount_paise: number | null;
  internal_note: string | null;
  products?: { name: string } | { name: string }[] | null;
  organizations?: { name: string } | { name: string }[] | null;
};

type Organization = { id: string; name: string };
type FormState = typeof emptyForm;
type VoucherFilter = 'all' | 'active' | 'inactive' | 'promotion' | 'offline';

const localDateTime = (value: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function relationName(value: VoucherRow['products'] | VoucherRow['organizations']) {
  if (Array.isArray(value)) return value[0]?.name || '';
  return value?.name || '';
}

function voucherState(voucher: VoucherRow) {
  const now = Date.now();
  if (!voucher.active) return 'Inactive';
  if (voucher.starts_at && new Date(voucher.starts_at).getTime() > now) return 'Scheduled';
  if (voucher.ends_at && new Date(voucher.ends_at).getTime() < now) return 'Expired';
  if (voucher.usage_limit && voucher.used_count >= voucher.usage_limit) return 'Exhausted';
  return 'Active';
}

export function AdminVoucherManager() {
  const { profile } = useAuth();
  const superAdmin = normalizeEvidaraRole(profile?.role) === 'super_admin';
  const [form, setForm] = useState<FormState>(emptyForm);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<VoucherFilter>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const [voucherResult, productResult, organizationResult] = await Promise.all([
      supabase.from('voucher_codes').select('id,code,description,discount_percent,purpose,product_id,allowed_email,organization_id,seat_count,usage_limit,per_user_limit,used_count,starts_at,ends_at,active,offline_payment_reference,offline_amount_paise,internal_note,products(name),organizations(name)').order('created_at', { ascending: false }),
      supabase.rpc('admin_list_products_v9'),
      supabase.from('organizations').select('id,name').order('name'),
    ]);
    if (voucherResult.error || productResult.error || organizationResult.error) {
      const detail = voucherResult.error?.message || productResult.error?.message || organizationResult.error?.message || 'Unable to load vouchers.';
      setError(/seat_count|admin_list_products_v9|admin_upsert_voucher_v9/i.test(detail)
        ? 'Apply Supabase migration 34 to enable V9 voucher controls.'
        : detail);
    } else {
      setVouchers((voucherResult.data || []) as unknown as VoucherRow[]);
      setProducts((productResult.data || []) as AdminProduct[]);
      setOrganizations((organizationResult.data || []) as Organization[]);
    }
    setBusy(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const offline = form.discountPercent === '100';
  const selectedProduct = useMemo(() => products.find((product) => product.id === form.productId), [form.productId, products]);
  const selectedOrganization = useMemo(() => organizations.find((organization) => organization.id === form.organizationId), [form.organizationId, organizations]);
  const filteredVouchers = useMemo(() => vouchers.filter((voucher) => {
    const state = voucherState(voucher).toLowerCase();
    const matchesFilter = filter === 'all'
      || (filter === 'active' && state === 'active')
      || (filter === 'inactive' && state !== 'active')
      || (filter === 'promotion' && voucher.discount_percent !== 100)
      || (filter === 'offline' && voucher.discount_percent === 100);
    const haystack = `${voucher.code} ${voucher.description || ''} ${relationName(voucher.products)} ${relationName(voucher.organizations)} ${voucher.allowed_email || ''}`.toLowerCase();
    return matchesFilter && (!search || haystack.includes(search.toLowerCase()));
  }), [filter, search, vouchers]);

  const stats = {
    total: vouchers.length,
    active: vouchers.filter((voucher) => voucherState(voucher) === 'Active').length,
    redemptions: vouchers.reduce((sum, voucher) => sum + voucher.used_count, 0),
    offline: vouchers.filter((voucher) => voucher.discount_percent === 100).length,
  };

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(emptyForm);
  }

  function openCreate() {
    reset();
    setError('');
    setMessage('');
    setFormOpen(true);
  }

  function edit(row: VoucherRow) {
    setForm({
      id: row.id,
      code: row.code,
      description: row.description || '',
      discountPercent: String(row.discount_percent),
      purpose: row.purpose,
      productId: row.product_id || 'all',
      organizationId: row.organization_id || 'none',
      allowedEmail: row.allowed_email || '',
      seatCount: row.seat_count ? String(row.seat_count) : '',
      usageLimit: row.usage_limit ? String(row.usage_limit) : '',
      perUserLimit: String(row.per_user_limit || 1),
      startsAt: localDateTime(row.starts_at),
      endsAt: localDateTime(row.ends_at),
      offlineReference: row.offline_payment_reference || '',
      offlineAmountRupees: row.offline_amount_paise ? String(row.offline_amount_paise / 100) : '',
      internalNote: row.internal_note || '',
      active: row.active,
    });
    setError('');
    setMessage('');
    setFormOpen(true);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) return setError('Supabase is not configured.');
    if (offline && !superAdmin) return setError('Only Super Admin can create a 100% offline school activation voucher.');
    if (offline && (form.productId === 'all' || form.organizationId === 'none' || !form.seatCount || !form.offlineReference || !form.offlineAmountRupees)) {
      return setError('A 100% voucher requires one product, one school, seat count, offline amount and payment reference.');
    }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) return setError('Voucher end time must be after its start time.');

    setBusy(true);
    const { error: saveError } = await supabase.rpc('admin_upsert_voucher_v9', {
      p_voucher_id: form.id || null,
      p_code: form.code.toUpperCase(),
      p_description: form.description || null,
      p_discount_percent: Number(form.discountPercent),
      p_purpose: offline ? 'offline_payment' : 'promotion',
      p_product_id: form.productId === 'all' ? null : form.productId,
      p_allowed_email: form.allowedEmail || null,
      p_organization_id: form.organizationId === 'none' ? null : form.organizationId,
      p_seat_count: offline ? Number(form.seatCount) : null,
      p_usage_limit: form.usageLimit ? Number(form.usageLimit) : null,
      p_per_user_limit: Number(form.perUserLimit || 1),
      p_starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      p_ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      p_active: form.active,
      p_offline_payment_reference: offline ? form.offlineReference : null,
      p_offline_amount_paise: offline ? Math.round(Number(form.offlineAmountRupees) * 100) : null,
      p_internal_note: form.internalNote || null,
    });
    setBusy(false);
    if (saveError) return setError(saveError.message);
    setMessage(form.id ? 'Voucher updated. Existing redemption history remains unchanged.' : offline ? 'Offline school activation voucher created.' : 'Promotional voucher created.');
    setFormOpen(false);
    reset();
    await load();
  }

  const metricCards = [
    { label: 'Voucher codes', value: stats.total, icon: TicketPercent },
    { label: 'Active now', value: stats.active, icon: CheckCircle2 },
    { label: 'Redemptions', value: stats.redemptions, icon: ShieldCheck },
    { label: 'Offline activations', value: stats.offline, icon: School },
  ];

  return (
    <div className={`${styles.workspace} space-y-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-2xl font-extrabold tracking-tight text-[#14232B]">Vouchers</h2><p className="mt-1 text-sm text-[#6B7980]">Manage promotional discounts and auditable offline school activations.</p></div>
        <Button onClick={openCreate} className="h-11 bg-[#0E5A5A] hover:bg-[#0A4A4A]"><Plus className="mr-2 h-4 w-4" />Create Voucher</Button>
      </div>

      {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#237A57]/20 bg-[#237A57]/5 text-[#237A57]'}`}>{error || message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ label, value, icon: Icon }) => <div key={label} className={styles.metricCard}><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-[#6B7980]">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#14232B]">{value}</p></div><div className="rounded-xl bg-[#DCE9E7] p-3 text-[#0E5A5A]"><Icon className="h-5 w-5" /></div></div></div>)}</div>

      <Card className="gap-0 border-[#E7ECEB] shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-[#E7ECEB] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code, product, school or email" className="pl-9" /></div>
            <div className="flex flex-wrap gap-2">{(['all', 'active', 'inactive', 'promotion', 'offline'] as VoucherFilter[]).map((item) => <Button key={item} type="button" size="sm" variant="outline" onClick={() => setFilter(item)} className={filter === item ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB]'}>{item === 'all' ? 'All' : item === 'offline' ? 'Offline 100%' : item[0].toUpperCase() + item.slice(1)}</Button>)}<Button variant="outline" size="icon" onClick={() => void load()} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></Button></div>
          </div>
          <div className={`${styles.scrollArea} overflow-x-auto`}>
            <table className="min-w-[1050px] w-full border-collapse">
              <thead><tr className="border-b border-[#E7ECEB] bg-[#F7F9F7] text-left text-xs font-semibold text-[#6B7980]"><th className="px-5 py-3">Voucher</th><th>Type</th><th>Product / recipient</th><th>Usage</th><th>Validity</th><th>Evidence</th><th>Status</th><th className="pr-5 text-right">Action</th></tr></thead>
              <tbody>{filteredVouchers.map((voucher) => { const state = voucherState(voucher); const productName = relationName(voucher.products); const organizationName = relationName(voucher.organizations); return <tr key={voucher.id} className={`${styles.tableRow} border-b border-[#E7ECEB] text-sm`}><td className="px-5 py-4"><strong className="text-[#14232B]">{voucher.code}</strong><p className="mt-1 max-w-[220px] truncate text-xs text-[#6B7980]">{voucher.description || 'No description'}</p></td><td><Badge className={voucher.discount_percent === 100 ? 'bg-[#FCF1DB] text-[#9A6508]' : 'bg-[#DCE9E7] text-[#0E5A5A]'}>{voucher.discount_percent === 100 ? 'Offline 100%' : `${voucher.discount_percent}% off`}</Badge></td><td><p className="font-medium text-[#14232B]">{productName || 'All products'}</p><p className="mt-1 text-xs text-[#6B7980]">{organizationName || voucher.allowed_email || 'Any eligible customer'}{voucher.seat_count ? ` · ${voucher.seat_count} seats` : ''}</p></td><td><strong className="text-[#14232B]">{voucher.used_count}/{voucher.usage_limit || '∞'}</strong><p className="mt-1 text-xs text-[#6B7980]">{voucher.per_user_limit} per account</p></td><td className="text-xs text-[#6B7980]"><p>{voucher.starts_at ? new Date(voucher.starts_at).toLocaleDateString('en-IN') : 'Immediately'}</p><p>to {voucher.ends_at ? new Date(voucher.ends_at).toLocaleDateString('en-IN') : 'No expiry'}</p></td><td>{voucher.offline_payment_reference ? <><p className="font-medium text-[#14232B]">{voucher.offline_payment_reference}</p><p className="mt-1 text-xs text-[#6B7980]">{rupees(voucher.offline_amount_paise || 0)}</p></> : <span className="text-[#AEB8BC]">—</span>}</td><td><Badge variant="outline" className={state === 'Active' ? 'border-[#237A57]/20 bg-[#237A57]/10 text-[#237A57]' : state === 'Scheduled' ? 'border-[#2E6D8B]/20 bg-[#2E6D8B]/10 text-[#2E6D8B]' : 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]'}>{state}</Badge></td><td className="pr-5 text-right"><Button variant="ghost" size="sm" onClick={() => edit(voucher)}><Edit3 className="mr-1 h-4 w-4" />Edit</Button></td></tr>; })}{!filteredVouchers.length && <tr><td colSpan={8} className={styles.emptyState}><TicketPercent className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" />No vouchers match the current search and filter.</td></tr>}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!busy) setFormOpen(open); }}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-4xl overflow-y-auto border-[#DCE9E7] p-0">
          <form onSubmit={save}>
            <DialogHeader className="border-b border-[#E7ECEB] px-5 py-4 text-left sm:px-6"><DialogTitle className="text-xl text-[#14232B]">{form.id ? 'Edit voucher' : 'Create voucher'}</DialogTitle><DialogDescription>Promotions are limited to 1–10%. Super Admin may record a controlled 100% offline school activation.</DialogDescription></DialogHeader>
            <div className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Voucher code</Label><Input required minLength={4} maxLength={32} value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="EVIDARA10" /></div>
                <div className="space-y-2"><Label>Discount</Label><Select value={form.discountPercent} onValueChange={(value) => { update('discountPercent', value); update('purpose', value === '100' ? 'offline_payment' : 'promotion'); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 10 }, (_item, index) => String(index + 1)).map((value) => <SelectItem key={value} value={value}>{value}% promotional discount</SelectItem>)}{superAdmin && <SelectItem value="100">100% offline school activation</SelectItem>}</SelectContent></Select></div>
                <div className="space-y-2"><Label>Product</Label><Select value={form.productId} onValueChange={(value) => update('productId', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{!offline && <SelectItem value="all">All products</SelectItem>}{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label>School</Label><Select value={form.organizationId} onValueChange={(value) => update('organizationId', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{!offline && <SelectItem value="none">Any eligible customer</SelectItem>}{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2 md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Campaign or payment context" /></div>
                {!offline && <div className="space-y-2 md:col-span-2"><Label>Optional account email restriction</Label><Input type="email" value={form.allowedEmail} onChange={(event) => update('allowedEmail', event.target.value.toLowerCase())} placeholder="student@example.com" /></div>}
                <div className="space-y-2"><Label>Usage limit</Label><Input type="number" min="1" value={form.usageLimit} onChange={(event) => update('usageLimit', event.target.value)} placeholder="Unlimited" /></div>
                <div className="space-y-2"><Label>Per-account limit</Label><Input type="number" min="1" value={form.perUserLimit} onChange={(event) => update('perUserLimit', event.target.value)} /></div>
                <div className="space-y-2"><Label>Starts at</Label><Input type="datetime-local" value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} /></div>
                <div className="space-y-2"><Label>Ends at</Label><Input type="datetime-local" value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} /></div>
              </div>

              {offline && <div className="space-y-4 rounded-2xl border border-[#F2B84B]/40 bg-[#FCF1DB] p-4"><div className="flex items-start gap-3"><School className="mt-0.5 h-5 w-5 text-[#9A6508]" /><div><strong className="text-sm text-[#14232B]">Offline school activation</strong><p className="mt-1 text-xs leading-relaxed text-[#6B7980]">The school paid outside Razorpay. Redemption creates a paid order and grants exactly the recorded seat count.</p></div></div><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label>Seats to activate</Label><Input required type="number" min="1" value={form.seatCount} onChange={(event) => update('seatCount', event.target.value)} /></div><div className="space-y-2"><Label>Offline amount received ₹</Label><Input required type="number" min="1" value={form.offlineAmountRupees} onChange={(event) => update('offlineAmountRupees', event.target.value)} /></div><div className="space-y-2 md:col-span-2"><Label>Receipt / invoice / transaction reference</Label><Input required value={form.offlineReference} onChange={(event) => update('offlineReference', event.target.value)} placeholder="INV-2026-104 / UTR number" /></div></div><div className="rounded-xl bg-white/70 px-4 py-3 text-xs text-[#44545C]"><strong>{selectedProduct?.name || 'Select one product'}</strong> · {selectedOrganization?.name || 'Select one school'}</div></div>}

              <div className="space-y-2"><Label>Internal note</Label><Textarea rows={4} value={form.internalNote} onChange={(event) => update('internalNote', event.target.value)} placeholder="Approval context, sales owner or payment evidence note" /></div>
              <label className="flex items-center gap-3 rounded-xl border border-[#E7ECEB] px-4 py-3"><Checkbox checked={form.active} onCheckedChange={(checked) => update('active', checked === true)} /><div><p className="text-sm font-medium text-[#14232B]">Voucher active</p><p className="text-xs text-[#6B7980]">Inactive vouchers cannot be reserved or redeemed.</p></div></label>
            </div>
            <DialogFooter className="border-t border-[#E7ECEB] px-5 py-4 sm:px-6"><Button type="button" variant="outline" onClick={() => setFormOpen(false)} disabled={busy}>Cancel</Button><Button disabled={busy} className="bg-[#0E5A5A] hover:bg-[#0A4A4A]">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : offline ? <School className="mr-2 h-4 w-4" /> : <TicketPercent className="mr-2 h-4 w-4" />}{form.id ? 'Save changes' : 'Create voucher'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
