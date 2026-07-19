import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { StudentSegmentEvidence } from "@/components/segments/StudentSegmentEvidence";

export default function Page(){return <ProtectedPage allowed="student"><DashboardShell kind="student"><StudentSegmentEvidence/></DashboardShell></ProtectedPage>}
