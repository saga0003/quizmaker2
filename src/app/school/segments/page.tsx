import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { SchoolSegmentExplorer } from "@/components/segments/SchoolSegmentExplorer";

export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><SchoolSegmentExplorer/></DashboardShell></ProtectedPage>}
