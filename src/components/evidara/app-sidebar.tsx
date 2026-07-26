'use client';

import { useEffect, useState } from 'react';
import { useAppStore, type AppView } from '@/store/use-app-store';
import { evidaraRoleLabel } from '@/lib/roles';
import { useModuleAccess, type EvidaraModuleKey } from '@/hooks/use-module-access';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  BarChart3,
  Trophy,
  Target,
  FolderOpen,
  ShoppingBag,
  Users,
  Package,
  CreditCard,
  PieChart,
  LogOut,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Home,
  Layers3,
  Tag,
  Crosshair,
  History,
  Flag,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  view: AppView;
  moduleKey?: EvidaraModuleKey;
}

type StudentAnalyticsSection = 'overview' | 'subject' | 'chapter' | 'topic' | 'practice' | 'history' | 'goals';

const studentAnalyticsChildren: Array<{ label: string; section: StudentAnalyticsSection; icon: React.ElementType }> = [
  { label: 'Overview', section: 'overview', icon: Home },
  { label: 'Subjects', section: 'subject', icon: BookOpen },
  { label: 'Chapters', section: 'chapter', icon: Layers3 },
  { label: 'Topics', section: 'topic', icon: Tag },
  { label: 'Practice', section: 'practice', icon: Crosshair },
  { label: 'Test History', section: 'history', icon: History },
  { label: 'Goals', section: 'goals', icon: Flag },
];

const studentNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, view: 'student-dashboard' },
  { label: 'Tests', icon: BookOpen, view: 'student-tests', moduleKey: 'papers' },
  { label: 'Analytics', icon: BarChart3, view: 'student-analytics', moduleKey: 'analytics' },
  { label: 'Achievements', icon: Trophy, view: 'student-achievements', moduleKey: 'achievements' },
  { label: 'Benchmarks', icon: Target, view: 'student-benchmarks', moduleKey: 'benchmarks' },
  { label: 'Resources', icon: FolderOpen, view: 'student-resources', moduleKey: 'resources' },
  { label: 'Store', icon: Package, view: 'student-store', moduleKey: 'subscriptions' },
  { label: 'Purchases', icon: ShoppingBag, view: 'student-purchases', moduleKey: 'subscriptions' },
];

const schoolNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, view: 'school-dashboard' },
  { label: 'Analytics', icon: BarChart3, view: 'school-analytics', moduleKey: 'analytics' },
  { label: 'Questions', icon: BookOpen, view: 'school-questions', moduleKey: 'questions' },
  { label: 'Papers', icon: FileText, view: 'school-papers', moduleKey: 'papers' },
  { label: 'Students', icon: Users, view: 'school-students', moduleKey: 'students' },
  { label: 'Product Store', icon: Package, view: 'school-store', moduleKey: 'subscriptions' },
  { label: 'Entitlements', icon: ShoppingBag, view: 'school-entitlements', moduleKey: 'subscriptions' },
  { label: 'Seat Management', icon: Users, view: 'school-product-seats', moduleKey: 'subscriptions' },
  { label: 'Subscription', icon: CreditCard, view: 'school-subscription', moduleKey: 'subscriptions' },
  { label: 'Resources', icon: FolderOpen, view: 'school-resources', moduleKey: 'resources' },
  { label: 'Achievements', icon: Trophy, view: 'school-achievements', moduleKey: 'achievements' },
  { label: 'Benchmarks', icon: Target, view: 'school-benchmarks', moduleKey: 'benchmarks' },
  { label: 'Segments', icon: PieChart, view: 'school-segments', moduleKey: 'analytics' },
  { label: 'Access Control', icon: ShieldCheck, view: 'school-access' },
];

const adminNav: NavItem[] = [
  { label: 'Command Centre', icon: LayoutDashboard, view: 'admin-dashboard' },
  { label: 'Analytics', icon: BarChart3, view: 'admin-analytics', moduleKey: 'analytics' },
  { label: 'Questions', icon: BookOpen, view: 'admin-questions', moduleKey: 'questions' },
  { label: 'Papers', icon: FileText, view: 'admin-papers', moduleKey: 'papers' },
  { label: 'Products', icon: Package, view: 'admin-products', moduleKey: 'subscriptions' },
  { label: 'Subscriptions', icon: CreditCard, view: 'admin-subscriptions', moduleKey: 'subscriptions' },
  { label: 'Achievements', icon: Trophy, view: 'admin-achievements', moduleKey: 'achievements' },
  { label: 'Benchmarks', icon: Target, view: 'admin-benchmarks', moduleKey: 'benchmarks' },
  { label: 'Segments', icon: PieChart, view: 'admin-segments', moduleKey: 'analytics' },
  { label: 'Access & Accounts', icon: ShieldCheck, view: 'admin-access' },
];

function navigationForUser(role: 'student' | 'school' | 'admin', accessRole: string) {
  if (role === 'student') return studentNav;
  if (role === 'school') {
    if (accessRole === 'school_teacher') {
      return schoolNav.filter((item) => !['school-subscription', 'school-entitlements', 'school-product-seats', 'school-access'].includes(item.view));
    }
    return schoolNav;
  }
  return adminNav;
}

function openStudentAnalyticsSection(section: StudentAnalyticsSection) {
  const tryOpen = (attempt = 0) => {
    const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('.reference-nav-button'));
    const target = buttons.find((button) => button.textContent?.trim().toLowerCase() === studentAnalyticsChildren.find((item) => item.section === section)?.label.toLowerCase());
    if (target) {
      target.click();
      document.querySelector('.reference-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (attempt < 12) window.setTimeout(() => tryOpen(attempt + 1), 60);
  };
  window.setTimeout(() => tryOpen(), 0);
}

export function AppSidebar() {
  const { user, view, setView, logout, sidebarOpen, setSidebarOpen } = useAppStore();
  const { canAccess } = useModuleAccess();
  const [analyticsOpen, setAnalyticsOpen] = useState(view === 'student-analytics');
  const [analyticsSection, setAnalyticsSection] = useState<StudentAnalyticsSection>('overview');

  useEffect(() => {
    if (view === 'student-analytics') setAnalyticsOpen(true);
  }, [view]);

  if (!user) return null;

  const nav = navigationForUser(user.role, user.accessRole).filter((item) => canAccess(item.moduleKey));
  const roleLabel = evidaraRoleLabel(user.accessRole);

  function selectAnalyticsSection(section: StudentAnalyticsSection) {
    setAnalyticsSection(section);
    setAnalyticsOpen(true);
    setView('student-analytics');
    openStudentAnalyticsSection(section);
  }

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#14232B] text-white transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-[68px]'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {sidebarOpen && <div className="flex items-center gap-3"><img src="/brand/evidara-logo-light.png" alt="Evidara" className="h-8 w-auto" /></div>}
        {!sidebarOpen && <img src="/brand/evidara-emblem.png" alt="Evidara" className="mx-auto h-8 w-8" />}
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="h-8 w-8 shrink-0 text-white/60 hover:bg-white/10 hover:text-white">
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <Separator className="bg-white/10" />
      {sidebarOpen && <div className="px-4 pb-2 pt-4"><span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">{roleLabel}</span></div>}

      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const isStudentAnalytics = user.role === 'student' && item.view === 'student-analytics';
            const isActive = view === item.view;
            const Icon = item.icon;

            if (isStudentAnalytics) {
              const analyticsButton = (
                <button
                  type="button"
                  onClick={() => {
                    if (!sidebarOpen) {
                      setSidebarOpen(true);
                      setAnalyticsOpen(true);
                      setView('student-analytics');
                      openStudentAnalyticsSection(analyticsSection);
                      return;
                    }
                    setAnalyticsOpen((open) => !open);
                    if (view !== 'student-analytics') {
                      setView('student-analytics');
                      openStudentAnalyticsSection(analyticsSection);
                    }
                  }}
                  className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-[#0E5A5A] text-white shadow-sm' : 'text-white/60 hover:bg-white/8 hover:text-white'} ${!sidebarOpen ? 'justify-center' : ''}`}
                >
                  <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white'}`} />
                  {sidebarOpen && <><span>Analytics</span><ChevronDown className={`ml-auto h-4 w-4 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} /></>}
                </button>
              );

              return (
                <div key={item.view}>
                  {!sidebarOpen ? <Tooltip delayDuration={0}><TooltipTrigger asChild>{analyticsButton}</TooltipTrigger><TooltipContent side="right" className="font-medium">Analytics</TooltipContent></Tooltip> : analyticsButton}
                  {sidebarOpen && analyticsOpen && (
                    <div className="ml-[21px] mt-1 space-y-1 border-l border-white/15 pb-1 pl-3">
                      {studentAnalyticsChildren.map((child) => {
                        const ChildIcon = child.icon;
                        const childActive = isActive && analyticsSection === child.section;
                        return (
                          <button
                            type="button"
                            key={child.section}
                            onClick={() => selectAnalyticsSection(child.section)}
                            className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-xs font-medium transition-colors ${childActive ? 'bg-white/12 text-white' : 'text-white/50 hover:bg-white/8 hover:text-white'}`}
                          >
                            <ChildIcon className="h-3.5 w-3.5" />
                            <span>{child.label}</span>
                            {childActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F2B84B]" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const button = (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${isActive ? 'bg-[#0E5A5A] text-white shadow-sm' : 'text-white/60 hover:bg-white/8 hover:text-white'} ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white'}`} />
                {sidebarOpen && <span>{item.label}</span>}
                {isActive && sidebarOpen && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F2B84B]" />}
              </button>
            );
            if (!sidebarOpen) return <Tooltip key={item.view} delayDuration={0}><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent side="right" className="font-medium">{item.label}</TooltipContent></Tooltip>;
            return button;
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-white/10" />
      <div className="p-3">
        {sidebarOpen ? (
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
            <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-[#0E5A5A] text-xs font-semibold text-white">{user.name.split(' ').map((name) => name[0]).join('').slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <div className="flex-1 overflow-hidden"><p className="truncate text-sm font-medium text-white">{user.name}</p><p className="truncate text-xs text-white/50">{roleLabel} · {user.email}</p></div>
            <Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => void logout()} className="h-8 w-8 shrink-0 text-white/40 hover:bg-white/10 hover:text-[#B54747]"><LogOut className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent side="top">Sign Out</TooltipContent></Tooltip>
          </div>
        ) : (
          <Tooltip delayDuration={0}><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={() => void logout()} className="mx-auto flex h-10 w-10 text-white/40 hover:bg-white/10 hover:text-[#B54747]"><LogOut className="h-5 w-5" /></Button></TooltipTrigger><TooltipContent side="right">Sign Out</TooltipContent></Tooltip>
        )}
      </div>
    </aside>
  );
}
