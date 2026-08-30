import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
const supabaseKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://evidara.natscix.com').replace(/\/$/, '');

function client() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function publicRpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
  const supabase = client();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return null;
  return data as T;
}

export function money(paise: number | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(paise || 0) / 100);
}

export function textFromLatex(text?: string | null, latex?: string | null) {
  return (text || latex || '').trim();
}
