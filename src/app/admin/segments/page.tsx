import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { SegmentGovernance } from "@/components/segments/SegmentGovernance";

export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><SegmentGovernance/></DashboardShell></ProtectedPage>}
