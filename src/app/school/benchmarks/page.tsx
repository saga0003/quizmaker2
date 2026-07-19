import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { SchoolBenchmarkWorkspace } from "@/components/benchmarks/SchoolBenchmarkWorkspace";

export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><SchoolBenchmarkWorkspace/></DashboardShell></ProtectedPage>}
