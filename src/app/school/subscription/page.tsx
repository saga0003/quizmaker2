import { DashboardShell } from "@/components/DashboardShell";import { ProtectedPage } from "@/components/ProtectedPage";import { SubscriptionCenter } from "@/components/school/SubscriptionCenter";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><SubscriptionCenter/></DashboardShell></ProtectedPage>}
