import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionPaperBuilder } from "@/components/papers/QuestionPaperBuilder";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><QuestionPaperBuilder kind="school"/></DashboardShell></ProtectedPage>}
