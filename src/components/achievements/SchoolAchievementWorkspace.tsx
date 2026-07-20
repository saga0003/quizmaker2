"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, FileCheck2, LoaderCircle, RefreshCw, Search, ShieldCheck, Trophy, Users } from "lucide-react";
import { achievementRequest, type AchievementDefinition, type SchoolAchievementRow } from "@/lib/achievementClient";
import styles from "./Achievements.module.css";

export function SchoolAchievementWorkspace(){
  const [rows,setRows]=useState<SchoolAchievementRow[]>([]);
  const [definitions,setDefinitions]=useState<AchievementDefinition[]>([]);
  const [summary,setSummary]=useState({active_awards:0,certificate_count:0,students_recognised:0});
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState("");
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [tier,setTier]=useState("all");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const payload=await achievementRequest<{rows:SchoolAchievementRow[];definitions:AchievementDefinition[];summary:typeof summary}>("?scope=school");
      setRows(payload.rows||[]);setDefinitions(payload.definitions||[]);setSummary(payload.summary||{active_awards:0,certificate_count:0,students_recognised:0});
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not load school achievements.");}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{void load()},[load]);

  async function act(action:string,body:Record<string,unknown>={}){
    setWorking(action+String(body.achievementId||body.certificateId||""));setError("");setNotice("");
    try{
      const result=await achievementRequest<{studentsEvaluated?:number}>("",{method:"POST",body:JSON.stringify({action,...body})});
      setNotice(action==="backfill"?`${result.studentsEvaluated??0} active students were evaluated against the published rules.`:action==="issue_certificate"?"Certificate issued with link-only verification.":action.includes("certificate")?"Certificate status updated.":"Achievement status updated after school review.");
      await load();
    }catch(reason){setError(reason instanceof Error?reason.message:"School achievement action failed.");}
    finally{setWorking("")}
  }

  const filtered=useMemo(()=>rows.filter(row=>{
    const term=query.trim().toLowerCase();
    return (!term||row.student_name.toLowerCase().includes(term)||row.definition.title.toLowerCase().includes(term)||row.definition.category.includes(term))
      &&(status==="all"||row.status===status)
      &&(tier==="all"||row.definition.tier===tier);
  }),[query,rows,status,tier]);

  return <div className={styles.workspace}>
    <div className="so-page-head"><div><span className="so-kicker">V6.7 SCHOOL RECOGNITION OPERATIONS</span><h1>Achievements and certificates</h1><p>Review the school’s named learners, issue certificates from active evidence, and withdraw recognition only with an auditable reason. No public leaderboard is created.</p></div><button className="so-btn so-btn-primary" disabled={Boolean(working)} onClick={()=>void act("backfill")}><RefreshCw size={16}/>Evaluate all active students</button></div>

    {error&&<div className={`${styles.notice} ${styles.noticeError}`}>{error}</div>}
    {notice&&<div className={`${styles.notice} ${styles.noticeSuccess}`}><ShieldCheck size={17}/>{notice}</div>}

    <div className={styles.summaryGrid}>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Award/></span><div><strong>{summary.active_awards}</strong><span>active evidence-backed awards</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Users/></span><div><strong>{summary.students_recognised}</strong><span>students recognised</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><FileCheck2/></span><div><strong>{summary.certificate_count}</strong><span>active verifiable certificates</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Trophy/></span><div><strong>{definitions.length}</strong><span>published rule definitions</span></div></div>
    </div>

    <div className={`${styles.notice} ${styles.noticeInfo}`}><ShieldCheck size={18}/><span>School staff can see names only for their own learners. Certificate links disclose a limited snapshot to the link holder and are explicitly excluded from search indexing. Automatically revoked evidence cannot be restored by school staff.</span></div>

    <section className="so-card so-pad">
      <div className={styles.toolbar}>
        <div className={styles.search}><Search size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search student, award or category"/></div>
        <div className={styles.filters}><select value={status} onChange={event=>setStatus(event.target.value)}><option value="all">All statuses</option><option value="active">Active</option><option value="revoked">Revoked</option></select><select value={tier} onChange={event=>setTier(event.target.value)}><option value="all">All tiers</option><option value="bronze">Bronze</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option></select></div>
      </div>
    </section>

    {loading?<div className={styles.empty}><LoaderCircle className="spin"/><h3>Loading school recognition evidence</h3></div>:<div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Student</th><th>Achievement</th><th>Evidence snapshot</th><th>Awarded</th><th>Status</th><th>Certificate</th><th>Review actions</th></tr></thead><tbody>{filtered.map(row=>{
      const certificate=row.certificate;
      const hasActiveCertificate=certificate?.status==="active";
      const evidence=Object.entries(row.evidence).filter(([,value])=>value!==null&&value!==undefined).slice(0,3).map(([key,value])=>`${key.replaceAll("_"," ")}: ${String(value)}`).join(" · ");
      return <tr key={row.id}><td className={styles.studentCell}><strong>{row.student_name}</strong><small>{row.student_email||"School learner"}</small></td><td><span className={`${styles.miniBadge} ${styles[row.definition.tier]}`}><span className={styles.miniIcon}><Award size={16}/></span><span><strong>{row.definition.title}</strong><small>{row.definition.tier} · {row.definition.category}</small></span></span></td><td>{evidence||"Verified evidence available"}</td><td>{new Date(row.awarded_at).toLocaleDateString("en-IN")}</td><td><span className={`${styles.status} ${row.status==="active"?styles.active:styles.statusRevoked}`}>{row.status}</span></td><td>{certificate?<><span className={`${styles.status} ${hasActiveCertificate?styles.active:styles.statusRevoked}`}>{certificate.status}</span><small style={{display:"block",marginTop:5}}>{certificate.certificate_number}</small></>:row.definition.certificate_eligible&&row.status==="active"?"Eligible":"Not issued"}</td><td><div className={styles.actions}>{certificate&&<Link className={styles.secondaryButton} href={`/verify/certificate/${certificate.verification_code}/`}>{hasActiveCertificate?"View":"View revoked"}</Link>}{hasActiveCertificate&&<button className={styles.dangerButton} disabled={Boolean(working)} onClick={()=>{if(window.confirm(`Withdraw ${row.student_name}'s certificate?`))void act("revoke_certificate",{certificateId:certificate.id,reason:"withdrawn_after_school_review"})}}>Withdraw certificate</button>}{!hasActiveCertificate&&row.definition.certificate_eligible&&row.status==="active"&&<button className={styles.primaryButton} disabled={Boolean(working)} onClick={()=>void act("issue_certificate",{achievementId:row.id})}>{certificate?"Reissue certificate":"Issue certificate"}</button>}{row.status==="active"&&<button className={styles.dangerButton} disabled={Boolean(working)} onClick={()=>{const reason=window.prompt("Reason for revoking this achievement:","Evidence requires manual review");if(reason)void act("revoke_achievement",{achievementId:row.id,reason})}}>Revoke award</button>}</div></td></tr>})}</tbody></table>{filtered.length===0&&<div className={styles.empty}><Award/><h3>No matching achievement records</h3><p>Change the filters or evaluate active students.</p></div>}</div>}
  </div>;
}
