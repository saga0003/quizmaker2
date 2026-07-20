"use client";

import Link from "next/link";
import { Award, Download, Flag, Layers3, Medal, Network, ShieldCheck, Star, TrendingUp, Trophy } from "lucide-react";
import type { StudentAchievement } from "@/lib/achievementClient";
import styles from "./Achievements.module.css";

const icons = {
  flag: Flag,
  star: Star,
  trophy: Trophy,
  "trending-up": TrendingUp,
  layers: Layers3,
  shield: ShieldCheck,
  network: Network,
  medal: Medal,
};

function evidenceSummary(item: StudentAchievement) {
  const evidence = item.evidence;
  switch (item.definition_code) {
    case "first_assessment": return `${String(evidence.submitted_attempts ?? 1)} verified assessment${Number(evidence.submitted_attempts ?? 1) === 1 ? "" : "s"} completed.`;
    case "assessment_excellence": return `${String(evidence.percentage ?? "90+")}% on ${String(evidence.paper_title ?? "a verified assessment")} · ${String(evidence.question_count ?? "10+")} questions.`;
    case "perfect_score": return `100% on ${String(evidence.paper_title ?? "a verified assessment")} · ${String(evidence.question_count ?? "5+")} questions.`;
    case "growth_milestone": return `${String(evidence.previous_percentage ?? "Earlier")}% → ${String(evidence.current_percentage ?? "Current")}% in comparable ${String(evidence.exam_type ?? "assessment")} evidence.`;
    case "consistent_performer": return `Minimum ${String(evidence.minimum_percentage ?? 75)}% and average ${String(evidence.average_percentage ?? "—")}% across three recent assessments.`;
    case "integrity_streak": return `Five recent assessments with ${String(evidence.maximum_recorded_integrity_events ?? 0)} recorded integrity events.`;
    case "benchmark_participant": return `Valid shared benchmark contribution · ${String(evidence.percentage ?? "—")}% on the exact paper version.`;
    case "benchmark_top_decile": return `${String(evidence.external_percentile ?? "90+")}th external percentile after privacy thresholds were satisfied.`;
    default: return "Awarded from verified Evidara assessment evidence.";
  }
}

export function AchievementBadge({ item, working, onIssue, onRevokeCertificate }: {
  item: StudentAchievement;
  working?: boolean;
  onIssue?: (achievementId: string) => void;
  onRevokeCertificate?: (certificateId: string) => void;
}) {
  const Icon = icons[item.definition.icon_key as keyof typeof icons] ?? Award;
  const tierClass = styles[item.definition.tier];
  const activeCertificate = item.certificate?.status === "active" ? item.certificate : null;
  return <article className={`${styles.badgeCard} ${tierClass} ${item.status === "revoked" ? styles.revoked : ""}`}>
    <div className={styles.badgeTop}>
      <div className={styles.badgeIcon}><Icon size={28}/></div>
      <span className={styles.tier}>{item.definition.tier} · {item.status}</span>
    </div>
    <h3>{item.definition.title}</h3>
    <p className={styles.description}>{item.definition.description}</p>
    <div className={styles.evidence}>
      <strong>Evidence used</strong>
      <p>{evidenceSummary(item)}</p>
    </div>
    <div className={styles.badgeFooter}>
      <small>Rule {item.rule_version}<br/>{new Date(item.awarded_at).toLocaleDateString("en-IN")}</small>
      <div className={styles.actions}>
        {activeCertificate&&<>
          <Link className={styles.secondaryButton} href={`/verify/certificate/${activeCertificate.verification_code}/`}><Award size={14}/>View</Link>
          <a className={styles.secondaryButton} href={`/api/certificates?code=${encodeURIComponent(activeCertificate.verification_code)}&format=svg`}><Download size={14}/>SVG</a>
          {onRevokeCertificate&&<button className={styles.dangerButton} disabled={working} onClick={()=>onRevokeCertificate(activeCertificate.id)}>Withdraw</button>}
        </>}
        {!activeCertificate&&item.status==="active"&&item.definition.certificate_eligible&&onIssue&&<button className={styles.primaryButton} disabled={working} onClick={()=>onIssue(item.id)}><Award size={14}/>Issue certificate</button>}
      </div>
    </div>
  </article>;
}
