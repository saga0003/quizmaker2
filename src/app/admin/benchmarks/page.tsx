import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AdminBenchmarkRouter } from "@/components/benchmarks/BenchmarkWorkspaceRouter";

export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><AdminBenchmarkRouter/></DashboardShell></ProtectedPage>}
