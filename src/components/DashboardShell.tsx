"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Award,
  BarChart3,
  BookOpenCheck,
  Brain,
  Building2,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileQuestion,
  GitCompareArrows,
  GraduationCap,
  Home,
  Layers3,
  LogOut,
  Menu,
  Package,
  Settings,
  ShieldCheck,
  Sparkles,
  TableProperties,
  Upload,
  Users,
  X,
} from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/context/AuthProvider";

type Kind = "student" | "school" | "admin";
type DemoIdentity = { id: string; fullName: string; email: string; username: string; role: string };
type ShellLink = { h: string; l: string; i: typeof Home; tag?: string };

const links: Record<Kind, ShellLink[]> = {
  student: [
    { h: "/student/", l: "My Overview", i: Home },
    { h: "/student/tests/", l: "Available Tests", i: ClipboardList },
    { h: "/student/analytics/", l: "My Analytics", i: BarChart3 },
    { h: "/student/segment/", l: "My Development Pattern", i: Brain },
    { h: "/student/benchmarks/", l: "Shared Benchmarks", i: GitCompareArrows },
    { h: "/student/achievements/", l: "Achievements", i: Award },
    { h: "/student/results/", l: "Result History", i: GraduationCap },
    { h: "/student/resources/", l: "My Resources", i: BookOpenCheck },
    { h: "/student/purchases/", l: "My Access", i: CreditCard },
    { h: "/metric-guide/", l: "Metric Guide", i: CircleHelp },
    { h: "/data-guide/", l: "Data Controls", i: TableProperties },
    { h: "/student/#profile", l: "Profile", i: Settings },
  ],
  school: [
    { h: "/school/", l: "School Overview", i: Home },
    { h: "/school/subscription/", l: "Annual Subscription", i: CreditCard },
    { h: "/school/students/", l: "Students & Promotion", i: Users },
    { h: "/school/segments/", l: "Development Patterns", i: Brain },
    { h: "/school/benchmarks/", l: "Shared Benchmarks", i: GitCompareArrows },
    { h: "/school/achievements/", l: "Achievements", i: Award },
    { h: "/school/resources/", l: "Resource Library", i: BookOpenCheck },
    { h: "/school/questions/", l: "Question Bank", i: FileQuestion },
    { h: "/school/questions/import/", l: "Bulk Question Import", i: Upload },
    { h: "/school/papers/", l: "Papers", i: ClipboardList, tag: "V8" },
    { h: "/metric-guide/", l: "Metric Guide", i: CircleHelp },
    { h: "/data-guide/", l: "Data Controls", i: TableProperties },
    { h: "/school/register/", l: "School Profile", i: Building2 },
  ],
  admin: [
    { h: "/admin/", l: "Command Centre", i: Home },
    { h: "/admin/subscriptions/", l: "School Subscriptions", i: CreditCard },
    { h: "/admin/questions/", l: "Master Question Bank", i: FileQuestion },
    { h: "/admin/questions/import/", l: "Bulk Import", i: Upload },
    { h: "/admin/papers/", l: "Papers", i: ClipboardList, tag: "V8" },
    { h: "/admin/segments/", l: "Segment Governance", i: Brain },
    { h: "/admin/benchmarks/", l: "Benchmark Governance", i: GitCompareArrows },
    { h: "/admin/achievements/", l: "Achievement Governance", i: Award },
    { h: "/admin/products/", l: "Plans & Pricing", i: Package, tag: "Later" },
    { h: "/admin/readiness/", l: "Launch Readiness", i: ShieldCheck },
    { h: "/metric-guide/", l: "Metric Guide", i: CircleHelp },
    { h: "/data-guide/", l: "Data Controls", i: TableProperties },
  ],
};

function isActivePath(pathname: string, href: string) {
  const clean = href.split("#")[0];
  if (["/student/", "/school/", "/admin/"].includes(clean)) return pathname === clean;
  return pathname === clean || pathname.startsWith(clean);
}

function workspaceLabel(kind: Kind) {
  if (kind === "admin") return "Platform workspace";
  if (kind === "school") return "School workspace";
  return "Student workspace";
}

export function DashboardShell({ kind, children }: { kind: Kind; children: React.ReactNode }) {
  const { user, profile, signOut, configured } = useAuth();
  const pathname = usePathname();
  const [demoIdentity, setDemoIdentity] = useState<DemoIdentity | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (configured) return;
    try {
      const raw = localStorage.getItem("evidara_demo_user") || localStorage.getItem("scholaros_demo_user");
      if (raw && !localStorage.getItem("evidara_demo_user")) localStorage.setItem("evidara_demo_user", raw);
      setDemoIdentity(raw ? (JSON.parse(raw) as DemoIdentity) : null);
    } catch {
      setDemoIdentity(null);
    }
  }, [configured, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("evidara_sidebar_collapsed") === "true");
    } catch {
      setCollapsed(false);
    }
  }, []);

  const displayName = profile?.full_name || profile?.username || user?.email || demoIdentity?.fullName || demoIdentity?.username || "Demo User";
  const displayRole = profile?.role || demoIdentity?.role || `${kind} role`;
  const currentLink = useMemo(() => links[kind].find((item) => isActivePath(pathname, item.h)), [kind, pathname]);
  const paperRoute = pathname.includes("/papers");

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      try {
        localStorage.setItem("evidara_sidebar_collapsed", String(next));
      } catch {
        // The preference is optional.
      }
      return next;
    });
  }

  async function logout() {
    if (user) await signOut();
    ["evidara_demo_user", "evidara_demo_role", "scholaros_demo_user", "scholaros_demo_role"].forEach((key) => localStorage.removeItem(key));
    window.location.href = "/login/";
  }

  const sidebar = (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[min(19rem,86vw)] flex-col bg-[#14232B] text-white shadow-2xl transition-transform duration-300 lg:w-64 lg:shadow-none ${
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      } lg:translate-x-0 ${collapsed ? "lg:w-[68px]" : "lg:w-64"}`}
      aria-label="Workspace navigation"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-3">
        <Link href="/" className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`} aria-label="Evidara home">
          <Logo variant="dark" />
        </Link>
        {collapsed && <img src="/brand/evidara-emblem.png" alt="Evidara" className="mx-auto hidden h-8 w-8 lg:block" />}
        <button
          type="button"
          className="hidden h-10 w-10 shrink-0 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white lg:grid"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
        <button
          type="button"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X size={19} />
        </button>
      </div>

      <div className={`px-4 pb-2 pt-4 ${collapsed ? "lg:hidden" : ""}`}>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">{workspaceLabel(kind)}</span>
        {paperRoute && <p className="mt-1 text-xs font-semibold text-[#A8D3CB]">Paper Builder · V8 UI refresh</p>}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {links[kind].map(({ h, l, i: Icon, tag }) => {
          const active = isActivePath(pathname, h);
          return (
            <Link
              key={h}
              href={h}
              title={collapsed ? l : undefined}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                active ? "bg-[#0E5A5A] text-white shadow-sm" : "text-white/60 hover:bg-white/8 hover:text-white"
              } ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-white/50 group-hover:text-white"}`} />
              <span className={`min-w-0 flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>{l}</span>
              {active && <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-[#F2B84B] ${collapsed ? "lg:hidden" : ""}`} />}
              {tag && !active && <em className={`rounded-full bg-white/8 px-2 py-0.5 text-[9px] font-bold not-italic text-white/55 ${collapsed ? "lg:hidden" : ""}`}>{tag}</em>}
            </Link>
          );
        })}
      </nav>

      {paperRoute && !collapsed && (
        <div className="mx-3 mb-3 hidden rounded-xl border border-white/10 bg-white/5 p-3 lg:block">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#F2B84B]" />
            <p className="text-[11px] leading-relaxed text-white/60">Paper definitions only. Products, payments and student delivery remain separate.</p>
          </div>
        </div>
      )}

      <div className="border-t border-white/10 p-3">
        <div className={`flex min-h-11 items-center gap-3 rounded-lg bg-white/5 px-2.5 py-2 ${collapsed ? "lg:justify-center" : ""}`}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0E5A5A] text-xs font-semibold text-white">{displayName.slice(0, 2).toUpperCase()}</div>
          <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
            <strong className="block truncate text-xs font-medium">{displayName}</strong>
            <span className="block truncate text-[10px] capitalize text-white/45">{displayRole.replaceAll("_", " ")}</span>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/40 hover:bg-white/10 hover:text-[#F29B9B] ${collapsed ? "lg:hidden" : ""}`}
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-[#F7F9F7] text-[#14232B]">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-[#14232B]/45 backdrop-blur-[2px] lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      {sidebar}

      <main className={`min-h-screen transition-[padding] duration-300 ${collapsed ? "lg:pl-[68px]" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[#E7ECEB] bg-white/95 px-3 backdrop-blur md:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-[#E7ECEB] bg-white text-[#14232B] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-bold sm:text-base">{currentLink?.l || "Evidara workspace"}</h1>
                {paperRoute && <span className="rounded-full bg-[#EDF6F4] px-2 py-0.5 text-[9px] font-bold text-[#0E5A5A]">V8</span>}
              </div>
              <p className="truncate text-[11px] text-[#6B7980]">{configured ? "Cloud data connected" : "Interactive demo mode"}</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 text-xs text-[#6B7980] md:flex">
            <span className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#E7ECEB] bg-[#F7F9F7] px-3"><CalendarRange size={14} />2026–27</span>
            {paperRoute && <span className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCE9E7] bg-[#EDF6F4] px-3 font-semibold text-[#0E5A5A]"><Layers3 size={14} />Paper Builder</span>}
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 md:px-6 md:py-6 lg:px-8">
          {paperRoute && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#DCE9E7] bg-white px-3 py-3 text-xs leading-relaxed text-[#587077] shadow-[0_4px_14px_rgba(20,35,43,0.04)] sm:px-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#0E5A5A]" />
              <p><strong className="text-[#14232B]">V8 paper workspace.</strong> Built on the V7 visual system with a responsive layout for desktop, tablet and mobile.</p>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
