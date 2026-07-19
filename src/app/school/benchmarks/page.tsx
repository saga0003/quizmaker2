import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { SharedBenchmark } from "@/components/benchmarks/SharedBenchmark";

export default function Page(){
  return <ProtectedPage allowed="school"><DashboardShell kind="school"><SharedBenchmark/></DashboardShell></ProtectedPage>;
}
