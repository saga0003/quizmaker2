import { ProtectedPage } from "@/components/ProtectedPage";
import { LiveExam } from "@/components/papers/LiveExam";
export default function Page(){return <ProtectedPage allowed="student"><LiveExam/></ProtectedPage>}
