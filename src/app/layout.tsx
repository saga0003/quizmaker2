import type { Metadata } from "next";import "katex/dist/katex.min.css";import "./globals.css";import { AuthProvider } from "@/context/AuthProvider";
export const metadata:Metadata={title:"ScholarOS — School Assessment Intelligence",description:"Subscription-based school testing, previous-year resources, secure exams and deep student analytics for Grades 8–12.",icons:{icon:"/icon.svg"}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><AuthProvider>{children}</AuthProvider></body></html>}
