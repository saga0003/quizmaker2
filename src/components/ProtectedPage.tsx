"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";

type Allowed="student"|"school"|"admin";
const isSchoolRole=(role?:string|null)=>Boolean(role&&(role.startsWith("institute_")||role.startsWith("school_")||["teacher","reviewer","invigilator"].includes(role)));

export function ProtectedPage({allowed,children}:{allowed:Allowed;children:React.ReactNode}){
  const {loading,user,profile,configured}=useAuth();
  const router=useRouter();
  useEffect(()=>{
    if(!configured||loading)return;
    if(!user){
      localStorage.setItem("evidara_after_login",window.location.pathname);
      localStorage.setItem("scholaros_after_login",window.location.pathname);
      router.replace("/login/");
      return;
    }
    if(!profile)return;
    const ok=allowed==="admin"?profile.role==="super_admin":allowed==="school"?isSchoolRole(profile.role):true;
    if(!ok)router.replace(profile.role==="super_admin"?"/admin/":isSchoolRole(profile.role)?"/school/":"/student/");
  },[allowed,configured,loading,profile,router,user]);
  if(configured&&(loading||!user||!profile))return <main style={{minHeight:"70vh",display:"grid",placeItems:"center"}}><div className="so-card so-pad">Checking your Evidara access…</div></main>;
  return <>{children}</>;
}
