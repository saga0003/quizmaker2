'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, LoaderCircle, ShoppingBag, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { rupees } from '@/types/commerce';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

type Order = { id: string; amount_paise: number; status: string; payment_source: string | null; created_at: string; paid_at: string | null; products: { name: string } | null };
type Entitlement = { id: string; status: string; starts_at: string; expires_at: string | null; attempts_limit: number | null; attempts_used: number; seat_limit: number | null; organization_id: string | null; products: { name: string } | null };

export function PurchaseHistory() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [access, setAccess] = useState<Entitlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const [orderResult, entitlementResult] = await Promise.all([
        supabase.from('orders').select('id,amount_paise,status,payment_source,created_at,paid_at,products(name)').order('created_at', { ascending: false }),
        supabase.from('entitlements').select('id,status,starts_at,expires_at,attempts_limit,attempts_used,seat_limit,organization_id,products(name)').order('created_at', { ascending: false }),
      ]);
      if (orderResult.error || entitlementResult.error) setMessage(orderResult.error?.message || entitlementResult.error?.message || 'Unable to load purchases.');
      setOrders((orderResult.data || []) as unknown as Order[]);
      setAccess((entitlementResult.data || []) as unknown as Entitlement[]);
      setLoading(false);
    }
    void load();
  }, []);

  if (loading) return <div className="py-16 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading purchases and access…</div>;

  return (
    <div className="space-y-5">
      <div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Purchase history</div><h1 className="mt-2 text-2xl font-bold text-[#14232B]">Your product access</h1><p className="mt-1 text-sm text-[#6B7980]">Verified student purchases and school seat entitlements.</p></div>
      {message && <div className="rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{message}</div>}
      <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><h2 className="font-semibold text-[#14232B]">Active and previous entitlements</h2><div className="mt-4 grid gap-4 md:grid-cols-2">{access.map((item) => <article key={item.id} className="rounded-2xl border border-[#E7ECEB] p-4"><div className="flex items-start justify-between gap-3"><strong className="text-[#14232B]">{item.products?.name || 'Evidara product'}</strong><Badge variant="outline" className={item.status === 'active' ? 'border-[#0E5A5A]/20 bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] text-[#6B7980]'}>{item.status}</Badge></div><div className="mt-3 flex items-center gap-2 text-xs text-[#6B7980]"><Clock3 className="h-4 w-4" />{item.expires_at ? `Valid until ${new Date(item.expires_at).toLocaleDateString('en-IN')}` : 'No expiry configured'}</div>{item.seat_limit && <div className="mt-2 flex items-center gap-2 text-xs text-[#6B7980]"><Users className="h-4 w-4" />School entitlement · {item.seat_limit} seats</div>}{item.attempts_limit && <p className="mt-2 text-xs text-[#6B7980]">Package attempts used: {item.attempts_used}/{item.attempts_limit}</p>}</article>)}{!access.length && <div className="col-span-full py-10 text-center text-sm text-[#6B7980]">No product entitlement is active yet.</div>}</div></CardContent></Card>
      <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><h2 className="font-semibold text-[#14232B]">Orders</h2><div className="mt-4 overflow-x-auto"><table className="min-w-[680px] w-full border-collapse"><thead><tr className="border-b border-[#E7ECEB] bg-[#F7F9F7] text-left text-xs font-semibold text-[#6B7980]"><th className="p-3">Product</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-[#E7ECEB] text-sm"><td className="p-3 font-medium text-[#14232B]">{order.products?.name || 'Evidara product'}</td><td>{rupees(order.amount_paise)}</td><td className="capitalize text-[#44545C]">{(order.payment_source || 'razorpay').replaceAll('_', ' ')}</td><td><span className="flex items-center gap-2">{order.status === 'paid' ? <CheckCircle2 className="h-4 w-4 text-[#237A57]" /> : <ShoppingBag className="h-4 w-4 text-[#6B7980]" />}{order.status}</span></td><td>{new Date(order.created_at).toLocaleDateString('en-IN')}</td></tr>)}{!orders.length && <tr><td colSpan={5} className="py-10 text-center text-sm text-[#6B7980]">No order history yet.</td></tr>}</tbody></table></div></CardContent></Card>
    </div>
  );
}
