import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StudentBenchmarkRouter } from "@/components/benchmarks/BenchmarkWorkspaceRouter";

export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><StudentBenchmarkRouter/></DashboardShell></ProtectedPage>}
