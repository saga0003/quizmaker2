import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionImporter } from "@/components/questions/QuestionImporter";
export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><QuestionImporter kind="admin"/></DashboardShell></ProtectedPage>}
