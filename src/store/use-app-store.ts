import { create } from 'zustand';

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

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

interface AppState {
  view: AppView;
  user: User | null;
  sidebarOpen: boolean;
  setView: (view: AppView) => void;
  login: (role: 'student' | 'school' | 'admin') => void;
  logout: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  view: 'landing',
  user: null,
  sidebarOpen: true,
  setView: (view) => set({ view }),
  login: (role) => {
    const users: Record<string, User> = {
      student: { id: 's1', name: 'Aarav Sharma', email: 'aarav@greenvalley.edu', role: 'student' },
      school: { id: 'sc1', name: 'Green Valley High', email: 'admin@greenvalley.edu', role: 'school' },
      admin: { id: 'a1', name: 'Evidara Admin', email: 'admin@evidara.com', role: 'admin' },
    };
    const user = users[role];
    const defaultView: Record<string, AppView> = {
      student: 'student-dashboard',
      school: 'school-dashboard',
      admin: 'admin-dashboard',
    };
    set({ user, view: defaultView[role], sidebarOpen: true });
  },
  logout: () => set({ user: null, view: 'landing' }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));