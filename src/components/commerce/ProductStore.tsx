'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  LoaderCircle,
  Package,
  Search,
  ShieldCheck,
  TicketPercent,
  Users,
  X,
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { discountPercent, rupees, type ProductPaper, type StoreProduct } from '@/types/commerce';
import { useAuth } from '@/context/AuthProvider';
import { normalizeEvidaraRole } from '@/lib/roles';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import styles from '@/components/commerce/commerce-prototype.module.css';

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

function normalizePaper(paper: ProductPaper & { name?: string }): ProductPaper {
  return {
    ...paper,
    display_name: paper.display_name || paper.name || paper.title || 'Question paper',
    display_order: Number(paper.display_order || 0),
  };
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
    papers: Array.isArray(product.papers) ? product.papers.map((paper) => normalizePaper(paper as ProductPaper & { name?: string })) : [],
  };
}

function productTypeLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function ProductStore() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [buying, setBuying] = useState<string | null>(null);
  const [voucherCode, setVoucherCode] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'student' | 'school'>('all');
  const [accepted, setAccepted] = useState(false);
  const [selected, setSelected] = useState<StoreProduct | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'papers' | 'pricing'>('overview');
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [purchaseScope, setPurchaseScope] = useState<'student' | 'school'>('student');
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const { user, profile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    async function fetchProducts() {
      if (!supabase) {
        setLoading(false);
        setMessage('Connect Supabase to load the Evidara product catalogue.');
        return;
      }
      const { data, error } = await supabase.rpc('get_store_products');
      if (!error) setProducts((data || []).map((product: StoreProduct) => normalizeProduct(product)));
      if (error) setMessage(/get_store_products/i.test(error.message) ? 'Apply Supabase migration 34 to enable the live product store.' : error.message);
      setLoading(false);
    }
    void fetchProducts();
  }, []);

  const schoolEligible = canBuyForSchool(profile?.role);
  const visible = useMemo(() => products.filter((product) => {
    const audienceMatch = filter === 'all' || product.audience === filter || product.audience === 'both';
    const textMatch = !search || `${product.name} ${product.exam_type || ''} ${product.short_description || ''} ${product.product_type}`.toLowerCase().includes(search.toLowerCase());
    return audienceMatch && textMatch;
  }), [filter, products, search]);
  const featured = useMemo(() => visible.filter((product) => product.is_featured), [visible]);
  const regular = useMemo(() => visible.filter((product) => !product.is_featured), [visible]);

  function openProduct(product: StoreProduct) {
    setSelected(product);
    setDetailTab('overview');
    setGalleryIndex(0);
    setMessage('');
    setPurchaseScope(product.audience === 'school' ? 'school' : 'student');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openCheckout(product: StoreProduct) {
    setSelected(product);
    setAccepted(false);
    setVoucherCode('');
    setMessage('');
    setPurchaseScope(product.audience === 'school' ? 'school' : 'student');
    setCheckoutOpen(true);
  }

  async function buy(product: StoreProduct, scope: 'student' | 'school') {
    setMessage('');
    if (!accepted) return setMessage('Please accept the Terms, Privacy Policy and Refund Policy before continuing.');
    if (scope === 'school' && !schoolEligible) return setMessage('Sign in as a School Admin to purchase and activate school seats.');
    if (product.audience === 'student' && scope === 'school') return setMessage('This product is available only for individual students.');
    if (product.audience === 'school' && scope === 'student') return setMessage('This product is available only for school purchase.');

    const client = supabase;
    if (!client) return setMessage('Supabase and Razorpay must be connected before a live purchase can begin.');
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
        setCheckoutOpen(false);
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
          setCheckoutOpen(false);
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

  function ProductCard({ product }: { product: StoreProduct }) {
    const off = discountPercent(product.mrp_paise, product.selling_price_paise);
    return (
      <button type="button" onClick={() => openProduct(product)} className={`${styles.cardHover} ${product.is_featured ? styles.featuredGlow : ''} overflow-hidden rounded-2xl border ${product.is_featured ? 'border-[#F2B84B]/40' : 'border-[#E7ECEB]'} bg-white text-left`}>
        <div className="relative h-44 overflow-hidden bg-[#DCE9E7]">
          {product.cover_image_url ? <img src={product.cover_image_url} alt={product.image_alt_text || product.name} className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-10 w-10 text-[#AEB8BC]" /></div>}
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5"><Badge className="bg-[#14232B]/85 text-white">{productTypeLabel(product.product_type)}</Badge>{product.is_featured && <Badge className="bg-[#FCF1DB] text-[#9A6508]">Featured</Badge>}</div>
          {off > 0 && <Badge className="absolute right-3 top-3 bg-[#B54747] text-white">{off}% off</Badge>}
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2 text-xs"><span className="font-semibold text-[#0E5A5A]">{product.exam_type || 'Multiple exams'}</span><span className="text-[#AEB8BC]">·</span><span className="text-[#6B7980]">{product.grade_levels.length ? product.grade_levels.join(', ') : 'Multiple grades'}</span></div>
          <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug text-[#14232B]">{product.name}</h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-[#6B7980]">{product.short_description || product.description}</p>
          <div className="mt-4 flex items-baseline gap-2"><strong className="text-xl text-[#14232B]">{rupees(product.selling_price_paise)}</strong>{off > 0 && <s className="text-xs text-[#AEB8BC]">{rupees(product.mrp_paise)}</s>}</div>
          <div className="mt-3 flex items-center justify-between border-t border-[#E7ECEB] pt-3 text-xs text-[#6B7980]"><span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{product.paper_count} paper{product.paper_count === 1 ? '' : 's'}</span><span className="font-semibold text-[#0E5A5A]">View details</span></div>
        </div>
      </button>
    );
  }

  if (selected) {
    const media = [selected.cover_image_url, ...selected.gallery_image_urls].filter(Boolean) as string[];
    const currentImage = media[galleryIndex] || null;
    const off = discountPercent(selected.mrp_paise, selected.selling_price_paise);
    return (
      <div className={`${styles.workspace} space-y-6`}>
        <Button type="button" variant="ghost" onClick={() => setSelected(null)} className="px-0 text-[#6B7980] hover:bg-transparent hover:text-[#0E5A5A]"><ArrowLeft className="mr-2 h-4 w-4" />Back to store</Button>
        {message && <div role="status" className="rounded-xl border border-[#F2B84B]/40 bg-[#FCF1DB] px-4 py-3 text-sm font-medium text-[#14232B]">{message}</div>}
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.2fr)_minmax(330px,0.8fr)]">
          <div className="space-y-4">
            <div className="relative aspect-[3/4] max-h-[620px] overflow-hidden rounded-2xl border border-[#E7ECEB] bg-[#F7F9F7]">
              {currentImage ? <img src={currentImage} alt={selected.image_alt_text || selected.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-12 w-12 text-[#AEB8BC]" /></div>}
              {media.length > 1 && <><Button type="button" variant="secondary" size="icon" onClick={() => setGalleryIndex((current) => (current - 1 + media.length) % media.length)} className="absolute left-3 top-1/2 -translate-y-1/2"><ChevronLeft className="h-4 w-4" /></Button><Button type="button" variant="secondary" size="icon" onClick={() => setGalleryIndex((current) => (current + 1) % media.length)} className="absolute right-3 top-1/2 -translate-y-1/2"><ChevronRight className="h-4 w-4" /></Button></>}
            </div>
            {media.length > 1 && <div className={`${styles.scrollArea} flex gap-2 overflow-x-auto pb-1`}>{media.map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => setGalleryIndex(index)} className={`h-16 w-24 shrink-0 overflow-hidden rounded-xl border-2 ${galleryIndex === index ? 'border-[#0E5A5A]' : 'border-[#E7ECEB]'}`}><img src={image} alt="" className="h-full w-full object-cover" /></button>)}</div>}
          </div>

          <div>
            <div className="flex flex-wrap gap-2"><Badge variant="outline" className="border-[#DCE9E7] text-[#0E5A5A]">{productTypeLabel(selected.product_type)}</Badge><Badge variant="outline" className="border-[#DCE9E7] text-[#0E5A5A]">{selected.audience === 'both' ? 'Students and schools' : selected.audience === 'school' ? 'Schools' : 'Students'}</Badge>{selected.is_featured && <Badge className="bg-[#FCF1DB] text-[#9A6508]">Featured</Badge>}</div>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#14232B]">{selected.name}</h1>
            <p className="mt-2 text-sm text-[#6B7980]">{selected.exam_type || 'Multiple exams'} · {selected.grade_levels.join(', ') || 'Multiple grades'} · {selected.paper_count} papers</p>
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#44545C]">{selected.short_description || selected.description}</p>
            <div className="mt-6 flex flex-wrap items-baseline gap-3"><strong className="text-3xl text-[#14232B]">{rupees(selected.selling_price_paise)}</strong>{off > 0 && <><s className="text-sm text-[#6B7980]">{rupees(selected.mrp_paise)}</s><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{off}% off</Badge></>}</div>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#6B7980]"><span className="flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{selected.access_days ? `${selected.access_days} days access` : 'No fixed expiry'}</span>{selected.max_attempts && <span className="flex items-center gap-1.5"><Package className="h-4 w-4" />{selected.max_attempts} attempts per paper</span>}{selected.student_limit && <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{selected.student_limit} school seats</span>}</div>
            <Button onClick={() => openCheckout(selected)} className="mt-7 h-12 w-full bg-[#0E5A5A] hover:bg-[#0A4A4A]"><CreditCard className="mr-2 h-4 w-4" />Pay securely or apply voucher</Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-[#6B7980]"><ShieldCheck className="h-4 w-4 text-[#0E5A5A]" />Access activates only after server-side verification.</p>
          </div>
        </div>

        <div className="border-b border-[#E7ECEB]"><div className={`${styles.scrollArea} flex overflow-x-auto`}>{(['overview', 'papers', 'pricing'] as const).map((tab) => <button key={tab} type="button" onClick={() => setDetailTab(tab)} className={`${styles.focusRing} shrink-0 border-b-2 px-5 py-3 text-sm font-semibold ${detailTab === tab ? 'border-[#0E5A5A] text-[#0E5A5A]' : 'border-transparent text-[#6B7980]'}`}>{tab === 'overview' ? 'Overview' : tab === 'papers' ? `Included Papers (${selected.paper_count})` : 'Pricing & Access'}</button>)}</div></div>

        <div className={styles.fadeIn}>
          {detailTab === 'overview' && <div className="grid gap-5 lg:grid-cols-2"><Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><h2 className="font-semibold text-[#14232B]">About this product</h2><p className="mt-4 whitespace-pre-line text-sm leading-7 text-[#44545C]">{selected.description || selected.short_description || 'No additional description is available.'}</p></CardContent></Card><Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><h2 className="font-semibold text-[#14232B]">What you receive</h2><div className="mt-4 space-y-3">{selected.features.map((feature) => <div key={feature} className="flex items-start gap-3 text-sm text-[#44545C]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#237A57]" />{feature}</div>)}{!selected.features.length && <p className="text-sm text-[#6B7980]">No benefits have been listed.</p>}</div></CardContent></Card></div>}

          {detailTab === 'papers' && <Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-0"><div className="border-b border-[#E7ECEB] p-5"><h2 className="font-semibold text-[#14232B]">Included question papers</h2><p className="mt-1 text-xs text-[#6B7980]">These paper names are specific to this product and do not modify the master papers.</p></div><div className="divide-y divide-[#E7ECEB]">{selected.papers.map((paper, index) => <div key={paper.paper_id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F7F9F7] text-xs font-bold text-[#6B7980]">{index + 1}</span><div><p className="text-sm font-medium text-[#14232B]">{paper.display_name || paper.title}</p><p className="mt-1 text-xs text-[#6B7980]">{paper.test_type?.replaceAll('_', ' ') || 'Assessment'} · {paper.grade_level || selected.grade_levels.join(', ') || 'Multiple grades'}</p></div></div><div className="flex flex-wrap gap-4 pl-11 text-xs text-[#6B7980] sm:pl-0"><span>{paper.total_questions || 0} questions</span><span>{paper.total_marks || 0} marks</span><span>{paper.duration_minutes || 0} minutes</span></div></div>)}{!selected.papers.length && <div className={styles.emptyState}><FileText className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" />No papers are currently included.</div>}</div></CardContent></Card>}

          {detailTab === 'pricing' && <div className="grid gap-5 lg:grid-cols-2"><Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><h2 className="font-semibold text-[#14232B]">Price</h2><div className="mt-5 flex items-baseline gap-3"><strong className="text-4xl text-[#14232B]">{rupees(selected.selling_price_paise)}</strong>{off > 0 && <s className="text-sm text-[#6B7980]">{rupees(selected.mrp_paise)}</s>}</div>{off > 0 && <p className="mt-2 text-sm font-medium text-[#237A57]">You save {rupees(selected.mrp_paise - selected.selling_price_paise)} ({off}%).</p>}</CardContent></Card><Card className="gap-0 border-[#E7ECEB] shadow-none"><CardContent className="p-5 sm:p-6"><h2 className="font-semibold text-[#14232B]">Access terms</h2><div className="mt-4 space-y-3 text-sm text-[#44545C]"><div className="flex justify-between gap-4"><span>Access duration</span><strong>{selected.access_days ? `${selected.access_days} days` : 'No fixed expiry'}</strong></div><div className="flex justify-between gap-4"><span>Maximum attempts</span><strong>{selected.max_attempts || 'Paper limit'}</strong></div>{selected.student_limit && <div className="flex justify-between gap-4"><span>School seats</span><strong>{selected.student_limit}</strong></div>}<div className="flex justify-between gap-4"><span>Included papers</span><strong>{selected.paper_count}</strong></div></div></CardContent></Card></div>}
        </div>

        <Dialog open={checkoutOpen} onOpenChange={(open) => { if (!buying) setCheckoutOpen(open); }}>
          <DialogContent className="max-h-[94vh] w-[96vw] max-w-md overflow-y-auto border-[#DCE9E7] p-0">
            <DialogHeader className="border-b border-[#E7ECEB] px-5 py-4 text-left"><DialogTitle className="text-lg text-[#14232B]">Confirm purchase</DialogTitle><DialogDescription>Review the purchase scope, voucher and policy acceptance.</DialogDescription></DialogHeader>
            <div className="space-y-5 p-5">
              <div className="flex gap-3"><div className="h-16 w-20 overflow-hidden rounded-xl border border-[#E7ECEB] bg-[#F7F9F7]">{selected.cover_image_url ? <img src={selected.cover_image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-5 w-5 text-[#AEB8BC]" /></div>}</div><div><h3 className="text-sm font-semibold text-[#14232B]">{selected.name}</h3><p className="mt-1 text-xs text-[#6B7980]">{selected.paper_count} papers · {selected.access_days ? `${selected.access_days} days` : 'No fixed expiry'}</p></div></div>
              {selected.audience === 'both' && schoolEligible && <div className="space-y-2"><label className="text-sm font-medium text-[#14232B]">Purchase for</label><Select value={purchaseScope} onValueChange={(value) => setPurchaseScope(value as 'student' | 'school')}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">My student account</SelectItem><SelectItem value="school">My school workspace</SelectItem></SelectContent></Select></div>}
              <div className="space-y-2"><label className="text-sm font-medium text-[#14232B]">Voucher code</label><div className="relative"><TicketPercent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#0E5A5A]" /><Input value={voucherCode} onChange={(event) => setVoucherCode(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))} placeholder="Optional voucher" className="pl-9" /></div><p className="text-xs text-[#6B7980]">Eligibility and final discount are validated by the server when the order is created.</p></div>
              <div className="rounded-xl border border-[#E7ECEB] bg-[#F7F9F7] p-4"><div className="flex items-center justify-between text-sm"><span className="text-[#6B7980]">Product price</span><strong className="text-[#14232B]">{rupees(selected.selling_price_paise)}</strong></div><div className="mt-2 flex items-center justify-between text-xs"><span className="text-[#6B7980]">Purchase scope</span><strong className="capitalize text-[#14232B]">{selected.audience === 'school' ? 'school' : selected.audience === 'student' ? 'student' : purchaseScope}</strong></div></div>
              <label className="flex items-start gap-3 text-sm text-[#44545C]"><Checkbox checked={accepted} onCheckedChange={(checked) => setAccepted(checked === true)} /><span>I agree to the <Link href="/terms/" className="font-semibold underline">Terms</Link>, <Link href="/privacy/" className="font-semibold underline">Privacy Policy</Link> and <Link href="/refund-policy/" className="font-semibold underline">Refund Policy</Link>.</span></label>
              {message && <div role="status" className="flex items-start gap-2 rounded-xl border border-[#F2B84B]/40 bg-[#FCF1DB] px-4 py-3 text-sm text-[#14232B]"><X className="mt-0.5 h-4 w-4 shrink-0 text-[#9A6508]" />{message}</div>}
            </div>
            <DialogFooter className="border-t border-[#E7ECEB] px-5 py-4"><Button type="button" variant="outline" onClick={() => setCheckoutOpen(false)} disabled={Boolean(buying)}>Cancel</Button><Button onClick={() => void buy(selected, selected.audience === 'school' ? 'school' : selected.audience === 'student' ? 'student' : purchaseScope)} disabled={buying === selected.id || !accepted} className="bg-[#0E5A5A] hover:bg-[#0A4A4A]">{buying === selected.id ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}Pay securely</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={`${styles.workspace} space-y-6`}>
      <div className="rounded-2xl border border-[#DCE9E7] bg-white p-5 sm:p-7"><h1 className="text-3xl font-extrabold tracking-tight text-[#14232B]">See beyond marks.</h1><p className="mt-2 max-w-2xl text-base text-[#6B7980]">Browse evidence-based test series and assessment products for individual students and schools.</p><div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="relative w-full max-w-md"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, exam or topic" className="h-11 pl-10" /></div><div className="flex w-fit rounded-xl border border-[#E7ECEB] bg-white p-1">{(['all', 'student', 'school'] as const).map((item) => <button key={item} type="button" onClick={() => setFilter(item)} className={`${styles.focusRing} rounded-lg px-4 py-2 text-sm font-medium ${filter === item ? 'bg-[#DCE9E7] text-[#0E5A5A]' : 'text-[#6B7980]'}`}>{item === 'all' ? 'All Products' : item === 'student' ? 'For Students' : 'For Schools'}</button>)}</div></div></div>

      {message && <div role="status" className="rounded-xl border border-[#F2B84B]/40 bg-[#FCF1DB] px-4 py-3 text-sm font-medium text-[#14232B]">{message}</div>}
      {loading ? <div className="py-20 text-center text-sm text-[#6B7980]"><LoaderCircle className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading live products…</div> : visible.length === 0 ? <div className={styles.emptyState}><Search className="mx-auto mb-4 h-12 w-12 text-[#AEB8BC]" /><h3 className="text-base font-semibold text-[#44545C]">No products found</h3><p className="mt-1 text-sm">Adjust the search or audience filter.</p></div> : <>
        {featured.length > 0 && <section><div className="mb-4"><Badge className="bg-[#FCF1DB] text-[#9A6508]">Featured</Badge></div><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{featured.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>}
        {regular.length > 0 && <section className={featured.length ? 'border-t border-[#E7ECEB] pt-7' : ''}><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{regular.map((product) => <ProductCard key={product.id} product={product} />)}</div></section>}
      </>}

      <div className="flex items-center justify-center gap-2 text-center text-xs text-[#6B7980]"><ShieldCheck className="h-4 w-4 text-[#0E5A5A]" />Access is granted only after server-side Razorpay verification or a controlled offline school voucher.</div>
    </div>
  );
}
