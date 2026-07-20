"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, FileCheck2, LoaderCircle, RefreshCw, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { achievementRequest, type AchievementDefinition, type StudentAchievement } from "@/lib/achievementClient";
import { AchievementBadge } from "./AchievementBadge";
import styles from "./Achievements.module.css";

export function StudentAchievementWorkspace(){
  const [rows,setRows]=useState<StudentAchievement[]>([]);
  const [definitions,setDefinitions]=useState<AchievementDefinition[]>([]);
  const [loading,setLoading]=useState(true);
  const [working,setWorking]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const payload=await achievementRequest<{rows:StudentAchievement[];definitions:AchievementDefinition[]}>("");
      setRows(payload.rows||[]);setDefinitions(payload.definitions||[]);
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not load achievements.");}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{void load()},[load]);

  async function act(action:string,body:Record<string,unknown>={}){
    setWorking(action+String(body.achievementId||body.certificateId||""));setError("");setNotice("");
    try{
      await achievementRequest("",{method:"POST",body:JSON.stringify({action,...body})});
      setNotice(action==="issue_certificate"?"Your verifiable certificate is ready.":action==="revoke_certificate"?"The certificate was withdrawn and now verifies as revoked.":"Achievement evidence refreshed.");
      await load();
    }catch(reason){setError(reason instanceof Error?reason.message:"Achievement action failed.");}
    finally{setWorking("")}
  }

  const active=rows.filter(item=>item.status==="active");
  const certificateCount=rows.filter(item=>item.certificate?.status==="active").length;
  const earnedCodes=new Set(active.map(item=>item.definition_code));
  const available=definitions.filter(item=>!earnedCodes.has(item.code));
  const highestTier=useMemo(()=>{
    const order={bronze:1,silver:2,gold:3,platinum:4};
    return active.reduce((best,item)=>order[item.definition.tier]>order[best]?item.definition.tier:best,"bronze" as keyof typeof order);
  },[active]);

  return <div className={styles.workspace}>
    <div className="so-page-head"><div><span className="so-kicker">V6.7 EVIDENCE-BACKED RECOGNITION</span><h1>My achievements and certificates</h1><p>Every badge cites the exact submitted evidence and a published rule version. Achievements recognise a current result or milestone; they do not define ability or predict future performance.</p></div><button className="so-btn so-btn-secondary" disabled={Boolean(working)} onClick={()=>void act("evaluate")}><RefreshCw size={16}/>Refresh evidence</button></div>

    {error&&<div className={`${styles.notice} ${styles.noticeError}`}>{error}</div>}
    {notice&&<div className={`${styles.notice} ${styles.noticeSuccess}`}><ShieldCheck size={17}/>{notice}</div>}

    <div className={styles.summaryGrid}>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Award/></span><div><strong>{active.length}</strong><span>active achievements</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><FileCheck2/></span><div><strong>{certificateCount}</strong><span>verifiable certificates</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Trophy/></span><div><strong style={{textTransform:"capitalize"}}>{active.length?highestTier:"—"}</strong><span>highest current tier</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Sparkles/></span><div><strong>{definitions.length?Math.round((active.length/definitions.length)*100):0}%</strong><span>published rules achieved</span></div></div>
    </div>

    <div className={`${styles.notice} ${styles.noticeInfo}`}><ShieldCheck size={18}/><span>Certificates use link-only verification. Anyone with the verification link can confirm the learner name, school, achievement, evidence summary, issue date and current validity. Certificate pages are marked not to be indexed by search engines.</span></div>

    {loading?<div className={styles.empty}><LoaderCircle className="spin"/><h3>Evaluating submitted evidence</h3><p>Checking current attempts, growth windows and private benchmark contributions.</p></div>:<>
      <section><div className="so-section-head"><div><span className="so-kicker">EARNED RECOGNITION</span><h2>Current evidence-backed badges</h2></div><Link className={styles.secondaryButton} href="/verify/certificate/">Verify a certificate</Link></div>
        {rows.length?<div className={styles.badgeGrid}>{rows.map(item=><AchievementBadge key={item.id} item={item} working={Boolean(working)} onIssue={achievementId=>void act("issue_certificate",{achievementId})} onRevokeCertificate={certificateId=>{if(window.confirm("Withdraw this public verification certificate? The achievement badge will remain."))void act("revoke_certificate",{certificateId,reason:"withdrawn_by_learner"})}}/>)}</div>:<div className={styles.empty}><Award size={32}/><h3>No achievements yet</h3><p>Complete a verified assessment to create the first evidence milestone.</p></div>}
      </section>

      <section className="so-card so-pad"><div className="so-section-head"><div><span className="so-kicker">TRANSPARENT RULES</span><h2>Recognition still available</h2><p style={{margin:0,color:"#697386",fontSize:12}}>The criteria are visible before an award is earned. Rules can change only through a new published rule version.</p></div></div>
        <div className={styles.ruleGrid}>{available.map(definition=><article className={`${styles.ruleCard} ${styles[definition.tier]}`} key={definition.code}><div className={styles.badgeIcon}><Award size={22}/></div><div><span className={styles.tier}>{definition.tier} · {definition.category}</span><h3>{definition.title}</h3><p>{definition.description}</p><div className={styles.criteria}>{Object.entries(definition.criteria).map(([key,value])=><span key={key}><strong>{key.replaceAll("_"," ")}:</strong> {String(value)}</span>)}</div></div></article>)}</div>
        {available.length===0&&<div className={styles.empty}><Trophy/><h3>All current recognition rules achieved</h3><p>Future evidence can still refresh or revoke temporary evidence-window awards.</p></div>}
      </section>
    </>}
  </div>;
}
