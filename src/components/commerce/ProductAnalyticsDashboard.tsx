'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Building2, CalendarRange, CreditCard, GraduationCap, LoaderCircle, RefreshCw, TicketPercent, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CommerceAnalytics } from '@/types/commerce';
import { rupees } from '@/types/commerce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 29);

export function ProductAnalyticsDashboard() {
  const [from, setFrom] = useState(dateInput(thirtyDaysAgo));
  const [to, setTo] = useState(dateInput(today));
  const [granularity, setGranularity] = useState<'day' | 'month' | 'year'>('day');
  const [data, setData] = useState<CommerceAnalytics | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const { data: result, error: loadError } = await supabase.rpc('get_product_commerce_analytics_v9', {
      p_from: from,
      p_to: to,
      p_granularity: granularity,
    });
    setBusy(false);
    if (loadError) {
      setError(/get_product_commerce_analytics_v9/i.test(loadError.message) ? 'Apply Supabase migration 34 to enable product analytics.' : loadError.message);
      return;
    }
    setData(result as CommerceAnalytics);
  }, [from, granularity, to]);

  useEffect(() => { void load(); }, [load]);

  const series = useMemo(() => (data?.series || []).map((item) => ({
    ...item,
    label: new Date(item.period).toLocaleDateString('en-IN', granularity === 'year' ? { year: 'numeric' } : granularity === 'month' ? { month: 'short', year: '2-digit' } : { day: '2-digit', month: 'short' }),
    revenue: item.revenue_paise / 100,
  })), [data?.series, granularity]);

  const summary = data?.summary;
  const cards = [
    { label: 'Verified revenue', value: rupees(summary?.revenue_paise || 0), detail: `${summary?.orders || 0} paid orders`, icon: CreditCard },
    { label: 'Student purchases', value: summary?.student_purchases || 0, detail: 'Distinct student buyers', icon: GraduationCap },
    { label: 'School purchases', value: summary?.school_purchases || 0, detail: `${summary?.school_seats_sold || 0} seats sold`, icon: Building2 },
    { label: 'Voucher redemptions', value: data?.voucher_redemptions || 0, detail: `${data?.offline_school_activations || 0} offline activations`, icon: TicketPercent },
  ];

  return (
    <div className="space-y-5">
      <Card className="gap-0 border-[#DCE9E7] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]"><CalendarRange className="h-4 w-4" />Commerce analytics</div><h2 className="mt-1 text-xl font-bold text-[#14232B]">Student and school product performance</h2><p className="mt-1 text-sm text-[#6B7980]">Analyse daily, monthly, annual or custom-date sales, seats and revenue.</p></div>
            <div className="grid gap-3 sm:grid-cols-[150px_150px_160px_auto] sm:items-end">
              <div className="space-y-2"><Label>From</Label><Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>To</Label><Input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Chart period</Label><Select value={granularity} onValueChange={(value) => setGranularity(value as 'day' | 'month' | 'year')}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="day">Daily</SelectItem><SelectItem value="month">Monthly</SelectItem><SelectItem value="year">Annual</SelectItem></SelectContent></Select></div>
              <Button onClick={() => void load()} disabled={busy} className="bg-[#0E5A5A] hover:bg-[#0A4747]">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Apply</Button>
            </div>
          </div>
          {error && <div className="mt-4 rounded-xl border border-[#B54747]/20 bg-[#B54747]/5 px-4 py-3 text-sm text-[#B54747]">{error}</div>}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, detail, icon: Icon }) => <Card key={label} className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="flex items-center justify-between p-4"><div><p className="text-xs font-medium text-[#6B7980]">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums text-[#14232B]">{value}</p><p className="mt-1 text-xs text-[#6B7980]">{detail}</p></div><div className="rounded-xl bg-[#DCE9E7] p-3 text-[#0E5A5A]"><Icon className="h-5 w-5" /></div></CardContent></Card>)}</div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-[#14232B]">Revenue trend</h3><p className="mt-1 text-xs text-[#6B7980]">Verified online payments and recorded offline school orders.</p></div><Badge variant="outline" className="border-[#DCE9E7] text-[#0E5A5A]">Average {rupees(summary?.average_order_paise || 0)}</Badge></div><div className="mt-5 h-[320px]"><ResponsiveContainer width="100%" height="100%"><AreaChart data={series} margin={{ top: 10, right: 10, left: 5, bottom: 0 }}><defs><linearGradient id="productRevenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0E5A5A" stopOpacity={0.25} /><stop offset="95%" stopColor="#0E5A5A" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7980' }} /><YAxis tick={{ fontSize: 11, fill: '#6B7980' }} tickFormatter={(value) => `₹${Number(value).toLocaleString('en-IN')}`} /><Tooltip formatter={(value) => [`₹${Number(value).toLocaleString('en-IN')}`, 'Revenue']} /><Area type="monotone" dataKey="revenue" stroke="#0E5A5A" strokeWidth={2} fill="url(#productRevenue)" /></AreaChart></ResponsiveContainer></div></CardContent></Card>

        <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><div><h3 className="font-semibold text-[#14232B]">Schools, students and seats</h3><p className="mt-1 text-xs text-[#6B7980]">Buyer mix and school capacity activated during the selected period.</p></div><div className="mt-5 h-[320px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#E7ECEB" /><XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B7980' }} /><YAxis tick={{ fontSize: 11, fill: '#6B7980' }} /><Tooltip /><Legend /><Bar dataKey="students" name="Students" fill="#2E6D8B" radius={[4, 4, 0, 0]} /><Bar dataKey="schools" name="Schools" fill="#0E5A5A" radius={[4, 4, 0, 0]} /><Bar dataKey="seats" name="Seats" fill="#F2B84B" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></CardContent></Card>
      </div>

      <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><h3 className="font-semibold text-[#14232B]">Top products</h3><p className="mt-1 text-xs text-[#6B7980]">Ranked by verified revenue in the selected date range.</p></div><div className="flex items-center gap-2 text-xs text-[#6B7980]"><Users className="h-4 w-4" />{summary?.active_products || 0} published products</div></div><div className="mt-4 overflow-x-auto"><table className="min-w-[760px] w-full border-collapse"><thead><tr className="border-b border-[#E7ECEB] bg-[#F7F9F7] text-left text-xs font-semibold text-[#6B7980]"><th className="p-3">Product</th><th>Revenue</th><th>Orders</th><th>Students</th><th>Schools</th><th>Seats</th></tr></thead><tbody>{(data?.top_products || []).map((product) => <tr key={product.product_id} className="border-b border-[#E7ECEB] text-sm"><td className="p-3 font-medium text-[#14232B]">{product.product_name}</td><td>{rupees(product.revenue_paise)}</td><td>{product.orders}</td><td>{product.students}</td><td>{product.schools}</td><td>{product.seats}</td></tr>)}{!data?.top_products?.length && <tr><td colSpan={6} className="py-12 text-center text-sm text-[#6B7980]">No paid product orders in this period.</td></tr>}</tbody></table></div></CardContent></Card>
    </div>
  );
}
