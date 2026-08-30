import { supabase } from "@/lib/supabase";

export async function uploadQuestionAsset(file: Blob, fileName: string, purpose = "questions") {
  if (!supabase) throw new Error("Supabase sign-in is required before uploading question images.");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error(error?.message ?? "Sign in again before uploading question images.");

  const form = new FormData();
  form.append("file", file, fileName);
  form.append("purpose", purpose);
  const response = await fetch("/api/question-assets/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}` },
    body: form,
  });
  const payload = await response.json().catch(() => ({})) as { publicUrl?: string; key?: string; error?: string };
  if (!response.ok || !payload.publicUrl) throw new Error(payload.error || `Image upload failed (${response.status}).`);
  return { publicUrl: payload.publicUrl, key: payload.key || "" };
}
