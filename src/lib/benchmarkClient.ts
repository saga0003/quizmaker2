import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export type CloudBenchmarkPublication = {
  id: string;
  paper_id: string;
  publisher_organization_id: string;
  title: string;
  paper_version: string;
  version_fingerprint: string;
  grade_label: string | null;
  preparation_track: string | null;
  access_code: string;
  status: "draft" | "published" | "closed" | "cancelled";
  privacy_minimum: number;
  privacy_minimum_schools: number;
  small_cell_minimum: number;
  max_violation_count: number;
  opens_at: string | null;
  closes_at: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
};

export type BenchmarkPaperOption = {
  id: string;
  title: string;
  exam_type: string;
  duration_minutes: number;
  total_marks: number;
  total_questions: number;
  status: string;
  updated_at: string;
};

export type CloudBenchmarkSummary = {
  publication_id: string;
  paper_id: string;
  title: string;
  paper_version: string;
  version_fingerprint: string;
  status: string;
  privacy_ready: boolean;
  privacy_minimum: number;
  privacy_minimum_schools: number;
  external_valid_attempts: number;
  external_participating_schools: number | null;
  network_average: number | null;
  network_median: number | null;
  school_attempts: number;
  school_invalid_attempts: number;
  school_average: number | null;
  school_median: number | null;
  school_percentile: number | null;
  distribution: Array<{ label: string; count: number | null; suppressed: boolean }>;
};

export type CloudBenchmarkCohortRow = {
  id: string;
  student_id: string;
  student_name: string;
  score: number;
  maximum_marks: number;
  percentage: number;
  status: string;
  submitted_at: string;
  violation_count: number;
};

async function accessToken() {
  if (!isSupabaseConfigured || !supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

export async function benchmarkRequest<T>(path = "", options: RequestInit = {}): Promise<T> {
  const token = await accessToken();
  const response = await fetch(`/api/benchmarks${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json() as T & { error?: string; details?: string | null };
  if (!response.ok) throw new Error(payload.error || payload.details || "Benchmark request failed.");
  return payload;
}
