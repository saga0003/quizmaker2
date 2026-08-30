import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const anon = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    !value ||
    normalized === "[sensitive]" ||
    normalized.includes("your-project") ||
    normalized.includes("your-anon-key") ||
    normalized.includes("your_supabase") ||
    normalized.includes("paste_") ||
    normalized.includes("replace_me")
  );
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(
  !isPlaceholder(url) &&
  !isPlaceholder(anon) &&
  isValidHttpUrl(url),
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url, anon, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
