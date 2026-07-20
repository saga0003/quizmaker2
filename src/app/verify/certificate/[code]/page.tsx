import type { Metadata } from "next";
import { CertificateViewer } from "@/components/achievements/CertificateViewer";

export const metadata: Metadata = {
  title: "Evidara Certificate Verification",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default async function Page({params}:{params:Promise<{code:string}>}){
  const {code}=await params;
  return <CertificateViewer code={code}/>;
}
