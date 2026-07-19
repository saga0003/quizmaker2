import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { SchoolBenchmarkRouter } from "@/components/benchmarks/BenchmarkWorkspaceRouter";

export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><SchoolBenchmarkRouter/></DashboardShell></ProtectedPage>}
