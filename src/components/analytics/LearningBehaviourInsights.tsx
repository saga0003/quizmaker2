"use client";

import { Activity, AlertTriangle, Brain, CheckCircle2, Clock3, Gauge, Info, RefreshCcw, ShieldCheck, Target } from "lucide-react";
import { evaluateLearningBehaviour, learningBehaviourDisclaimer, type BehaviourMetric } from "@/lib/learningBehaviourMetrics";

const demoEvidence = {
  comparableAssessments: 5,
  validResponses: 250,
  accuracyFirstThird: 88,
  accuracyMiddleThird: 82,
  accuracyFinalThird: 69,
  medianCorrectTimeSeconds: 61,
  medianIncorrectTimeSeconds: 84,
  rapidIncorrectRate: 11,
  overtimeIncorrectRate: 18,
  answerChangesCorrectToWrong: 5,
  answerChangesWrongToCorrect: 8,
  easySkippedRate: 7,
  hardAttemptRate: 72,
  scoreCoefficientOfVariation: 9.8,
  postErrorAccuracy: 68,
  baselineAccuracy: 81,
  revisionGain: 12,
  retentionAfter21Days: 74,
};

const iconById:Record<string,typeof Brain> = {
  "exam-endurance": Activity,
  "decision-balance": Gauge,
  "review-discipline": CheckCircle2,
  "question-selection": Target,
  "performance-consistency": RefreshCcw,
  "recovery-after-error": ShieldCheck,
  "revision-effectiveness": Brain,
  "speed-accuracy-control": Clock3,
};

function metricStatus(metric:BehaviourMetric){
  if(metric.band === "strength") return "Current strength";
  if(metric.band === "stable") return "Generally stable";
  if(metric.band === "watch") return "Worth monitoring";
  if(metric.band === "priority") return "Development priority";
  return "Limited evidence";
}

export function LearningBehaviourInsights(){
  const metrics=evaluateLearningBehaviour(demoEvidence);
  const scored=metrics.filter(metric=>metric.score!==null);
  const overall=scored.length ? Math.round(scored.reduce((sum,metric)=>sum+(metric.score||0),0)/scored.length) : null;
  const priorities=scored.filter(metric=>metric.band==="priority"||metric.band==="watch").slice(0,3);

  return <div className="lb-page">
    <div className="so-page-head">
      <div>
        <span className="so-kicker">LEARNING BEHAVIOUR INSIGHTS</span>
        <h1>Patterns behind the assessment result</h1>
        <p>Rule-based observations from repeated performance, question timing, attempt order and answer-review behaviour. This view explains current patterns without labelling the learner.</p>
      </div>
      <span className="so-status success">Non-AI · rules version 2026.07-v1</span>
    </div>

    <section className="lb-hero">
      <div>
        <span className="so-kicker light">CURRENT EVIDENCE SUMMARY</span>
        <h2>{overall===null?"More evidence required":`${overall}/100 behaviour evidence index`}</h2>
        <p>{overall!==null&&overall>=70?"The learner shows a generally stable assessment approach, with specific opportunities in endurance and post-error recovery.":"Use the component evidence below before deciding the next action."}</p>
        <div className="lb-evidence-window"><span>5 comparable assessments</span><span>250 valid responses</span><span>12 May–14 July</span></div>
      </div>
      <div className="lb-index-ring"><strong>{overall??"—"}</strong><span>reference index</span></div>
    </section>

    <div className="lb-disclaimer">
      <AlertTriangle size={20}/><div><strong>{learningBehaviourDisclaimer.title}</strong><p>{learningBehaviourDisclaimer.body}</p><small>{learningBehaviourDisclaimer.nonAi}</small></div>
    </div>

    <section className="so-card so-pad so-mt">
      <div className="so-section-head"><div><span className="so-kicker">PRIORITY VIEW</span><h2>What may improve the next result</h2></div><Target/></div>
      <div className="lb-priority-grid">{priorities.map((metric,index)=><article key={metric.id}><b>{index+1}</b><div><strong>{metric.title}</strong><p>{metric.nextStep}</p></div></article>)}</div>
    </section>

    <div className="lb-metric-grid so-mt">{metrics.map(metric=>{
      const Icon=iconById[metric.id]||Info;
      return <article className={`lb-metric-card ${metric.band}`} key={metric.id}>
        <div className="lb-card-head"><span><Icon size={20}/></span><div><small>{metricStatus(metric)}</small><h3>{metric.title}</h3></div><strong>{metric.score??"—"}</strong></div>
        <p className="lb-summary">{metric.summary}</p>
        <div className="lb-score-track"><i style={{width:`${metric.score??0}%`}}/></div>
        <div className="lb-evidence"><span>Observed evidence</span>{metric.evidence.map(item=><small key={item}>{item}</small>)}</div>
        <div className="lb-next"><span>Recommended next step</span><p>{metric.nextStep}</p></div>
        <details><summary>How to interpret this measure</summary><p><b>Minimum evidence:</b> {metric.minimumEvidence}</p><p><b>Research basis:</b> {metric.studyBasis}</p></details>
      </article>
    })}</div>

    <section className="so-card so-pad so-mt">
      <div className="so-section-head"><div><span className="so-kicker">INTERPRETATION BOUNDARY</span><h2>What this module can and cannot say</h2></div><ShieldCheck/></div>
      <div className="lb-boundary-grid">
        <div><CheckCircle2/><strong>It can support</strong><p>Study planning, exam-strategy reflection, teacher discussion, targeted practice and comparison with the learner's own future evidence.</p></div>
        <div><AlertTriangle/><strong>It cannot establish</strong><p>Anxiety, ADHD, depression, intelligence, personality, motivation, a learning disability or any psychological or medical diagnosis.</p></div>
      </div>
    </section>
  </div>;
}
