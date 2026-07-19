import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { PaperPreview } from "@/components/papers/PaperPreview";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><PaperPreview kind="school"/></DashboardShell></ProtectedPage>}
