import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/supabaseServer";
import { isPlatformAdmin, isSchoolStaff, normalizeEvidaraRole } from "@/lib/roles";
import { uploadQuestionAssetToR2 } from "@/lib/server/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  const value = error as { message?: string; status?: number };
  return NextResponse.json(
    { error: value.message ?? "Unable to upload the question image." },
    { status: value.status ?? 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const { data: profile, error: profileError } = await auth.admin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();
    if (profileError || !profile) {
      throw Object.assign(new Error(profileError?.message ?? "Evidara profile not found."), { status: 403 });
    }
    const role = normalizeEvidaraRole(profile.role);
    if (!isPlatformAdmin(role) && !isSchoolStaff(role)) {
      throw Object.assign(new Error("Teacher or administrator permission is required to upload question images."), { status: 403 });
    }

    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose") ?? "questions").slice(0, 50);
    if (!(file instanceof File)) {
      throw Object.assign(new Error("Choose an image file to upload."), { status: 400 });
    }

    const result = await uploadQuestionAssetToR2({
      bytes: new Uint8Array(await file.arrayBuffer()),
      contentType: file.type,
      originalName: file.name,
      userId: auth.user.id,
      purpose,
    });
    return NextResponse.json(
      { ok: true, ...result },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
