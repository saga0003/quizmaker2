import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { LearningBehaviourInsights } from "@/components/analytics/LearningBehaviourInsights";

export default function Page(){
  return <ProtectedPage allowed="student"><DashboardShell kind="student"><LearningBehaviourInsights/></DashboardShell></ProtectedPage>;
}
