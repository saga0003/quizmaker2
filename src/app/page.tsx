'use client';

import { ShoppingBag } from 'lucide-react';
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
import { LiveStudentTests } from '@/components/evidara/live-student-tests';
import { SchoolQuestionReview } from '@/components/evidara/school-question-review';
import { AccessControlView } from '@/components/evidara/access-control-view';
import { QuestionPaperList } from '@/components/papers/QuestionPaperList';

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
  if (view === 'student-purchases') return <StudentPurchasesView />;

  if (view === 'school-dashboard') return <SchoolDashboardView />;
  if (view === 'school-questions') return <SchoolQuestionWorkspace />;
  if (view === 'school-papers') return <QuestionPaperList kind="school" />;
  if (view === 'school-students') return <SchoolStudentsView />;
  if (view === 'school-subscription') return <SchoolSubscriptionView />;
  if (view === 'school-resources') return <SchoolResourcesView />;
  if (view === 'school-achievements') return <SchoolAchievementsView />;
  if (view === 'school-benchmarks') return <SchoolBenchmarksView />;
  if (view === 'school-segments') return <SchoolSegmentsView />;
  if (view === 'school-access') return <AccessControlView kind="school" />;

  if (view === 'admin-dashboard') return <AdminDashboardView />;
  if (view === 'admin-questions') return <LiveQuestionBank kind="admin" />;
  if (view === 'admin-papers') return <QuestionPaperList kind="admin" />;
  if (view === 'admin-products') return <AdminProductsView />;
  if (view === 'admin-subscriptions') return <AdminSubscriptionsView />;
  if (view === 'admin-achievements') return <AdminAchievementsView />;
  if (view === 'admin-benchmarks') return <AdminBenchmarksView />;
  if (view === 'admin-segments') return <AdminSegmentsView />;
  if (view === 'admin-access') return <AccessControlView kind="admin" />;

  return null;
}

function StudentPurchasesView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#14232B]">Purchase History</h1>
        <p className="mt-1 text-sm text-[#6B7980]">Your transaction history and entitlements</p>
      </div>
      <div className="rounded-xl border border-[#E7ECEB] bg-white p-8 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-[#DCE9E7]" />
        <h3 className="mt-4 text-lg font-semibold text-[#14232B]">No purchases yet</h3>
        <p className="mt-1 text-sm text-[#6B7980]">Your purchase history will appear here after you subscribe to a product.</p>
        <button
          onClick={() => useAppStore.getState().setView('student-dashboard')}
          className="mt-4 rounded-lg bg-[#0E5A5A] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0a4747]"
        >
          Browse Products
        </button>
      </div>
    </div>
  );
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
