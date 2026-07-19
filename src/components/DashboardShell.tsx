"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, BookOpenCheck, Building2, CalendarRange, ChevronRight, ClipboardList, CreditCard, FileQuestion, GraduationCap, Home, Layers3, LogOut, Package, Settings, ShieldCheck, Sparkles, Upload, Users } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/context/AuthProvider";

type Kind = "student" | "school" | "admin";
type DemoIdentity = { id:string; fullName:string; email:string; username:string; role:string };

const links:{[K in Kind]:{h:string;l:string;i:typeof Home;tag?:string}[]}={
  student:[
    {h:"/student/",l:"My Overview",i:Home},{h:"/student/tests/",l:"Available Tests",i:ClipboardList},{h:"/student/analytics/",l:"My Analytics",i:BarChart3},{h:"/student/results/",l:"Result History",i:GraduationCap},{h:"/student/resources/",l:"My Resources",i:BookOpenCheck,tag:"Included"},{h:"/student/purchases/",l:"My Access",i:CreditCard},{h:"/student/#profile",l:"Profile",i:Settings},
  ],
  school:[
    {h:"/school/",l:"School Overview",i:Home},{h:"/school/subscription/",l:"Annual Subscription",i:CreditCard,tag:"Active"},{h:"/school/students/",l:"Students & Promotion",i:Users},{h:"/school/resources/",l:"Resource Library",i:BookOpenCheck,tag:"Complimentary"},{h:"/school/questions/",l:"Question Bank",i:FileQuestion},{h:"/school/questions/import/",l:"Bulk Question Import",i:Upload},{h:"/school/papers/",l:"Tests & Papers",i:ClipboardList,tag:"Free"},{h:"/school/register/",l:"School Profile",i:Building2},
  ],
  admin:[
    {h:"/admin/",l:"Command Centre",i:Home},{h:"/admin/subscriptions/",l:"School Subscriptions",i:CreditCard},{h:"/admin/questions/",l:"Master Question Bank",i:FileQuestion},{h:"/admin/questions/import/",l:"Bulk Import",i:Upload},{h:"/admin/papers/",l:"Assessment Catalogue",i:ClipboardList},{h:"/admin/products/",l:"Plans & Pricing",i:Package},{h:"/setup-check/",l:"System & Security",i:ShieldCheck},
  ],
};

export function DashboardShell({kind,children}:{kind:Kind;children:React.ReactNode}){
  const {user,profile,signOut,configured}=useAuth();
  const pathname=usePathname();
  const [demoIdentity,setDemoIdentity]=useState<DemoIdentity|null>(null);

  useEffect(()=>{
    if(configured)return;
    try{
      const raw=localStorage.getItem("evidara_demo_user")||localStorage.getItem("scholaros_demo_user");
      if(raw&&!localStorage.getItem("evidara_demo_user"))localStorage.setItem("evidara_demo_user",raw);
      setDemoIdentity(raw?JSON.parse(raw) as DemoIdentity:null);
    }catch{setDemoIdentity(null)}
  },[configured,pathname]);

  const displayName=profile?.full_name||profile?.username||user?.email||demoIdentity?.fullName||demoIdentity?.username||"Demo User";
  const displayRole=profile?.role||demoIdentity?.role||`${kind} role`;
  const avatarText=displayName.slice(0,2).toUpperCase();
  const workspaceName=kind==="school"?"Green Valley School":displayName;

  async function logout(){
    if(user)await signOut();
    ["evidara_demo_user","evidara_demo_role","scholaros_demo_user","scholaros_demo_role"].forEach(key=>localStorage.removeItem(key));
    window.location.href="/login/";
  }

  return <div className="so-shell"><aside className="so-sidebar"><div className="so-sidebar-brand"><Link href="/"><Logo/></Link><button className="so-collapse" aria-label="Collapse navigation"><ChevronRight size={15}/></button></div><div className="so-workspace"><span>{kind==="admin"?"Platform workspace":kind==="school"?"School workspace":"Student workspace"}</span><strong>{workspaceName}</strong></div><nav className="so-nav">{links[kind].map(({h,l,i:Icon,tag})=>{const active=pathname===h||pathname.startsWith(h.replace(/\/$/,"")+(h==="/student/"||h==="/school/"||h==="/admin/"?"__never":"/"));return <Link key={h} href={h} className={active?"active":""}><span><Icon size={18}/>{l}</span>{tag&&<em>{tag}</em>}</Link>})}</nav><div className="so-sidebar-card"><Sparkles size={18}/><div><strong>Evidara Annual</strong><span>{kind==="student"?"Resources assigned by your school":"Free tests · complimentary resources"}</span></div></div><div className="so-account"><div className="so-avatar">{avatarText}</div><div><strong>{displayName}</strong><span>{displayRole.replaceAll("_"," ")}{demoIdentity?.id?` · ${demoIdentity.id}`:""}</span></div>{(user||demoIdentity)&&<button onClick={()=>void logout()} title="Sign out"><LogOut size={17}/></button>}</div></aside><main className="so-main"><header className="so-topbar"><div><span className="so-live-dot"/> {configured?"Cloud data connected":"Interactive demo mode"}</div><div className="so-top-summary"><span><CalendarRange size={15}/> Academic year 2026–27</span><span><Layers3 size={15}/> Evidara V6.1</span></div></header><div className="so-content">{children}</div></main></div>;
}
