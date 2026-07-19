import { DashboardShell } from "@/components/DashboardShell";
import { ProtectedPage } from "@/components/ProtectedPage";
import { BenchmarkPublisher } from "@/components/benchmarks/BenchmarkPublisher";
import { BenchmarkPrivacyNotice } from "@/components/benchmarks/BenchmarkPrivacyNotice";

export default function Page(){return <ProtectedPage allowed="school"><DashboardShell kind="school"><div className="so-page-head"><div><span className="so-kicker">SHARE A SCHOOL PAPER</span><h1>Publish an exact paper version for anonymous comparison</h1><p>Create the access window first. The benchmark aggregate remains hidden until the privacy minimum is reached.</p></div></div><BenchmarkPrivacyNotice/><BenchmarkPublisher/></DashboardShell></ProtectedPage>}
