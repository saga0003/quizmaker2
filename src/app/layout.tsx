import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./evidara-brand.css";
import "./evidara-metrics.css";
import "../components/analytics-v12/analytics-v12.css";
import "./evidara-tables.css";
import { AuthProvider } from "@/context/AuthProvider";
import { EvidaraAuthBridge } from "@/components/evidara/auth-bridge";
import { QuestionBankPolicy } from "@/components/evidara/question-bank-policy";
import { UniversalTableEnhancer } from "@/components/ui/UniversalTableEnhancer";
import { Toaster } from "@/components/ui/toaster";

const platformTitle = "Evidara — Assessment & Testing Platform for Schools and Colleges";
const platformDescription = "Question banks, intelligent paper creation, secure testing, analytics and academic insights — built for institutions.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://evidara.natscix.com"),
  title: platformTitle,
  description: platformDescription,
  keywords: ["school assessment platform", "college testing platform", "question bank software", "online assessment platform", "test analytics", "student performance analytics", "question paper generator"],
  alternates: { canonical: "/" },
  icons: {
    icon: "/brand/evidara-emblem.png",
    apple: "/brand/evidara-emblem.png",
  },
  openGraph: {
    title: platformTitle,
    description: platformDescription,
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-background text-foreground antialiased">
        <AuthProvider>
          <EvidaraAuthBridge />
          <QuestionBankPolicy />
          <UniversalTableEnhancer />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
