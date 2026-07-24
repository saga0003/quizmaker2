'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Edit3,
  FileText,
  Image as ImageIcon,
  LoaderCircle,
  Package,
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

const FORM_TABS = ['Basic info', 'Descriptions', 'Images', 'Pricing', 'Benefits', 'Papers'] as const;
const STATUS_FILTERS = ['all', 'published', 'draft', 'archived'] as const;

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

function statusClass(status: ProductStatus) {
  if (status === 'published') return 'border-[#237A57]/20 bg-[#237A57]/10 text-[#237A57]';
  if (status === 'archived') return 'border-[#F2B84B]/35 bg-[#FCF1DB] text-[#9A6508]';
  return 'border-[#E7ECEB] bg-[#F7F9F7] text-[#6B7980]';
}

function audienceLabel(audience: ProductAudience) {
  if (audience === 'both') return 'Students and schools';
  return audience === 'school' ? 'Schools' : 'Students';
}

export function AdminProductManager() {
  const { grades, exams } = useAssessmentOptions(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [availablePapers, setAvailablePapers] = useState<BuilderPaper[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [paperSearch, setPaperSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formTab, setFormTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [workingId, setWorkingId] = useState('');
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
  const selectedPaperIds = useMemo(() => new Set(form.papers.map((paper) => paper.paper_id)), [form.papers]);
  const filteredPapers = useMemo(() => availablePapers.filter((paper) => {
    if (!paperSearch) return true;
    return `${paper.title} ${paper.code || ''} ${paper.exam_type || ''} ${paper.grade_level || ''}`.toLowerCase().includes(paperSearch.toLowerCase());
  }), [availablePapers, paperSearch]);
  const filteredProducts = useMemo(() => products.filter((product) => {
    const matchesStatus = statusFilter === 'all' || product.status === statusFilter;
    const matchesSearch = !search || `${product.name} ${product.slug} ${product.exam_type || ''}`.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  }), [products, search, statusFilter]);

  const stats = {
    total: products.length,
    published: products.filter((product) => product.status === 'published').length,
    draft: products.filter((product) => product.status === 'draft').length,
    archived: products.filter((product) => product.status === 'archived').length,
  };

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setPaperSearch('');
    setFormTab(0);
  }

  function openCreate() {
    resetForm();
    setError('');
    setMessage('');
    setFormOpen(true);
  }

  function openEdit(product: AdminProduct) {
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
    setPaperSearch('');
    setFormTab(0);
    setError('');
    setMessage('');
    setFormOpen(true);
  }

  function toggleGrade(value: string) {
    update('gradeLevels', form.gradeLevels.includes(value)
      ? form.gradeLevels.filter((grade) => grade !== value)
      : [...form.gradeLevels, value]);
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
    update('papers', form.papers
      .filter((paper) => paper.paper_id !== paperId)
      .map((paper, index) => ({ ...paper, display_order: index })));
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

  async function persistProduct(payload: FormState, targetStatus = payload.status) {
    if (!supabase) throw new Error('Supabase is not configured.');
    const gallery = payload.galleryImageUrls.map((item) => item.trim()).filter(Boolean);
    const listPaise = Math.round(Number(payload.mrpRupees || 0) * 100);
    const salePaise = Math.round(Number(payload.sellingRupees || 0) * 100);
    if (!httpsUrl(payload.coverImageUrl) || gallery.some((item) => !httpsUrl(item))) throw new Error('Every product image must be an HTTPS image link.');
    if (!payload.papers.length && targetStatus === 'published') throw new Error('Add at least one paper before publishing the product.');
    if (salePaise > listPaise) throw new Error('Selling price cannot exceed the list price.');
    const { error: saveError } = await supabase.rpc('admin_upsert_product_v9', {
      p_product_id: payload.id || null,
      p_name: payload.name,
      p_slug: payload.slug || slugify(payload.name),
      p_short_description: payload.shortDescription || null,
      p_description: payload.description || null,
      p_product_type: payload.productType,
      p_audience: payload.audience,
      p_exam_type: payload.examType || null,
      p_grade_levels: payload.gradeLevels,
      p_cover_image_url: payload.coverImageUrl || null,
      p_gallery_image_urls: gallery,
      p_image_alt_text: payload.imageAltText || null,
      p_mrp_paise: listPaise,
      p_selling_price_paise: salePaise,
      p_access_days: payload.accessDays ? Number(payload.accessDays) : null,
      p_max_attempts: payload.maxAttempts ? Number(payload.maxAttempts) : null,
      p_student_limit: payload.studentLimit ? Number(payload.studentLimit) : null,
      p_features: payload.features.split('\n').map((item) => item.trim()).filter(Boolean),
      p_status: targetStatus,
      p_is_featured: payload.isFeatured,
      p_papers: payload.papers.map((paper, display_order) => ({ paper_id: paper.paper_id, display_name: paper.display_name, display_order })),
    });
    if (saveError) throw saveError;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      await persistProduct(form);
      setMessage(form.id ? 'Product updated. A new immutable price version was created.' : 'Product created successfully.');
      setFormOpen(false);
      resetForm();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save product.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(product: AdminProduct, status: ProductStatus) {
    const version = product.current_version;
    if (!version) return setError('The product does not have a current pricing version.');
    setWorkingId(product.id);
    setError('');
    setMessage('');
    try {
      await persistProduct({
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
        mrpRupees: String(version.mrp_paise / 100),
        sellingRupees: String(version.selling_price_paise / 100),
        accessDays: version.access_days ? String(version.access_days) : '',
        maxAttempts: version.max_attempts ? String(version.max_attempts) : '',
        studentLimit: version.student_limit ? String(version.student_limit) : '',
        features: (version.features || []).join('\n'),
        status,
        isFeatured: product.is_featured,
        papers: product.papers || [],
      }, status);
      setMessage(status === 'published' ? `“${product.name}” is now published.` : `“${product.name}” has been archived.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to change product status.');
    } finally {
      setWorkingId('');
    }
  }

  function renderFormContent() {
    if (formTab === 0) {
      return (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2"><Label>Product name</Label><Input required value={form.name} onChange={(event) => { update('name', event.target.value); if (!form.id) update('slug', slugify(event.target.value)); }} placeholder="NEET Complete Mock Test Series" /></div>
          <div className="space-y-2"><Label>URL slug</Label><Input required value={form.slug} onChange={(event) => update('slug', slugify(event.target.value))} /></div>
          <div className="space-y-2"><Label>Product type</Label><Select value={form.productType} onValueChange={(value) => update('productType', value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{PRODUCT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Audience</Label><Select value={form.audience} onValueChange={(value) => update('audience', value as ProductAudience)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="student">Students</SelectItem><SelectItem value="school">Schools</SelectItem><SelectItem value="both">Students and schools</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Exam</Label><Select value={form.examType} onValueChange={(value) => update('examType', value)}><SelectTrigger><SelectValue placeholder="Select exam" /></SelectTrigger><SelectContent>{exams.map((item) => <SelectItem key={item.id} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between"><Label>Grades</Label><span className="text-xs text-[#6B7980]">{form.gradeLevels.length} selected</span></div><div className="flex flex-wrap gap-2">{grades.map((item) => <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => toggleGrade(item.value)} className={form.gradeLevels.includes(item.value) ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB]'}>{item.label}</Button>)}</div></div>
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => update('status', value as ProductStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
          <label className="flex items-center gap-3 rounded-xl border border-[#E7ECEB] px-4 py-3"><Checkbox checked={form.isFeatured} onCheckedChange={(checked) => update('isFeatured', checked === true)} /><span className="text-sm font-medium text-[#14232B]">Featured product</span></label>
        </div>
      );
    }

    if (formTab === 1) {
      return (
        <div className="space-y-5">
          <div className="space-y-2"><Label>Short description</Label><Input value={form.shortDescription} onChange={(event) => update('shortDescription', event.target.value)} placeholder="Shown in catalogue and store cards" /></div>
          <div className="space-y-2"><Label>Full description</Label><Textarea rows={12} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Explain coverage, outcomes and who the product is for." /></div>
        </div>
      );
    }

    if (formTab === 2) {
      return (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="aspect-[3/4] overflow-hidden rounded-2xl border border-[#DCE9E7] bg-[#F7F9F7]">
            {form.coverImageUrl && httpsUrl(form.coverImageUrl) ? <img src={form.coverImageUrl} alt={form.imageAltText || 'Product cover preview'} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center px-5 text-center text-[#6B7980]"><ImageIcon className="h-9 w-9 text-[#AEB8BC]" /><p className="mt-3 text-sm font-medium">Product cover preview</p></div>}
          </div>
          <div className="space-y-5">
            <div className="space-y-2"><Label>Primary cover image URL</Label><Input value={form.coverImageUrl} onChange={(event) => update('coverImageUrl', event.target.value)} placeholder="HTTPS image link" /></div>
            <div className="space-y-2"><Label>Image alt text</Label><Input value={form.imageAltText} onChange={(event) => update('imageAltText', event.target.value)} /></div>
            <div className="space-y-3"><div className="flex items-center justify-between"><div><Label>Gallery image links</Label><p className="mt-1 text-xs text-[#6B7980]">Up to eight HTTPS links.</p></div><Button type="button" size="sm" variant="outline" disabled={form.galleryImageUrls.length >= 8} onClick={() => update('galleryImageUrls', [...form.galleryImageUrls, ''])}><Plus className="mr-1 h-4 w-4" />Add</Button></div>{form.galleryImageUrls.map((url, index) => <div key={index} className="flex gap-2"><Input value={url} onChange={(event) => setGallery(index, event.target.value)} placeholder={`Gallery image ${index + 1}`} /><Button type="button" variant="ghost" size="icon" onClick={() => update('galleryImageUrls', form.galleryImageUrls.filter((_item, itemIndex) => itemIndex !== index))} disabled={form.galleryImageUrls.length === 1 && !url}><X className="h-4 w-4" /></Button></div>)}</div>
          </div>
        </div>
      );
    }

    if (formTab === 3) {
      const discount = discountPercent(mrpPaise, sellingPaise);
      return (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2"><Label>List price ₹</Label><Input required type="number" min="0" value={form.mrpRupees} onChange={(event) => update('mrpRupees', event.target.value)} /></div>
            <div className="space-y-2"><Label>Selling price ₹</Label><Input required type="number" min="0" value={form.sellingRupees} onChange={(event) => update('sellingRupees', event.target.value)} /></div>
            <div className="space-y-2"><Label>Access days</Label><Input type="number" min="1" value={form.accessDays} onChange={(event) => update('accessDays', event.target.value)} /></div>
            <div className="space-y-2"><Label>Maximum attempts per paper</Label><Input type="number" min="1" value={form.maxAttempts} onChange={(event) => update('maxAttempts', event.target.value)} placeholder="Use paper limit" /></div>
            <div className="space-y-2 md:col-span-2"><Label>Default school seats</Label><Input type="number" min="1" value={form.studentLimit} onChange={(event) => update('studentLimit', event.target.value)} placeholder="Used for online school purchase" /></div>
          </div>
          <div className="rounded-2xl border border-[#DCE9E7] bg-[#F7F9F7] p-5"><div className="flex flex-wrap items-baseline gap-3"><strong className="text-3xl text-[#14232B]">{rupees(sellingPaise)}</strong>{sellingPaise < mrpPaise && <><s className="text-sm text-[#6B7980]">{rupees(mrpPaise)}</s><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{discount}% off</Badge></>}</div><p className="mt-2 text-xs text-[#6B7980]">{form.papers.length} papers · {form.accessDays || 'No fixed'} days access</p></div>
        </div>
      );
    }

    if (formTab === 4) {
      return <div className="space-y-2"><Label>Benefits — one per line</Label><Textarea rows={14} value={form.features} onChange={(event) => update('features', event.target.value)} placeholder="Detailed analytics\nChapter-level insights" /></div>;
    }

    return (
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-[#E7ECEB] p-4">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold text-[#14232B]">Available papers</h3><p className="mt-1 text-xs text-[#6B7980]">Approved and published Evidara master papers.</p></div><Badge variant="outline">{availablePapers.length}</Badge></div>
          <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={paperSearch} onChange={(event) => setPaperSearch(event.target.value)} placeholder="Search papers" className="pl-9" /></div>
          <div className={`${styles.scrollArea} mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1`}>{filteredPapers.map((paper) => <div key={paper.id} className="flex items-start gap-3 rounded-xl border border-[#E7ECEB] p-3"><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium text-[#14232B]">{paper.title}</p><p className="mt-1 text-xs text-[#6B7980]">{paper.code || 'No code'} · {paper.exam_type || 'No exam'} · {paper.grade_level || 'No grade'} · {paper.total_questions} questions</p></div><Button type="button" size="sm" variant={selectedPaperIds.has(paper.id) ? 'secondary' : 'outline'} disabled={selectedPaperIds.has(paper.id)} onClick={() => addPaper(paper)}>{selectedPaperIds.has(paper.id) ? <Check className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}{selectedPaperIds.has(paper.id) ? 'Added' : 'Add'}</Button></div>)}{!filteredPapers.length && <div className={styles.emptyState}><FileText className="mx-auto mb-3 h-8 w-8 text-[#AEB8BC]" />No matching papers.</div>}</div>
        </div>
        <div className="rounded-2xl border border-[#DCE9E7] bg-[#F7F9F7] p-4">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold text-[#14232B]">Included papers and storefront names</h3><p className="mt-1 text-xs text-[#6B7980]">The source-paper title remains unchanged.</p></div><Badge className="bg-[#DCE9E7] text-[#0E5A5A]">{form.papers.length} paper{form.papers.length === 1 ? '' : 's'}</Badge></div>
          <div className={`${styles.scrollArea} mt-4 max-h-[470px] space-y-3 overflow-y-auto pr-1`}>{form.papers.map((paper, index) => <div key={paper.paper_id} className="rounded-xl border border-[#DCE9E7] bg-white p-3"><div className="flex items-start gap-2"><div className="flex flex-col"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => movePaper(index, -1)}><ChevronUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === form.papers.length - 1} onClick={() => movePaper(index, 1)}><ChevronDown className="h-4 w-4" /></Button></div><div className="min-w-0 flex-1"><Input value={paper.display_name} onChange={(event) => updatePaperName(paper.paper_id, event.target.value)} className="h-9 text-sm font-medium" /><p className="mt-2 line-clamp-1 text-xs text-[#6B7980]">Source: {paper.title || availablePapers.find((item) => item.id === paper.paper_id)?.title}</p></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[#B54747]" onClick={() => removePaper(paper.paper_id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}{!form.papers.length && <div className={styles.emptyState}><Package className="mx-auto mb-3 h-8 w-8 text-[#AEB8BC]" />Select papers to build the product.</div>}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.workspace} space-y-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-2xl font-extrabold tracking-tight text-[#14232B]">Products</h2><p className="mt-1 text-sm text-[#6B7980]">Manage paper bundles, pricing versions and publication.</p></div>
        <Button onClick={openCreate} className="h-11 bg-[#0E5A5A] hover:bg-[#0A4A4A]"><Plus className="mr-2 h-4 w-4" />Create Product</Button>
      </div>

      {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[#B54747]/20 bg-[#B54747]/5 text-[#B54747]' : 'border-[#237A57]/20 bg-[#237A57]/5 text-[#237A57]'}`}>{error || message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[['All products', stats.total, Package], ['Published', stats.published, CheckCircle2], ['Drafts', stats.draft, Edit3], ['Archived', stats.archived, Archive]].map(([label, value, Icon]) => <div key={String(label)} className={styles.metricCard}><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-[#6B7980]">{String(label)}</p><p className="mt-1 text-2xl font-extrabold text-[#14232B]">{String(value)}</p></div><div className="rounded-xl bg-[#DCE9E7] p-3 text-[#0E5A5A]"><Icon className="h-5 w-5" /></div></div></div>)}
      </div>

      <Card className="gap-0 border-[#E7ECEB] shadow-none">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-[#E7ECEB] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, slug or exam" className="pl-9" /></div>
            <div className="flex flex-wrap gap-2">{STATUS_FILTERS.map((status) => <Button key={status} type="button" size="sm" variant="outline" onClick={() => setStatusFilter(status)} className={statusFilter === status ? 'border-[#0E5A5A] bg-[#DCE9E7] text-[#0E5A5A]' : 'border-[#E7ECEB]'}>{status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}</Button>)}<Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></Button></div>
          </div>
          <div className={`${styles.scrollArea} overflow-x-auto`}>
            <table className="min-w-[980px] w-full border-collapse">
              <thead><tr className="border-b border-[#E7ECEB] bg-[#F7F9F7] text-left text-xs font-semibold text-[#6B7980]"><th className="px-5 py-3">Product</th><th>Audience</th><th>Papers</th><th>Current price</th><th>Status</th><th>Updated</th><th className="pr-5 text-right">Actions</th></tr></thead>
              <tbody>{filteredProducts.map((product) => { const version = product.current_version; return <tr key={product.id} className={`${styles.tableRow} border-b border-[#E7ECEB] text-sm`}><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-14 w-20 overflow-hidden rounded-xl border border-[#E7ECEB] bg-[#F7F9F7]">{product.cover_image_url ? <img src={product.cover_image_url} alt={product.image_alt_text || product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-5 w-5 text-[#AEB8BC]" /></div>}</div><div className="min-w-0"><div className="flex items-center gap-2"><strong className="max-w-[300px] truncate text-[#14232B]">{product.name}</strong>{product.is_featured && <Star className="h-4 w-4 fill-[#F2B84B] text-[#F2B84B]" />}</div><p className="mt-1 text-xs text-[#6B7980]">{product.slug} · {product.exam_type || 'Multi-exam'}</p></div></div></td><td className="capitalize text-[#44545C]">{audienceLabel(product.audience)}</td><td><strong className="text-[#14232B]">{product.paper_count}</strong></td><td>{version ? <div><strong className="text-[#14232B]">{rupees(version.selling_price_paise)}</strong>{version.mrp_paise > version.selling_price_paise && <p className="text-xs text-[#6B7980]"><s>{rupees(version.mrp_paise)}</s> · v{version.version_number}</p>}</div> : <span className="text-[#AEB8BC]">No price</span>}</td><td><Badge variant="outline" className={statusClass(product.status)}>{product.status}</Badge></td><td className="text-xs text-[#6B7980]">{new Date(product.updated_at || product.created_at).toLocaleDateString('en-IN')}</td><td className="pr-5"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => openEdit(product)}><Edit3 className="mr-1 h-4 w-4" />Edit</Button>{product.status !== 'published' && <Button type="button" variant="ghost" size="sm" disabled={workingId === product.id} onClick={() => void changeStatus(product, 'published')} className="text-[#237A57]">{workingId === product.id ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}Publish</Button>}{product.status !== 'archived' && <Button type="button" variant="ghost" size="sm" disabled={workingId === product.id} onClick={() => void changeStatus(product, 'archived')} className="text-[#9A6508]"><Archive className="mr-1 h-4 w-4" />Archive</Button>}</div></td></tr>; })}{!filteredProducts.length && <tr><td colSpan={7} className={styles.emptyState}><Package className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" />No products match the current search and status filter.</td></tr>}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!busy) setFormOpen(open); }}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-6xl overflow-hidden border-[#DCE9E7] p-0">
          <form onSubmit={save} className="flex max-h-[94vh] flex-col">
            <DialogHeader className="border-b border-[#E7ECEB] px-5 py-4 text-left sm:px-6"><DialogTitle className="text-xl text-[#14232B]">{form.id ? 'Edit product' : 'Create product'}</DialogTitle><DialogDescription>{form.id ? 'Changes create a new immutable pricing version.' : 'Bundle approved or published master papers into a commercial product.'}</DialogDescription></DialogHeader>
            <div className={`${styles.scrollArea} flex gap-0 overflow-x-auto border-b border-[#E7ECEB] px-4 sm:px-6`}>{FORM_TABS.map((tab, index) => <button key={tab} type="button" onClick={() => setFormTab(index)} className={`${styles.focusRing} shrink-0 border-b-2 px-3.5 py-3 text-xs font-semibold transition-colors ${formTab === index ? 'border-[#0E5A5A] text-[#0E5A5A]' : 'border-transparent text-[#6B7980] hover:text-[#14232B]'}`}>{tab}</button>)}</div>
            <div className={`${styles.scrollArea} ${styles.fadeIn} flex-1 overflow-y-auto bg-white p-5 sm:p-6`}>{renderFormContent()}</div>
            <DialogFooter className="border-t border-[#E7ECEB] bg-white px-5 py-4 sm:px-6"><div className="mr-auto text-xs text-[#6B7980]">Step {formTab + 1} of {FORM_TABS.length}</div>{formTab > 0 && <Button type="button" variant="outline" onClick={() => setFormTab((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Back</Button>}{formTab < FORM_TABS.length - 1 && <Button type="button" variant="outline" onClick={() => setFormTab((current) => current + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>}<Button disabled={busy} className="bg-[#0E5A5A] hover:bg-[#0A4A4A]">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}{form.id ? 'Save changes' : 'Create product'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
