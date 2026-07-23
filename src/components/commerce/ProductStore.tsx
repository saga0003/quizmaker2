'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  LoaderCircle,
  ShieldCheck,
  TicketPercent,
} from 'lucide-react';
import { demoProducts } from '@/data/demoProducts';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { discountPercent, rupees, type ProductAudience, type StoreProduct } from '@/types/commerce';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function loadRazorpay() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function canBuyForSchool(role?: string | null) {
  const normalized = normalizeEvidaraRole(role);
  return normalized === 'school_admin' || normalized === 'super_admin' || normalized === 'evidara_admin';
}

function normalizeProduct(product: Partial<StoreProduct> & { id: string; name: string }): StoreProduct {
  return {
    id: product.id,
    name: product.name,
    slug: product.slug || product.id,
    short_description: product.short_description || null,
    description: product.description || null,
    product_type: product.product_type || 'test_series',
    audience: product.audience || 'student',
    exam_type: product.exam_type || null,
    grade_levels: Array.isArray(product.grade_levels) ? product.grade_levels : [],
    cover_image_url: product.cover_image_url || null,
    gallery_image_urls: Array.isArray(product.gallery_image_urls) ? product.gallery_image_urls : [],
    image_alt_text: product.image_alt_text || null,
    is_featured: Boolean(product.is_featured),
    version_id: product.version_id || product.id,
    mrp_paise: Number(product.mrp_paise || 0),
    selling_price_paise: Number(product.selling_price_paise || 0),
    access_days: product.access_days || null,
    max_attempts: product.max_attempts || null,
    student_limit: product.student_limit || null,
    features: Array.isArray(product.features) ? product.features : [],
    starts_at: product.starts_at || null,
    ends_at: product.ends_at || null,
    paper_count: Number(product.paper_count || 0),
    papers: Array.isArray(product.papers) ? product.papers : [],
  };
}

export function ProductStore() {
  const [products, setProducts] = useState<StoreProduct[]>(() => demoProducts.map((product) => normalizeProduct(product as unknown as Partial<StoreProduct> & { id: string; name: string })));
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [buying, setBuying] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<'all' | 'student' | 'school'>('all');
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [purchaseScope, setPurchaseScope] = useState<'student' | 'school'>('student');
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchProducts() {
      if (!supabase) return;
      const { data, error } = await supabase.rpc('get_store_products');
      if (!error) setProducts((data || []).map((product: StoreProduct) => normalizeProduct(product)));
      if (error) setMessage(`Store connection: ${error.message}`);
      setLoading(false);
    }
    void fetchProducts();
  }, []);

  const visible = useMemo(() => products.filter((product) => filter === 'all' || product.audience === filter || product.audience === 'both'), [filter, products]);
  const schoolEligible = canBuyForSchool(profile?.role);

  function openProduct(product: StoreProduct) {
    setSelected(product);
    setGalleryIndex(0);
    setPurchaseScope(product.audience === 'school' ? 'school' : 'student');
  }

  async function buy(product: StoreProduct, scope: 'student' | 'school') {
    setMessage('');
    if (!accepted) return setMessage('Please accept the Terms, Privacy Policy and Refund Policy before continuing.');
    if (scope === 'school' && !schoolEligible) return setMessage('Sign in as a School Admin to purchase and activate school seats.');
    if (product.audience === 'student' && scope === 'school') return setMessage('This product is available only for individual students.');
    if (product.audience === 'school' && scope === 'student') return setMessage('This product is available only for school purchase.');

    const client = supabase;
    if (!client) return setMessage('Demo checkout completed. Connect Supabase and Razorpay for a real purchase.');
    if (!user) {
      localStorage.setItem('evidara_after_login', '/products/');
      router.push('/login/');
      return;
    }

    const destination = scope === 'school' ? '/school/subscription/' : '/student/purchases/';
    setBuying(product.id);
    try {
      const { data: order, error: orderError } = await client.functions.invoke('create-razorpay-order', {
        body: { product_id: product.id, voucher_code: voucherCode.trim() || null, purchase_scope: scope },
      });
      if (orderError) throw orderError;
      if (order?.error) throw new Error(order.error);
      if (order?.free_access) {
        setMessage(order.message || 'Voucher applied and access granted.');
        router.push(`${destination}?voucher=success`);
        router.refresh();
        return;
      }
      const ready = await loadRazorpay();
      if (!ready) throw new Error('Razorpay Checkout could not load. Check your browser blockers or connection.');
      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: 'Evidara',
        description: order.product_name,
        order_id: order.razorpay_order_id,
        prefill: { name: order.customer?.name, email: order.customer?.email },
        theme: { color: '#0E5A5A' },
        handler: async (response) => {
          const { data: verified, error: verifyError } = await client.functions.invoke('verify-razorpay-payment', {
            body: { internal_order_id: order.internal_order_id, ...response },
          });
          if (verifyError || !verified?.success) {
            setMessage(verifyError?.message || verified?.error || 'Payment verification failed.');
            return;
          }
          router.push(`${destination}?payment=success`);
          router.refresh();
        },
        modal: { ondismiss: () => setMessage('Payment window closed. No access was granted.') },
      });
      checkout.on('payment.failed', () => setMessage('Payment failed. You can try again without creating duplicate access.'));
      checkout.open();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Unable to start checkout.');
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="gap-0 border-[#DCE9E7] shadow-none"><CardContent className="space-y-4 p-4 sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-2">{(['all', 'student', 'school'] as const).map((item) => <Button key={item} onClick={() => setFilter(item)} variant="outline" className={filter === item ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] bg-white text-[#44545C]'}>{item === 'all' ? 'All products' : item === 'student' ? <><GraduationCap className="mr-2 h-4 w-4" />Student products</> : <><Building2 className="mr-2 h-4 w-4" />School products</>}</Button>)}</div><label className="flex items-center gap-2 lg:min-w-[330px]"><TicketPercent className="h-5 w-5 text-[#0E5A5A]" /><Input placeholder="Voucher code" value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} className="border-[#E7ECEB]" /></label></div><label className="flex items-start gap-3 text-sm text-[#44545C]"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>I agree to the <Link href="/terms/" className="font-semibold underline">Terms</Link>, <Link href="/privacy/" className="font-semibold underline">Privacy Policy</Link> and <Link href="/refund-policy/" className="font-semibold underline">Refund Policy</Link>.</span></label></CardContent></Card>

      {message && <div role="status" className="rounded-xl border border-[#F2B84B]/40 bg-[#FCF1DB] px-4 py-3 text-sm font-medium text-[#14232B]">{message}</div>}

      {loading ? <div className="py-16 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading live products…</div> : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{visible.map((product) => {
        const off = discountPercent(product.mrp_paise, product.selling_price_paise);
        return <Card key={product.id} className="group gap-0 overflow-hidden border-[#E7ECEB] shadow-none transition hover:border-[#0E5A5A]/40"><button type="button" onClick={() => openProduct(product)} className="relative block aspect-[3/4] w-full overflow-hidden bg-[#F7F9F7] text-left">{product.cover_image_url ? <img src={product.cover_image_url} alt={product.image_alt_text || product.name} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-10 w-10 text-[#AEB8BC]" /></div>}{product.is_featured && <Badge className="absolute right-3 top-3 bg-[#FCF1DB] text-[#8A5F00]">Featured</Badge>}<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#14232B]/90 to-transparent px-4 pb-4 pt-16 text-white"><p className="text-xs font-semibold uppercase tracking-wide text-white/70">{product.exam_type || 'Evidara'} · {product.paper_count} papers</p><h2 className="mt-1 text-xl font-bold">{product.name}</h2></div></button><CardContent className="flex min-h-[330px] flex-col p-5"><p className="line-clamp-3 text-sm leading-relaxed text-[#44545C]">{product.short_description || product.description}</p><div className="mt-4 flex flex-wrap gap-2">{product.grade_levels.slice(0, 4).map((grade) => <Badge key={grade} variant="outline" className="border-[#DCE9E7] text-[#0E5A5A]">{grade}</Badge>)}{product.grade_levels.length > 4 && <Badge variant="outline">+{product.grade_levels.length - 4}</Badge>}</div><div className="mt-5 flex items-baseline gap-2"><strong className="text-3xl text-[#14232B]">{rupees(product.selling_price_paise)}</strong>{off > 0 && <><s className="text-sm text-[#6B7980]">{rupees(product.mrp_paise)}</s><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{off}% off</Badge></>}</div><div className="mt-4 space-y-2 text-sm text-[#44545C]">{product.features.slice(0, 3).map((feature) => <div key={feature} className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#237A57]" />{feature}</div>)}</div><div className="mt-auto pt-5"><Button onClick={() => openProduct(product)} className="w-full bg-[#0E5A5A] hover:bg-[#0A4747]"><FileText className="mr-2 h-4 w-4" />View {product.paper_count} included papers</Button></div></CardContent></Card>;
      })}{!visible.length && <div className="col-span-full py-16 text-center text-sm text-[#6B7980]">No products match this audience.</div>}</div>}

      <div className="flex items-center justify-center gap-2 text-center text-xs text-[#6B7980]"><ShieldCheck className="h-4 w-4 text-[#0E5A5A]" />Access is granted only after server-side Razorpay verification or a controlled offline school voucher.</div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-5xl overflow-y-auto border-[#DCE9E7] p-0">
          {selected && <><DialogHeader className="border-b border-[#E7ECEB] px-5 py-4 sm:px-7"><DialogTitle className="pr-8 text-xl text-[#14232B]">{selected.name}</DialogTitle><DialogDescription>{selected.paper_count} papers · {selected.exam_type || 'Multi-exam'} · {selected.grade_levels.join(', ') || 'Multiple grades'}</DialogDescription></DialogHeader><div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[320px_minmax(0,1fr)]"><div><div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-[#DCE9E7] bg-[#F7F9F7]">{[selected.cover_image_url, ...selected.gallery_image_urls].filter(Boolean)[galleryIndex] ? <img src={[selected.cover_image_url, ...selected.gallery_image_urls].filter(Boolean)[galleryIndex] as string} alt={selected.image_alt_text || selected.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-10 w-10 text-[#AEB8BC]" /></div>}{[selected.cover_image_url, ...selected.gallery_image_urls].filter(Boolean).length > 1 && <><Button type="button" variant="secondary" size="icon" onClick={() => setGalleryIndex((current) => (current - 1 + [selected.cover_image_url, ...selected.gallery_image_urls].filter(Boolean).length) % [selected.cover_image_url, ...selected.gallery_image_urls].filter(Boolean).length)} className="absolute left-2 top-1/2 -translate-y-1/2"><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="secondary" size="icon" onClick={() => setGalleryIndex((current) => (current + 1) % [selected.cover_image_url, ...selected.gallery_image_urls].filter(Boolean).length)} className="absolute right-2 top-1/2 -translate-y-1/2"><ChevronRight className="h-4 w-4" /></Button></>}</div><div className="mt-4 flex items-baseline gap-2"><strong className="text-3xl text-[#14232B]">{rupees(selected.selling_price_paise)}</strong>{selected.mrp_paise > selected.selling_price_paise && <s className="text-sm text-[#6B7980]">{rupees(selected.mrp_paise)}</s>}</div><p className="mt-3 text-sm leading-relaxed text-[#44545C]">{selected.description || selected.short_description}</p></div><div className="space-y-5"><div><h3 className="font-semibold text-[#14232B]">What you receive</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{selected.features.map((feature) => <div key={feature} className="flex items-start gap-2 rounded-xl border border-[#E7ECEB] px-3 py-2 text-sm text-[#44545C]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#237A57]" />{feature}</div>)}</div></div><div><div className="flex items-center justify-between"><h3 className="font-semibold text-[#14232B]">Included question papers</h3><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{selected.paper_count} total</Badge></div><div className="mt-3 max-h-[310px] space-y-2 overflow-y-auto">{selected.papers.map((paper, index) => <div key={paper.paper_id} className="rounded-xl border border-[#E7ECEB] p-3"><div className="flex items-start gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">{index + 1}</span><div><p className="text-sm font-medium text-[#14232B]">{paper.display_name || paper.title}</p><p className="mt-1 text-xs text-[#6B7980]">{paper.total_questions || 0} questions · {paper.total_marks || 0} marks · {paper.duration_minutes || 0} minutes</p></div></div></div>)}</div></div>{selected.audience === 'both' && schoolEligible && <div className="space-y-2"><label className="text-sm font-medium text-[#14232B]">Purchase for</label><Select value={purchaseScope} onValueChange={(value) => setPurchaseScope(value as 'student' | 'school')}><SelectTrigger className="border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">My student account</SelectItem><SelectItem value="school">My school workspace</SelectItem></SelectContent></Select></div>}<Button onClick={() => void buy(selected, selected.audience === 'school' ? 'school' : selected.audience === 'student' ? 'student' : purchaseScope)} disabled={buying === selected.id} className="h-12 w-full bg-[#0E5A5A] hover:bg-[#0A4747]">{buying === selected.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Pay securely or apply voucher</Button></div></div></>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
