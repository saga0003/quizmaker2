import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionPaperList } from "@/components/papers/QuestionPaperList";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><QuestionPaperList kind="school"/></DashboardShell></ProtectedPage>}
