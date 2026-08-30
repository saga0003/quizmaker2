import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const publicKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  ""
).trim();
const serviceKey = (
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  ""
).trim();

function isPlaceholder(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    !value ||
    normalized === "[sensitive]" ||
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

export const isPublicSupabaseConfigured = Boolean(
  !isPlaceholder(supabaseUrl) &&
  !isPlaceholder(publicKey) &&
  isValidHttpUrl(supabaseUrl),
);
export const isServerSupabaseReady = Boolean(
  isPublicSupabaseConfigured && !isPlaceholder(serviceKey),
);

// Backward-compatible guard used by existing API routes. A missing server key
// still fails closed in authenticateRequest rather than selecting demo data.
export const isServerSupabaseConfigured = isPublicSupabaseConfigured;

export function createServiceClient(): SupabaseClient {
  if (!isServerSupabaseReady) {
    throw Object.assign(new Error("Evidara server-side Supabase environment is incomplete."), { status: 503 });
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createRequestClient(accessToken: string): SupabaseClient {
  if (!isPublicSupabaseConfigured) {
    throw Object.assign(new Error("Evidara public Supabase environment is not configured."), { status: 503 });
  }
  return createClient(supabaseUrl, publicKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function authenticateRequest(request: Request): Promise<{
  accessToken: string;
  user: User;
  client: SupabaseClient;
  admin: SupabaseClient;
}> {
  if (isPublicSupabaseConfigured && !isServerSupabaseReady) {
    throw Object.assign(
      new Error("Evidara cloud is partially configured. Add the server secret before using authenticated cloud operations."),
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";
  if (!accessToken) {
    throw Object.assign(new Error("Cloud sign-in is required."), { status: 401 });
  }

  const client = createRequestClient(accessToken);
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) {
    throw Object.assign(new Error(error?.message ?? "Invalid cloud session."), { status: 401 });
  }

  return { accessToken, user: data.user, client, admin: createServiceClient() };
}
