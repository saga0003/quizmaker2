import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionEditor } from "@/components/questions/QuestionEditor";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><QuestionEditor kind="school"/></DashboardShell></ProtectedPage>}
