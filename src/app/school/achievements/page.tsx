import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { SchoolAchievementWorkspace } from "@/components/achievements/SchoolAchievementWorkspace";

export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><SchoolAchievementWorkspace/></DashboardShell></ProtectedPage>}
