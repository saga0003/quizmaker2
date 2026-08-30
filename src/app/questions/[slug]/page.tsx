import { requirePhase1PublicFeature } from '@/lib/phase1PublicGate';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PublicSeoShell } from '@/components/seo/PublicSeoShell';
import { JsonLd } from '@/components/seo/JsonLd';
import { SourceFidelityContent, type SourceFidelityRender } from '@/components/evidara/source-fidelity-content';
import { publicRpc, SITE_URL, textFromLatex } from '@/lib/seo-public';

export const dynamic = 'force-dynamic';
type Q = {
  id:string; slug:string; title:string; description:string; stem_text?:string; stem_latex?:string; question_image_url?:string;
  solution_text?:string; solution_latex?:string; correct_answer:unknown; difficulty?:string; exam_types?:string[]; source_year?:number;
  subject?:string; chapter?:string; topic?:string; metadata?:Record<string,unknown>;
  options?:Array<{option_key:string;content_text?:string;content_latex?:string;image_url?:string}>;
};
async function get(slug:string){const q=await publicRpc<Q>('get_public_question_v15',{p_slug:slug});return q&&q.id?q:null}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const q=await get(slug);if(!q)return{title:'Solved Question | Evidara',robots:{index:false,follow:false}};return{title:q.title,description:q.description,alternates:{canonical:`${SITE_URL}/questions/${q.slug}/`},openGraph:{title:q.title,description:q.description,type:'article'}}}
function v19Render(metadata?:Record<string,unknown>):SourceFidelityRender|null{const value=metadata?.v19_render;return value&&typeof value==='object'&&(value as SourceFidelityRender).mode==='source_fidelity'?(value as SourceFidelityRender):null}
function publicAnswer(value:unknown){const keys=Array.isArray(value)?value.map(String):[String(value??'')];const map:Record<string,string>={A:'1',B:'2',C:'3',D:'4'};return keys.filter(Boolean).map((key)=>map[key]||key).join(', ')}
export default async function Page({params}:{params:Promise<{slug:string}>}){requirePhase1PublicFeature('publicQuestionPages');
  const{slug}=await params;const q=await get(slug);if(!q)notFound();
  const question=textFromLatex(q.stem_text,q.stem_latex);const solution=textFromLatex(q.solution_text,q.solution_latex);const exam=q.exam_types?.[0]||'Exam';
  const source=v19Render(q.metadata);const pageSize=source?.source_pdf_page_size||[612,792];
  return <PublicSeoShell><JsonLd data={{'@context':'https://schema.org','@type':'LearningResource',name:q.title,educationalLevel:q.difficulty,about:[exam,q.subject,q.chapter,q.topic].filter(Boolean),description:q.description}}/>
    <article className="mx-auto max-w-4xl px-5 py-12"><nav className="text-sm text-[#6C7D83]">{[exam,q.subject,q.chapter,q.topic].filter(Boolean).join(' › ')}</nav><h1 className="mt-4 text-3xl font-extrabold">{q.title}</h1>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">{q.source_year?<span className="rounded-full bg-[#EAF3F1] px-3 py-1">{q.source_year}</span>:null}{q.difficulty?<span className="rounded-full bg-[#F2F4F3] px-3 py-1">{q.difficulty}</span>:null}</div>
      <section className="mt-8 rounded-2xl border border-[#DCE5E2] bg-white p-6"><h2 className="text-lg font-bold">Question</h2>
        {source?<div className="mt-4 rounded-xl border border-[#E7ECEB] bg-white p-2"><SourceFidelityContent segments={source.prompt_segments} pageSize={pageSize} label="Previous-year question"/></div>:<><p className="mt-4 whitespace-pre-wrap text-lg leading-8">{question}</p>{q.question_image_url?<img src={q.question_image_url} alt="Question diagram" className="mt-5 max-h-[520px] rounded-xl object-contain"/>:null}<div className="mt-6 space-y-3">{q.options?.map(o=><div key={o.option_key} className="rounded-xl bg-[var(--canvas)] p-4"><b>{o.option_key}.</b> {textFromLatex(o.content_text,o.content_latex)}{o.image_url?<img src={o.image_url} alt={`Option ${o.option_key}`} className="mt-2 max-h-44 object-contain"/>:null}</div>)}</div></>}
      </section>
      <section className="mt-6 rounded-2xl border border-[#B9D9D4] bg-[#EDF7F5] p-6"><h2 className="text-xl font-bold">Answer</h2><p className="mt-3 font-bold">Option {publicAnswer(q.correct_answer)}</p><h2 className="mt-7 text-xl font-bold">Detailed solution</h2>{source?<div className="mt-3 rounded-xl border border-[#CFE3DF] bg-white p-2"><SourceFidelityContent segments={source.solution_segments} pageSize={pageSize} label="Detailed solution"/></div>:<p className="mt-3 whitespace-pre-wrap leading-8 text-[#334B53]">{solution}</p>}</section>
      <section className="mt-8 rounded-2xl bg-[#142F35] p-7 text-white"><h2 className="text-2xl font-bold">Turn this topic into a strength.</h2><p className="mt-2 text-[#D4E2E0]">Practise related questions, take a focused self-assessment, or explore the relevant Evidara test series.</p><div className="mt-5 flex flex-wrap gap-3"><Link href="/products/" className="rounded-lg bg-white px-4 py-2 font-bold text-[#142F35]">Explore test series</Link><Link href="/?view=student-self-assessment" className="rounded-lg border border-white/30 px-4 py-2 font-bold">Create a test</Link></div></section>
    </article></PublicSeoShell>;
}
