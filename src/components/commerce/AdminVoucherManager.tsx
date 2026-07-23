'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit3, LoaderCircle, RefreshCw, School, TicketPercent } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import type { AdminProduct } from '@/types/commerce';
import { rupees } from '@/types/commerce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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
  products?: { name: string } | null;
  organizations?: { name: string } | null;
};

type Organization = { id: string; name: string };

type FormState = typeof emptyForm;

const localDateTime = (value: string | null) => value ? new Date(value).toISOString().slice(0, 16) : '';

export function AdminVoucherManager() {
  const { profile } = useAuth();
  const superAdmin = normalizeEvidaraRole(profile?.role) === 'super_admin';
  const [form, setForm] = useState<FormState>(emptyForm);
  const [vouchers, setVouchers] = useState<VoucherRow[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
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
      setError(voucherResult.error?.message || productResult.error?.message || organizationResult.error?.message || 'Unable to load vouchers.');
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

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(emptyForm);
    setError('');
    setMessage('');
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    setMessage(form.id ? 'Voucher updated.' : offline ? 'Offline school activation voucher created.' : 'Promotional voucher created.');
    reset();
    await load();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save}>
        <Card className="gap-0 border-[#DCE9E7] shadow-none">
          <CardContent className="space-y-5 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]"><TicketPercent className="h-4 w-4" />Voucher control</div><h2 className="mt-1 text-xl font-bold text-[#14232B]">{form.id ? 'Edit voucher' : 'Create voucher code'}</h2><p className="mt-1 text-sm text-[#6B7980]">Admins can create 1–10% promotions. Super Admin controls auditable 100% offline school activations.</p></div>{form.id && <Button type="button" variant="outline" onClick={reset}>Create another</Button>}</div>
            {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#0E5A5A]/20 bg-[#DCE9E7]/50 text-[#0E5A5A]'}`}>{error || message}</div>}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2"><Label>Voucher code</Label><Input required value={form.code} onChange={(event) => update('code', event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="EVIDARA10" className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Discount</Label><Select value={form.discountPercent} onValueChange={(value) => { update('discountPercent', value); update('purpose', value === '100' ? 'offline_payment' : 'promotion'); }}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{Array.from({ length: 10 }, (_item, index) => String(index + 1)).map((value) => <SelectItem key={value} value={value}>{value}% promotional discount</SelectItem>)}{superAdmin && <SelectItem value="100">100% offline school activation</SelectItem>}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Product</Label><Select value={form.productId} onValueChange={(value) => update('productId', value)}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{!offline && <SelectItem value="all">All products</SelectItem>}{products.map((product) => <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>School</Label><Select value={form.organizationId} onValueChange={(value) => update('organizationId', value)}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{!offline && <SelectItem value="none">Any eligible customer</SelectItem>}{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2 md:col-span-2"><Label>Description</Label><Input value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Internal and checkout explanation" className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Usage limit</Label><Input type="number" min="1" value={form.usageLimit} onChange={(event) => update('usageLimit', event.target.value)} placeholder="Unlimited" className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Per-account limit</Label><Input type="number" min="1" value={form.perUserLimit} onChange={(event) => update('perUserLimit', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Starts at</Label><Input type="datetime-local" value={form.startsAt} onChange={(event) => update('startsAt', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Ends at</Label><Input type="datetime-local" value={form.endsAt} onChange={(event) => update('endsAt', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
              {!offline && <div className="space-y-2 md:col-span-2"><Label>Optional account email restriction</Label><Input type="email" value={form.allowedEmail} onChange={(event) => update('allowedEmail', event.target.value)} placeholder="student@example.com" className="h-11 border-[#E7ECEB]" /></div>}
              {offline && <>
                <div className="space-y-2"><Label>Seats to activate</Label><Input required type="number" min="1" value={form.seatCount} onChange={(event) => update('seatCount', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
                <div className="space-y-2"><Label>Offline amount received ₹</Label><Input required type="number" min="1" value={form.offlineAmountRupees} onChange={(event) => update('offlineAmountRupees', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
                <div className="space-y-2 md:col-span-2"><Label>Receipt / invoice / transaction reference</Label><Input required value={form.offlineReference} onChange={(event) => update('offlineReference', event.target.value)} placeholder="INV-2026-104 / UTR number" className="h-11 border-[#E7ECEB]" /></div>
                <div className="md:col-span-4 rounded-xl border border-[#F2B84B]/40 bg-[#FCF1DB] px-4 py-3 text-sm text-[#14232B]"><div className="flex items-start gap-2"><School className="mt-0.5 h-4 w-4 text-[#8A5F00]" /><div><strong>{selectedProduct?.name || 'Selected product'}</strong><p className="mt-1 text-xs text-[#6B7980]">The school pays offline, then applies this one-time 100% voucher. Evidara records a paid order and grants exactly the seat count entered above.</p></div></div></div>
              </>}
              <div className="space-y-2 md:col-span-2 xl:col-span-4"><Label>Internal note</Label><Textarea rows={3} value={form.internalNote} onChange={(event) => update('internalNote', event.target.value)} placeholder="Approval context, sales owner or payment evidence note" className="border-[#E7ECEB]" /></div>
              <label className="flex items-center gap-3 rounded-xl border border-[#E7ECEB] px-4 py-3"><Checkbox checked={form.active} onCheckedChange={(checked) => update('active', checked === true)} /><div><p className="text-sm font-medium text-[#14232B]">Voucher active</p><p className="text-xs text-[#6B7980]">Inactive vouchers cannot be reserved or applied.</p></div></label>
            </div>
            <Button disabled={busy} className="h-11 w-full bg-[#0E5A5A] hover:bg-[#0A4747]">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <TicketPercent className="mr-2 h-4 w-4" />}{form.id ? 'Save voucher changes' : 'Create voucher'}</Button>
          </CardContent>
        </Card>
      </form>

      <Card className="gap-0 border-[#E7ECEB] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Voucher register</div><h2 className="mt-1 text-xl font-bold text-[#14232B]">Promotions and offline activations</h2></div><Button variant="outline" size="icon" onClick={() => void load()} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></Button></div>
          <div className="mt-5 overflow-x-auto"><table className="min-w-[980px] w-full border-collapse"><thead><tr className="border-b border-[#E7ECEB] bg-[#F7F9F7] text-left text-xs font-semibold text-[#6B7980]"><th className="p-3">Code</th><th>Type</th><th>Product / school</th><th>Usage</th><th>Evidence</th><th>Status</th><th className="pr-3 text-right">Action</th></tr></thead><tbody>{vouchers.map((voucher) => <tr key={voucher.id} className="border-b border-[#E7ECEB] text-sm"><td className="p-3"><strong className="text-[#14232B]">{voucher.code}</strong><p className="mt-1 max-w-[220px] truncate text-xs text-[#6B7980]">{voucher.description || 'No description'}</p></td><td><Badge className={voucher.discount_percent === 100 ? 'bg-[#FCF1DB] text-[#8A5F00]' : 'bg-[#DCE9E7] text-[#0E5A5A]'}>{voucher.discount_percent === 100 ? 'Offline 100%' : `${voucher.discount_percent}% off`}</Badge></td><td><p className="font-medium text-[#14232B]">{voucher.products?.name || 'All products'}</p><p className="text-xs text-[#6B7980]">{voucher.organizations?.name || voucher.allowed_email || 'Any eligible customer'}{voucher.seat_count ? ` · ${voucher.seat_count} seats` : ''}</p></td><td>{voucher.used_count}/{voucher.usage_limit || '∞'}<p className="text-xs text-[#6B7980]">{voucher.per_user_limit} per account</p></td><td>{voucher.offline_payment_reference ? <><p className="font-medium text-[#14232B]">{voucher.offline_payment_reference}</p><p className="text-xs text-[#6B7980]">{rupees(voucher.offline_amount_paise || 0)}</p></> : <span className="text-[#AEB8BC]">—</span>}</td><td><Badge variant="outline" className={voucher.active ? 'border-[#0E5A5A]/20 text-[#0E5A5A]' : 'border-[#B54747]/20 text-[#B54747]'}>{voucher.active ? 'Active' : 'Inactive'}</Badge></td><td className="pr-3 text-right"><Button variant="ghost" size="icon" onClick={() => edit(voucher)}><Edit3 className="h-4 w-4" /></Button></td></tr>)}{!vouchers.length && <tr><td colSpan={7} className="py-12 text-center text-sm text-[#6B7980]">No voucher codes have been created.</td></tr>}</tbody></table></div>
        </CardContent>
      </Card>
    </div>
  );
}
