"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";

export function SetupBanner() {
  const { configured } = useAuth();
  if (configured) return null;
  return <div style={{background:"#fff7dc",borderBottom:"1px solid #f5d77c",padding:"10px 16px",textAlign:"center",fontSize:13,fontWeight:700,color:"#6d4d00"}}>Demo Mode is active. Add Supabase keys to enable live login and database storage. <Link href="/setup-check/" style={{textDecoration:"underline"}}>Open setup check</Link></div>;
}
