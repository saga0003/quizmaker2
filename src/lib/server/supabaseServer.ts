import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isServerSupabaseConfigured = Boolean(
  supabaseUrl && publicKey && serviceKey,
);

export function createServiceClient(): SupabaseClient {
  if (!isServerSupabaseConfigured) {
    throw new Error("ScholarOS cloud environment is not configured.");
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createRequestClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !publicKey) {
    throw new Error("ScholarOS public Supabase environment is not configured.");
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
