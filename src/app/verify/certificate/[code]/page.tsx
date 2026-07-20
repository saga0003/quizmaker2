import { CertificateViewer } from "@/components/achievements/CertificateViewer";

export default async function Page({params}:{params:Promise<{code:string}>}){
  const {code}=await params;
  return <CertificateViewer code={code}/>;
}
