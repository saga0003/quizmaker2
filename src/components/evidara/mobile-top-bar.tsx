'use client';

import { useAppStore } from '@/store/use-app-store';
import { evidaraRoleLabel } from '@/lib/roles';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Menu,
  ChevronDown,
  BarChart3,
  BookOpen,
  BookOpenCheck,
  CreditCard,
  FileQuestion,
  FileText,
  FolderOpen,
  History,
  Landmark,
  LogOut,
  Package,
  ShieldCheck,
  ShoppingBag,
  Share2,
  Sparkles,
  Layers3,
  LayoutDashboard,
  ListChecks,
  Users,
} from 'lucide-react';
import { useState, type ElementType } from 'react';
import type { AppView, AppUser } from '@/store/use-app-store';
import type { EvidaraModuleKey } from '@/lib/modules';
import { useModuleAccess } from '@/hooks/use-module-access';
import { phase1AllowsWorkspaceView } from '@/config/phase1-launch';
import { LoginAsSwitcher } from '@/components/evidara/login-as-switcher';

/* ── Navigation definition (mirrors app-sidebar.tsx) ── */

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
  label: 'Analytics', icon: BarChart3, moduleKey: 'analytics',
  children: [
    { label: 'Overview', icon: LayoutDashboard, view: 'student-analytics-overview', moduleKey: 'analytics' },
    { label: 'Subject', icon: BookOpenCheck, view: 'student-analytics-subject', moduleKey: 'analytics' },
    { label: 'Chapter', icon: Layers3, view: 'student-analytics-chapter', moduleKey: 'analytics' },
    { label: 'Topic', icon: FileQuestion, view: 'student-analytics-topic', moduleKey: 'analytics' },
    { label: 'Priorities', icon: ListChecks, view: 'student-analytics-priorities', moduleKey: 'analytics' },
    { label: 'History', icon: History, view: 'student-analytics-history', moduleKey: 'analytics' },
  ],
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
  { label: 'Analytics', icon: BarChart3, view: 'school-analytics-overview', moduleKey: 'analytics' },
  { label: 'Questions', icon: BookOpen, view: 'school-questions', moduleKey: 'questions' },
  { label: 'Papers', icon: FileText, view: 'school-papers', moduleKey: 'papers' },
  { label: 'Students', icon: Users, view: 'school-students', moduleKey: 'students' },
  { label: 'Product Store', icon: Package, view: 'school-store', moduleKey: 'subscriptions' },
  { label: 'Entitlements', icon: ShoppingBag, view: 'school-entitlements', moduleKey: 'subscriptions' },
  { label: 'Seats', icon: Users, view: 'school-product-seats', moduleKey: 'subscriptions' },
  { label: 'Subscription', icon: CreditCard, view: 'school-subscription', moduleKey: 'subscriptions' },
  { label: 'Resources', icon: FolderOpen, view: 'school-resources', moduleKey: 'resources' },
  { label: 'Access', icon: ShieldCheck, view: 'school-access' },
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

function getNavForRole(user: AppUser) {
  let source = user.role === 'student' ? studentNav : user.role === 'school' ? schoolNav : adminNav;
  if (user.role === 'school' && user.accessRole === 'school_teacher') {
    source = source.filter((entry) => isGroup(entry) || !['school-subscription', 'school-access'].includes(entry.view));
  }
  return source
    .map((entry) => isGroup(entry) ? { ...entry, children: entry.children.filter((item) => phase1AllowsWorkspaceView(user.accessRole, item.view)) } : entry)
    .filter((entry) => isGroup(entry) ? entry.children.length > 0 : phase1AllowsWorkspaceView(user.accessRole, entry.view));
}

export function MobileTopBar() {
  const { user, view, setView, logout } = useAppStore();
  const { canAccess } = useModuleAccess();
  const [open, setOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(view.includes('-analytics-'));

  if (!user) return null;

  const nav = getNavForRole(user)
    .filter((entry) => canAccess(entry.moduleKey))
    .map((entry) => isGroup(entry) ? { ...entry, children: entry.children.filter((item) => canAccess(item.moduleKey)) } : entry)
    .filter((entry) => !isGroup(entry) || entry.children.length > 0);
  const roleLabel = evidaraRoleLabel(user.accessRole);

  function handleNav(view: AppView) {
    setView(view);
    setOpen(false);
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[var(--line)] bg-white/95 px-4 backdrop-blur-sm">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-[var(--foreground)]">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 bg-[var(--midnight)] border-none">
          <div className="flex h-14 items-center gap-2.5 px-4">
            <img src="/brand/evidara-logo-light.png" alt="Evidara" className="h-7 w-auto" />
          </div>
          <Separator className="bg-white/8" />
          <div className="px-4 pb-1 pt-3">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/30">{roleLabel}</span>
          </div>
          <ScrollArea className="flex-1 px-2 py-2">
            <nav className="flex flex-col gap-0.5">
              {nav.map((entry) => {
                if (!isGroup(entry)) {
                  const Icon = entry.icon;
                  const isActive = view === entry.view;
                  return (
                    <button
                      key={entry.view}
                      onClick={() => handleNav(entry.view)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                        isActive
                          ? 'bg-[var(--teal)] text-white'
                          : 'text-white/55 hover:bg-white/6 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-white/40'}`} />
                      <span>{entry.label}</span>
                      {isActive && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />}
                    </button>
                  );
                }

                const Icon = entry.icon;
                const active = entry.children.some((item) => item.view === view);
                return (
                  <div key={entry.label} className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => setAnalyticsOpen((c) => !c)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all ${
                        active ? 'text-white' : 'text-white/55 hover:bg-white/6 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[var(--amber)]' : 'text-white/40'}`} />
                      <span>{entry.label}</span>
                      <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {analyticsOpen && (
                      <div className="space-y-0.5 border-l border-white/8 pl-1">
                        {entry.children.map((item) => {
                          const Icon2 = item.icon;
                          const isActive2 = view === item.view;
                          return (
                            <button
                              key={item.view}
                              onClick={() => handleNav(item.view)}
                              className={`flex w-full items-center gap-2.5 rounded-lg pl-7 pr-3 py-2 text-[12px] font-medium transition-all ${
                                isActive2
                                  ? 'bg-[var(--teal)] text-white'
                                  : 'text-white/40 hover:bg-white/6 hover:text-white'
                              }`}
                            >
                              <Icon2 className="h-3.5 w-3.5 shrink-0" />
                              <span>{item.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>
          </ScrollArea>
          <div className="px-3 pb-3">
            <LoginAsSwitcher compact onSelected={() => setOpen(false)} />
          </div>
          <Separator className="bg-white/8" />
          <div className="p-3">
            <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2">
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarFallback className="bg-[var(--teal)] text-[10px] font-semibold text-white">
                  {user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 overflow-hidden">
                <p className="truncate text-[13px] font-medium text-white">{user.name}</p>
                <p className="truncate text-[11px] text-white/40">{roleLabel}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => { void logout(); setOpen(false); }}
                className="h-7 w-7 shrink-0 text-white/30 hover:bg-white/10 hover:text-[var(--error)]"
              >
                <LogOut className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex items-center gap-2">
        <img src="/brand/evidara-emblem.png" alt="Evidara" className="h-6 w-6" />
        <span className="text-sm font-semibold text-[var(--foreground)]">Evidara</span>
      </div>
    </header>
  );
}
