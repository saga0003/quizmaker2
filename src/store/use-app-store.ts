'use client';

import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  normalizeEvidaraRole,
  type EvidaraRole,
} from '@/lib/roles';

export type UserRole = 'student' | 'school' | 'admin' | null;
export type AppView =
  | 'landing'
  | 'login'
  | 'register-school'
  | 'student-dashboard'
  | 'student-tests'
  | 'student-analytics'
  | 'student-results'
  | 'student-achievements'
  | 'student-benchmarks'
  | 'student-resources'
  | 'student-purchases'
  | 'school-dashboard'
  | 'school-questions'
  | 'school-papers'
  | 'school-students'
  | 'school-subscription'
  | 'school-resources'
  | 'school-achievements'
  | 'school-benchmarks'
  | 'school-segments'
  | 'admin-dashboard'
  | 'admin-questions'
  | 'admin-papers'
  | 'admin-products'
  | 'admin-subscriptions'
  | 'admin-achievements'
  | 'admin-benchmarks'
  | 'admin-segments';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Exclude<UserRole, null>;
  accessRole: EvidaraRole;
  avatar?: string;
}

export function cloudRoleToV7Role(role?: string | null): Exclude<UserRole, null> {
  const normalized = normalizeEvidaraRole(role);
  if (normalized === 'super_admin' || normalized === 'evidara_admin') return 'admin';
  if (normalized === 'school_admin' || normalized === 'school_teacher') return 'school';
  return 'student';
}

export function defaultViewForRole(role: Exclude<UserRole, null>): AppView {
  if (role === 'admin') return 'admin-dashboard';
  if (role === 'school') return 'school-dashboard';
  return 'student-dashboard';
}

interface AppState {
  view: AppView;
  user: AppUser | null;
  sidebarOpen: boolean;
  authReady: boolean;
  setView: (view: AppView) => void;
  setCloudUser: (user: AppUser | null) => void;
  setAuthReady: (ready: boolean) => void;
  login: (role: 'student' | 'school' | 'admin') => void;
  logout: () => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'landing',
  user: null,
  sidebarOpen: true,
  authReady: !isSupabaseConfigured,
  setView: (view) => set({ view }),
  setCloudUser: (user) => {
    if (!user) {
      set({ user: null, view: 'landing', sidebarOpen: true });
      return;
    }
    const current = get();
    const sameIdentity =
      current.user?.id === user.id &&
      current.user?.role === user.role &&
      current.user?.accessRole === user.accessRole;
    const authenticatedView = !['landing', 'login', 'register-school'].includes(current.view);
    set({
      user,
      view: sameIdentity && authenticatedView ? current.view : defaultViewForRole(user.role),
      sidebarOpen: true,
    });
  },
  setAuthReady: (authReady) => set({ authReady }),
  login: (role) => {
    if (isSupabaseConfigured) return;
    const users: Record<Exclude<UserRole, null>, AppUser> = {
      student: {
        id: 'demo-student',
        name: 'Aarav Sharma',
        email: 'aarav@greenvalley.edu',
        role: 'student',
        accessRole: 'student',
      },
      school: {
        id: 'demo-school',
        name: 'Green Valley High',
        email: 'admin@greenvalley.edu',
        role: 'school',
        accessRole: 'school_admin',
      },
      admin: {
        id: 'demo-admin',
        name: 'Evidara Admin',
        email: 'admin@evidara.com',
        role: 'admin',
        accessRole: 'super_admin',
      },
    };
    set({ user: users[role], view: defaultViewForRole(role), sidebarOpen: true, authReady: true });
  },
  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ user: null, view: 'landing', sidebarOpen: true, authReady: true });
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
