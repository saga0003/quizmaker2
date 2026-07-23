'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Edit3,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  PackagePlus,
  Plus,
  RefreshCw,
  Search,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAssessmentOptions } from '@/components/evidara/use-assessment-options';
import type { AdminProduct, BuilderPaper, ProductAudience, ProductPaper, ProductStatus } from '@/types/commerce';
import { discountPercent, rupees } from '@/types/commerce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const PRODUCT_TYPES = [
  ['test_series', 'Test series'],
  ['single_exam', 'Single exam'],
  ['subject_package', 'Subject package'],
  ['chapter_package', 'Chapter package'],
  ['entrance_exam', 'Entrance exam package'],
  ['student_subscription', 'Student subscription'],
  ['school_subscription', 'School subscription'],
  ['question_bank_addon', 'Question bank add-on'],
  ['bundle', 'Bundle'],
] as const;

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const httpsUrl = (value: string) => !value.trim() || /^https:\/\//i.test(value.trim());

const emptyForm = {
  id: '',
  name: '',
  slug: '',
  shortDescription: '',
  description: '',
  productType: 'test_series',
  audience: 'student' as ProductAudience,
  examType: 'NEET',
  gradeLevels: [] as string[],
  coverImageUrl: '',
  imageAltText: '',
  galleryImageUrls: [''] as string[],
  mrpRupees: '1999',
  sellingRupees: '999',
  accessDays: '365',
  maxAttempts: '',
  studentLimit: '',
  features: 'Detailed performance analytics\nChapter and topic insights\nAccess to every paper in this series',
  status: 'draft' as ProductStatus,
  isFeatured: false,
  papers: [] as ProductPaper[],
};

type FormState = typeof emptyForm;

function PortraitPreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-[#DCE9E7] bg-[#F7F9F7]">
      {src && httpsUrl(src) ? (
        <img src={src} alt={alt || 'Product cover preview'} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center px-5 text-center text-[#6B7980]">
          <ImageIcon className="h-9 w-9 text-[#AEB8BC]" />
          <p className="mt-3 text-sm font-medium">3:4 portrait cover</p>
          <p className="mt-1 text-xs">Paste an HTTPS image link. Evidara stores only the URL.</p>
        </div>
      )}
    </div>
  );
}

export function AdminProductManager() {
  const { grades, exams } = useAssessmentOptions(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [availablePapers, setAvailablePapers] = useState<BuilderPaper[]>([]);
  const [search, setSearch] = useState('');
  const [paperSearch, setPaperSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    setBusy(true);
    setError('');
    const [productResult, paperResult] = await Promise.all([
      supabase.rpc('admin_list_products_v9'),
      supabase.rpc('list_product_builder_papers_v9'),
    ]);
    if (productResult.error || paperResult.error) {
      const detail = productResult.error?.message || paperResult.error?.message || 'Unable to load products.';
      setError(/admin_list_products_v9|list_product_builder_papers_v9/i.test(detail)
        ? 'Apply Supabase migration 34 to enable the V9 product catalogue.'
        : detail);
    } else {
      setProducts((productResult.data || []) as AdminProduct[]);
      setAvailablePapers((paperResult.data || []) as BuilderPaper[]);
    }
    setBusy(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mrpPaise = Math.round(Number(form.mrpRupees || 0) * 100);
  const sellingPaise = Math.round(Number(form.sellingRupees || 0) * 100);
  const filteredProducts = useMemo(() => products.filter((product) => !search || `${product.name} ${product.slug} ${product.exam_type || ''}`.toLowerCase().includes(search.toLowerCase())), [products, search]);
  const selectedPaperIds = useMemo(() => new Set(form.papers.map((paper) => paper.paper_id)), [form.papers]);
  const filteredPapers = useMemo(() => availablePapers.filter((paper) => !paperSearch || `${paper.title} ${paper.code || ''} ${paper.exam_type || ''} ${paper.grade_level || ''}`.toLowerCase().includes(paperSearch.toLowerCase())), [availablePapers, paperSearch]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function reset() {
    setForm(emptyForm);
    setPaperSearch('');
    setError('');
    setMessage('');
  }

  function edit(product: AdminProduct) {
    const version = product.current_version;
    setForm({
      id: product.id,
      name: product.name,
      slug: product.slug,
      shortDescription: product.short_description || '',
      description: product.description || '',
      productType: product.product_type,
      audience: product.audience,
      examType: product.exam_type || '',
      gradeLevels: product.grade_levels || [],
      coverImageUrl: product.cover_image_url || '',
      imageAltText: product.image_alt_text || '',
      galleryImageUrls: product.gallery_image_urls?.length ? product.gallery_image_urls : [''],
      mrpRupees: String((version?.mrp_paise || 0) / 100),
      sellingRupees: String((version?.selling_price_paise || 0) / 100),
      accessDays: version?.access_days ? String(version.access_days) : '',
      maxAttempts: version?.max_attempts ? String(version.max_attempts) : '',
      studentLimit: version?.student_limit ? String(version.student_limit) : '',
      features: (version?.features || []).join('\n'),
      status: product.status,
      isFeatured: product.is_featured,
      papers: (product.papers || []).map((paper, index) => ({ ...paper, display_order: index })),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleGrade(value: string) {
    update('gradeLevels', form.gradeLevels.includes(value) ? form.gradeLevels.filter((grade) => grade !== value) : [...form.gradeLevels, value]);
  }

  function addPaper(paper: BuilderPaper) {
    if (selectedPaperIds.has(paper.id)) return;
    update('papers', [...form.papers, {
      paper_id: paper.id,
      display_name: paper.title,
      display_order: form.papers.length,
      title: paper.title,
      code: paper.code,
      exam_type: paper.exam_type,
      grade_level: paper.grade_level,
      test_type: paper.test_type,
      duration_minutes: paper.duration_minutes,
      total_questions: paper.total_questions,
      total_marks: paper.total_marks,
      status: paper.status,
    }]);
  }

  function removePaper(paperId: string) {
    update('papers', form.papers.filter((paper) => paper.paper_id !== paperId).map((paper, index) => ({ ...paper, display_order: index })));
  }

  function movePaper(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= form.papers.length) return;
    const next = [...form.papers];
    [next[index], next[target]] = [next[target], next[index]];
    update('papers', next.map((paper, display_order) => ({ ...paper, display_order })));
  }

  function updatePaperName(paperId: string, displayName: string) {
    update('papers', form.papers.map((paper) => paper.paper_id === paperId ? { ...paper, display_name: displayName } : paper));
  }

  function setGallery(index: number, value: string) {
    update('galleryImageUrls', form.galleryImageUrls.map((item, itemIndex) => itemIndex === index ? value : item));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!supabase) return setError('Supabase is not configured.');
    const gallery = form.galleryImageUrls.map((item) => item.trim()).filter(Boolean);
    if (!httpsUrl(form.coverImageUrl) || gallery.some((item) => !httpsUrl(item))) return setError('Every product image must be an HTTPS link.');
    if (!form.papers.length && form.status === 'published') return setError('Add at least one paper before publishing the product.');
    if (sellingPaise > mrpPaise) return setError('Selling price cannot exceed the list price.');
    setBusy(true);
    const { error: saveError } = await supabase.rpc('admin_upsert_product_v9', {
      p_product_id: form.id || null,
      p_name: form.name,
      p_slug: form.slug || slugify(form.name),
      p_short_description: form.shortDescription || null,
      p_description: form.description || null,
      p_product_type: form.productType,
      p_audience: form.audience,
      p_exam_type: form.examType || null,
      p_grade_levels: form.gradeLevels,
      p_cover_image_url: form.coverImageUrl || null,
      p_gallery_image_urls: gallery,
      p_image_alt_text: form.imageAltText || null,
      p_mrp_paise: mrpPaise,
      p_selling_price_paise: sellingPaise,
      p_access_days: form.accessDays ? Number(form.accessDays) : null,
      p_max_attempts: form.maxAttempts ? Number(form.maxAttempts) : null,
      p_student_limit: form.studentLimit ? Number(form.studentLimit) : null,
      p_features: form.features.split('\n').map((item) => item.trim()).filter(Boolean),
      p_status: form.status,
      p_is_featured: form.isFeatured,
      p_papers: form.papers.map((paper, display_order) => ({ paper_id: paper.paper_id, display_name: paper.display_name, display_order })),
    });
    setBusy(false);
    if (saveError) return setError(saveError.message);
    setMessage(form.id ? 'Product updated. A new immutable price version was created.' : 'Product created successfully.');
    reset();
    await load();
  }

  return (
    <div className="space-y-5">
      <form onSubmit={save}>
        <Card className="gap-0 overflow-hidden border-[#DCE9E7] shadow-none">
          <div className="border-b border-[#DCE9E7] bg-[#F7F9F7] px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Product builder</div>
                <h2 className="mt-1 text-xl font-bold text-[#14232B]">{form.id ? 'Edit paper-series product' : 'Create a paper-series product'}</h2>
                <p className="mt-1 text-sm text-[#6B7980]">Images stay on your CDN or website. Evidara stores only HTTPS links.</p>
              </div>
              {form.id && <Button type="button" variant="outline" onClick={reset} className="border-[#DCE9E7] bg-white"><Plus className="mr-2 h-4 w-4" />Create another</Button>}
            </div>
          </div>
          <CardContent className="space-y-6 p-5 sm:p-6">
            {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#0E5A5A]/20 bg-[#DCE9E7]/50 text-[#0E5A5A]'}`}>{error || message}</div>}

            <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="space-y-3">
                <PortraitPreview src={form.coverImageUrl} alt={form.imageAltText} />
                <div className="space-y-2"><Label>Primary cover image URL</Label><Input value={form.coverImageUrl} onChange={(event) => update('coverImageUrl', event.target.value)} placeholder="https://cdn.example.com/neet-series.jpg" className="border-[#E7ECEB]" /></div>
                <div className="space-y-2"><Label>Image alt text</Label><Input value={form.imageAltText} onChange={(event) => update('imageAltText', event.target.value)} placeholder="NEET full syllabus test series cover" className="border-[#E7ECEB]" /></div>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2"><Label>Product name</Label><Input required value={form.name} onChange={(event) => { update('name', event.target.value); if (!form.id) update('slug', slugify(event.target.value)); }} placeholder="NEET Complete Mock Test Series" className="h-11 border-[#E7ECEB]" /></div>
                  <div className="space-y-2"><Label>URL slug</Label><Input required value={form.slug} onChange={(event) => update('slug', slugify(event.target.value))} className="h-11 border-[#E7ECEB]" /></div>
                  <div className="space-y-2"><Label>Audience</Label><Select value={form.audience} onValueChange={(value) => update('audience', value as ProductAudience)}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Students</SelectItem><SelectItem value="school">Schools</SelectItem><SelectItem value="both">Students and schools</SelectItem></SelectContent></Select></div>
                  <div className="space-y-2"><Label>Product type</Label><Select value={form.productType} onValueChange={(value) => update('productType', value)}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent>{PRODUCT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2"><Label>Exam</Label><Select value={form.examType} onValueChange={(value) => update('examType', value)}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue placeholder="Select exam" /></SelectTrigger><SelectContent>{exams.map((item) => <SelectItem key={item.id} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-2 md:col-span-2"><Label>Short description</Label><Input value={form.shortDescription} onChange={(event) => update('shortDescription', event.target.value)} placeholder="A concise value statement shown on the product card." className="h-11 border-[#E7ECEB]" /></div>
                  <div className="space-y-2 md:col-span-2"><Label>Product description</Label><Textarea rows={5} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Explain who this series is for, what it covers and what students or schools receive." className="border-[#E7ECEB]" /></div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between"><Label>Grades</Label><span className="text-xs text-[#6B7980]">{form.gradeLevels.length} selected</span></div>
                  <div className="flex flex-wrap gap-2">{grades.map((item) => <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => toggleGrade(item.value)} className={form.gradeLevels.includes(item.value) ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB] bg-white text-[#44545C]'}>{item.label}</Button>)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E7ECEB] bg-[#FBFCFC] p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-[#14232B]">Optional gallery image links</h3><p className="mt-1 text-xs text-[#6B7980]">Show up to eight additional previews of analytics, paper coverage or included benefits.</p></div><Button type="button" variant="outline" size="sm" disabled={form.galleryImageUrls.length >= 8} onClick={() => update('galleryImageUrls', [...form.galleryImageUrls, ''])} className="border-[#DCE9E7] bg-white"><Plus className="mr-1 h-4 w-4" />Add image</Button></div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">{form.galleryImageUrls.map((url, index) => <div key={index} className="flex items-center gap-2"><Input value={url} onChange={(event) => setGallery(index, event.target.value)} placeholder={`Gallery image ${index + 1} HTTPS URL`} className="border-[#E7ECEB] bg-white" /><Button type="button" variant="ghost" size="icon" onClick={() => update('galleryImageUrls', form.galleryImageUrls.filter((_item, itemIndex) => itemIndex !== index))} disabled={form.galleryImageUrls.length === 1 && !url}><X className="h-4 w-4" /></Button></div>)}</div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
              <div className="rounded-2xl border border-[#E7ECEB] p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-[#14232B]">Select question papers</h3><p className="mt-1 text-xs text-[#6B7980]">The product count is compiled automatically from this list.</p></div><Badge variant="outline" className="w-fit border-[#0E5A5A]/20 bg-[#DCE9E7] text-[#0E5A5A]">{form.papers.length} paper{form.papers.length === 1 ? '' : 's'} included</Badge></div>
                <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" /><Input value={paperSearch} onChange={(event) => setPaperSearch(event.target.value)} placeholder="Search published or approved papers" className="border-[#E7ECEB] pl-9" /></div>
                <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1">{filteredPapers.map((paper) => <div key={paper.id} className="flex items-start gap-3 rounded-xl border border-[#E7ECEB] bg-white p-3"><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium text-[#14232B]">{paper.title}</p><p className="mt-1 text-xs text-[#6B7980]">{paper.code || 'No code'} · {paper.exam_type || 'No exam'} · {paper.grade_level || 'No grade'} · {paper.total_questions} questions</p></div><Button type="button" size="sm" variant={selectedPaperIds.has(paper.id) ? 'secondary' : 'outline'} disabled={selectedPaperIds.has(paper.id)} onClick={() => addPaper(paper)} className={selectedPaperIds.has(paper.id) ? 'bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#0E5A5A]/30 text-[#0E5A5A]'}>{selectedPaperIds.has(paper.id) ? <Check className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}{selectedPaperIds.has(paper.id) ? 'Added' : 'Add'}</Button></div>)}{!filteredPapers.length && <div className="py-10 text-center text-sm text-[#6B7980]">No matching master papers are available.</div>}</div>
              </div>

              <div className="rounded-2xl border border-[#DCE9E7] bg-[#F7F9F7] p-4 sm:p-5">
                <h3 className="font-semibold text-[#14232B]">Included papers and storefront names</h3>
                <p className="mt-1 text-xs text-[#6B7980]">Rename papers only for this product. The source paper title remains unchanged.</p>
                <div className="mt-4 max-h-[470px] space-y-3 overflow-y-auto pr-1">{form.papers.map((paper, index) => <div key={paper.paper_id} className="rounded-xl border border-[#DCE9E7] bg-white p-3"><div className="flex items-start gap-2"><div className="flex flex-col"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => movePaper(index, -1)}><ChevronUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === form.papers.length - 1} onClick={() => movePaper(index, 1)}><ChevronDown className="h-4 w-4" /></Button></div><div className="min-w-0 flex-1"><Input value={paper.display_name} onChange={(event) => updatePaperName(paper.paper_id, event.target.value)} className="h-9 border-[#E7ECEB] text-sm font-medium" /><p className="mt-2 line-clamp-1 text-xs text-[#6B7980]">Source: {paper.title || availablePapers.find((item) => item.id === paper.paper_id)?.title}</p></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[#B54747]" onClick={() => removePaper(paper.paper_id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}{!form.papers.length && <div className="py-12 text-center text-sm text-[#6B7980]"><FileText className="mx-auto mb-3 h-8 w-8 text-[#AEB8BC]" />Select papers to build the product.</div>}</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2"><Label>List price ₹</Label><Input required type="number" min="0" value={form.mrpRupees} onChange={(event) => update('mrpRupees', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Selling price ₹</Label><Input required type="number" min="0" value={form.sellingRupees} onChange={(event) => update('sellingRupees', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Access days</Label><Input type="number" min="1" value={form.accessDays} onChange={(event) => update('accessDays', event.target.value)} className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Maximum attempts per paper</Label><Input type="number" min="1" value={form.maxAttempts} onChange={(event) => update('maxAttempts', event.target.value)} placeholder="Use paper limit" className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Default school seats</Label><Input type="number" min="1" value={form.studentLimit} onChange={(event) => update('studentLimit', event.target.value)} placeholder="Used for online school purchase" className="h-11 border-[#E7ECEB]" /></div>
              <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => update('status', value as ProductStatus)}><SelectTrigger className="h-11 border-[#E7ECEB]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
              <div className="md:col-span-2 rounded-xl border border-[#DCE9E7] bg-[#F7F9F7] px-4 py-3"><div className="flex flex-wrap items-baseline gap-2"><strong className="text-2xl text-[#14232B]">{rupees(sellingPaise)}</strong>{sellingPaise < mrpPaise && <><s className="text-sm text-[#6B7980]">{rupees(mrpPaise)}</s><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{discountPercent(mrpPaise, sellingPaise)}% off</Badge></>}</div><p className="mt-1 text-xs text-[#6B7980]">{form.papers.length} papers · {form.accessDays || 'No fixed'} days access</p></div>
              <div className="space-y-2 md:col-span-2 xl:col-span-4"><Label>Benefits — one per line</Label><Textarea rows={4} value={form.features} onChange={(event) => update('features', event.target.value)} className="border-[#E7ECEB]" /></div>
              <label className="flex items-center gap-3 rounded-xl border border-[#E7ECEB] px-4 py-3 md:col-span-2"><Checkbox checked={form.isFeatured} onCheckedChange={(checked) => update('isFeatured', checked === true)} /><div><div className="flex items-center gap-2 text-sm font-medium text-[#14232B]"><Star className="h-4 w-4 text-[#F2B84B]" />Featured product</div><p className="text-xs text-[#6B7980]">Prioritise this series in the student and school store.</p></div></label>
            </div>

            <Button disabled={busy} className="h-12 w-full bg-[#0E5A5A] text-white hover:bg-[#0A4747]">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}{form.id ? 'Save product changes' : 'Create product'}</Button>
          </CardContent>
        </Card>
      </form>

      <Card className="gap-0 border-[#E7ECEB] shadow-none">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0E5A5A]">Product catalogue</div><h2 className="mt-1 text-xl font-bold text-[#14232B]">Products and current versions</h2></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7980]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="w-[240px] border-[#E7ECEB] pl-9" /></div><Button variant="outline" size="icon" onClick={() => void load()} disabled={busy} className="border-[#E7ECEB]"><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></Button></div></div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">{filteredProducts.map((product) => <article key={product.id} className="grid grid-cols-[110px_minmax(0,1fr)] gap-4 rounded-2xl border border-[#E7ECEB] bg-white p-4"><div className="aspect-[3/4] overflow-hidden rounded-xl bg-[#F7F9F7]">{product.cover_image_url ? <img src={product.cover_image_url} alt={product.image_alt_text || product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-7 w-7 text-[#AEB8BC]" /></div>}</div><div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-[#14232B]">{product.name}</h3><p className="mt-1 text-xs text-[#6B7980]">{product.exam_type || 'Multi-exam'} · {product.paper_count} papers · {product.audience}</p></div><Badge variant="outline" className={product.status === 'published' ? 'border-[#0E5A5A]/20 bg-[#DCE9E7] text-[#0E5A5A]' : product.status === 'archived' ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#E7ECEB] text-[#6B7980]'}>{product.status}</Badge></div><p className="mt-3 line-clamp-2 text-sm text-[#44545C]">{product.short_description || product.description}</p><div className="mt-3 flex flex-wrap items-center gap-2"><strong className="text-lg text-[#14232B]">{rupees(product.current_version?.selling_price_paise || 0)}</strong>{product.current_version && product.current_version.mrp_paise > product.current_version.selling_price_paise && <s className="text-xs text-[#6B7980]">{rupees(product.current_version.mrp_paise)}</s>}{product.is_featured && <Badge className="bg-[#FCF1DB] text-[#8A5F00]">Featured</Badge>}</div><div className="mt-4 flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => edit(product)} className="border-[#0E5A5A]/30 text-[#0E5A5A]"><Edit3 className="mr-1 h-4 w-4" />Edit</Button>{product.cover_image_url && <Button type="button" size="sm" variant="ghost" asChild><a href={product.cover_image_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-4 w-4" />Image</a></Button>}</div></div></article>)}{!filteredProducts.length && <div className="col-span-full py-12 text-center text-sm text-[#6B7980]">No products match the search.</div>}</div>
        </CardContent>
      </Card>
    </div>
  );
}
