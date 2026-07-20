import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AdminAchievementGovernance } from "@/components/achievements/AdminAchievementGovernance";

export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><AdminAchievementGovernance/></DashboardShell></ProtectedPage>}
