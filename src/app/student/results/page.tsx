import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StudentResults } from "@/components/papers/StudentResults";
export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><StudentResults/></DashboardShell></ProtectedPage>}
