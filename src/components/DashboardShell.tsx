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
type DemoIdentity = {
  id: string;
  fullName: string;
  email: string;
  username: string;
  role: string;
};
type ShellLink = {
  h: string;
  l: string;
  i: typeof Home;
  tag?: string;
};

const links: Record<Kind, ShellLink[]> = {
  student: [
    { h: "/student/", l: "My Overview", i: Home },
    { h: "/student/tests/", l: "Available Tests", i: ClipboardList },
    { h: "/student/analytics/", l: "My Analytics", i: BarChart3 },
    { h: "/student/segment/", l: "My Development Pattern", i: Brain, tag: "Explained" },
    { h: "/student/benchmarks/", l: "Shared Benchmarks", i: GitCompareArrows, tag: "Private" },
    { h: "/student/achievements/", l: "Achievements", i: Award },
    { h: "/student/results/", l: "Result History", i: GraduationCap },
    { h: "/student/resources/", l: "My Resources", i: BookOpenCheck, tag: "Included" },
    { h: "/student/purchases/", l: "My Access", i: CreditCard },
    { h: "/metric-guide/", l: "Metric Guide", i: CircleHelp },
    { h: "/data-guide/", l: "Data Controls", i: TableProperties },
    { h: "/student/#profile", l: "Profile", i: Settings },
  ],
  school: [
    { h: "/school/", l: "School Overview", i: Home },
    { h: "/school/subscription/", l: "Annual Subscription", i: CreditCard, tag: "Active" },
    { h: "/school/students/", l: "Students & Promotion", i: Users },
    { h: "/school/segments/", l: "Development Patterns", i: Brain },
    { h: "/school/benchmarks/", l: "Shared Benchmarks", i: GitCompareArrows, tag: "Live" },
    { h: "/school/achievements/", l: "Achievements", i: Award },
    { h: "/school/resources/", l: "Resource Library", i: BookOpenCheck, tag: "Included" },
    { h: "/school/questions/", l: "Question Bank", i: FileQuestion },
    { h: "/school/questions/import/", l: "Bulk Question Import", i: Upload },
    { h: "/school/papers/", l: "Paper Builder", i: ClipboardList, tag: "V8" },
    { h: "/metric-guide/", l: "Metric Guide", i: CircleHelp },
    { h: "/data-guide/", l: "Data Controls", i: TableProperties },
    { h: "/school/register/", l: "School Profile", i: Building2 },
  ],
  admin: [
    { h: "/admin/", l: "Command Centre", i: Home },
    { h: "/admin/subscriptions/", l: "School Subscriptions", i: CreditCard },
    { h: "/admin/questions/", l: "Master Question Bank", i: FileQuestion },
    { h: "/admin/questions/import/", l: "Bulk Import", i: Upload },
    { h: "/admin/papers/", l: "Paper Builder", i: ClipboardList, tag: "V8" },
    { h: "/admin/segments/", l: "Segment Governance", i: Brain },
    { h: "/admin/benchmarks/", l: "Benchmark Governance", i: GitCompareArrows, tag: "Live" },
    { h: "/admin/achievements/", l: "Achievement Governance", i: Award },
    { h: "/admin/products/", l: "Plans & Pricing", i: Package, tag: "Later" },
    { h: "/admin/readiness/", l: "Launch Readiness", i: ShieldCheck },
    { h: "/metric-guide/", l: "Metric Guide", i: CircleHelp },
    { h: "/data-guide/", l: "Data Controls", i: TableProperties },
  ],
};

function isActivePath(pathname: string, href: string) {
  if (href.endsWith("#profile")) return pathname === href.split("#")[0];
  if (["/student/", "/school/", "/admin/"].includes(href)) return pathname === href;
  return pathname === href || pathname.startsWith(href);
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
      const raw =
        localStorage.getItem("evidara_demo_user") || localStorage.getItem("scholaros_demo_user");
      if (raw && !localStorage.getItem("evidara_demo_user")) {
        localStorage.setItem("evidara_demo_user", raw);
      }
      setDemoIdentity(raw ? (JSON.parse(raw) as DemoIdentity) : null);
    } catch {
      setDemoIdentity(null);
    }
  }, [configured, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const displayName =
    profile?.full_name ||
    profile?.username ||
    user?.email ||
    demoIdentity?.fullName ||
    demoIdentity?.username ||
    "Demo User";
  const displayRole = profile?.role || demoIdentity?.role || `${kind} role`;
  const avatarText = displayName.slice(0, 2).toUpperCase();
  const workspaceName = kind === "school" ? "School workspace" : kind === "admin" ? "Evidara platform" : "Student workspace";
  const currentLink = useMemo(
    () => links[kind].find((item) => isActivePath(pathname, item.h)),
    [kind, pathname],
  );

  async function logout() {
    if (user) await signOut();
    ["evidara_demo_user", "evidara_demo_role", "scholaros_demo_user", "scholaros_demo_role"].forEach(
      (key) => localStorage.removeItem(key),
    );
    window.location.href = "/login/";
  }

  return (
    <div className="min-h-screen bg-[#F7F9F7] text-[#14232B]">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-[#14232B]/45 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-white/10 bg-[#14232B] text-white shadow-2xl transition-all duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 ${collapsed ? "lg:w-20" : "lg:w-72"}`}
      >
        <div className="flex h-18 items-center justify-between border-b border-white/10 px-4">
          <Link href="/" className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
            <Logo variant="dark" />
          </Link>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="hidden h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white lg:grid"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
            >
              {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
            </button>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className={`border-b border-white/10 px-4 py-4 ${collapsed ? "lg:px-3" : ""}`}>
          <div className={`rounded-xl bg-white/6 p-3 ${collapsed ? "lg:grid lg:place-items-center lg:p-2" : ""}`}>
            <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40 ${collapsed ? "lg:hidden" : ""}`}>
              {workspaceName}
            </span>
            <div className="mt-1 flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#0E5A5A] text-xs font-bold text-white">
                V8
              </span>
              <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
                <strong className="block truncate text-sm">Papers development</strong>
                <span className="block text-[11px] text-white/45">Draft build · no deployment</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {links[kind].map(({ h, l, i: Icon, tag }) => {
            const active = isActivePath(pathname, h);
            return (
              <Link
                key={h}
                href={h}
                title={collapsed ? l : undefined}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-[#0E5A5A] text-white shadow-sm"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                } ${collapsed ? "lg:justify-center lg:px-2" : ""}`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className={`min-w-0 flex-1 truncate ${collapsed ? "lg:hidden" : ""}`}>{l}</span>
                {tag && (
                  <em
                    className={`rounded-full px-2 py-0.5 text-[9px] font-bold not-italic ${
                      active ? "bg-white/15 text-white" : "bg-white/8 text-white/55"
                    } ${collapsed ? "lg:hidden" : ""}`}
                  >
                    {tag}
                  </em>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className={`flex items-center gap-3 rounded-xl bg-white/5 p-2.5 ${collapsed ? "lg:justify-center" : ""}`}>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F2B84B] text-xs font-bold text-[#14232B]">
              {avatarText}
            </div>
            <div className={`min-w-0 flex-1 ${collapsed ? "lg:hidden" : ""}`}>
              <strong className="block truncate text-xs text-white">{displayName}</strong>
              <span className="block truncate text-[10px] capitalize text-white/45">
                {displayRole.replaceAll("_", " ")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/40 transition hover:bg-white/10 hover:text-[#F29B9B] ${
                collapsed ? "lg:hidden" : ""
              }`}
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <main className={`min-h-screen transition-all duration-300 ${collapsed ? "lg:pl-20" : "lg:pl-72"}`}>
        <header className="sticky top-0 z-30 flex min-h-18 items-center justify-between gap-4 border-b border-[#E7ECEB] bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#E7ECEB] text-[#14232B] lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={19} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-[#14232B]">
                  {currentLink?.l || "Evidara workspace"}
                </h1>
                {pathname.includes("/papers") && (
                  <span className="rounded-full bg-[#FFF2CC] px-2 py-0.5 text-[10px] font-bold text-[#7A5200]">
                    V8
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-[#6B7980]">
                {configured ? "Connected to Supabase test environment" : "Interactive demo mode"}
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2 text-xs text-[#6B7980] sm:flex">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#E7ECEB] bg-[#F7F9F7] px-3 py-2">
              <CalendarRange size={14} /> 2026–27
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#DCE9E7] bg-[#EDF6F4] px-3 py-2 font-semibold text-[#0E5A5A]">
              <Layers3 size={14} /> V8 Papers
            </span>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1600px] p-4 md:p-6 lg:p-7">
          {pathname.includes("/papers") && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#F2B84B]/45 bg-[#FFF9E8] px-4 py-3 text-sm text-[#6E4A00]">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                <strong>V8 development workspace.</strong> Paper definitions may be saved, duplicated and reviewed as drafts. No Vercel or production deployment is enabled.
              </p>
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
