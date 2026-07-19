import { DashboardShell } from "@/components/DashboardShell";import { ProtectedPage } from "@/components/ProtectedPage";import { ResourceLibrary } from "@/components/school/ResourceLibrary";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><ResourceLibrary/></DashboardShell></ProtectedPage>}
