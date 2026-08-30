'use client';

import { useEffect, useState, type ElementType } from 'react';
import { useAppStore, type AppView } from '@/store/use-app-store';
import { supabase } from '@/lib/supabase';
import { evidaraRoleLabel } from '@/lib/roles';
import { useModuleAccess } from '@/hooks/use-module-access';
import type { EvidaraModuleKey } from '@/lib/modules';
import { phase1AllowsWorkspaceView } from '@/config/phase1-launch';
import { LoginAsSwitcher } from '@/components/evidara/login-as-switcher';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart3,
  BookOpen,
  BookOpenCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileQuestion,
  FileText,
  FolderOpen,
  History,
  Landmark,
  Sparkles,
  Layers3,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
  Share2,
  Users,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: ElementType;
  view: AppView;
  moduleKey?: EvidaraModuleKey;
}

interface NavGroup {
  label: string;
  icon: ElementType;
  moduleKey?: EvidaraModuleKey;
  children: NavItem[];
}

type NavEntry = NavItem | NavGroup;

const studentAnalytics: NavGroup = {
  label: 'Analytics',
  icon: BarChart3,
  moduleKey: 'analytics',
  children: [
    { label: 'Overview', icon: LayoutDashboard, view: 'student-analytics-overview', moduleKey: 'analytics' },
    { label: 'Subject Analysis', icon: BookOpenCheck, view: 'student-analytics-subject', moduleKey: 'analytics' },
    { label: 'Chapter Analysis', icon: Layers3, view: 'student-analytics-chapter', moduleKey: 'analytics' },
    { label: 'Topic Analysis', icon: FileQuestion, view: 'student-analytics-topic', moduleKey: 'analytics' },
    { label: 'Revision Priorities', icon: ListChecks, view: 'student-analytics-priorities', moduleKey: 'analytics' },
    { label: 'Test History', icon: History, view: 'student-analytics-history', moduleKey: 'analytics' },
  ],
};

const schoolAnalytics: NavItem = {
  label: 'Analytics',
  icon: BarChart3,
  view: 'school-analytics-overview',
  moduleKey: 'analytics',
};

const studentNav: NavEntry[] = [
  { label: 'Dashboard', icon: LayoutDashboard, view: 'student-dashboard' },
  studentAnalytics,
  { label: 'Tests', icon: BookOpen, view: 'student-tests', moduleKey: 'papers' },
  { label: 'Results', icon: ListChecks, view: 'student-results', moduleKey: 'analytics' },
  { label: 'Self Assessment', icon: Sparkles, view: 'student-self-assessment', moduleKey: 'papers' },
  { label: 'Resources', icon: FolderOpen, view: 'student-resources', moduleKey: 'resources' },
  { label: 'Store', icon: Package, view: 'student-store', moduleKey: 'subscriptions' },
  { label: 'Purchases', icon: ShoppingBag, view: 'student-purchases', moduleKey: 'subscriptions' },
  { label: 'Refer & Earn', icon: Share2, view: 'student-referrals', moduleKey: 'subscriptions' },
];

const schoolNav: NavEntry[] = [
  { label: 'Dashboard', icon: LayoutDashboard, view: 'school-dashboard' },
  schoolAnalytics,
  { label: 'Questions', icon: BookOpen, view: 'school-questions', moduleKey: 'questions' },
  { label: 'Papers', icon: FileText, view: 'school-papers', moduleKey: 'papers' },
  { label: 'Students', icon: Users, view: 'school-students', moduleKey: 'students' },
  { label: 'Product Store', icon: Package, view: 'school-store', moduleKey: 'subscriptions' },
  { label: 'Entitlements', icon: ShoppingBag, view: 'school-entitlements', moduleKey: 'subscriptions' },
  { label: 'Seat Management', icon: Users, view: 'school-product-seats', moduleKey: 'subscriptions' },
  { label: 'Subscription', icon: CreditCard, view: 'school-subscription', moduleKey: 'subscriptions' },
  { label: 'Resources', icon: FolderOpen, view: 'school-resources', moduleKey: 'resources' },
  { label: 'Access Control', icon: ShieldCheck, view: 'school-access' },
];

const adminNav: NavEntry[] = [
  { label: 'Command Centre', icon: LayoutDashboard, view: 'admin-dashboard' },
  { label: 'Analytics', icon: BarChart3, view: 'admin-analytics', moduleKey: 'analytics' },
  { label: 'Questions', icon: BookOpen, view: 'admin-questions', moduleKey: 'questions' },
  { label: 'Papers', icon: FileText, view: 'admin-papers', moduleKey: 'papers' },
  { label: 'Products', icon: Package, view: 'admin-products', moduleKey: 'subscriptions' },
  { label: 'Institutions', icon: Landmark, view: 'admin-institutions', moduleKey: 'students' },
  { label: 'Subscriptions', icon: CreditCard, view: 'admin-subscriptions', moduleKey: 'subscriptions' },
  { label: 'Resources', icon: FolderOpen, view: 'admin-resources', moduleKey: 'resources' },
  { label: 'Referral Settings', icon: Share2, view: 'admin-referrals', moduleKey: 'subscriptions' },
  { label: 'Self Assessment', icon: Sparkles, view: 'admin-self-assessment', moduleKey: 'papers' },
  { label: 'Access & Accounts', icon: ShieldCheck, view: 'admin-access' },
];

function isGroup(entry: NavEntry): entry is NavGroup {
  return 'children' in entry;
}

function navigationForUser(role: 'student' | 'school' | 'admin', accessRole: string) {
  let source = role === 'student' ? studentNav : role === 'school' ? schoolNav : adminNav;
  if (role === 'school') {
    source = source.map((entry) => {
      if (isGroup(entry)) return entry;
      if (entry.view === 'school-questions') return { ...entry, label: accessRole === 'school_teacher' ? 'My Questions' : 'School Questions' };
      return entry;
    });
    if (accessRole === 'school_teacher') {
      source = source.filter((entry) => isGroup(entry) || !['school-subscription', 'school-access'].includes(entry.view));
    }
  }
  return source
    .map((entry) => isGroup(entry) ? { ...entry, children: entry.children.filter((item) => phase1AllowsWorkspaceView(accessRole, item.view)) } : entry)
    .filter((entry) => isGroup(entry) ? entry.children.length > 0 : phase1AllowsWorkspaceView(accessRole, entry.view));
}

export function AppSidebar() {
  const { user, view, setView, logout, sidebarOpen, setSidebarOpen } = useAppStore();
  const { canAccess } = useModuleAccess();
  const [analyticsOpen, setAnalyticsOpen] = useState(view.includes('-analytics-'));
  const [schoolEnrolledStudent, setSchoolEnrolledStudent] = useState(false);

  useEffect(() => {
    if (view.includes('-analytics-')) setAnalyticsOpen(true);
  }, [view]);

  useEffect(() => {
    if (user?.role !== 'student' || !supabase) { setSchoolEnrolledStudent(false); return; }
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('student_school_memberships').select('id').eq('student_id', user.id).eq('status', 'active').limit(1).maybeSingle();
      if (!cancelled) setSchoolEnrolledStudent(Boolean(data));
    })();
    return () => { cancelled = true; };
  }, [user?.id, user?.role]);


  if (!user) return null;

  const nav = navigationForUser(user.role, user.accessRole)
    .filter((entry) => !(schoolEnrolledStudent && !isGroup(entry) && entry.view === 'student-referrals'))
    .filter((entry) => canAccess(entry.moduleKey))
    .map((entry) => isGroup(entry) ? { ...entry, children: entry.children.filter((item) => canAccess(item.moduleKey)) } : entry)
    .filter((entry) => !isGroup(entry) || entry.children.length > 0);
  const roleLabel = evidaraRoleLabel(user.accessRole);

  function itemButton(item: NavItem, nested = false) {
    const isActive = view === item.view;
    const Icon = item.icon;
    const button = (
      <button
        key={item.view}
        onClick={() => setView(item.view)}
        className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
          nested ? 'pl-7 text-[12px]' : ''
        } ${
          isActive
            ? 'bg-[var(--teal)] text-white shadow-sm'
            : 'text-white/55 hover:bg-white/6 hover:text-white'
        } ${
          !sidebarOpen ? 'justify-center px-0' : ''
        }`}
      >
        <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-white/40 group-hover:text-white'}`} />
        {sidebarOpen && <span>{item.label}</span>}
        {isActive && sidebarOpen && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />}
      </button>
    );
    if (!sidebarOpen) {
      return (
        <Tooltip key={item.view} delayDuration={0}>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" className="text-xs font-medium">{item.label}</TooltipContent>
        </Tooltip>
      );
    }
    return button;
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-[var(--midnight)] text-white transition-all duration-200 ${
        sidebarOpen ? 'w-[260px]' : 'w-[64px]'
      }`}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between px-3">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <img src="/brand/evidara-logo-light.png" alt="Evidara" className="h-7 w-auto" />
          </div>
        )}
        {!sidebarOpen && (
          <img src="/brand/evidara-emblem.png" alt="Evidara" className="mx-auto h-7 w-7" />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-7 w-7 shrink-0 text-white/50 hover:bg-white/10 hover:text-white"
        >
          {sidebarOpen ? <ChevronLeft className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <Separator className="bg-white/8" />

      {/* Role label */}
      {sidebarOpen && (
        <div className="px-3 pb-1 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
            {roleLabel}
          </span>
        </div>
      )}

      {/* Navigation */}
      <ScrollArea className="flex-1 px-1.5 py-1">
        <nav className="flex flex-col gap-0.5">
          {nav.map((entry) => {
            if (!isGroup(entry)) return itemButton(entry);
            const Icon = entry.icon;
            const active = entry.children.some((item) => item.view === view);
            return (
              <div key={entry.label} className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => {
                    if (!sidebarOpen) setView(entry.children[0].view);
                    else setAnalyticsOpen((current) => !current);
                  }}
                  className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                    active ? 'text-white' : 'text-white/55 hover:bg-white/6 hover:text-white'
                  } ${!sidebarOpen ? 'justify-center px-0' : ''}`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--amber)]' : 'text-white/40 group-hover:text-white'}`} />
                  {sidebarOpen && (
                    <>
                      <span>{entry.label}</span>
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </button>
                {sidebarOpen && analyticsOpen && (
                  <div className="space-y-0.5 border-l border-white/8 pl-1">
                    {entry.children.map((item) => itemButton(item, true))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {sidebarOpen && (
        <div className="px-3 py-3">
          <LoginAsSwitcher />
        </div>
      )}

      <Separator className="bg-white/8" />

      {/* User footer */}
      <div className="p-2">
        {sidebarOpen ? (
          <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
            <Avatar className="h-7 w-7 shrink-0">
              <AvatarFallback className="bg-[var(--teal)] text-[10px] font-semibold text-white">
                {user.name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
              <p className="truncate text-[11px] text-white/40">{roleLabel}</p>
            </div>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void logout()}
                  className="h-7 w-7 shrink-0 text-white/30 hover:bg-white/10 hover:text-[var(--error)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">Sign Out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void logout()}
                className="mx-auto flex text-white/30 hover:bg-white/10 hover:text-[var(--error)]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Sign Out</TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
