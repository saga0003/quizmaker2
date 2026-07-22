import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./evidara-brand.css";
import "./evidara-metrics.css";
import "./evidara-tables.css";
import "./evidara-segments.css";
import "./evidara-benchmarks.css";
import { AuthProvider } from "@/context/AuthProvider";
import { V7AuthBridge } from "@/components/evidara/v7-auth-bridge";
import { QuestionBankPolicy } from "@/components/evidara/question-bank-policy";
import { UniversalTableEnhancer } from "@/components/ui/UniversalTableEnhancer";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Evidara V7.1 — Evidence-Driven Student Development",
  description: "Subscription-based school assessments, previous-year resources, secure exams and student intelligence for Grades 8–12.",
  icons: {
    icon: "/brand/evidara-emblem.png",
    apple: "/brand/evidara-emblem.png",
  },
  openGraph: {
    title: "Evidara V7.1 — Evidence-Driven Student Development",
    description: "Subscription-based school assessments, previous-year resources, secure exams and student intelligence for Grades 8–12.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <AuthProvider>
          <V7AuthBridge />
          <QuestionBankPolicy />
          <UniversalTableEnhancer />
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
