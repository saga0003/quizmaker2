"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/AuthProvider";

export function useQuestionScope(kind: "admin" | "school") {
  const { user, configured } = useAuth();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState<string>(kind === "admin" ? "ScholarOS Master Bank" : "School Question Bank");
  const [loading, setLoading] = useState(kind === "school" && configured);
  const [error, setError] = useState("");

  useEffect(() => {
    if (kind === "admin") { setLoading(false); return; }
    if (!supabase || !user) { setLoading(false); return; }
    supabase
      .from("organization_members")
      .select("organization_id,organizations(name)")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (queryError) setError(queryError.message);
        const row = data as { organization_id?: string; organizations?: { name?: string } | { name?: string }[] | null } | null;
        setOrganizationId(row?.organization_id ?? null);
        const org = Array.isArray(row?.organizations) ? row?.organizations[0] : row?.organizations;
        if (org?.name) setOrganizationName(org.name);
        setLoading(false);
      });
  }, [kind, user]);

  return { organizationId, organizationName, loading, error };
}
