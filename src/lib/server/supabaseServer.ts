import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isPublicSupabaseConfigured = Boolean(supabaseUrl && publicKey);
export const isServerSupabaseReady = Boolean(
  isPublicSupabaseConfigured && serviceKey,
);

// Backward-compatible cloud-mode guard used by earlier API routes. It is true
// whenever the browser is configured for Supabase, ensuring a missing server key
// fails closed in authenticateRequest instead of silently selecting demo data.
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
    throw Object.assign(new Error("Evidara cloud is partially configured. Add the server service-role key before using authenticated cloud operations."), { status: 503 });
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
