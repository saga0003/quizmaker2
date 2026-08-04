"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { canAccessWorkspace, type EvidaraWorkspace, workspaceHome } from "@/lib/accessControl";

export function ProtectedPage({ allowed, children }: { allowed: EvidaraWorkspace; children: React.ReactNode }) {
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
    if (!canAccessWorkspace(profile.role, allowed)) router.replace(workspaceHome(profile.role));
  }, [allowed, configured, loading, profile, router, user]);

  if (configured && (loading || !user || !profile)) {
    return (
      <main style={{ minHeight: "70vh", display: "grid", placeItems: "center" }}>
        <div className="so-card so-pad">Checking your Evidara access…</div>
      </main>
    );
  }

  return <>{children}</>;
}
