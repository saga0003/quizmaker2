import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AchievementsCenter } from "@/components/achievements/AchievementsCenter";

export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><AchievementsCenter/></DashboardShell></ProtectedPage>}
