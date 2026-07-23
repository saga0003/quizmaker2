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

const description = "Evidara V8 Phase 3 paper management, approved Question Bank selection, hybrid locking, blueprint generation, shortage validation and reproducible generation history.";

export const metadata: Metadata = {
  title: "Evidara V8 Phase 3 — Test Paper Builder",
  description,
  robots: { index: false, follow: false },
  icons: {
    icon: "/brand/evidara-emblem.png",
    apple: "/brand/evidara-emblem.png",
  },
  openGraph: {
    title: "Evidara V8 Phase 3 — Test Paper Builder",
    description,
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
