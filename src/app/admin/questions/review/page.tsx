import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionReviewQueue } from "@/components/questions/QuestionReviewQueue";
export default function Page(){return <ProtectedPage allowed="admin"><DashboardShell kind="admin"><QuestionReviewQueue/></DashboardShell></ProtectedPage>}
