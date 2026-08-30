'use client';

import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { defaultViewForRole, useAppStore } from '@/store/use-app-store';
import { useModuleAccess } from '@/hooks/use-module-access';
import { canOpenAppView, parseAppView } from '@/lib/workspaceViews';
import { AppSidebar } from '@/components/evidara/app-sidebar';
import { MobileTopBar } from '@/components/evidara/mobile-top-bar';
import LandingPage from '@/components/evidara/landing-page';
import LoginPage from '@/components/evidara/login-page';
import { StudentDashboard } from '@/components/evidara/student-dashboard';
import { StudentResultsView, StudentResourcesView } from '@/components/evidara/student-live-views';
import {
  SchoolDashboardView,
  SchoolStudentsView,
  SchoolSubscriptionView,
  SchoolResourcesView,
} from '@/components/evidara/school-views';
import {
  AdminDashboardView,
  AdminProductsView,
} from '@/components/evidara/admin-views';
import { AdminSchoolControlView } from '@/components/evidara/admin-school-control';
import { LiveQuestionBank } from '@/components/evidara/live-question-bank';
import { LivePaperCatalogue } from '@/components/evidara/live-paper-catalogue';
import { LiveStudentTests } from '@/components/evidara/live-student-tests';
import { SchoolQuestionReview } from '@/components/evidara/school-question-review';
import { AccessControlView } from '@/components/evidara/access-control-view';
import { ProductStore } from '@/components/commerce/ProductStore';
import { PurchaseHistory } from '@/components/commerce/PurchaseHistory';
import { ReferralCenter } from '@/components/commerce/ReferralCenter';
import { SelfAssessmentCenter } from '@/components/evidara/self-assessment-center';
import { AdminInstitutionsView, AdminResourcesView, ReferralSettingsView, AdminSelfAssessmentView } from '@/components/evidara/admin-v14-views';
import { SchoolProductAccess } from '@/components/commerce/SchoolProductAccess';
import { AnalyticsV12Workspace } from '@/components/analytics-v12/student-analytics-v12';
import { EvidaraAnalyticsWorkspace } from '@/components/evidara/analytics-hierarchy';
import type { AnalyticsV12View } from '@/types/analytics-v12';

function analyticsView(view: string): AnalyticsV12View {
  if (view.endsWith('-question-intelligence')) return 'question-intelligence';
  if (view.endsWith('-subject')) return 'subject';
  if (view.endsWith('-chapter')) return 'chapter';
  if (view.endsWith('-topic')) return 'topic';
  if (view.endsWith('-priorities')) return 'priorities';
  if (view.endsWith('-history')) return 'history';
  return 'overview';
}

function SchoolQuestionWorkspace() {
  return (
    <div className="space-y-6">
      <SchoolQuestionReview />
      <LiveQuestionBank kind="school" />
    </div>
  );
}

function PaperWorkspace({ kind }: { kind: 'admin' | 'school' }) {
  const [openRequestedPaper, setOpenRequestedPaper] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOpenRequestedPaper(params.has('id') || params.get('create') === '1');
  }, []);

  return <LivePaperCatalogue kind={kind} startInCreate={openRequestedPaper} />;
}

function ViewRouter() {
  const { view, user } = useAppStore();
  const { access } = useModuleAccess();

  if (user && !canOpenAppView(user, view, access)) {
    const fallback = defaultViewForRole(user.role);
    if (fallback === 'admin-dashboard') return <AdminDashboardView />;
    if (fallback === 'school-dashboard') return <SchoolDashboardView />;
    return <StudentDashboard />;
  }

  if (view === 'student-dashboard') return <StudentDashboard />;
  if (view === 'student-tests') return <LiveStudentTests />;
  if (view === 'student-results') return <StudentResultsView />;
  if (view.startsWith('student-analytics-')) return <AnalyticsV12Workspace mode="student" view={analyticsView(view)} />;
  if (view === 'student-resources') return <StudentResourcesView />;
  if (view === 'student-store') return <ProductStore />;
  if (view === 'student-purchases') return <PurchaseHistory />;
  if (view === 'student-referrals') return <ReferralCenter />;
  if (view === 'student-self-assessment') return <SelfAssessmentCenter />;

  if (view === 'school-dashboard') return <SchoolDashboardView />;
  if (view.startsWith('school-analytics-')) return <EvidaraAnalyticsWorkspace mode="school" />;
  if (view === 'school-questions') return <SchoolQuestionWorkspace />;
  if (view === 'school-papers') return <PaperWorkspace kind="school" />;
  if (view === 'school-students') return <SchoolStudentsView />;
  if (view === 'school-store') return <ProductStore />;
  if (view === 'school-entitlements') return <SchoolProductAccess mode="entitlements" />;
  if (view === 'school-product-seats') return <SchoolProductAccess mode="seats" />;
  if (view === 'school-subscription') return <SchoolSubscriptionView />;
  if (view === 'school-resources') return <SchoolResourcesView />;
  if (view === 'school-access') return <AccessControlView kind="school" />;

  if (view === 'admin-dashboard') return <AdminDashboardView />;
  if (view === 'admin-analytics') return <EvidaraAnalyticsWorkspace mode="platform" />;
  if (view === 'admin-questions') return <LiveQuestionBank kind="admin" />;
  if (view === 'admin-papers') return <PaperWorkspace kind="admin" />;
  if (view === 'admin-products') return <AdminProductsView />;
  if (view === 'admin-subscriptions') return <AdminSchoolControlView />;
  if (view === 'admin-institutions') return <AdminInstitutionsView />;
  if (view === 'admin-resources') return <AdminResourcesView />;
  if (view === 'admin-referrals') return <ReferralSettingsView />;
  if (view === 'admin-self-assessment') return <AdminSelfAssessmentView />;
  if (view === 'admin-access') return <AccessControlView kind="admin" />;

  return null;
}

export default function Home() {
  const { view, user, sidebarOpen, setSidebarOpen, authReady } = useAppStore();
  const { access } = useModuleAccess();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      if (e.matches) setSidebarOpen(false);
    };
    handler(mq);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setSidebarOpen]);

  useEffect(() => {
    if (!authReady) return;

    const syncFromUrl = () => {
      const requested = parseAppView(new URLSearchParams(window.location.search).get('view'));
      if (!user) {
        if (requested === 'login' || requested === 'register-school') {
          useAppStore.setState({ view: requested });
        }
        return;
      }

      const next = requested && canOpenAppView(user, requested, access)
        ? requested
        : canOpenAppView(user, view, access)
          ? view
          : defaultViewForRole(user.role);
      useAppStore.setState({ view: next });
      const url = new URL(window.location.href);
      url.pathname = '/';
      url.searchParams.set('view', next);
      window.history.replaceState({ evidaraView: next }, '', `${url.pathname}${url.search}${url.hash}`);
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [access, authReady, user, view]);

  if (isSupabaseConfigured && !authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--canvas)]">
        <div className="mx-4 rounded-xl border border-[var(--line)] bg-white px-8 py-6 text-center shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" />
          <strong className="text-[var(--foreground)]">Connecting to Evidara cloud</strong>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Confirming your session and workspace.</p>
        </div>
      </main>
    );
  }

  if (view === 'landing') return <LandingPage />;
  if (view === 'login' || view === 'register-school') return <LoginPage />;

  if (user) {
    return (
      <div className="min-h-screen bg-[var(--canvas)]">
        {!isMobile && <AppSidebar />}
        {isMobile && <MobileTopBar />}
        <main
          className={`transition-all duration-200 ${
            isMobile
              ? 'ml-0'
              : sidebarOpen
                ? 'ml-[260px]'
                : 'ml-[64px]'
          }`}
        >
          <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
            <ViewRouter />
          </div>
        </main>
      </div>
    );
  }

  return <LandingPage />;
}
