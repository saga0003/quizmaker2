'use client';

import { create } from 'zustand';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import {
  evidaraRoleLabel,
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
  | 'student-results'
  | 'student-analytics-overview'
  | 'student-analytics-subject'
  | 'student-analytics-chapter'
  | 'student-analytics-topic'
  | 'student-analytics-question-intelligence'
  | 'student-analytics-priorities'
  | 'student-analytics-history'
  | 'student-resources'
  | 'student-store'
  | 'student-purchases'
  | 'student-referrals'
  | 'student-self-assessment'
  | 'school-dashboard'
  | 'school-analytics-overview'
  | 'school-analytics-subject'
  | 'school-analytics-chapter'
  | 'school-analytics-topic'
  | 'school-analytics-question-intelligence'
  | 'school-analytics-priorities'
  | 'school-analytics-history'
  | 'school-questions'
  | 'school-papers'
  | 'school-students'
  | 'school-store'
  | 'school-entitlements'
  | 'school-product-seats'
  | 'school-subscription'
  | 'school-resources'
  | 'school-access'
  | 'admin-dashboard'
  | 'admin-analytics'
  | 'admin-questions'
  | 'admin-papers'
  | 'admin-products'
  | 'admin-subscriptions'
  | 'admin-institutions'
  | 'admin-resources'
  | 'admin-referrals'
  | 'admin-self-assessment'
  | 'admin-access';

export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Exclude<UserRole, null>;
  accessRole: EvidaraRole;
  avatar?: string;
}

type PreviewIdentity = {
  id?: string;
  name?: string;
  email?: string;
};

export function cloudRoleToWorkspaceRole(role?: string | null): Exclude<UserRole, null> {
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
  baseUser: AppUser | null;
  impersonatingAs: EvidaraRole | null;
  impersonatedUser: AppUser | null;
  sidebarOpen: boolean;
  authReady: boolean;
  setView: (view: AppView) => void;
  setCloudUser: (user: AppUser | null) => void;
  setAuthReady: (ready: boolean) => void;
  login: (role: 'student' | 'school' | 'admin') => void;
  loginAs: (role: Exclude<EvidaraRole, 'super_admin'>, identity?: PreviewIdentity) => void;
  exitLoginAs: () => void;
  logout: () => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  view: 'landing',
  user: null,
  baseUser: null,
  impersonatingAs: null,
  impersonatedUser: null,
  sidebarOpen: true,
  authReady: !isSupabaseConfigured,
  setView: (view) => {
    set({ view });
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.pathname = '/';
    url.searchParams.set('view', view);
    url.searchParams.delete('id');
    url.searchParams.delete('create');
    window.history.pushState({ evidaraView: view }, '', `${url.pathname}${url.search}${url.hash}`);
  },
  setCloudUser: (user) => {
    if (!user) {
      set({ user: null, baseUser: null, impersonatingAs: null, impersonatedUser: null, view: 'landing', sidebarOpen: true });
      return;
    }
    const current = get();
    const targetRole = current.baseUser?.id === user.id && current.baseUser.accessRole === 'super_admin'
      ? current.impersonatingAs
      : null;
    const preservedPreview = targetRole && current.impersonatedUser?.accessRole === targetRole
      ? current.impersonatedUser
      : null;
    const effectiveUser = preservedPreview || (targetRole
      ? { ...user, role: cloudRoleToWorkspaceRole(targetRole), accessRole: targetRole, name: `${user.name} · ${evidaraRoleLabel(targetRole)}` }
      : user);
    const sameIdentity =
      current.user?.id === effectiveUser.id &&
      current.user?.role === effectiveUser.role &&
      current.user?.accessRole === effectiveUser.accessRole;
    const authenticatedView = !['landing', 'login', 'register-school'].includes(current.view);
    set({
      user: effectiveUser,
      baseUser: user,
      impersonatingAs: targetRole,
      impersonatedUser: preservedPreview,
      view: sameIdentity && authenticatedView ? current.view : defaultViewForRole(effectiveUser.role),
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
    const selected = users[role];
    set({ user: selected, baseUser: selected, impersonatingAs: null, impersonatedUser: null, view: defaultViewForRole(role), sidebarOpen: true, authReady: true });
  },
  loginAs: (role, identity) => {
    const current = get();
    const baseUser = current.baseUser ?? current.user;
    if (!baseUser || baseUser.accessRole !== 'super_admin') return;
    const workspaceRole = cloudRoleToWorkspaceRole(role);
    const effectiveUser: AppUser = role === 'student' && identity?.id
      ? {
          id: identity.id,
          name: identity.name || 'Demo Student',
          email: identity.email || '',
          role: 'student',
          accessRole: 'student',
        }
      : {
          ...baseUser,
          role: workspaceRole,
          accessRole: role,
          name: `${baseUser.name} · ${evidaraRoleLabel(role)}`,
        };
    set({
      baseUser,
      impersonatingAs: role,
      impersonatedUser: effectiveUser,
      user: effectiveUser,
      view: role === 'student' ? 'student-analytics-overview' : defaultViewForRole(workspaceRole),
      sidebarOpen: true,
    });
  },
  exitLoginAs: () => {
    const current = get();
    const baseUser = current.baseUser;
    if (!baseUser || baseUser.accessRole !== 'super_admin') return;
    set({
      user: baseUser,
      impersonatingAs: null,
      impersonatedUser: null,
      view: defaultViewForRole(baseUser.role),
      sidebarOpen: true,
    });
  },
  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    set({ user: null, baseUser: null, impersonatingAs: null, impersonatedUser: null, view: 'landing', sidebarOpen: true, authReady: true });
  },
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
}));
