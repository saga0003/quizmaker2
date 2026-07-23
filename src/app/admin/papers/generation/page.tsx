import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { QuestionGenerationStudio } from "@/components/papers/QuestionGenerationStudio";

export default function Page() {
  return (
    <ProtectedPage allowed="admin">
      <DashboardShell kind="admin">
        <QuestionGenerationStudio kind="admin" />
      </DashboardShell>
    </ProtectedPage>
  );
}
