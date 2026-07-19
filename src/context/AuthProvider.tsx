"use client";

import { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Profile = { id: string; full_name: string | null; username: string | null; role: string; phone: string | null };
type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  configured: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const loadProfile = async (userId?: string) => {
    if (!supabase || !userId) { setProfile(null); return; }
    const { data } = await supabase.from("profiles").select("id,full_name,username,role,phone").eq("id", userId).maybeSingle();
    setProfile(data ?? null);
  };

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user.id).finally(() => setLoading(false));
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      loadProfile(next?.user.id);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(() => ({
    user: session?.user ?? null,
    session,
    profile,
    loading,
    configured: isSupabaseConfigured,
    signOut: async () => { if (supabase) await supabase.auth.signOut(); setSession(null); setProfile(null); },
    refreshProfile: async () => loadProfile(session?.user.id),
  }), [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
