"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpenCheck, Building2, CalendarRange, ChevronRight, ClipboardList, CreditCard, FileQuestion, GraduationCap, Home, Layers3, LogOut, Package, Settings, ShieldCheck, Sparkles, Upload, Users } from "lucide-react";
import { Logo } from "./Logo";
import { useAuth } from "@/context/AuthProvider";
type Kind="student"|"school"|"admin";
const links:{[K in Kind]:{h:string;l:string;i:typeof Home;tag?:string}[]}={
 student:[
  {h:"/student/",l:"My Overview",i:Home},{h:"/student/tests/",l:"Available Tests",i:ClipboardList},{h:"/student/analytics/",l:"My Analytics",i:BarChart3},{h:"/student/results/",l:"Result History",i:GraduationCap},{h:"/student/resources/",l:"My Resources",i:BookOpenCheck,tag:"Included"},{h:"/student/purchases/",l:"My Access",i:CreditCard},{h:"/student/#profile",l:"Profile",i:Settings}
 ],
 school:[
  {h:"/school/",l:"School Overview",i:Home},{h:"/school/subscription/",l:"Annual Subscription",i:CreditCard,tag:"Active"},{h:"/school/students/",l:"Students & Promotion",i:Users},{h:"/school/resources/",l:"Resource Library",i:BookOpenCheck,tag:"Complimentary"},{h:"/school/questions/",l:"Question Bank",i:FileQuestion},{h:"/school/questions/import/",l:"Bulk Question Import",i:Upload},{h:"/school/papers/",l:"Tests & Papers",i:ClipboardList,tag:"Free"},{h:"/school/register/",l:"School Profile",i:Building2}
 ],
 admin:[
  {h:"/admin/",l:"Command Centre",i:Home},{h:"/admin/subscriptions/",l:"School Subscriptions",i:CreditCard},{h:"/admin/questions/",l:"Master Question Bank",i:FileQuestion},{h:"/admin/questions/import/",l:"Bulk Import",i:Upload},{h:"/admin/papers/",l:"Assessment Catalogue",i:ClipboardList},{h:"/admin/products/",l:"Plans & Pricing",i:Package},{h:"/setup-check/",l:"System & Security",i:ShieldCheck}
 ]
};
export function DashboardShell({kind,children}:{kind:Kind;children:React.ReactNode}){
 const {user,profile,signOut,configured}=useAuth(); const pathname=usePathname();
 return <div className="so-shell"><aside className="so-sidebar"><div className="so-sidebar-brand"><Link href="/"><Logo/></Link><button className="so-collapse"><ChevronRight size={15}/></button></div><div className="so-workspace"><span>{kind==="admin"?"Platform workspace":kind==="school"?"School workspace":"Student workspace"}</span><strong>{kind==="school"?"Green Valley School":profile?.full_name||profile?.username||user?.email||"Demo account"}</strong></div><nav className="so-nav">{links[kind].map(({h,l,i:Icon,tag})=>{const active=pathname===h||pathname.startsWith(h.replace(/\/$/,"")+(h==="/student/"||h==="/school/"||h==="/admin/"?"__never":"/"));return <Link key={h} href={h} className={active?"active":""}><span><Icon size={18}/>{l}</span>{tag&&<em>{tag}</em>}</Link>})}</nav><div className="so-sidebar-card"><Sparkles size={18}/><div><strong>ScholarOS Annual</strong><span>{kind==="student"?"Resources assigned by your school":"Tests free · PYQs complimentary"}</span></div></div><div className="so-account"><div className="so-avatar">{(profile?.full_name||user?.email||kind).slice(0,2).toUpperCase()}</div><div><strong>{profile?.full_name||profile?.username||user?.email||(configured?"Not signed in":"Demo User")}</strong><span>{profile?.role?.replaceAll("_"," ")||`${kind} role`}</span></div>{user&&<button onClick={async()=>{await signOut();window.location.href="/"}} title="Sign out"><LogOut size={17}/></button>}</div></aside><main className="so-main"><header className="so-topbar"><div><span className="so-live-dot"/> {configured?"Cloud data connected":"Interactive demo mode"}</div><div className="so-top-summary"><span><CalendarRange size={15}/> Academic year 2026–27</span><span><Layers3 size={15}/> ScholarOS V4</span></div></header><div className="so-content">{children}</div></main></div>
}
