import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type AchievementTier = "bronze" | "silver" | "gold" | "platinum";
export type AchievementStatus = "active" | "revoked";

export type AchievementDefinition = {
  code: string;
  title: string;
  description: string;
  category: "milestone" | "performance" | "growth" | "consistency" | "integrity" | "benchmark";
  tier: AchievementTier;
  icon_key: string;
  rule_version: string;
  criteria: Record<string, unknown>;
  certificate_eligible: boolean;
  display_order: number;
};

export type AchievementCertificate = {
  id: string;
  achievement_id: string;
  certificate_number: string;
  verification_code: string;
  status: AchievementStatus;
  issued_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
};

export type StudentAchievement = {
  id: string;
  student_id: string;
  organization_id: string;
  definition_code: string;
  rule_version: string;
  source_type: string;
  source_id: string | null;
  evidence: Record<string, unknown>;
  status: AchievementStatus;
  awarded_at: string;
  last_evaluated_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
  definition: AchievementDefinition;
  certificate: AchievementCertificate | null;
};

export type SchoolAchievementRow = StudentAchievement & {
  student_name: string;
  student_email: string | null;
};

export type AchievementGovernanceRow = AchievementDefinition & {
  active_awards: number;
  revoked_awards: number;
  active_certificates: number;
};

export type PublicCertificate = {
  certificate_number: string;
  verification_code: string;
  student_name: string;
  organization_name: string;
  achievement_title: string;
  achievement_description: string;
  rule_version: string;
  evidence_summary: string;
  issued_at: string;
  status: AchievementStatus;
  revoked_at: string | null;
  revoked_reason: string | null;
};

async function accessToken() {
  if (!isSupabaseConfigured || !supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export async function achievementRequest<T>(path = "", options: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`/api/achievements${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json() as T & { error?: string; details?: string | null };
  if (!response.ok) throw new Error(payload.error || payload.details || "Achievement request failed.");
  return payload;
}
