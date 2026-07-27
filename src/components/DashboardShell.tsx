'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Award, BarChart3, BookOpen, BookOpenCheck, Brain, Building2, CalendarRange, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, CreditCard, FileQuestion, Flag, GitCompareArrows, History, Home, Layers3, LogOut, Menu, Package, Settings, ShieldCheck, Sparkles, TableProperties, Tag, Target, Upload, Users, X } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/context/AuthProvider';

type Kind = 'student' | 'school' | 'admin';
type DemoIdentity = { id:string; fullName:string; email:string; username:string; role:string };
type NavItem = { h:string; l:string; i:typeof Home; tag?:string };
type AnalyticsItem = { label:string; icon:typeof Home; href:string };

const links: Record<Kind, NavItem[]> = {
  student: [
    {h:'/student/',l:'My Overview',i:Home},
    {h:'/student/tests/',l:'Available Tests',i:ClipboardList},
    {h:'/student/segment/',l:'My Development Pattern',i:Brain,tag:'Explained'},
    {h:'/student/benchmarks/',l:'Shared Benchmarks',i:GitCompareArrows,tag:'Private'},
    {h:'/student/achievements/',l:'Achievements',i:Award},
    {h:'/student/resources/',l:'My Resources',i:BookOpenCheck,tag:'Included'},
    {h:'/student/purchases/',l:'My Access',i:CreditCard},
    {h:'/metric-guide/',l:'Metric Guide',i:CircleHelp},
    {h:'/data-guide/',l:'Data Controls',i:TableProperties},
    {h:'/student/#profile',l:'Profile',i:Settings},
  ],
  school: [
    {h:'/school/',l:'School Overview',i:Home},{h:'/school/analytics/',l:'Analytics',i:BarChart3},{h:'/school/subscription/',l:'Annual Subscription',i:CreditCard,tag:'Active'},{h:'/school/students/',l:'Students & Promotion',i:Users},{h:'/school/segments/',l:'Development Patterns',i:Brain},{h:'/school/benchmarks/',l:'Shared Benchmarks',i:GitCompareArrows},{h:'/school/achievements/',l:'Achievements',i:Award},{h:'/school/resources/',l:'Resource Library',i:BookOpenCheck},{h:'/school/questions/',l:'Question Bank',i:FileQuestion},{h:'/school/questions/import/',l:'Bulk Question Import',i:Upload},{h:'/school/papers/',l:'Tests & Papers',i:ClipboardList},{h:'/metric-guide/',l:'Metric Guide',i:CircleHelp},{h:'/data-guide/',l:'Data Controls',i:TableProperties},{h:'/school/register/',l:'School Profile',i:Building2},
  ],
  admin: [
    {h:'/admin/',l:'Command Centre',i:Home},{h:'/admin/analytics/',l:'Platform Analytics',i:BarChart3},{h:'/admin/student-analytics/',l:'Student Analytics V12',i:Brain,tag:'V12'},{h:'/admin/subscriptions/',l:'School Subscriptions',i:CreditCard},{h:'/admin/questions/',l:'Master Question Bank',i:FileQuestion},{h:'/admin/questions/import/',l:'Bulk Import',i:Upload},{h:'/admin/papers/',l:'Assessment Catalogue',i:ClipboardList},{h:'/admin/segments/',l:'Segment Governance',i:Brain},{h:'/admin/benchmarks/',l:'Benchmark Governance',i:GitCompareArrows},{h:'/admin/achievements/',l:'Achievement Governance',i:Award},{h:'/admin/products/',l:'Plans & Pricing',i:Package},{h:'/admin/readiness/',l:'Launch Readiness',i:ShieldCheck},{h:'/metric-guide/',l:'Metric Guide',i:CircleHelp},{h:'/data-guide/',l:'Data Controls',i:TableProperties},
  ],
};

const analyticsTree:AnalyticsItem[] = [
  {label:'Overview',icon:Home,href:'/student/analytics/?view=overview'},
  {label:'Subjects',icon:BookOpen,href:'/student/analytics/?view=subject'},
  {label:'Chapters',icon:Layers3,href:'/student/analytics/?view=chapter'},
  {label:'Topics',icon:Tag,href:'/student/analytics/?view=topic'},
  {label:'Learning Behaviour',icon:Brain,href:'/student/analytics/?view=behaviour'},
  {label:'Practice',icon:Target,href:'/student/analytics/?view=practice'},
  {label:'Test History',icon:History,href:'/student/analytics/?view=history'},
  {label:'Goals',icon:Flag,href:'/student/analytics/?view=goals'},
];

export function DashboardShell({kind,children}:{kind:Kind;children:React.ReactNode}){
  const {user,profile,signOut,configured}=useAuth();
  const pathname=usePathname();
  const [demoIdentity,setDemoIdentity]=useState<DemoIdentity|null>(null);
  const [navPinned,setNavPinned]=useState(false);
  const [analyticsOpen,setAnalyticsOpen]=useState(pathname.startsWith('/student/analytics'));

  useEffect(()=>{
    if(configured)return;
    try{
      const raw=localStorage.getItem('evidara_demo_user')||localStorage.getItem('scholaros_demo_user');
      if(raw&&!localStorage.getItem('evidara_demo_user'))localStorage.setItem('evidara_demo_user',raw);
      setDemoIdentity(raw?JSON.parse(raw) as DemoIdentity:null);
    }catch{setDemoIdentity(null)}
  },[configured,pathname]);

  const displayName=profile?.full_name||profile?.username||user?.email||demoIdentity?.fullName||demoIdentity?.username||'Demo User';
  const displayRole=profile?.role||demoIdentity?.role||`${kind} role`;
  const avatarText=displayName.slice(0,2).toUpperCase();
  const workspaceName=kind==='school'?'School workspace':kind==='admin'?'Evidara platform':displayName;

  async function logout(){
    if(user)await signOut();
    ['evidara_demo_user','evidara_demo_role','scholaros_demo_user','scholaros_demo_role'].forEach(key=>localStorage.removeItem(key));
    window.location.href='/login/';
  }

  return <div className={`so-shell ${navPinned?'nav-pinned':''}`}>
    <div className="so-sidebar-zone" aria-hidden="true" />
    <button className="so-nav-trigger" onClick={()=>setNavPinned(value=>!value)} aria-label={navPinned?'Close navigation':'Open navigation'}>{navPinned?<X size={21}/>:<Menu size={21}/>}</button>
    <div className="so-nav-overlay" onClick={()=>setNavPinned(false)} />
    <aside className="so-sidebar">
      <div className="so-sidebar-brand"><Link href="/"><Logo variant="dark"/></Link><button className="so-collapse" onClick={()=>setNavPinned(false)} aria-label="Close navigation"><ChevronLeft size={17}/></button></div>
      <div className="so-workspace"><span>{kind==='admin'?'Platform workspace':kind==='school'?'School workspace':'Student workspace'}</span><strong>{workspaceName}</strong></div>
      <nav className="so-nav">
        {kind==='student'&&<div className={`so-tree ${analyticsOpen?'open':''}`}>
          <button className={`so-tree-root ${pathname.startsWith('/student/analytics')?'active':''}`} onClick={()=>setAnalyticsOpen(value=>!value)}><span><BarChart3 size={19}/>Analytics V12</span><ChevronDown className="so-tree-chevron" size={17}/></button>
          <div className="so-tree-children">{analyticsTree.map(item=>{const Icon=item.icon;return <Link key={item.label} href={item.href} onClick={()=>window.innerWidth<1100&&setNavPinned(false)}><Icon size={16}/>{item.label}</Link>})}</div>
        </div>}
        {links[kind].map(({h,l,i:Icon,tag})=>{const active=pathname===h||pathname.startsWith(h.replace(/\/$/,'')+(h==='/student/'||h==='/school/'||h==='/admin/'?'__never':'/'));return <Link key={h} href={h} className={active?'active':''} onClick={()=>window.innerWidth<1100&&setNavPinned(false)}><span><Icon size={18}/>{l}</span>{tag&&<em>{tag}</em>}</Link>})}
      </nav>
      <div className="so-sidebar-card"><Sparkles size={18}/><div><strong>Evidara</strong><span>{kind==='student'?'Evidence with a clear next step':'Evidence-driven student development'}</span></div></div>
      <div className="so-account"><div className="so-avatar">{avatarText}</div><div><strong>{displayName}</strong><span>{displayRole.replaceAll('_',' ')}</span></div>{(user||demoIdentity)&&<button onClick={()=>void logout()} title="Sign out"><LogOut size={17}/></button>}</div>
    </aside>
    <main className="so-main"><header className="so-topbar"><div><span className="so-live-dot"/> {configured?'Cloud data connected':'Interactive demo mode'}</div><div className="so-top-summary"><span><CalendarRange size={15}/> Academic year 2026–27</span><span><ChevronRight size={15}/> Evidara V12</span></div></header><div className="so-content">{children}</div></main>
  </div>;
}
