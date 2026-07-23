'use client';

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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.ElementType;
  view: AppView;
  moduleKey?: EvidaraModuleKey;
}

const studentNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, view: 'student-dashboard' },
  { label: 'Tests', icon: BookOpen, view: 'student-tests', moduleKey: 'papers' },
  { label: 'Analytics', icon: BarChart3, view: 'student-analytics', moduleKey: 'analytics' },
  { label: 'Results', icon: FileText, view: 'student-results', moduleKey: 'analytics' },
  { label: 'Achievements', icon: Trophy, view: 'student-achievements', moduleKey: 'achievements' },
  { label: 'Benchmarks', icon: Target, view: 'student-benchmarks', moduleKey: 'benchmarks' },
  { label: 'Resources', icon: FolderOpen, view: 'student-resources', moduleKey: 'resources' },
  { label: 'Store', icon: Package, view: 'student-store', moduleKey: 'subscriptions' },
  { label: 'Purchases', icon: ShoppingBag, view: 'student-purchases', moduleKey: 'subscriptions' },
];

const schoolNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, view: 'school-dashboard' },
  { label: 'Questions', icon: BookOpen, view: 'school-questions', moduleKey: 'questions' },
  { label: 'Papers', icon: FileText, view: 'school-papers', moduleKey: 'papers' },
  { label: 'Students', icon: Users, view: 'school-students', moduleKey: 'students' },
  { label: 'Product Store', icon: Package, view: 'school-store', moduleKey: 'subscriptions' },
  { label: 'Subscription', icon: CreditCard, view: 'school-subscription', moduleKey: 'subscriptions' },
  { label: 'Resources', icon: FolderOpen, view: 'school-resources', moduleKey: 'resources' },
  { label: 'Achievements', icon: Trophy, view: 'school-achievements', moduleKey: 'achievements' },
  { label: 'Benchmarks', icon: Target, view: 'school-benchmarks', moduleKey: 'benchmarks' },
  { label: 'Segments', icon: PieChart, view: 'school-segments', moduleKey: 'analytics' },
  { label: 'Access Control', icon: ShieldCheck, view: 'school-access' },
];

const adminNav: NavItem[] = [
  { label: 'Command Centre', icon: LayoutDashboard, view: 'admin-dashboard' },
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
      return schoolNav.filter((item) => item.view !== 'school-subscription' && item.view !== 'school-access');
    }
    return schoolNav;
  }
  return adminNav;
}

export function AppSidebar() {
  const { user, view, setView, logout, sidebarOpen, setSidebarOpen } = useAppStore();
  const { canAccess } = useModuleAccess();
  if (!user) return null;

  const nav = navigationForUser(user.role, user.accessRole).filter((item) => canAccess(item.moduleKey));
  const roleLabel = evidaraRoleLabel(user.accessRole);

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col bg-[#14232B] text-white transition-all duration-300 ${
        sidebarOpen ? 'w-64' : 'w-[68px]'
      }`}
    >
      <div className="flex h-16 items-center justify-between px-4">
        {sidebarOpen && (
          <div className="flex items-center gap-3">
            <img
              src="/brand/evidara-logo-light.png"
              alt="Evidara"
              className="h-8 w-auto"
            />
          </div>
        )}
        {!sidebarOpen && (
          <img
            src="/brand/evidara-emblem.png"
            alt="Evidara"
            className="mx-auto h-8 w-8"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="h-8 w-8 shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
        >
          {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </div>

      <Separator className="bg-white/10" />

      {sidebarOpen && (
        <div className="px-4 pt-4 pb-2">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
            {roleLabel}
          </span>
        </div>
      )}

      <ScrollArea className="flex-1 px-2 py-2">
        <nav className="flex flex-col gap-1">
          {nav.map((item) => {
            const isActive = view === item.view;
            const Icon = item.icon;
            const button = (
              <button
                key={item.view}
                onClick={() => setView(item.view)}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#0E5A5A] text-white shadow-sm'
                    : 'text-white/60 hover:bg-white/8 hover:text-white'
                } ${!sidebarOpen ? 'justify-center' : ''}`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white'}`} />
                {sidebarOpen && <span>{item.label}</span>}
                {isActive && sidebarOpen && <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#F2B84B]" />}
              </button>
            );
            if (!sidebarOpen) {
              return (
                <Tooltip key={item.view} delayDuration={0}>
                  <TooltipTrigger asChild>{button}</TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
                </Tooltip>
              );
            }
            return button;
          })}
        </nav>
      </ScrollArea>

      <Separator className="bg-white/10" />
      <div className="p-3">
        {sidebarOpen ? (
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[#0E5A5A] text-xs font-semibold text-white">
                {user.name
                  .split(' ')
                  .map((name) => name[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-white/50">{roleLabel} · {user.email}</p>
            </div>
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void logout()}
                  className="h-8 w-8 shrink-0 text-white/40 hover:bg-white/10 hover:text-[#B54747]"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">Sign Out</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => void logout()}
                className="mx-auto flex h-10 w-10 text-white/40 hover:bg-white/10 hover:text-[#B54747]"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sign Out</TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}
