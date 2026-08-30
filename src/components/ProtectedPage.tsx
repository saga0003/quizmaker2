"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { canAccessWorkspace, type EvidaraWorkspace, workspaceHome } from "@/lib/accessControl";
import { normalizeEvidaraRole } from "@/lib/roles";

export function ProtectedPage({ allowed, superAdminOnly = false, children }: { allowed: EvidaraWorkspace; superAdminOnly?: boolean; children: React.ReactNode }) {
  const { loading, user, profile, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!configured || loading) return;
    if (!user) {
      localStorage.setItem("evidara_after_login", window.location.pathname);
      localStorage.setItem("scholaros_after_login", window.location.pathname);
      router.replace("/login/");
      return;
    }
    if (!profile) return;
    if (!canAccessWorkspace(profile.role, allowed)) { router.replace(workspaceHome(profile.role)); return; }
    if (superAdminOnly && normalizeEvidaraRole(profile.role) !== "super_admin") router.replace(workspaceHome(profile.role));
  }, [allowed, configured, loading, profile, router, superAdminOnly, user]);

  const blocked = configured && profile && (
    !canAccessWorkspace(profile.role, allowed) ||
    (superAdminOnly && normalizeEvidaraRole(profile.role) !== "super_admin")
  );

  if (configured && (loading || !user || !profile || blocked)) {
    return (
      <main style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
        <div className="so-card so-pad">Checking your Evidara access…</div>
      </main>
    );
  }

  return <>{children}</>;
}
