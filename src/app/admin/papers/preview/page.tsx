import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { PaperPreview } from "@/components/papers/PaperPreview";
export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><PaperPreview kind="admin"/></DashboardShell></ProtectedPage>}
