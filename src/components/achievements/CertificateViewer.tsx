"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Download, LoaderCircle, Printer, Search, ShieldAlert, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import type { PublicCertificate } from "@/lib/achievementClient";
import styles from "./Achievements.module.css";

export function CertificateViewer({code}:{code?:string}){
  const [certificate,setCertificate]=useState<PublicCertificate|null>(null);
  const [loading,setLoading]=useState(Boolean(code));
  const [error,setError]=useState("");
  const [entry,setEntry]=useState(code??"");

  useEffect(()=>{
    if(!code)return;
    setLoading(true);setError("");
    void fetch(`/api/certificates?code=${encodeURIComponent(code)}`,{cache:"no-store"})
      .then(async response=>{const payload=await response.json() as {certificate?:PublicCertificate;error?:string};if(!response.ok)throw new Error(payload.error||"Certificate verification failed.");setCertificate(payload.certificate??null)})
      .catch(reason=>setError(reason instanceof Error?reason.message:"Certificate verification failed."))
      .finally(()=>setLoading(false));
  },[code]);

  function verify(event:React.FormEvent){
    event.preventDefault();
    const value=entry.trim().toLowerCase();
    if(value)window.location.href=`/verify/certificate/${encodeURIComponent(value)}/`;
  }

  if(!code)return <main className={styles.verifyPage}><div className={styles.verifyNav}><Link href="/"><Logo/></Link><Link className={styles.secondaryButton} href="/login/">Open Evidara</Link></div><section className={styles.verificationForm}><span className="so-kicker">LINK-ONLY VERIFICATION</span><h1>Verify an Evidara certificate</h1><p>Enter the verification code printed on the certificate. The result confirms the limited award snapshot and whether the certificate is currently active or revoked.</p><form onSubmit={verify}><input value={entry} onChange={event=>setEntry(event.target.value)} placeholder="e.g. demo-evidara-2026" aria-label="Certificate verification code"/><button type="submit"><Search size={16}/>Verify</button></form><div className={`${styles.notice} ${styles.noticeInfo}`} style={{marginTop:18}}><ShieldCheck size={17}/><span>Verification pages are not indexed. A valid link does not expose assessment answers, marks history, contact information or other student records.</span></div></section></main>;

  if(loading)return <main className={styles.verifyPage}><div className={styles.loading}><div><LoaderCircle className="spin"/><p>Verifying Evidara certificate…</p></div></div></main>;

  if(error||!certificate)return <main className={styles.verifyPage}><div className={styles.verifyNav}><Link href="/"><Logo/></Link></div><section className={styles.verificationForm}><ShieldAlert size={34} color="#B54747"/><span className="so-kicker">VERIFICATION FAILED</span><h1>Certificate not found</h1><p>{error||"No Evidara certificate matches this verification code."}</p><Link className={styles.primaryButton} href="/verify/certificate/">Try another code</Link></section></main>;

  const revoked=certificate.status==="revoked";
  return <main className={styles.verifyPage}>
    <div className={styles.verifyNav}><Link href="/"><Logo/></Link><div className={styles.verifyActions}><Link className={styles.secondaryButton} href="/verify/certificate/">Verify another</Link><a className={styles.secondaryButton} href={`/api/certificates?code=${encodeURIComponent(certificate.verification_code)}&format=svg`}><Download size={15}/>Download SVG</a><button className={styles.primaryButton} onClick={()=>window.print()}><Printer size={15}/>Print / Save PDF</button></div></div>
    <div className={`${styles.verificationState} ${revoked?styles.revokedCertificate:styles.verified}`}>{revoked?<><ShieldAlert size={17}/>This certificate was issued by Evidara but is currently revoked.</>:<><CheckCircle2 size={17}/>Verified active Evidara certificate</>}</div>
    <div className={styles.certificateOuter}><article className={styles.certificatePaper}>{revoked&&<div className={styles.revokedStamp}>REVOKED</div>}<div className={styles.certificateContent}>
      <div className={styles.certificateBrand}><Logo/></div>
      <div className={styles.certificateEyebrow}>Certificate of Achievement</div><div className={styles.certificateLine}/>
      <div className={styles.presented}>This evidence-backed recognition is presented to</div>
      <h1 className={styles.recipient}>{certificate.student_name}</h1><div className={styles.schoolName}>of {certificate.organization_name}</div>
      <div className={styles.awardTitle}>{certificate.achievement_title}</div><p className={styles.awardDescription}>{certificate.achievement_description}</p><p className={styles.evidenceSummary}>{certificate.evidence_summary}</p>
      <div className={styles.seal}><ShieldCheck size={48}/></div>
      <div className={styles.certificateMeta}><div><strong>Issued</strong><br/>{new Date(certificate.issued_at).toLocaleDateString("en-IN",{day:"2-digit",month:"long",year:"numeric",timeZone:"UTC"})}<br/>Rule {certificate.rule_version}</div><div><strong>{certificate.certificate_number}</strong><br/>Verification code<br/>{certificate.verification_code}</div></div>
      <div className={styles.certificateNote}>This certificate recognises the cited evidence only. It is not a prediction, permanent label or guarantee of a future result.</div>
    </div></article></div>
    {revoked&&<div className={`${styles.notice} ${styles.noticeError}`} style={{maxWidth:1180,margin:"18px auto 0"}}><ShieldAlert size={17}/><span>Revoked on {certificate.revoked_at?new Date(certificate.revoked_at).toLocaleDateString("en-IN"):"a recorded date"}. Reason: {certificate.revoked_reason?.replaceAll("_"," ")||"certificate withdrawn"}.</span></div>}
  </main>;
}
