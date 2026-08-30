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

const FORM_TABS = ['Basic info', 'Descriptions', 'Images', 'Pricing', 'Benefits', 'Papers', 'SEO & Public Page'] as const;
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
  features: 'Score and answer review\nAccess to every paper in this series\nClear attempt and access limits',
  status: 'draft' as ProductStatus,
  isFeatured: false,
  papers: [] as ProductPaper[],
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  whoFor: '',
  outcomes: '',
  faq: '',
};

type FormState = typeof emptyForm;

function statusClass(status: ProductStatus) {
  if (status === 'published') return 'border-[#237A57]/20 bg-[#237A57]/10 text-[#237A57]';
  if (status === 'archived') return 'border-[var(--amber)]/35 bg-[#FCF1DB] text-[#9A6508]';
  return 'border-[var(--line)] bg-[var(--canvas)] text-[var(--muted-foreground)]';
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
  const [paperKindFilter, setPaperKindFilter] = useState('all');
  const [paperYearFilter, setPaperYearFilter] = useState('all');
  const [paperVariantFilter, setPaperVariantFilter] = useState('all');
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
  const paperYears = useMemo(() => [...new Set(availablePapers.filter((paper)=>paper.is_previous_year_paper && paper.source_year).map((paper)=>Number(paper.source_year)))].sort((a,b)=>b-a), [availablePapers]);
  const paperVariants = useMemo(() => [...new Set(availablePapers.filter((paper)=>paper.is_previous_year_paper && paper.source_variant).map((paper)=>String(paper.source_variant)))].sort(), [availablePapers]);
  const filteredPapers = useMemo(() => availablePapers.filter((paper) => {
    const matchesSearch = !paperSearch || `${paper.title} ${paper.code || ''} ${paper.exam_type || ''} ${paper.grade_level || ''} ${paper.source_year || ''} ${paper.source_variant || ''} ${paper.source_paper_code || ''}`.toLowerCase().includes(paperSearch.toLowerCase());
    const matchesKind = paperKindFilter === 'all' || (paperKindFilter === 'pyq' ? paper.is_previous_year_paper : !paper.is_previous_year_paper);
    const matchesYear = paperYearFilter === 'all' || String(paper.source_year || '') === paperYearFilter;
    const matchesVariant = paperVariantFilter === 'all' || String(paper.source_variant || '') === paperVariantFilter;
    return matchesSearch && matchesKind && matchesYear && matchesVariant;
  }), [availablePapers, paperKindFilter, paperSearch, paperVariantFilter, paperYearFilter]);
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
    setPaperKindFilter('all');
    setPaperYearFilter('all');
    setPaperVariantFilter('all');
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
      seoTitle: product.seo_title || '',
      seoDescription: product.seo_description || '',
      seoKeywords: (product.seo_keywords || []).join(', '),
      whoFor: product.public_content?.whoFor || '',
      outcomes: (product.public_content?.outcomes || []).join('\n'),
      faq: (product.public_content?.faq || []).map((item) => `${item.question} | ${item.answer}`).join('\n'),
    });
    setPaperSearch('');
    setPaperKindFilter('all');
    setPaperYearFilter('all');
    setPaperVariantFilter('all');
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
      is_previous_year_paper: paper.is_previous_year_paper,
      source_year: paper.source_year,
      source_variant: paper.source_variant,
      source_paper_code: paper.source_paper_code,
      paper_origin: paper.paper_origin,
      pyq_source_paper_id: paper.pyq_source_paper_id,
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
    const { data: savedProductId, error: saveError } = await supabase.rpc('admin_upsert_product_v9', {
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
    const productId = payload.id || (typeof savedProductId === 'string' ? savedProductId : '');
    if (productId) {
      const faq = payload.faq.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
        const [question, ...answer] = line.split('|');
        return { question: question.trim(), answer: answer.join('|').trim() };
      }).filter((item) => item.question && item.answer);
      const { error: seoError } = await supabase.rpc('admin_update_product_seo_v15', {
        p_product_id: productId,
        p_seo_title: payload.seoTitle || `${payload.name} | Evidara`,
        p_seo_description: payload.seoDescription || payload.shortDescription || payload.description || null,
        p_seo_keywords: payload.seoKeywords.split(',').map((item) => item.trim()).filter(Boolean),
        p_public_content: { whoFor: payload.whoFor || null, outcomes: payload.outcomes.split('\n').map((item) => item.trim()).filter(Boolean), faq },
      });
      if (seoError) throw seoError;
    }
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
        seoTitle: product.seo_title || '',
        seoDescription: product.seo_description || '',
        seoKeywords: (product.seo_keywords || []).join(', '),
        whoFor: product.public_content?.whoFor || '',
        outcomes: (product.public_content?.outcomes || []).join('\n'),
        faq: (product.public_content?.faq || []).map((item) => `${item.question} | ${item.answer}`).join('\n'),
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
          <div className="space-y-2 md:col-span-2"><div className="flex items-center justify-between"><Label>Grades</Label><span className="text-xs text-[var(--muted-foreground)]">{form.gradeLevels.length} selected</span></div><div className="flex flex-wrap gap-2">{grades.map((item) => <Button key={item.id} type="button" size="sm" variant="outline" onClick={() => toggleGrade(item.value)} className={form.gradeLevels.includes(item.value) ? 'border-[var(--teal)] bg-[var(--secondary)] text-[var(--teal)]' : 'border-[var(--line)]'}>{item.label}</Button>)}</div></div>
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(value) => update('status', value as ProductStatus)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></div>
          <label className="flex items-center gap-3 rounded-xl border border-[var(--line)] px-4 py-3"><Checkbox checked={form.isFeatured} onCheckedChange={(checked) => update('isFeatured', checked === true)} /><span className="text-sm font-medium text-[var(--foreground)]">Featured product</span></label>
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
        <div className="grid gap-3 sm:gap-4 lg:gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
          <div className="min-w-0 aspect-[3/4] overflow-hidden rounded-2xl border border-[var(--secondary)] bg-[var(--canvas)]">
            {form.coverImageUrl && httpsUrl(form.coverImageUrl) ? <img src={form.coverImageUrl} alt={form.imageAltText || 'Product cover preview'} className="h-full w-full object-cover" /> : <div className="flex h-full flex-col items-center justify-center px-5 text-center text-[var(--muted-foreground)]"><ImageIcon className="h-9 w-9 text-[#AEB8BC]" /><p className="mt-3 text-sm font-medium">Product cover preview</p></div>}
          </div>
          <div className="min-w-0 space-y-5">
            <div className="space-y-2"><Label>Primary cover image URL</Label><Input value={form.coverImageUrl} onChange={(event) => update('coverImageUrl', event.target.value)} placeholder="HTTPS image link" /></div>
            <div className="space-y-2"><Label>Image alt text</Label><Input value={form.imageAltText} onChange={(event) => update('imageAltText', event.target.value)} /></div>
            <div className="space-y-3"><div className="flex items-center justify-between"><div><Label>Gallery image links</Label><p className="mt-1 text-xs text-[var(--muted-foreground)]">Up to eight HTTPS links.</p></div><Button type="button" size="sm" variant="outline" disabled={form.galleryImageUrls.length >= 8} onClick={() => update('galleryImageUrls', [...form.galleryImageUrls, ''])}><Plus className="mr-1 h-4 w-4" />Add</Button></div>{form.galleryImageUrls.map((url, index) => <div key={index} className="flex gap-2"><Input value={url} onChange={(event) => setGallery(index, event.target.value)} placeholder={`Gallery image ${index + 1}`} /><Button type="button" variant="ghost" size="icon" onClick={() => update('galleryImageUrls', form.galleryImageUrls.filter((_item, itemIndex) => itemIndex !== index))} disabled={form.galleryImageUrls.length === 1 && !url}><X className="h-4 w-4" /></Button></div>)}</div>
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
          <div className="rounded-2xl border border-[var(--secondary)] bg-[var(--canvas)] p-4 sm:p-5 lg:p-6"><div className="flex flex-wrap items-baseline gap-3"><strong className="text-3xl text-[var(--foreground)]">{rupees(sellingPaise)}</strong>{sellingPaise < mrpPaise && <><s className="text-sm text-[var(--muted-foreground)]">{rupees(mrpPaise)}</s><Badge className="bg-[var(--secondary)] text-[var(--teal)]">{discount}% off</Badge></>}</div><p className="mt-2 text-xs text-[var(--muted-foreground)]">{form.papers.length} papers · {form.accessDays || 'No fixed'} days access</p></div>
        </div>
      );
    }

    if (formTab === 4) {
      return <div className="space-y-2"><Label>Benefits — one per line</Label><Textarea rows={14} value={form.features} onChange={(event) => update('features', event.target.value)} placeholder="Score and answer review\nClear attempt limits" /></div>;
    }

    if (formTab === 6) {
      return (
        <div className="space-y-5">
          <div className="rounded-xl border border-[var(--secondary)] bg-[#F7FAF9] p-4 text-sm text-[#52656C]">Publishing automatically creates the public page <b>/test-series/{form.slug || 'your-product'}/</b>. Defaults are generated from product data, and these fields let you refine the search result and landing page without developer work.</div>
          <div className="space-y-2"><Label>SEO title</Label><Input value={form.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} placeholder={`${form.name || 'Product'} | Evidara`} /></div>
          <div className="space-y-2"><Label>Meta description</Label><Textarea rows={3} value={form.seoDescription} onChange={(event) => update('seoDescription', event.target.value)} placeholder={form.shortDescription || 'Describe the exam, test coverage and student benefit.'} /></div>
          <div className="space-y-2"><Label>SEO keywords</Label><Input value={form.seoKeywords} onChange={(event) => update('seoKeywords', event.target.value)} placeholder="NEET test series, NEET mock test, NEET online practice" /><p className="text-xs text-[var(--muted-foreground)]">Comma-separated. Page content and relevance remain the primary ranking signals.</p></div>
          <div className="space-y-2"><Label>Who is this for?</Label><Textarea rows={3} value={form.whoFor} onChange={(event) => update('whoFor', event.target.value)} /></div>
          <div className="space-y-2"><Label>Student outcomes — one per line</Label><Textarea rows={5} value={form.outcomes} onChange={(event) => update('outcomes', event.target.value)} /></div>
          <div className="space-y-2"><Label>FAQs</Label><Textarea rows={6} value={form.faq} onChange={(event) => update('faq', event.target.value)} placeholder={'How many tests are included? | 20 tests are included.\nHow long is access valid? | Access is valid for one year.'} /><p className="text-xs text-[var(--muted-foreground)]">Use one line per FAQ: Question | Answer</p></div>
        </div>
      );
    }

    return (
      <div className="grid gap-3 sm:gap-4 lg:gap-5 xl:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-[var(--line)] p-4">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold text-[var(--foreground)]">Available papers</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Approved and published Evidara master papers.</p></div><Badge variant="outline">{availablePapers.length}</Badge></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><div className="relative sm:col-span-2 xl:col-span-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={paperSearch} onChange={(event) => setPaperSearch(event.target.value)} placeholder="Search papers" className="pl-9" /></div><Select value={paperKindFilter} onValueChange={setPaperKindFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All papers</SelectItem><SelectItem value="pyq">Previous-year papers</SelectItem><SelectItem value="other">Non-PYQ papers</SelectItem></SelectContent></Select><Select value={paperYearFilter} onValueChange={setPaperYearFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All years</SelectItem>{paperYears.map((year)=><SelectItem key={year} value={String(year)}>{year}</SelectItem>)}</SelectContent></Select><Select value={paperVariantFilter} onValueChange={setPaperVariantFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All variants</SelectItem>{paperVariants.map((variant)=><SelectItem key={variant} value={variant}>{variant}</SelectItem>)}</SelectContent></Select></div>
          <div className={`${styles.scrollArea} mt-3 max-h-[420px] space-y-2 overflow-y-auto pr-1`}>{filteredPapers.map((paper) => <div key={paper.id} className="flex items-start gap-3 rounded-xl border border-[var(--line)] p-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><p className="line-clamp-2 text-sm font-medium text-[var(--foreground)]">{paper.title}</p>{paper.is_previous_year_paper && <Badge className="bg-[var(--secondary)] text-[var(--teal)]">PYQ {paper.source_year}</Badge>}{paper.source_variant && paper.source_variant!=='Main' && <Badge variant="outline">{paper.source_variant}</Badge>}</div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{paper.source_paper_code ? `Code ${paper.source_paper_code} · ` : ''}{paper.code || 'No code'} · {paper.exam_type || 'No exam'} · {paper.grade_level || 'No grade'} · {paper.total_questions} questions</p></div><Button type="button" size="sm" variant={selectedPaperIds.has(paper.id) ? 'secondary' : 'outline'} disabled={selectedPaperIds.has(paper.id)} onClick={() => addPaper(paper)}>{selectedPaperIds.has(paper.id) ? <Check className="mr-1 h-4 w-4" /> : <Plus className="mr-1 h-4 w-4" />}{selectedPaperIds.has(paper.id) ? 'Added' : 'Add'}</Button></div>)}{!filteredPapers.length && <div className={styles.emptyState}><FileText className="mx-auto mb-3 h-8 w-8 text-[#AEB8BC]" />No matching papers.</div>}</div>
        </div>
        <div className="min-w-0 rounded-2xl border border-[var(--secondary)] bg-[var(--canvas)] p-4">
          <div className="flex items-center justify-between"><div><h3 className="font-semibold text-[var(--foreground)]">Included papers and storefront names</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">The source-paper title remains unchanged.</p></div><Badge className="bg-[var(--secondary)] text-[var(--teal)]">{form.papers.length} paper{form.papers.length === 1 ? '' : 's'}</Badge></div>
          <div className={`${styles.scrollArea} mt-4 max-h-[470px] space-y-3 overflow-y-auto pr-1`}>{form.papers.map((paper, index) => <div key={paper.paper_id} className="rounded-xl border border-[var(--secondary)] bg-white p-3"><div className="flex items-start gap-2"><div className="flex flex-col"><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === 0} onClick={() => movePaper(index, -1)}><ChevronUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" size="icon" className="h-7 w-7" disabled={index === form.papers.length - 1} onClick={() => movePaper(index, 1)}><ChevronDown className="h-4 w-4" /></Button></div><div className="min-w-0 flex-1"><Input value={paper.display_name} onChange={(event) => updatePaperName(paper.paper_id, event.target.value)} className="h-9 text-sm font-medium" /><div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]"><span>Source: {paper.title || availablePapers.find((item) => item.id === paper.paper_id)?.title}</span>{paper.is_previous_year_paper && <Badge className="bg-[var(--secondary)] text-[var(--teal)]">PYQ {paper.source_year}</Badge>}{paper.source_variant && <Badge variant="outline">{paper.source_variant}</Badge>}{paper.source_paper_code && <Badge variant="outline">Code {paper.source_paper_code}</Badge>}</div></div><Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-[var(--destructive)]" onClick={() => removePaper(paper.paper_id)}><Trash2 className="h-4 w-4" /></Button></div></div>)}{!form.papers.length && <div className={styles.emptyState}><Package className="mx-auto mb-3 h-8 w-8 text-[#AEB8BC]" />Select papers to build the product.</div>}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.workspace} space-y-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-2xl font-extrabold tracking-tight text-[var(--foreground)]">Products</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">Manage paper bundles, pricing versions and publication.</p></div>
        <Button onClick={openCreate} className="h-11 bg-[var(--teal)] hover:bg-[#0A4A4A]"><Plus className="mr-2 h-4 w-4" />Create Product</Button>
      </div>

      {(error || message) && <div className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-[var(--destructive)]/20 bg-[var(--destructive)]/5 text-[var(--destructive)]' : 'border-[#237A57]/20 bg-[#237A57]/5 text-[#237A57]'}`}>{error || message}</div>}

      <div className="grid gap-3 sm:gap-4 lg:gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'All products', value: stats.total, icon: Package },
          { label: 'Published', value: stats.published, icon: CheckCircle2 },
          { label: 'Drafts', value: stats.draft, icon: Edit3 },
          { label: 'Archived', value: stats.archived, icon: Archive },
        ].map(({ label, value, icon: Icon }) => <div key={label} className={styles.metricCard}><div className="flex items-center justify-between"><div><p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p><p className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">{value}</p></div><div className="rounded-xl bg-[var(--secondary)] p-3 text-[var(--teal)]"><Icon className="h-5 w-5" /></div></div></div>)}
      </div>

      <Card className="gap-0 border-[var(--line)] shadow-sm rounded-xl">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#AEB8BC]" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, slug or exam" className="pl-9" /></div>
            <div className="flex flex-wrap gap-2">{STATUS_FILTERS.map((status) => <Button key={status} type="button" size="sm" variant="outline" onClick={() => setStatusFilter(status)} className={statusFilter === status ? 'border-[var(--teal)] bg-[var(--secondary)] text-[var(--teal)]' : 'border-[var(--line)]'}>{status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)}</Button>)}<Button type="button" variant="outline" size="icon" onClick={() => void load()} disabled={busy}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></Button></div>
          </div>
          <div className={`${styles.scrollArea} overflow-x-auto`}>
            <table className="min-w-[980px] w-full border-collapse">
              <thead><tr className="border-b border-[var(--line)] bg-[var(--canvas)] text-left text-xs font-semibold text-[var(--muted-foreground)]"><th className="px-5 py-3">Product</th><th>Audience</th><th>Papers</th><th>Current price</th><th>Status</th><th>Updated</th><th className="pr-5 text-right">Actions</th></tr></thead>
              <tbody>{filteredProducts.map((product) => { const version = product.current_version; return <tr key={product.id} className={`${styles.tableRow} border-b border-[var(--line)] text-sm`}><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-14 w-20 overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--canvas)]">{product.cover_image_url ? <img src={product.cover_image_url} alt={product.image_alt_text || product.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><ImageIcon className="h-5 w-5 text-[#AEB8BC]" /></div>}</div><div className="min-w-0"><div className="flex items-center gap-2"><strong className="max-w-[300px] truncate text-[var(--foreground)]">{product.name}</strong>{product.is_featured && <Star className="h-4 w-4 fill-[var(--amber)] text-[var(--amber)]" />}</div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{product.slug} · {product.exam_type || 'Multi-exam'}</p></div></div></td><td className="capitalize text-[#44545C]">{audienceLabel(product.audience)}</td><td><strong className="text-[var(--foreground)]">{product.paper_count}</strong></td><td>{version ? <div><strong className="text-[var(--foreground)]">{rupees(version.selling_price_paise)}</strong>{version.mrp_paise > version.selling_price_paise && <p className="text-xs text-[var(--muted-foreground)]"><s>{rupees(version.mrp_paise)}</s> · v{version.version_number}</p>}</div> : <span className="text-[#AEB8BC]">No price</span>}</td><td><Badge variant="outline" className={statusClass(product.status)}>{product.status}</Badge></td><td className="text-xs text-[var(--muted-foreground)]">{new Date(product.updated_at || product.created_at).toLocaleDateString('en-IN')}</td><td className="pr-5"><div className="flex justify-end gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => openEdit(product)}><Edit3 className="mr-1 h-4 w-4" />Edit</Button>{product.status !== 'published' && <Button type="button" variant="ghost" size="sm" disabled={workingId === product.id} onClick={() => void changeStatus(product, 'published')} className="text-[#237A57]">{workingId === product.id ? <LoaderCircle className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}Publish</Button>}{product.status !== 'archived' && <Button type="button" variant="ghost" size="sm" disabled={workingId === product.id} onClick={() => void changeStatus(product, 'archived')} className="text-[#9A6508]"><Archive className="mr-1 h-4 w-4" />Archive</Button>}</div></td></tr>; })}{!filteredProducts.length && <tr><td colSpan={7} className={styles.emptyState}><Package className="mx-auto mb-3 h-10 w-10 text-[#AEB8BC]" />No products match the current search and status filter.</td></tr>}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => { if (!busy) setFormOpen(open); }}>
        <DialogContent className="max-h-[94vh] w-[96vw] max-w-6xl overflow-hidden border-[var(--secondary)] p-0">
          <form onSubmit={save} className="flex max-h-[94vh] flex-col">
            <DialogHeader className="border-b border-[var(--line)] px-5 py-4 text-left sm:px-6"><DialogTitle className="text-xl text-[var(--foreground)]">{form.id ? 'Edit product' : 'Create product'}</DialogTitle><DialogDescription>{form.id ? 'Changes create a new immutable pricing version.' : 'Bundle approved or published master papers into a commercial product.'}</DialogDescription></DialogHeader>
            <div className={`${styles.scrollArea} flex gap-0 overflow-x-auto border-b border-[var(--line)] px-4 sm:px-6`}>{FORM_TABS.map((tab, index) => <button key={tab} type="button" onClick={() => setFormTab(index)} className={`${styles.focusRing} shrink-0 border-b-2 px-3.5 py-3 text-xs font-semibold transition-colors ${formTab === index ? 'border-[var(--teal)] text-[var(--teal)]' : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]'}`}>{tab}</button>)}</div>
            <div className={`${styles.scrollArea} ${styles.fadeIn} flex-1 overflow-y-auto bg-white p-4 sm:p-5 lg:p-6`}>{renderFormContent()}</div>
            <DialogFooter className="border-t border-[var(--line)] bg-white px-5 py-4 sm:px-6"><div className="mr-auto text-xs text-[var(--muted-foreground)]">Step {formTab + 1} of {FORM_TABS.length}</div>{formTab > 0 && <Button type="button" variant="outline" onClick={() => setFormTab((current) => current - 1)}><ChevronLeft className="mr-1 h-4 w-4" />Back</Button>}{formTab < FORM_TABS.length - 1 && <Button type="button" variant="outline" onClick={() => setFormTab((current) => current + 1)}>Next<ChevronRight className="ml-1 h-4 w-4" /></Button>}<Button disabled={busy} className="bg-[var(--teal)] hover:bg-[#0A4A4A]">{busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <PackagePlus className="mr-2 h-4 w-4" />}{form.id ? 'Save changes' : 'Create product'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
