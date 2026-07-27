import { ProtectedPage } from "@/components/ProtectedPage";
import { DashboardShell } from "@/components/DashboardShell";
import { V12LiveAnalytics } from "@/components/analytics/V12LiveAnalytics";

export default function Page(){
  return <ProtectedPage allowed="student"><DashboardShell kind="student"><V12LiveAnalytics mode="student"/></DashboardShell></ProtectedPage>;
}
