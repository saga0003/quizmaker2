import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AvailableTests } from "@/components/papers/AvailableTests";
export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><AvailableTests/></DashboardShell></ProtectedPage>}
