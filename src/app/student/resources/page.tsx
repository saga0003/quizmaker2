import { DashboardShell } from "@/components/DashboardShell";import { ProtectedPage } from "@/components/ProtectedPage";import { ResourceLibrary } from "@/components/school/ResourceLibrary";
export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><ResourceLibrary studentMode/></DashboardShell></ProtectedPage>}
