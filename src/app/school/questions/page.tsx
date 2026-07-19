import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionBank } from "@/components/questions/QuestionBank";
export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><QuestionBank kind="school"/></DashboardShell></ProtectedPage>}
