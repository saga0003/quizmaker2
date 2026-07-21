'use client';

import { useAppStore } from '@/store/use-app-store';
import { AppSidebar } from '@/components/evidara/app-sidebar';
import LandingPage from '@/components/evidara/landing-page';
import LoginPage from '@/components/evidara/login-page';
import { StudentDashboard } from '@/components/evidara/student-dashboard';
import {
  StudentTestsView,
  StudentAnalyticsView,
  StudentResultsView,
  StudentAchievementsView,
  StudentBenchmarksView,
  StudentResourcesView,
} from '@/components/evidara/student-views';
import {
  SchoolDashboardView,
  SchoolQuestionsView,
  SchoolPapersView,
  SchoolStudentsView,
  SchoolSubscriptionView,
  SchoolResourcesView,
  SchoolAchievementsView,
  SchoolBenchmarksView,
  SchoolSegmentsView,
} from '@/components/evidara/school-views';
import {
  AdminDashboardView,
  AdminQuestionsView,
  AdminPapersView,
  AdminProductsView,
  AdminSubscriptionsView,
  AdminAchievementsView,
  AdminBenchmarksView,
  AdminSegmentsView,
} from '@/components/evidara/admin-views';

function ViewRouter() {
  const { view } = useAppStore();

  // Student views
  if (view === 'student-dashboard') return <StudentDashboard />;
  if (view === 'student-tests') return <StudentTestsView />;
  if (view === 'student-analytics') return <StudentAnalyticsView />;
  if (view === 'student-results') return <StudentResultsView />;
  if (view === 'student-achievements') return <StudentAchievementsView />;
  if (view === 'student-benchmarks') return <StudentBenchmarksView />;
  if (view === 'student-resources') return <StudentResourcesView />;
  if (view === 'student-purchases') return <StudentPurchasesView />;

  // School views
  if (view === 'school-dashboard') return <SchoolDashboardView />;
  if (view === 'school-questions') return <SchoolQuestionsView />;
  if (view === 'school-papers') return <SchoolPapersView />;
  if (view === 'school-students') return <SchoolStudentsView />;
  if (view === 'school-subscription') return <SchoolSubscriptionView />;
  if (view === 'school-resources') return <SchoolResourcesView />;
  if (view === 'school-achievements') return <SchoolAchievementsView />;
  if (view === 'school-benchmarks') return <SchoolBenchmarksView />;
  if (view === 'school-segments') return <SchoolSegmentsView />;

  // Admin views
  if (view === 'admin-dashboard') return <AdminDashboardView />;
  if (view === 'admin-questions') return <AdminQuestionsView />;
  if (view === 'admin-papers') return <AdminPapersView />;
  if (view === 'admin-products') return <AdminProductsView />;
  if (view === 'admin-subscriptions') return <AdminSubscriptionsView />;
  if (view === 'admin-achievements') return <AdminAchievementsView />;
  if (view === 'admin-benchmarks') return <AdminBenchmarksView />;
  if (view === 'admin-segments') return <AdminSegmentsView />;

  return null;
}

// Placeholder for student purchases view
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

import { ShoppingBag } from 'lucide-react';

export default function Home() {
  const { view, user, sidebarOpen } = useAppStore();

  // Public pages (no sidebar)
  if (view === 'landing') return <LandingPage />;
  if (view === 'login' || view === 'register-school') return <LoginPage />;

  // Authenticated pages (with sidebar)
  if (user) {
    return (
      <div className="min-h-screen bg-[#F7F9F7]">
        <AppSidebar />
        <main
          className={`transition-all duration-300 ${
            sidebarOpen ? 'ml-64' : 'ml-[68px]'
          }`}
        >
          <div className="mx-auto max-w-7xl p-6 lg:p-8">
            <ViewRouter />
          </div>
        </main>
      </div>
    );
  }

  // Fallback
  return <LandingPage />;
}