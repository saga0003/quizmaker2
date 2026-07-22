import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/supabaseServer";
import { isPlatformAdmin, normalizeEvidaraRole } from "@/lib/roles";

function failure(error: unknown) {
  const value = error as { message?: string; status?: number };
  return NextResponse.json(
    { error: value.message ?? "Unable to review the question." },
    { status: value.status ?? 500, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    const body = await request.json() as { questionId?: string; status?: string };
    const questionId = String(body.questionId ?? "");
    const status = String(body.status ?? "");

    if (!questionId || !["approved", "rejected"].includes(status)) {
      throw Object.assign(new Error("A question and an approved or rejected decision are required."), { status: 400 });
    }

    const { data: profile, error: profileError } = await auth.admin
      .from("profiles")
      .select("id,role")
      .eq("id", auth.user.id)
      .single();
    if (profileError || !profile) {
      throw Object.assign(new Error(profileError?.message ?? "Evidara profile not found."), { status: 403 });
    }

    const role = normalizeEvidaraRole(profile.role);
    const platformAdmin = isPlatformAdmin(role);
    if (!platformAdmin && role !== "school_admin") {
      throw Object.assign(new Error("School Admin permission is required to approve or reject school questions."), { status: 403 });
    }

    const { data: question, error: questionError } = await auth.admin
      .from("questions")
      .select("id,organization_id,status")
      .eq("id", questionId)
      .single();
    if (questionError || !question) {
      throw Object.assign(new Error(questionError?.message ?? "Question not found."), { status: 404 });
    }

    if (!platformAdmin) {
      if (!question.organization_id) {
        throw Object.assign(new Error("School Admins cannot change Evidara master-bank questions."), { status: 403 });
      }
      const { data: membership, error: membershipError } = await auth.admin
        .from("organization_members")
        .select("organization_id,member_role")
        .eq("user_id", auth.user.id)
        .eq("organization_id", question.organization_id)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
      if (membershipError || !membership) {
        throw Object.assign(new Error(membershipError?.message ?? "This question does not belong to your linked school."), { status: 403 });
      }
      if (!["institute_owner", "institute_admin", "school_owner", "school_admin"].includes(membership.member_role)) {
        throw Object.assign(new Error("The linked school membership is not allowed to review questions."), { status: 403 });
      }
    }

    const { error: updateError } = await auth.admin
      .from("questions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", questionId);
    if (updateError) throw new Error(updateError.message);

    await auth.admin.from("audit_logs").insert({
      actor_id: auth.user.id,
      organization_id: question.organization_id,
      action: `question.${status}`,
      entity_type: "question",
      entity_id: questionId,
      metadata: { previous_status: question.status, interface: "v7" },
    });

    return NextResponse.json(
      { ok: true, questionId, status },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
