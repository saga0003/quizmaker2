'use client';
import Link from 'next/link';
import { ArrowRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Logo } from './Logo';

export function Navbar(){
  const [open,setOpen]=useState(false);
  return <header className="public-nav"><div className="rm-container nav-inner"><Link href="/"><Logo/></Link><nav className={open?'open':''}><Link href="/">Home</Link><Link href="/#institutions">For Institutions</Link><Link href="/#how">How it works</Link><Link href="/#pricing">Pricing</Link><Link href="/data-guide/">Data controls</Link><Link href="/login/">Sign in</Link><Link href="/?view=register-school" className="nav-cta">Register institution <ArrowRight size={16}/></Link></nav><button className="nav-menu" aria-label={open?'Close navigation':'Open navigation'} onClick={()=>setOpen(v=>!v)}>{open?<X/>:<Menu/>}</button></div></header>
}
