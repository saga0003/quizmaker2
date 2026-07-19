import { DashboardShell } from "@/components/DashboardShell";import { ProtectedPage } from "@/components/ProtectedPage";import { SubscriptionManager } from "@/components/admin/SubscriptionManager";
export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><SubscriptionManager/></DashboardShell></ProtectedPage>}
