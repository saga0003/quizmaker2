"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Award, FileCheck2, LoaderCircle, RefreshCw, ShieldCheck, Trophy, Users } from "lucide-react";
import { achievementRequest, type AchievementGovernanceRow } from "@/lib/achievementClient";
import styles from "./Achievements.module.css";

export function AdminAchievementGovernance(){
  const [rows,setRows]=useState<AchievementGovernanceRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{
      const payload=await achievementRequest<{rows:AchievementGovernanceRow[]}>("?scope=admin");
      setRows(payload.rows||[]);
    }catch(reason){setError(reason instanceof Error?reason.message:"Could not load achievement governance.");}
    finally{setLoading(false)}
  },[]);

  useEffect(()=>{void load()},[load]);

  const totals=useMemo(()=>rows.reduce((result,row)=>({
    active:result.active+row.active_awards,
    revoked:result.revoked+row.revoked_awards,
    certificates:result.certificates+row.active_certificates,
  }),{active:0,revoked:0,certificates:0}),[rows]);

  return <div className={styles.workspace}>
    <div className="so-page-head"><div><span className="so-kicker">V6.7 RECOGNITION GOVERNANCE</span><h1>Published rules and certificate controls</h1><p>Audit every badge definition, responsible-use note, rule version and issuance count. Evidara recognition remains evidence-specific and cannot be used for high-impact student decisions.</p></div><button className="so-btn so-btn-secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={16}/>Refresh governance</button></div>

    {error&&<div className={`${styles.notice} ${styles.noticeError}`}>{error}</div>}

    <div className={styles.summaryGrid}>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Award/></span><div><strong>{rows.length}</strong><span>active rule definitions</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><Users/></span><div><strong>{totals.active}</strong><span>active learner awards</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><FileCheck2/></span><div><strong>{totals.certificates}</strong><span>active certificates</span></div></div>
      <div className={styles.summaryCard}><span className={styles.summaryIcon}><ShieldCheck/></span><div><strong>{totals.revoked}</strong><span>revoked evidence records</span></div></div>
    </div>

    <div className={`${styles.notice} ${styles.noticeInfo}`}><ShieldCheck size={18}/><span>Governance boundary: rule definitions are versioned; raw evidence is server-only; school staff can review only their own learners; public verification is link-only; and a revoked certificate continues to verify as revoked rather than disappearing.</span></div>

    {loading?<div className={styles.empty}><LoaderCircle className="spin"/><h3>Loading published recognition rules</h3></div>:<div className={styles.ruleGrid}>{rows.map(row=><article className={`${styles.ruleCard} ${styles[row.tier]}`} key={row.code}><div className={styles.badgeIcon}><Trophy size={22}/></div><div><span className={styles.tier}>{row.tier} · {row.category}</span><h3>{row.title}</h3><p>{row.description}</p><div className={styles.criteria}>{Object.entries(row.criteria).map(([key,value])=><span key={key}><strong>{key.replaceAll("_"," ")}:</strong> {String(value)}</span>)}</div><div className={styles.governanceStats}><span>{row.active_awards} active awards</span><span>{row.revoked_awards} revoked</span><span>{row.active_certificates} certificates</span><span>Rule {row.rule_version}</span><span>{row.certificate_eligible?"Certificate eligible":"Badge only"}</span></div></div></article>)}</div>}
  </div>;
}
