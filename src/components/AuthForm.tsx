"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, LockKeyhole, Mail, User, LogIn } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type Mode="login"|"register";
export function AuthForm(){
 const [mode,setMode]=useState<Mode>("login");const [fullName,setFullName]=useState("");const [username,setUsername]=useState("");const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [message,setMessage]=useState("");const [isError,setIsError]=useState(false);const [busy,setBusy]=useState(false);const router=useRouter();
 const afterLogin=()=>{const saved=localStorage.getItem("scholaros_after_login");localStorage.removeItem("scholaros_after_login");return saved||""};
 async function routeByRole(userId:string){if(!supabase)return router.push("/student/");const saved=afterLogin();if(saved)return router.push(saved);const {data:profile}=await supabase.from("profiles").select("role").eq("id",userId).maybeSingle();const role=profile?.role;router.push(role==="super_admin"?"/admin/":((role?.startsWith("school_")||role?.startsWith("institute_"))||["teacher","reviewer","invigilator"].includes(role||""))?"/school/":"/student/")}
 async function submit(e:React.FormEvent){e.preventDefault();setMessage("");setIsError(false);if(!supabase){localStorage.setItem("scholaros_demo_user",JSON.stringify({email,fullName:fullName||"Demo Student",username:username||"demo_student"}));router.push(afterLogin()||"/student/");return;}setBusy(true);try{
   if(mode==="register"){
    const cleanUsername=username.trim();
    if(!/^[A-Za-z0-9._-]{3,30}$/.test(cleanUsername))throw new Error("Username must be 3–30 characters and use only letters, numbers, dot, underscore or hyphen.");
    const {data:available,error:availabilityError}=await supabase.rpc("is_username_available",{p_username:cleanUsername});if(availabilityError)throw availabilityError;if(!available)throw new Error("That username is already taken. Choose another username.");
    const {data,error}=await supabase.auth.signUp({email,password,options:{data:{full_name:fullName.trim(),username:cleanUsername}}});if(error)throw error;
    if(data.session&&data.user){setMessage("Account created. Opening your dashboard…");await routeByRole(data.user.id)}else throw new Error("Account was created but no session was returned. In Supabase, turn off Authentication → Providers → Email → Confirm email.");
   }else{const {data,error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await routeByRole(data.user.id)}
  }catch(err){setIsError(true);setMessage(err instanceof Error?err.message:"Authentication failed");}finally{setBusy(false)}}
 async function google(){setMessage("");if(!supabase){router.push(afterLogin()||"/student/");return;}const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:`${window.location.origin}/auth/callback/`,queryParams:{prompt:"select_account"}}});if(error){setIsError(true);setMessage(error.message)}}
 return <div className="rm-card" style={{padding:24,maxWidth:470,width:"100%"}}>
  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",background:"#f2f4f7",padding:4,borderRadius:12,marginBottom:22}}><button onClick={()=>{setMode("login");setMessage("")}} style={{border:0,borderRadius:9,padding:10,fontWeight:800,background:mode==="login"?"white":"transparent"}}>Login</button><button onClick={()=>{setMode("register");setMessage("")}} style={{border:0,borderRadius:9,padding:10,fontWeight:800,background:mode==="register"?"white":"transparent"}}>Register</button></div>
  <h1 style={{fontSize:26,margin:"0 0 6px",color:"#131e35"}}>{mode==="login"?"Welcome back":"Create your account"}</h1><p style={{margin:"0 0 20px",color:"#667085"}}>{!isSupabaseConfigured?"Demo Mode: any details will open the dashboard.":mode==="register"?"No manual email verification. Register and start immediately.":"Use Google or your email and password."}</p>
  <button onClick={google} className="rm-btn-secondary" style={{width:"100%",display:"flex",gap:9,alignItems:"center",justifyContent:"center"}}><LogIn size={18}/>Continue with Google</button><div style={{display:"flex",alignItems:"center",gap:10,margin:"18px 0",color:"#98a2b3",fontSize:12}}><span style={{height:1,background:"#e4e7ec",flex:1}}/>OR<span style={{height:1,background:"#e4e7ec",flex:1}}/></div>
  <form onSubmit={submit} style={{display:"grid",gap:14}}>{mode==="register"&&<><label><span className="rm-label">Full name</span><div style={{position:"relative",marginTop:6}}><User size={17} style={{position:"absolute",left:12,top:13,color:"#98a2b3"}}/><input className="rm-input" style={{paddingLeft:38}} value={fullName} onChange={e=>setFullName(e.target.value)} required/></div></label><label><span className="rm-label">Username</span><div style={{position:"relative",marginTop:6}}><AtSign size={17} style={{position:"absolute",left:12,top:13,color:"#98a2b3"}}/><input className="rm-input" style={{paddingLeft:38}} value={username} onChange={e=>setUsername(e.target.value.replace(/\s/g,""))} minLength={3} maxLength={30} placeholder="example: sagar_neet" required/></div><small style={{color:"#667085"}}>Your public account name. Login still uses email and password.</small></label></>}
   <label><span className="rm-label">Email</span><div style={{position:"relative",marginTop:6}}><Mail size={17} style={{position:"absolute",left:12,top:13,color:"#98a2b3"}}/><input type="email" className="rm-input" style={{paddingLeft:38}} value={email} onChange={e=>setEmail(e.target.value)} required/></div></label>
   <label><span className="rm-label">Password</span><div style={{position:"relative",marginTop:6}}><LockKeyhole size={17} style={{position:"absolute",left:12,top:13,color:"#98a2b3"}}/><input type="password" minLength={8} className="rm-input" style={{paddingLeft:38}} value={password} onChange={e=>setPassword(e.target.value)} required/></div></label>
   {mode==="login"&&<div style={{fontSize:12,color:"#667085",textAlign:"right"}}>Password recovery by email is intentionally disabled for now.</div>}
   <button disabled={busy} className="rm-btn-primary" style={{width:"100%",marginTop:4}}>{busy?"Please wait…":mode==="login"?"Login":"Create account & continue"}</button>
  </form>{message&&<div style={{marginTop:14,padding:12,borderRadius:10,background:isError?"#fef3f2":"#ecfdf3",color:isError?"#b42318":"#137a3a",fontSize:13}}>{message}</div>}
 </div>
}
