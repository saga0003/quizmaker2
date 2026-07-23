'use client';

import { isSupabaseConfigured } from '@/lib/supabase';
import { useAppStore } from '@/store/use-app-store';
import { AppSidebar } from '@/components/evidara/app-sidebar';
import LandingPage from '@/components/evidara/landing-page';
import LoginPage from '@/components/evidara/login-page';
import { StudentDashboard } from '@/components/evidara/student-dashboard';
import {
  StudentAnalyticsView,
  StudentResultsView,
  StudentAchievementsView,
  StudentBenchmarksView,
  StudentResourcesView,
} from '@/components/evidara/student-views';
import {
  SchoolDashboardView,
  SchoolStudentsView,
  SchoolSubscriptionView,
  SchoolResourcesView,
  SchoolAchievementsView,
  SchoolBenchmarksView,
  SchoolSegmentsView,
} from '@/components/evidara/school-views';
import {
  AdminDashboardView,
  AdminProductsView,
  AdminSubscriptionsView,
  AdminAchievementsView,
  AdminBenchmarksView,
  AdminSegmentsView,
} from '@/components/evidara/admin-views';
import { LiveQuestionBank } from '@/components/evidara/live-question-bank';
import { LivePaperCatalogue } from '@/components/evidara/live-paper-catalogue';
import { LiveStudentTests } from '@/components/evidara/live-student-tests';
import { SchoolQuestionReview } from '@/components/evidara/school-question-review';
import { AccessControlView } from '@/components/evidara/access-control-view';
import { ProductStore } from '@/components/commerce/ProductStore';
import { PurchaseHistory } from '@/components/commerce/PurchaseHistory';

function SchoolQuestionWorkspace() {
  return (
    <div className="space-y-6">
      <SchoolQuestionReview />
      <LiveQuestionBank kind="school" />
    </div>
  );
}

function ViewRouter() {
  const { view } = useAppStore();

  if (view === 'student-dashboard') return <StudentDashboard />;
  if (view === 'student-tests') return <LiveStudentTests />;
  if (view === 'student-analytics') return <StudentAnalyticsView />;
  if (view === 'student-results') return <StudentResultsView />;
  if (view === 'student-achievements') return <StudentAchievementsView />;
  if (view === 'student-benchmarks') return <StudentBenchmarksView />;
  if (view === 'student-resources') return <StudentResourcesView />;
  if (view === 'student-store') return <ProductStore />;
  if (view === 'student-purchases') return <PurchaseHistory />;

  if (view === 'school-dashboard') return <SchoolDashboardView />;
  if (view === 'school-questions') return <SchoolQuestionWorkspace />;
  if (view === 'school-papers') return <LivePaperCatalogue kind="school" />;
  if (view === 'school-students') return <SchoolStudentsView />;
  if (view === 'school-store') return <ProductStore />;
  if (view === 'school-subscription') return <SchoolSubscriptionView />;
  if (view === 'school-resources') return <SchoolResourcesView />;
  if (view === 'school-achievements') return <SchoolAchievementsView />;
  if (view === 'school-benchmarks') return <SchoolBenchmarksView />;
  if (view === 'school-segments') return <SchoolSegmentsView />;
  if (view === 'school-access') return <AccessControlView kind="school" />;

  if (view === 'admin-dashboard') return <AdminDashboardView />;
  if (view === 'admin-questions') return <LiveQuestionBank kind="admin" />;
  if (view === 'admin-papers') return <LivePaperCatalogue kind="admin" />;
  if (view === 'admin-products') return <AdminProductsView />;
  if (view === 'admin-subscriptions') return <AdminSubscriptionsView />;
  if (view === 'admin-achievements') return <AdminAchievementsView />;
  if (view === 'admin-benchmarks') return <AdminBenchmarksView />;
  if (view === 'admin-segments') return <AdminSegmentsView />;
  if (view === 'admin-access') return <AccessControlView kind="admin" />;

  return null;
}

export default function Home() {
  const { view, user, sidebarOpen, authReady } = useAppStore();

  if (isSupabaseConfigured && !authReady) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F7F9F7]">
        <div className="rounded-2xl border border-[#DCE9E7] bg-white px-8 py-6 text-center shadow-sm">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-[#DCE9E7] border-t-[#0E5A5A]" />
          <strong className="text-[#14232B]">Connecting to Evidara cloud…</strong>
          <p className="mt-1 text-sm text-[#6B7980]">Confirming your Supabase session and workspace.</p>
        </div>
      </main>
    );
  }

  if (view === 'landing') return <LandingPage />;
  if (view === 'login' || view === 'register-school') return <LoginPage />;

  if (user) {
    return (
      <div className="min-h-screen bg-[#F7F9F7]">
        <AppSidebar />
        <main className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-[68px]'}`}>
          <div className="mx-auto max-w-7xl p-6 lg:p-8">
            <ViewRouter />
          </div>
        </main>
      </div>
    );
  }

  return <LandingPage />;
}
