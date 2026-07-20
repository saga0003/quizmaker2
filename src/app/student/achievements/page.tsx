import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StudentAchievementWorkspace } from "@/components/achievements/StudentAchievementWorkspace";

export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><StudentAchievementWorkspace/></DashboardShell></ProtectedPage>}
