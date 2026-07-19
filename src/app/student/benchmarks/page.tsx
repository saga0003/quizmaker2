import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StudentBenchmarkWorkspace } from "@/components/benchmarks/StudentBenchmarkWorkspace";

export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><StudentBenchmarkWorkspace/></DashboardShell></ProtectedPage>}
