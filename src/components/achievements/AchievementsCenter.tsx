"use client";

import { Award, BadgeCheck, Download, Medal, Printer, ShieldCheck, Sparkles, Target, TrendingUp } from "lucide-react";
import { useState } from "react";

const badges=[
 {name:"Evidence Explorer",description:"Completed the first valid Evidara assessment cycle.",icon:Sparkles,earned:true},
 {name:"Consistent Improver",description:"Improved across three comparable assessments without an accuracy decline.",icon:TrendingUp,earned:true},
 {name:"Accuracy Builder",description:"Reached at least 80% accuracy in a full assessment.",icon:Target,earned:true},
 {name:"Pacing Progress",description:"Reduced overtime questions in two consecutive assessments.",icon:Medal,earned:false},
 {name:"Shared Evidence Contributor",description:"Completed an anonymous shared-paper benchmark.",icon:ShieldCheck,earned:true},
];

async function assetDataUrl(path:string){
 const response=await fetch(path);const blob=await response.blob();
 return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob)});
}

export function AchievementsCenter(){
 const [downloading,setDownloading]=useState(false);
 async function downloadCertificate(){
  setDownloading(true);
  try{
   const logo=await assetDataUrl("/brand/evidara-master.svg");
   const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1120" viewBox="0 0 1600 1120"><rect width="1600" height="1120" fill="#F7F9F7"/><rect x="44" y="44" width="1512" height="1032" rx="34" fill="#FFFFFF" stroke="#DCE9E7" stroke-width="3"/><path d="M0 905 C320 760 520 1045 850 875 C1120 735 1320 850 1600 690 V1120 H0Z" fill="#DCE9E7"/><circle cx="1430" cy="150" r="26" fill="#F2B84B"/><image href="${logo}" x="110" y="90" width="500" height="184" preserveAspectRatio="xMinYMin meet"/><text x="800" y="390" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="28" font-weight="700" fill="#0E5A5A" letter-spacing="5">CERTIFICATE OF PARTICIPATION</text><text x="800" y="510" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="62" font-weight="800" fill="#14232B">Ananya Rao</text><text x="800" y="590" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="26" fill="#44545C">has completed the Evidara Assessment and Development Programme</text><text x="800" y="650" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="24" fill="#44545C">and demonstrated consistent evidence of improvement across five assessments.</text><line x1="240" y1="820" x2="590" y2="820" stroke="#AEB8BC" stroke-width="2"/><line x1="1010" y1="820" x2="1360" y2="820" stroke="#AEB8BC" stroke-width="2"/><text x="415" y="862" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="20" fill="#44545C">School representative</text><text x="1185" y="862" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="20" fill="#44545C">Evidara verification</text><text x="110" y="1010" font-family="Inter,Arial,sans-serif" font-size="18" fill="#6B7980">Evidence-Driven Student Development · Certificate ID EVI-DEMO-2026-001</text></svg>`;
   const url=URL.createObjectURL(new Blob([svg],{type:"image/svg+xml"}));const anchor=document.createElement("a");anchor.href=url;anchor.download="Evidara_Certificate_Ananya_Rao.svg";anchor.click();URL.revokeObjectURL(url);
  }finally{setDownloading(false)}
 }
 return <div>
  <div className="so-page-head"><div><span className="so-kicker">EVIDARA ACHIEVEMENTS</span><h1>Progress worth recognising</h1><p>Badges recognise evidence and effort without turning one mark into a permanent label. Certificates use the approved Evidara identity and can be downloaded or printed.</p></div><div className="so-action-row"><button className="rm-btn-secondary" onClick={()=>window.print()}><Printer size={16}/>Print certificate</button><button className="so-btn so-btn-primary" disabled={downloading} onClick={()=>void downloadCertificate()}><Download size={16}/>{downloading?"Preparing…":"Download certificate"}</button></div></div>
  <section className="ev-certificate-preview"><div className="ev-certificate-logo"><img src="/brand/evidara-master.svg" alt="Evidara"/></div><span>CERTIFICATE OF PARTICIPATION</span><h2>Ananya Rao</h2><p>Completed the Evidara Assessment and Development Programme and demonstrated consistent evidence of improvement across five assessments.</p><div className="ev-certificate-signatures"><div><i/>School representative</div><div><i/>Evidara verification</div></div><small>Certificate ID EVI-DEMO-2026-001</small></section>
  <section className="so-card so-pad so-mt"><div className="so-section-head"><div><span className="so-kicker">BADGE WALLET</span><h2>Current evidence badges</h2></div><Award/></div><div className="ev-badge-grid">{badges.map(({name,description,icon:Icon,earned})=><article key={name} className={`ev-badge-card ${earned?"earned":"locked"}`}><div className="ev-badge-symbol"><Icon/></div><div><span>{earned?"EARNED":"NEXT MILESTONE"}</span><h3>{name}</h3><p>{description}</p></div>{earned&&<BadgeCheck className="ev-badge-check"/>}</article>)}</div></section>
  <div className="so-notice info so-mt"><ShieldCheck/><span>Achievements are issued from defined evidence rules. They never claim guaranteed success, and schools may add their own logo beside Evidara using the approved co-branding arrangement.</span></div>
 </div>
}
