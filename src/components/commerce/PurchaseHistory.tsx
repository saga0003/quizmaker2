'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Package,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { rupees } from '@/types/commerce';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import styles from '@/components/commerce/commerce-prototype.module.css';

type ProductRelation = { name: string; cover_image_url: string | null } | { name: string; cover_image_url: string | null }[] | null;
type Order = {
  id: string;
  amount_paise: number;
  discount_paise: number | null;
  status: string;
  payment_source: string | null;
  created_at: string;
  paid_at: string | null;
  products: ProductRelation;
};
type Entitlement = {
  id: string;
  status: string;
  source: string;
  starts_at: string;
  expires_at: string | null;
  attempts_limit: number | null;
  attempts_used: number;
  seat_limit: number | null;
  organization_id: string | null;
  products: ProductRelation;
};

function productRelation(value: ProductRelation) {
  if (Array.isArray(value)) return value[0] || null;
  return value;
}

function daysRemaining(value: string | null) {
  if (!value) return null;
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000));
}

export function PurchaseHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [access, setAccess] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const [orderResult, entitlementResult] = await Promise.all([
        supabase.from('orders').select('id,amount_paise,discount_paise,status,payment_source,created_at,paid_at,products(name,cover_image_url)').order('created_at', { ascending: false }),
        supabase.rpc('list_my_entitlements_v12'),
      ]);
      if (orderResult.error || entitlementResult.error) {
        const detail = orderResult.error?.message || entitlementResult.error?.message || 'Unable to load purchases.';
        setMessage(/list_my_entitlements_v12|could not find the function|schema cache/i.test(detail)
          ? 'Apply Supabase migration 44, refresh the PostgREST schema cache and retry.'
          : detail);
      }
      setOrders((orderResult.data || []) as unknown as Order[]);
      setAccess((entitlementResult.data || []) as unknown as Entitlement[]);
      setLoading(false);
    }
    void load();
  }, []);

  const activeCount = useMemo(() => access.filter((item) => item.status === 'active' && (!item.expires_at || new Date(item.expires_at) > new Date())).length, [access]);
  const paidCount = useMemo(() => orders.filter((item) => item.status === 'paid').length, [orders]);

  if (loading) return <div className="py-16 text-center text-sm text-[var(--muted-foreground)]"><LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading purchases and access…</div>;

  return (
    <div className={`${styles.workspace} space-y-6`}>
      <div><h1 className="text-2xl font-extrabold tracking-tight text-[var(--foreground)]">My Products</h1><p className="mt-1 text-sm text-[var(--muted-foreground)]">Verified orders, active access and per-paper attempt usage.</p></div>
      {message && <div className="rounded-xl border border-[var(--destructive)]/20 bg-[var(--destructive)]/5 px-4 py-3 text-sm text-[var(--destructive)]">{message}</div>}

      <div className="grid gap-3 sm:gap-4 lg:gap-5 sm:grid-cols-3">
        <div className={styles.metricCard}><div className="flex items-center justify-between"><div><p className="text-xs text-[var(--muted-foreground)]">Active entitlements</p><p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{activeCount}</p></div><Package className="h-5 w-5 text-[var(--teal)]" /></div></div>
        <div className={styles.metricCard}><div className="flex items-center justify-between"><div><p className="text-xs text-[var(--muted-foreground)]">Paid orders</p><p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{paidCount}</p></div><CreditCard className="h-5 w-5 text-[var(--teal)]" /></div></div>
        <div className={styles.metricCard}><div className="flex items-center justify-between"><div><p className="text-xs text-[var(--muted-foreground)]">School seats</p><p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{access.reduce((sum, item) => sum + (item.seat_limit || 0), 0)}</p></div><Users className="h-5 w-5 text-[var(--teal)]" /></div></div>
      </div>

      <Tabs defaultValue="entitlements">
        <TabsList className="h-auto bg-[var(--line)]/60 p-1"><TabsTrigger value="entitlements"><Package className="mr-2 h-4 w-4" />Entitlements</TabsTrigger><TabsTrigger value="orders"><ShoppingBag className="mr-2 h-4 w-4" />Purchases</TabsTrigger></TabsList>
        <TabsContent value="entitlements" className="mt-5">
          <div className="space-y-4">{access.map((item) => { const product = productRelation(item.products); const days = daysRemaining(item.expires_at); const active = item.status === 'active' && (days === null || days > 0); const progress = item.attempts_limit ? Math.min(100, (item.attempts_used / item.attempts_limit) * 100) : 0; return <Card key={item.id} className={`gap-0 overflow-hidden border-[var(--line)] shadow-sm rounded-xl ${active ? '' : 'opacity-75'}`}><CardContent className="p-4 sm:p-5 lg:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-4"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--canvas)]">{product?.cover_image_url ? <img src={product.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-6 w-6 text-[#AEB8BC]" /></div>}</div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-[var(--foreground)]">{product?.name || 'Evidara product'}</h3><Badge variant="outline" className={active ? 'border-[#237A57]/20 bg-[#237A57]/10 text-[#237A57]' : 'border-[var(--line)] text-[var(--muted-foreground)]'}>{active ? 'Active' : item.status}</Badge></div><p className="mt-1 text-xs capitalize text-[var(--muted-foreground)]">Source: {item.source.replaceAll('_', ' ')} · {item.organization_id ? 'School entitlement' : 'Individual entitlement'}</p></div></div><div className={`flex items-center gap-1.5 text-xs font-medium ${days !== null && days <= 30 && days > 0 ? 'text-[#9A6508]' : days === 0 ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'}`}><Clock3 className="h-4 w-4" />{days === null ? 'No expiry' : days > 0 ? `${days} days remaining` : 'Expired'}</div></div>{item.attempts_limit ? <div className="mt-5"><div className="mb-2 flex justify-between text-xs"><span className="text-[var(--muted-foreground)]">Highest paper usage</span><strong className="text-[var(--foreground)]">{item.attempts_used} / {item.attempts_limit}</strong></div><Progress value={progress} className="h-2" /></div> : null}<div className="mt-4 grid gap-3 sm:gap-4 lg:gap-5 border-t border-[var(--line)] pt-4 text-xs text-[var(--muted-foreground)] sm:grid-cols-3"><div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#AEB8BC]">Access started</span><strong className="mt-1 block font-medium text-[#44545C]">{new Date(item.starts_at).toLocaleDateString('en-IN')}</strong></div><div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#AEB8BC]">Access expires</span><strong className="mt-1 block font-medium text-[#44545C]">{item.expires_at ? new Date(item.expires_at).toLocaleDateString('en-IN') : 'No expiry'}</strong></div><div className="min-w-0"><span className="block text-[10px] font-semibold uppercase tracking-wide text-[#AEB8BC]">Seat allocation</span><strong className="mt-1 block font-medium text-[#44545C]">{item.seat_limit ? `${item.seat_limit} school seats` : 'Individual access'}</strong></div></div></CardContent></Card>; })}{!access.length && <div className={styles.emptyState}><Package className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" /><h3 className="font-semibold text-[#44545C]">No product access</h3><p className="mt-1 text-sm">Purchase a product from the store to unlock its papers.</p></div>}</div>
        </TabsContent>

        <TabsContent value="orders" className="mt-5">
          <Card className="gap-0 border-[var(--line)] shadow-sm rounded-xl"><CardContent className="p-0"><div className={`${styles.scrollArea} overflow-x-auto`}><table className="min-w-[760px] w-full border-collapse"><thead><tr className="border-b border-[var(--line)] bg-[var(--canvas)] text-left text-xs font-semibold text-[var(--muted-foreground)]"><th className="px-5 py-3">Product</th><th>Amount</th><th>Method</th><th>Status</th><th>Ordered</th><th>Paid</th></tr></thead><tbody>{orders.map((order) => { const product = productRelation(order.products); return <tr key={order.id} className={`${styles.tableRow} border-b border-[var(--line)] text-sm`}><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-12 w-16 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--canvas)]">{product?.cover_image_url ? <img src={product.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><FileText className="h-5 w-5 text-[#AEB8BC]" /></div>}</div><strong className="text-[var(--foreground)]">{product?.name || 'Evidara product'}</strong></div></td><td><div><strong className="text-[var(--foreground)]">{rupees(order.amount_paise)}</strong>{order.discount_paise ? <p className="mt-1 text-xs text-[#237A57]">{rupees(order.discount_paise)} discount</p> : null}</div></td><td className="capitalize text-[#44545C]">{(order.payment_source || 'razorpay').replaceAll('_', ' ')}</td><td><span className="flex items-center gap-2">{order.status === 'paid' ? <CheckCircle2 className="h-4 w-4 text-[#237A57]" /> : <ShoppingBag className="h-4 w-4 text-[#9A6508]" />}<Badge variant="outline" className={order.status === 'paid' ? 'border-[#237A57]/20 text-[#237A57]' : 'border-[var(--amber)]/30 text-[#9A6508]'}>{order.status}</Badge></span></td><td className="text-xs text-[var(--muted-foreground)]">{new Date(order.created_at).toLocaleDateString('en-IN')}</td><td className="text-xs text-[var(--muted-foreground)]">{order.paid_at ? new Date(order.paid_at).toLocaleDateString('en-IN') : '—'}</td></tr>; })}{!orders.length && <tr><td colSpan={6} className={styles.emptyState}><ShoppingBag className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" />No order history yet.</td></tr>}</tbody></table></div></CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
