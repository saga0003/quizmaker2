"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";

export function SetupBanner(){
 const {configured}=useAuth();
 if(configured)return null;
 return <div style={{background:"#FCF1DB",borderBottom:"1px solid #F5C66F",padding:"11px 16px",textAlign:"center",fontSize:13,fontWeight:700,color:"#754D06"}}>Evidara interactive demo is active. Connect Supabase to enable shared cloud login, live records and privacy-controlled benchmark data. <Link href="/setup-check/" style={{textDecoration:"underline",color:"#14232B"}}>Review system setup</Link></div>;
}
