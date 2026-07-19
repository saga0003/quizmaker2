import { DashboardShell } from "@/components/DashboardShell";import { ProtectedPage } from "@/components/ProtectedPage";import { StudentIntelligence } from "@/components/analytics/StudentIntelligence";
export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><StudentIntelligence/></DashboardShell></ProtectedPage>}
