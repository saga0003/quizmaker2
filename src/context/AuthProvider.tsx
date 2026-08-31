"use client";

import { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string | null; username: string | null; role: string; phone: string | null };
export type InstitutionMembership = {
  organizationId: string;
  organizationName: string;
  memberRole: string;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  institutionMemberships: InstitutionMembership[];
  activeOrganizationId: string | null;
  activeInstitution: InstitutionMembership | null;
  requiresInstitutionSelection: boolean;
  membershipsLoading: boolean;
  setActiveOrganizationId: (organizationId: string | null) => void;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

function activeInstitutionStorageKey(userId: string) {
  return `evidara:active-organization:${userId}`;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [institutionMemberships, setInstitutionMemberships] = useState<InstitutionMembership[]>([]);
  const [activeOrganizationId, setActiveOrganizationIdState] = useState<string | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = async (userId?: string) => {
    if (!supabase || !userId) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("id,full_name,username,role,phone").eq("id", userId).maybeSingle();
    setProfile(data ?? null);
  };

  const loadInstitutionMemberships = async (userId?: string) => {
    if (!supabase || !userId) {
      setInstitutionMemberships([]);
      setActiveOrganizationIdState(null);
      return;
    }
    setMembershipsLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from("organization_members")
        .select("organization_id,member_role,is_active")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (error) throw error;

      const activeRows = (rows || []).filter((row) => Boolean(row.organization_id));
      const ids = [...new Set(activeRows.map((row) => String(row.organization_id)))];
      let names = new Map<string, string>();
      if (ids.length) {
        const { data: organizations } = await supabase.from("organizations").select("id,name").in("id", ids);
        names = new Map((organizations || []).map((row) => [String(row.id), String(row.name || row.id)]));
      }
      const memberships = activeRows.map((row) => ({
        organizationId: String(row.organization_id),
        organizationName: names.get(String(row.organization_id)) || `Institution ${String(row.organization_id).slice(0, 8)}`,
        memberRole: String(row.member_role || "staff"),
      }));
      setInstitutionMemberships(memberships);

      const stored = typeof window === "undefined" ? null : window.localStorage.getItem(activeInstitutionStorageKey(userId));
      const storedIsValid = stored ? memberships.some((membership) => membership.organizationId === stored) : false;
      if (memberships.length === 1) {
        setActiveOrganizationIdState(memberships[0].organizationId);
      } else if (storedIsValid) {
        setActiveOrganizationIdState(stored);
      } else {
        // Multi-institution staff must make an explicit choice. Never silently use the first membership.
        setActiveOrganizationIdState(null);
      }
    } catch {
      setInstitutionMemberships([]);
      setActiveOrganizationIdState(null);
    } finally {
      setMembershipsLoading(false);
    }
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      Promise.all([
        loadProfile(data.session?.user.id),
        loadInstitutionMemberships(data.session?.user.id),
      ]).finally(() => setLoading(false));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadProfile(next?.user.id);
      void loadInstitutionMemberships(next?.user.id);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const setActiveOrganizationId = (organizationId: string | null) => {
    const userId = session?.user.id;
    if (!organizationId) {
      setActiveOrganizationIdState(null);
      if (userId && typeof window !== "undefined") window.localStorage.removeItem(activeInstitutionStorageKey(userId));
      return;
    }
    if (!institutionMemberships.some((membership) => membership.organizationId === organizationId)) return;
    setActiveOrganizationIdState(organizationId);
    if (userId && typeof window !== "undefined") window.localStorage.setItem(activeInstitutionStorageKey(userId), organizationId);
  };

  const activeInstitution = institutionMemberships.find((membership) => membership.organizationId === activeOrganizationId) || null;
  const requiresInstitutionSelection = institutionMemberships.length > 1 && !activeOrganizationId;

  const value = useMemo<AuthValue>(() => ({
    user: session?.user ?? null,
    session,
    profile,
    institutionMemberships,
    activeOrganizationId,
    activeInstitution,
    requiresInstitutionSelection,
    membershipsLoading,
    setActiveOrganizationId,
    loading,
    configured: isSupabaseConfigured,
    signOut: async () => {
      if (supabase) await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setInstitutionMemberships([]);
      setActiveOrganizationIdState(null);
    },
    refreshProfile: async () => {
      await Promise.all([loadProfile(session?.user.id), loadInstitutionMemberships(session?.user.id)]);
    },
  }), [session, profile, institutionMemberships, activeOrganizationId, activeInstitution, requiresInstitutionSelection, membershipsLoading, loading]);

  const institutionSelector = session && institutionMemberships.length > 1 ? (
    <div className={requiresInstitutionSelection
      ? "fixed inset-0 z-[100] grid place-items-center bg-[#14232B]/70 px-4 backdrop-blur-sm"
      : "fixed right-4 top-3 z-[90] rounded-lg border border-[#D7E2E3] bg-white px-3 py-2 shadow-lg"}
    >
      <div className={requiresInstitutionSelection ? "w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" : "min-w-[240px]"}>
        <label htmlFor="evidara-active-institution" className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-[#607078]">
          Active institution
        </label>
        {requiresInstitutionSelection && (
          <>
            <h2 className="mt-2 text-xl font-bold text-[#14232B]">Choose the school you are working in</h2>
            <p className="mt-1 text-sm leading-6 text-[#607078]">This account belongs to more than one institution. Evidara will not open or change school data until you choose the active institution.</p>
          </>
        )}
        <select
          id="evidara-active-institution"
          value={activeOrganizationId || ""}
          onChange={(event) => setActiveOrganizationId(event.target.value || null)}
          className="mt-3 w-full rounded-lg border border-[#C9D5D7] bg-white px-3 py-2 text-sm font-medium text-[#14232B] outline-none focus:border-[#0E7773] focus:ring-2 focus:ring-[#0E7773]/15"
          aria-required="true"
        >
          <option value="">Choose institution…</option>
          {institutionMemberships.map((membership) => (
            <option key={membership.organizationId} value={membership.organizationId}>{membership.organizationName}</option>
          ))}
        </select>
        {requiresInstitutionSelection && <p className="mt-3 text-xs text-[#607078]">Your choice is remembered only for this signed-in account and is revalidated against current memberships each session.</p>}
      </div>
    </div>
  ) : null;

  return (
    <AuthContext.Provider value={value}>
      {children}
      {institutionSelector}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
