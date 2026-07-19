"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, GraduationCap, LockKeyhole, LogIn, Mail, Presentation, School, ShieldCheck, User } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Mode = "login" | "register";
type DemoRole = "super_admin" | "institute_admin" | "teacher" | "student";
type DemoAccount = {
  id: string;
  label: string;
  fullName: string;
  email: string;
  legacyEmail?: string;
  username: string;
  password: string;
  role: DemoRole;
  route: string;
};

const DEMO_PASSWORD = "demo12345";
const demoAccounts: DemoAccount[] = [
  { id:"demo-super-admin", label:"Super Admin", fullName:"Evidara Super Admin", email:"admin@evidara.demo", legacyEmail:"admin@scholaros.demo", username:"evidara_admin", password:DEMO_PASSWORD, role:"super_admin", route:"/admin/" },
  { id:"demo-school-admin", label:"School Admin", fullName:"Green Valley School Admin", email:"school@evidara.demo", legacyEmail:"school@scholaros.demo", username:"greenvalley_admin", password:DEMO_PASSWORD, role:"institute_admin", route:"/school/" },
  { id:"demo-teacher", label:"Teacher", fullName:"Evidara Demo Teacher", email:"teacher@evidara.demo", legacyEmail:"teacher@scholaros.demo", username:"evidara_teacher", password:DEMO_PASSWORD, role:"teacher", route:"/school/" },
  { id:"demo-student", label:"Student", fullName:"Ananya Rao", email:"student@evidara.demo", legacyEmail:"student@scholaros.demo", username:"ananya_student", password:DEMO_PASSWORD, role:"student", route:"/student/" },
];

const roleIcons = { super_admin:ShieldCheck, institute_admin:School, teacher:Presentation, student:GraduationCap };

export function AuthForm() {
  const [mode,setMode]=useState<Mode>("login");
  const [fullName,setFullName]=useState("");
  const [username,setUsername]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [message,setMessage]=useState("");
  const [isError,setIsError]=useState(false);
  const [busy,setBusy]=useState(false);
  const router=useRouter();

  function afterLogin(){
    const saved=localStorage.getItem("evidara_after_login")||localStorage.getItem("scholaros_after_login")||"";
    localStorage.removeItem("evidara_after_login");
    localStorage.removeItem("scholaros_after_login");
    return saved;
  }

  function openDemo(account:DemoAccount){
    localStorage.setItem("evidara_demo_user",JSON.stringify(account));
    localStorage.setItem("evidara_demo_role",account.role);
    localStorage.setItem("scholaros_demo_user",JSON.stringify(account));
    localStorage.setItem("scholaros_demo_role",account.role);
    router.push(account.route);
  }

  async function routeByRole(userId:string){
    if(!supabase)return router.push("/student/");
    const saved=afterLogin();
    if(saved)return router.push(saved);
    const {data:profile}=await supabase.from("profiles").select("role").eq("id",userId).maybeSingle();
    const role=profile?.role;
    router.push(role==="super_admin"?"/admin/":((role?.startsWith("school_")||role?.startsWith("institute_"))||["teacher","reviewer","invigilator"].includes(role||""))?"/school/":"/student/");
  }

  async function submit(event:React.FormEvent){
    event.preventDefault();setMessage("");setIsError(false);
    if(!supabase){
      const clean=email.trim().toLowerCase();
      const account=demoAccounts.find(item=>item.email.toLowerCase()===clean||item.legacyEmail?.toLowerCase()===clean);
      if(account&&password!==account.password){setIsError(true);setMessage("Incorrect demo password. Use demo12345.");return}
      if(account){openDemo(account);return}
      openDemo({id:"demo-student-custom",label:"Student",fullName:fullName||"Demo Student",email,username:username||"demo_student",password:DEMO_PASSWORD,role:"student",route:"/student/"});
      return;
    }
    setBusy(true);
    try{
      if(mode==="register"){
        const cleanUsername=username.trim();
        if(!/^[A-Za-z0-9._-]{3,30}$/.test(cleanUsername))throw new Error("Username must be 3–30 characters and use only letters, numbers, dot, underscore or hyphen.");
        const {data:available,error:availabilityError}=await supabase.rpc("is_username_available",{p_username:cleanUsername});
        if(availabilityError)throw availabilityError;
        if(!available)throw new Error("That username is already taken. Choose another username.");
        const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName.trim(),username:cleanUsername}}});
        if(error)throw error;
        if(!data.session||!data.user)throw new Error("Account was created but no session was returned. In Supabase, turn off Authentication → Providers → Email → Confirm email.");
        setMessage("Account created. Opening your Evidara workspace…");
        await routeByRole(data.user.id);
      }else{
        const {data,error}=await supabase.auth.signInWithPassword({email,password});
        if(error)throw error;
        await routeByRole(data.user.id);
      }
    }catch(error){setIsError(true);setMessage(error instanceof Error?error.message:"Authentication failed")}
    finally{setBusy(false)}
  }

  async function google(){
    setMessage("");
    if(!supabase){openDemo(demoAccounts[3]);return}
    const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth/callback/`,queryParams:{prompt:"select_account"}}});
    if(error){setIsError(true);setMessage(error.message)}
  }

  return <div className="so-card" style={{padding:24,maxWidth:540,width:"100%"}}>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:"#E7ECEB",padding:4,borderRadius:10,marginBottom:22}}>
      <button onClick={()=>{setMode("login");setMessage("")}} style={{border:0,borderRadius:8,minHeight:44,fontWeight:800,color:"#14232B",background:mode==="login"?"white":"transparent"}}>Login</button>
      <button onClick={()=>{setMode("register");setMessage("")}} style={{border:0,borderRadius:8,minHeight:44,fontWeight:800,color:"#14232B",background:mode==="register"?"white":"transparent"}}>Register</button>
    </div>
    <span className="so-kicker">EVIDARA ACCOUNT</span>
    <h1 style={{fontSize:28,margin:"7px 0 6px",color:"#14232B"}}>{mode==="login"?"Welcome back":"Create your account"}</h1>
    <p style={{margin:"0 0 20px",color:"#6B7980",lineHeight:1.55}}>{!isSupabaseConfigured?"Interactive demo: open a role below or use its Evidara demo email and password.":mode==="register"?"Create your Evidara identity and begin the assessment journey.":"Use Google or your email and password."}</p>

    {!isSupabaseConfigured&&mode==="login"&&<div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:10,marginBottom:18}}>{demoAccounts.map(account=>{const Icon=roleIcons[account.role];return <button key={account.id} type="button" onClick={()=>openDemo(account)} style={{border:"1px solid #DCE9E7",background:"white",borderRadius:10,padding:13,textAlign:"left",minHeight:74}}><span style={{display:"flex",alignItems:"center",gap:7,color:"#14232B",fontWeight:800}}><Icon size={17}/>{account.label}</span><small style={{display:"block",marginTop:5,color:"#6B7980"}}>{account.email}</small></button>})}</div>}

    <button onClick={google} className="rm-btn-secondary" style={{width:"100%",display:"flex",gap:9,alignItems:"center",justifyContent:"center"}}><LogIn size={18}/>Continue with Google</button>
    <div style={{display:"flex",alignItems:"center",gap:10,margin:"18px 0",color:"#AEB8BC",fontSize:12}}><span style={{height:1,background:"#E7ECEB",flex:1}}/>OR<span style={{height:1,background:"#E7ECEB",flex:1}}/></div>
    <form onSubmit={submit} style={{display:"grid",gap:14}}>
      {mode==="register"&&<><label><span className="rm-label">Full name</span><div style={{position:"relative",marginTop:6}}><User size={17} style={{position:"absolute",left:12,top:14,color:"#6B7980"}}/><input className="rm-input" style={{paddingLeft:38}} value={fullName} onChange={event=>setFullName(event.target.value)} required/></div></label><label><span className="rm-label">Username</span><div style={{position:"relative",marginTop:6}}><AtSign size={17} style={{position:"absolute",left:12,top:14,color:"#6B7980"}}/><input className="rm-input" style={{paddingLeft:38}} value={username} onChange={event=>setUsername(event.target.value.replace(/\s/g,""))} minLength={3} maxLength={30} placeholder="example: ananya_rao" required/></div></label></>}
      <label><span className="rm-label">Email</span><div style={{position:"relative",marginTop:6}}><Mail size={17} style={{position:"absolute",left:12,top:14,color:"#6B7980"}}/><input type="email" className="rm-input" style={{paddingLeft:38}} value={email} onChange={event=>setEmail(event.target.value)} required/></div></label>
      <label><span className="rm-label">Password</span><div style={{position:"relative",marginTop:6}}><LockKeyhole size={17} style={{position:"absolute",left:12,top:14,color:"#6B7980"}}/><input type="password" minLength={8} className="rm-input" style={{paddingLeft:38}} value={password} onChange={event=>setPassword(event.target.value)} required/></div></label>
      {mode==="login"&&<div style={{fontSize:12,color:"#6B7980",textAlign:"right"}}>{!isSupabaseConfigured?"Demo password: demo12345":"Password recovery by email is currently disabled."}</div>}
      <button disabled={busy} className="so-btn so-btn-primary" style={{width:"100%",marginTop:4}}>{busy?"Please wait…":mode==="login"?"Open Evidara":"Create account & continue"}</button>
    </form>
    {message&&<div className={`so-notice ${isError?"warning":"info"}`} style={{marginTop:14}}>{message}</div>}
  </div>;
}
