import { ProtectedPage } from "@/components/ProtectedPage";
import { AnalyticsV12Frame } from "@/components/analytics/AnalyticsV12Frame";

export default function Page(){
  return <ProtectedPage allowed="student"><AnalyticsV12Frame/></ProtectedPage>;
}
