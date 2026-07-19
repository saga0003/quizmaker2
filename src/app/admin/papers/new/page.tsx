import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionPaperBuilder } from "@/components/papers/QuestionPaperBuilder";
export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><QuestionPaperBuilder kind="admin"/></DashboardShell></ProtectedPage>}
