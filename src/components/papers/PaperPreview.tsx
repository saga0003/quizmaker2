'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Clock3, FileQuestion, LoaderCircle } from 'lucide-react';
import { BlockMath, InlineMath } from 'react-katex';
import { supabase } from '@/lib/supabase';

type PreviewOption = {
  option_key: string;
  content_text?: string;
  content_latex?: string;
  image_url?: string;
  display_order?: number;
};

type PreviewSnapshot = {
  stem_text?: string;
  stem_latex?: string;
  question_image_url?: string;
  options?: PreviewOption[];
};

type PreviewItem = {
  id: string;
  section_id: string;
  display_order: number;
  question_snapshot: PreviewSnapshot;
};

type PreviewSection = {
  id: string;
  title: string;
  instructions: string | null;
  questions_to_attempt: number | null;
  display_order: number;
};

function safeHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

export function PaperPreview({ kind }: { kind: 'admin' | 'school' }) {
  const [paper, setPaper] = useState<Record<string, unknown> | null>(null);
  const [sections, setSections] = useState<PreviewSection[]>([]);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const base = kind === 'admin' ? '/admin/papers' : '/school/papers';

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) {
      setError('Paper ID is missing.');
      setLoading(false);
      return;
    }
    void load(id);
  }, []);

  async function load(id: string) {
    if (!supabase) {
      setError('Connect Supabase to preview a saved paper.');
      setLoading(false);
      return;
    }
    const [paperResult, sectionResult, itemResult] = await Promise.all([
      supabase.from('question_papers').select('*').eq('id', id).single(),
      supabase.from('paper_sections').select('*').eq('paper_id', id).order('display_order'),
      supabase.from('paper_questions').select('id,section_id,display_order,question_snapshot').eq('paper_id', id).order('display_order'),
    ]);
    const loadError = paperResult.error || sectionResult.error || itemResult.error;
    if (loadError) setError(loadError.message || 'Unable to load paper.');
    else {
      setPaper(paperResult.data as Record<string, unknown>);
      setSections((sectionResult.data || []) as PreviewSection[]);
      setItems((itemResult.data || []) as unknown as PreviewItem[]);
    }
    setLoading(false);
  }

  if (loading) return <div className="py-16 text-center text-sm text-[#667085]"><LoaderCircle className="mx-auto mb-2 h-6 w-6 animate-spin" />Loading paper preview…</div>;
  if (error || !paper) return <div><Link href={`${base}/`} className="inline-flex items-center gap-2 font-semibold text-[#667085]"><ArrowLeft className="h-4 w-4" />Back to papers</Link><div className="mt-4 rounded-xl bg-[#FEF3F2] p-4 text-[#B42318]">{error || 'Paper not found.'}</div></div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link href={`${base}/`} className="inline-flex items-center gap-2 text-sm font-semibold text-[#667085]"><ArrowLeft className="h-4 w-4" />Back to papers</Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-[#0E5A5A]">Student-facing test preview</p>
          <h1 className="mt-1 text-3xl font-bold text-[#131E35]">{String(paper.title)}</h1>
          {Boolean(paper.description) && <p className="mt-2 text-sm text-[#667085]">{String(paper.description)}</p>}
        </div>
        <Link className="rounded-lg bg-[#0E5A5A] px-4 py-2.5 text-sm font-semibold text-white" href={`${base}/new/?id=${String(paper.id)}`}>Edit paper</Link>
      </div>

      <section className="flex flex-wrap gap-5 rounded-xl border border-[#E7ECEB] bg-white p-4 text-sm text-[#14232B]">
        <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#0E5A5A]" />{String(paper.duration_minutes)} minutes</span>
        <span className="inline-flex items-center gap-2"><FileQuestion className="h-4 w-4 text-[#0E5A5A]" />{String(paper.total_questions)} questions</span>
        <span className="inline-flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-[#0E5A5A]" />{String(paper.total_marks)} marks</span>
      </section>

      {Boolean(paper.instructions) && <section className="rounded-xl border border-[#E7ECEB] bg-[#F7F9F7] p-5 text-sm leading-6 text-[#14232B]" dangerouslySetInnerHTML={{ __html: safeHtml(String(paper.instructions)) }} />}

      {sections.map((section) => (
        <section key={section.id} className="rounded-2xl border border-[#E7ECEB] bg-white p-5">
          <div className="border-b border-[#14232B] pb-3">
            <h2 className="text-xl font-bold text-[#14232B]">{section.title}</h2>
            {section.instructions && <p className="mt-1 text-sm text-[#667085]">{section.instructions}</p>}
            {section.questions_to_attempt && <p className="mt-1 text-sm font-semibold text-[#14232B]">Attempt any {section.questions_to_attempt} questions.</p>}
          </div>
          <div className="divide-y divide-[#EEF1F5]">
            {items.filter((item) => item.section_id === section.id).map((item, index) => {
              const question = item.question_snapshot || {};
              const options = [...(question.options || [])].sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
              return (
                <article key={item.id} className="py-5">
                  <p className="font-semibold leading-7 text-[#14232B]">{index + 1}. {String(question.stem_text || '')}</p>
                  {question.stem_latex && <div className="mt-2 overflow-x-auto"><BlockMath math={question.stem_latex} /></div>}
                  {question.question_image_url && <img src={question.question_image_url} alt="Question" className="mt-3 max-h-80 max-w-full rounded-xl object-contain" />}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {options.map((option) => (
                      <div key={option.option_key} className="rounded-xl border border-[#E7ECEB] px-3 py-2.5 text-sm text-[#14232B]">
                        <strong className="mr-2">{option.option_key}.</strong>{option.content_text || ''}
                        {option.content_latex && <span className="ml-2"><InlineMath math={option.content_latex} /></span>}
                        {option.image_url && <img src={option.image_url} alt={`Option ${option.option_key}`} className="mt-2 max-h-36 max-w-56 object-contain" />}
                      </div>
                    ))}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
