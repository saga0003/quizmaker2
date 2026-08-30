'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BookOpenCheck, Building2, CalendarRange, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, CreditCard, FileQuestion, LogOut, Menu, Package, ShieldCheck, Sparkles, TableProperties, Users, X, Home } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '@/context/AuthProvider';
import { EVIDARA_RELEASE_LABEL } from '@/lib/release';
import { normalizeEvidaraRole } from '@/lib/roles';
import { phase1AllowsWorkspaceView } from '@/config/phase1-launch';

type Kind = 'student' | 'school' | 'admin';
type DemoIdentity = { id:string; fullName:string; email:string; username:string; role:string };
type NavItem = { h:string; l:string; i:typeof Home; tag?:string; view?:string; superAdminOnly?:boolean };

const links: Record<Kind, NavItem[]> = {
  student: [
    {h:'/?view=student-dashboard',l:'My Overview',i:Home},
    {h:'/?view=student-tests',l:'Available Tests',i:ClipboardList},
    {h:'/?view=student-resources',l:'My Resources',i:BookOpenCheck,tag:'Included'},
    {h:'/?view=student-purchases',l:'My Access',i:CreditCard,view:'student-purchases'},
    {h:'/metric-guide/',l:'Metric Guide',i:CircleHelp},
    {h:'/data-guide/',l:'Data Controls',i:TableProperties},
  ],
  school: [
    {h:'/?view=school-dashboard',l:'School Overview',i:Home},
    {h:'/?view=school-subscription',l:'Annual Subscription',i:CreditCard,tag:'Active'},
    {h:'/?view=school-students',l:'Students & Promotion',i:Users},
    {h:'/?view=school-resources',l:'Resource Library',i:BookOpenCheck},
    {h:'/?view=school-questions',l:'Question Bank',i:FileQuestion},
    {h:'/?view=school-papers',l:'Tests & Papers',i:ClipboardList},
    {h:'/metric-guide/',l:'Metric Guide',i:CircleHelp},
    {h:'/data-guide/',l:'Data Controls',i:TableProperties},
    {h:'/school/register/',l:'School Profile',i:Building2},
  ],
  admin: [
    {h:'/?view=admin-dashboard',l:'Command Centre',i:Home},
    {h:'/?view=admin-subscriptions',l:'School Subscriptions',i:CreditCard},
    {h:'/?view=admin-questions',l:'Master Question Bank',i:FileQuestion},
    {h:'/?view=admin-papers',l:'Assessment Catalogue',i:ClipboardList},
    {h:'/?view=admin-products',l:'Plans & Pricing',i:Package,view:'admin-products',superAdminOnly:true},
    {h:'/?view=admin-access',l:'Access & Accounts',i:ShieldCheck},
    {h:'/admin/readiness/',l:'Launch Readiness',i:ShieldCheck,superAdminOnly:true},
    {h:'/metric-guide/',l:'Metric Guide',i:CircleHelp},
    {h:'/data-guide/',l:'Data Controls',i:TableProperties},
  ],
};

export function DashboardShell({kind,children}:{kind:Kind;children:React.ReactNode}){
  const {user,profile,signOut,configured}=useAuth();
  const pathname=usePathname();
  const [demoIdentity,setDemoIdentity]=useState<DemoIdentity|null>(null);
  const [navPinned,setNavPinned]=useState(false);

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
  const accessRole=normalizeEvidaraRole(profile?.role||demoIdentity?.role);
  const visibleLinks=links[kind].filter((item)=>{
    if(item.superAdminOnly && accessRole!=='super_admin') return false;
    if(item.view && !phase1AllowsWorkspaceView(accessRole,item.view)) return false;
    return true;
  });

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
        {visibleLinks.map(({h,l,i:Icon,tag})=>{const active=h.startsWith('/?')?false:pathname===h||pathname.startsWith(h.replace(/\/$/,'')+'/');return <Link key={h} href={h} className={active?'active':''} onClick={()=>window.innerWidth<1100&&setNavPinned(false)}><span><Icon size={18}/>{l}</span>{tag&&<em>{tag}</em>}</Link>})}
      </nav>
      <div className="so-sidebar-card"><Sparkles size={18}/><div><strong>Evidara</strong><span>{kind==='student'?'Evidence with a clear next step':'Evidence-driven student development'}</span></div></div>
      <div className="so-account"><div className="so-avatar">{avatarText}</div><div><strong>{displayName}</strong><span>{displayRole.replaceAll('_',' ')}</span></div>{(user||demoIdentity)&&<button onClick={()=>void logout()} title="Sign out"><LogOut size={17}/></button>}</div>
    </aside>
    <main className="so-main"><header className="so-topbar"><div><span className="so-live-dot"/> {configured?'Cloud data connected':'Interactive demo mode'}</div><div className="so-top-summary"><span><CalendarRange size={15}/> Academic year 2026–27</span><span><ChevronRight size={15}/> {EVIDARA_RELEASE_LABEL}</span></div></header><div className="so-content">{children}</div></main>
  </div>;
}
