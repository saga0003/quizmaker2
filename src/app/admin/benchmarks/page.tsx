import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { BenchmarkGovernance } from "@/components/benchmarks/BenchmarkGovernance";

export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><BenchmarkGovernance/></DashboardShell></ProtectedPage>}
