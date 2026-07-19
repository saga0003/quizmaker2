import { DashboardShell } from "@/components/DashboardShell";import { ProtectedPage } from "@/components/ProtectedPage";import { StudentLifecycleManager } from "@/components/school/StudentLifecycleManager";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><StudentLifecycleManager/></DashboardShell></ProtectedPage>}
