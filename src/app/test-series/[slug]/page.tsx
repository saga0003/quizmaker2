import { requirePhase1PublicFeature } from '@/lib/phase1PublicGate';
import { redirect } from 'next/navigation';
export default async function Page({params}:{params:Promise<{slug:string}>}){requirePhase1PublicFeature('publicTestSeries');const{slug}=await params;redirect(`/products/${slug}/`)}
