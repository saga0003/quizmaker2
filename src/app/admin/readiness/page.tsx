import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { SystemReadinessDashboard } from "@/components/readiness/SystemReadinessDashboard";

export default function AdminReadinessPage() {
  return (
    <ProtectedPage allowed="admin" superAdminOnly>
      <DashboardShell kind="admin">
        <SystemReadinessDashboard />
      </DashboardShell>
    </ProtectedPage>
  );
}
