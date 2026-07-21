import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Evidara — Evidence-Driven Student Development",
  description: "Subscription-based school assessments, previous-year resources, secure exams and student intelligence for Grades 8–12.",
  icons: {
    icon: "/brand/evidara-emblem.png",
    apple: "/brand/evidara-emblem.png",
  },
  openGraph: {
    title: "Evidara — Evidence-Driven Student Development",
    description: "Subscription-based school assessments, previous-year resources, secure exams and student intelligence for Grades 8–12.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}