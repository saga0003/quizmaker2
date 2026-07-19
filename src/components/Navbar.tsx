"use client";
import Link from "next/link";
import { ArrowRight, Menu, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";

export function Navbar(){const [open,setOpen]=useState(false);return <header className="public-nav"><div className="rm-container nav-inner"><Link href="/"><Logo/></Link><nav className={open?"open":""}><Link href="/#platform">Platform</Link><Link href="/#schools">For Schools</Link><Link href="/#analytics">Analytics</Link><Link href="/metric-guide/">Metric guide</Link><Link href="/#subscription">Subscription</Link><Link href="/login/">Sign in</Link><Link href="/school/register/" className="nav-cta">Start school pilot <ArrowRight size={16}/></Link></nav><button className="nav-menu" aria-label={open?"Close navigation":"Open navigation"} onClick={()=>setOpen(value=>!value)}>{open?<X/>:<Menu/>}</button></div></header>}
