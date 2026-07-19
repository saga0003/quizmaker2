import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./evidara-brand.css";
import "./evidara-metrics.css";
import "./evidara-tables.css";
import "./evidara-segments.css";
import { AuthProvider } from "@/context/AuthProvider";
import { UniversalTableEnhancer } from "@/components/ui/UniversalTableEnhancer";

export const metadata: Metadata = {
  title: "Evidara — Evidence-Driven Student Development",
  description: "Subscription-based school assessments, previous-year resources, secure exams and student intelligence for Grades 8–12.",
  icons: {
    icon: "/brand/evidara-emblem.png",
    apple: "/brand/evidara-emblem.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AuthProvider><UniversalTableEnhancer/>{children}</AuthProvider></body></html>;
}
