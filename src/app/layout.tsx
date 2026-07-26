import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./evidara-brand.css";
import "./evidara-metrics.css";
import "./evidara-tables.css";
import "./evidara-segments.css";
import "./evidara-benchmarks.css";
import "./evidara-analytics-phase3.css";
import "./evidara-analytics-phase4.css";
import "./evidara-analytics-reference.css";
import { AuthProvider } from "@/context/AuthProvider";
import { V7AuthBridge } from "@/components/evidara/v7-auth-bridge";
import { QuestionBankPolicy } from "@/components/evidara/question-bank-policy";
import { UniversalTableEnhancer } from "@/components/ui/UniversalTableEnhancer";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Evidara V10.11 — Complete Student Analytics",
  description: "Evidence-driven assessment analytics with tree navigation, mapped student evidence, subject, chapter and topic analysis, practice, test history, goals and clean PDF reporting.",
  icons: {
    icon: "/brand/evidara-emblem.png",
    apple: "/brand/evidara-emblem.png",
  },
  openGraph: {
    title: "Evidara V10.11 — Complete Student Analytics",
    description: "Mapped student analytics with detailed taxonomy analysis and clean PDF reports.",
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
