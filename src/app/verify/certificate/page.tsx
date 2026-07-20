import type { Metadata } from "next";
import { CertificateViewer } from "@/components/achievements/CertificateViewer";

export const metadata: Metadata = {
  title: "Verify an Evidara Certificate",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
};

export default function Page(){return <CertificateViewer/>}
