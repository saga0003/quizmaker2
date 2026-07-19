import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";
import "./evidara.css";
import { AuthProvider } from "@/context/AuthProvider";

export const metadata: Metadata = {
  title: "Evidara — Evidence-Driven Student Development",
  description: "School assessments, anonymous shared-paper benchmarks and student intelligence that turn evidence into responsible next steps.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>;
}
