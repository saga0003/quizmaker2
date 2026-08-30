import { requirePhase1PublicFeature } from '@/lib/phase1PublicGate';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicSeoShell } from '@/components/seo/PublicSeoShell';
import { publicRpc } from '@/lib/seo-public';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Online Test Series for NEET & JEE | Evidara', description: 'Explore Evidara online test series for NEET, JEE Main, JEE Advanced and subject-wise practice with analytics.' };

type P={slug:string;name:string;exam_type?:string;seo_description?:string};
export default async function TestSeriesPage(){
  requirePhase1PublicFeature('publicTestSeries');
 const products=await publicRpc<P[]>('list_public_products_v15')||[];
 return <PublicSeoShell><section className="mx-auto max-w-6xl px-5 py-12"><p className="font-semibold uppercase tracking-[.18em] text-[#0E7774]">Test Series</p><h1 className="mt-2 text-4xl font-extrabold">Practice built around the exam you are preparing for.</h1><p className="mt-4 max-w-3xl text-[#65757C]">Every published Evidara product gets its own public page automatically. Compare coverage, papers, features and outcomes before signing in.</p><div className="mt-9 grid gap-5 md:grid-cols-2">{products.map(p=><Link key={p.slug} href={`/products/${p.slug}/`} className="rounded-2xl border border-[#DCE5E2] bg-white p-6 shadow-sm transition hover:-translate-y-0.5"><div className="text-xs font-bold uppercase tracking-wider text-[#0E7774]">{p.exam_type||'Evidara'}</div><h2 className="mt-2 text-2xl font-bold">{p.name}</h2><p className="mt-3 text-sm leading-6 text-[#65757C]">{p.seo_description||'View complete test-series details, included tests and access information.'}</p><span className="mt-5 inline-block font-semibold text-[var(--teal)]">View details →</span></Link>)}</div>{!products.length&&<p className="mt-8 rounded-xl bg-white p-6 text-[#65757C]">Published student test series will appear here automatically.</p>}</section></PublicSeoShell>
}
