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
import "./learning-behaviour.css";
import { AuthProvider } from "@/context/AuthProvider";
import { V7AuthBridge } from "@/components/evidara/v7-auth-bridge";
import { QuestionBankPolicy } from "@/components/evidara/question-bank-policy";
import { UniversalTableEnhancer } from "@/components/ui/UniversalTableEnhancer";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Evidara V10.13 — Learning Behaviour Insights",
  description: "Evidence-driven student analytics with transparent, non-AI learning-behaviour observations, responsible-use guidance and practical next steps.",
  icons: {
    icon: "/brand/evidara-emblem.png",
    apple: "/brand/evidara-emblem.png",
  },
  openGraph: {
    title: "Evidara V10.13 — Learning Behaviour Insights",
    description: "Rule-based assessment behaviour insights with clear evidence boundaries and development actions.",
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
