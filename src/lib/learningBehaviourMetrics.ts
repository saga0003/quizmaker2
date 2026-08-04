export type BehaviourBand = "strength" | "stable" | "watch" | "priority" | "limited";

export type BehaviourMetric = {
  id: string;
  title: string;
  score: number | null;
  band: BehaviourBand;
  summary: string;
  evidence: string[];
  nextStep: string;
  minimumEvidence: string;
  studyBasis: string;
};

export type BehaviourEvidence = {
  comparableAssessments: number;
  validResponses: number;
  accuracyFirstThird: number;
  accuracyMiddleThird: number;
  accuracyFinalThird: number;
  medianCorrectTimeSeconds: number;
  medianIncorrectTimeSeconds: number;
  rapidIncorrectRate: number;
  overtimeIncorrectRate: number;
  answerChangesCorrectToWrong: number;
  answerChangesWrongToCorrect: number;
  easySkippedRate: number;
  hardAttemptRate: number;
  scoreCoefficientOfVariation: number;
  postErrorAccuracy: number;
  baselineAccuracy: number;
  revisionGain: number;
  retentionAfter21Days: number;
};

const clamp = (value:number) => Math.max(0, Math.min(100, Math.round(value)));

function band(score:number):BehaviourBand {
  if(score >= 80) return "strength";
  if(score >= 65) return "stable";
  if(score >= 50) return "watch";
  return "priority";
}

export function evaluateLearningBehaviour(e:BehaviourEvidence):BehaviourMetric[] {
  const sufficient = e.comparableAssessments >= 3 && e.validResponses >= 60;
  if(!sufficient){
    return [{
      id:"evidence-readiness", title:"Evidence readiness", score:null, band:"limited",
      summary:"More comparable assessment evidence is required before learning-behaviour patterns are displayed.",
      evidence:[`${e.comparableAssessments} comparable assessments available`, `${e.validResponses} valid question responses available`],
      nextStep:"Complete at least three comparable assessments and 60 valid question responses.",
      minimumEvidence:"3 comparable assessments and 60 valid responses",
      studyBasis:"Responsible interpretation requires repeated observations; a single test should not be treated as the whole student."
    }];
  }

  const enduranceDrop = Math.max(0, e.accuracyFirstThird - e.accuracyFinalThird);
  const endurance = clamp(100 - enduranceDrop * 2.5);
  const decision = clamp(100 - e.rapidIncorrectRate * 1.8 - e.overtimeIncorrectRate * 1.2);
  const reviewQuality = clamp(70 + (e.answerChangesWrongToCorrect - e.answerChangesCorrectToWrong) * 4);
  const selection = clamp(100 - e.easySkippedRate * 2 + Math.min(10, e.hardAttemptRate * 0.2));
  const consistency = clamp(100 - e.scoreCoefficientOfVariation * 3.2);
  const recoveryGap = Math.max(0, e.baselineAccuracy - e.postErrorAccuracy);
  const recovery = clamp(100 - recoveryGap * 2.5);
  const revision = clamp(55 + e.revisionGain * 2 + e.retentionAfter21Days * 0.25);
  const speedAccuracy = clamp(72 - Math.max(0,e.medianIncorrectTimeSeconds-e.medianCorrectTimeSeconds)*0.35 - e.rapidIncorrectRate*0.8);

  return [
    {
      id:"exam-endurance", title:"Exam endurance", score:endurance, band:band(endurance),
      summary:enduranceDrop >= 12 ? "Accuracy declines meaningfully toward the final third of the assessment." : "Accuracy remains reasonably stable across the assessment.",
      evidence:[`First-third accuracy ${e.accuracyFirstThird}%`, `Middle-third accuracy ${e.accuracyMiddleThird}%`, `Final-third accuracy ${e.accuracyFinalThird}%`],
      nextStep:enduranceDrop >= 12 ? "Use progressively longer timed sets and review the point at which accuracy begins to decline." : "Maintain full-length practice and verify the pattern across future comparable tests.",
      minimumEvidence:"3 comparable assessments with reliable question order and timestamps",
      studyBasis:"Sustained performance can vary over the course of a test; timing and accuracy patterns are useful observations but do not identify a psychological condition."
    },
    {
      id:"decision-balance", title:"Decision balance", score:decision, band:band(decision),
      summary:e.rapidIncorrectRate > 15 ? "A notable share of incorrect responses were submitted unusually quickly." : e.overtimeIncorrectRate > 15 ? "Several incorrect responses consumed substantially more time than the learner's usual correct responses." : "Speed and answer quality appear reasonably balanced.",
      evidence:[`Rapid incorrect responses ${e.rapidIncorrectRate}%`, `Overtime incorrect responses ${e.overtimeIncorrectRate}%`, `Median correct time ${e.medianCorrectTimeSeconds}s`],
      nextStep:e.rapidIncorrectRate > e.overtimeIncorrectRate ? "Introduce a short read-plan-check routine before submitting." : "Practise stop-loss rules for difficult questions and return after completing easier opportunities.",
      minimumEvidence:"Reliable item timestamps and answer outcomes",
      studyBasis:"Response time can add useful process evidence, but speed-accuracy relationships differ by learner, item and assessment context."
    },
    {
      id:"review-discipline", title:"Review discipline", score:reviewQuality, band:band(reviewQuality),
      summary:e.answerChangesCorrectToWrong > e.answerChangesWrongToCorrect ? "Review changes currently remove more correct answers than they recover." : "Answer review is generally improving the final response set.",
      evidence:[`${e.answerChangesWrongToCorrect} wrong-to-correct changes`, `${e.answerChangesCorrectToWrong} correct-to-wrong changes`],
      nextStep:e.answerChangesCorrectToWrong > e.answerChangesWrongToCorrect ? "Change an answer only when a specific rule, calculation or evidence contradicts the first choice." : "Continue the current review routine and track whether the benefit remains consistent.",
      minimumEvidence:"Recorded answer-change history across at least two assessments",
      studyBasis:"Confidence calibration concerns the relationship between perceived understanding and actual performance; behavioural traces provide only a partial proxy unless confidence is directly collected."
    },
    {
      id:"question-selection", title:"Question selection", score:selection, band:band(selection),
      summary:e.easySkippedRate > 10 ? "Accessible questions are being left unanswered while harder questions continue to receive attempts." : "The current attempt pattern generally protects accessible marks.",
      evidence:[`Easy-question skip rate ${e.easySkippedRate}%`, `Hard-question attempt rate ${e.hardAttemptRate}%`],
      nextStep:e.easySkippedRate > 10 ? "Use a first pass that prioritises high-confidence and lower-complexity questions." : "Maintain the present selection strategy and monitor it under tighter time limits.",
      minimumEvidence:"Question difficulty tags and attempt status",
      studyBasis:"This is an exam-strategy observation derived from task selection, not a personality or risk-taking diagnosis."
    },
    {
      id:"performance-consistency", title:"Performance consistency", score:consistency, band:band(consistency),
      summary:e.scoreCoefficientOfVariation > 15 ? "Comparable assessment outcomes fluctuate enough to warrant checking preparation, coverage and test conditions." : "Comparable assessment outcomes are relatively stable.",
      evidence:[`Score variation index ${e.scoreCoefficientOfVariation.toFixed(1)}`, `${e.comparableAssessments} comparable assessments`],
      nextStep:e.scoreCoefficientOfVariation > 15 ? "Compare revision completion, sleep, syllabus coverage and paper difficulty before attributing the variation to the learner." : "Continue the current preparation cycle and check whether stability also holds by subject.",
      minimumEvidence:"At least three genuinely comparable assessments",
      studyBasis:"Variation can reflect many contextual factors; it should not be interpreted as a fixed trait."
    },
    {
      id:"recovery-after-error", title:"Recovery after an error", score:recovery, band:band(recovery),
      summary:recoveryGap >= 10 ? "Accuracy falls for the questions immediately following an incorrect response." : "The learner generally returns to baseline accuracy after an incorrect response.",
      evidence:[`Baseline accuracy ${e.baselineAccuracy}%`, `Post-error accuracy ${e.postErrorAccuracy}%`],
      nextStep:recoveryGap >= 10 ? "Use a brief reset routine after uncertain questions and avoid carrying one outcome into the next item." : "Maintain the current reset behaviour and confirm it during high-stakes simulations.",
      minimumEvidence:"At least 20 error-following question sequences",
      studyBasis:"Sequential response patterns may suggest a temporary performance effect; they cannot establish emotional state or test anxiety."
    },
    {
      id:"revision-effectiveness", title:"Revision effectiveness", score:revision, band:band(revision),
      summary:e.revisionGain > 8 && e.retentionAfter21Days >= 70 ? "Targeted revision is producing improvement that remains visible after a delay." : e.revisionGain > 8 ? "Revision produces an immediate gain, but delayed retention needs strengthening." : "Current revision activity is not yet producing a clear measurable gain.",
      evidence:[`Immediate revision gain ${e.revisionGain >= 0 ? "+" : ""}${e.revisionGain} points`, `21-day retention ${e.retentionAfter21Days}%`],
      nextStep:e.revisionGain <= 8 ? "Reduce passive rereading and use retrieval practice followed by a delayed retest." : e.retentionAfter21Days < 70 ? "Add spaced retrieval at 7 and 21 days." : "Continue the current revision method and apply it to the next priority topic.",
      minimumEvidence:"Pre-revision, post-revision and delayed comparable checks",
      studyBasis:"Repeated and delayed assessment provides stronger evidence than an immediate post-practice score alone."
    },
    {
      id:"speed-accuracy-control", title:"Speed–accuracy control", score:speedAccuracy, band:band(speedAccuracy),
      summary:e.medianIncorrectTimeSeconds > e.medianCorrectTimeSeconds * 1.25 ? "Incorrect responses are taking longer than correct responses, suggesting inefficient persistence on some items." : e.rapidIncorrectRate > 15 ? "Some errors appear to arise from unusually rapid responding." : "The current timing pattern does not show a dominant speed-related loss pattern.",
      evidence:[`Median correct-response time ${e.medianCorrectTimeSeconds}s`, `Median incorrect-response time ${e.medianIncorrectTimeSeconds}s`, `Rapid incorrect rate ${e.rapidIncorrectRate}%`],
      nextStep:"Review question-level timing together with difficulty and method before setting any universal time target.",
      minimumEvidence:"Reliable question-level timestamps and difficulty context",
      studyBasis:"Research shows heterogeneous speed-accuracy relationships; neither faster nor slower responding is automatically better."
    }
  ];
}

export const learningBehaviourDisclaimer = {
  title:"Responsible-use note",
  body:"These learning-behaviour insights are rule-based observations calculated from assessment responses, timing, answer changes and repeated performance. They are informed by educational and psychological research, but individual behaviour and test conditions vary. The results may not be fully accurate for every learner and must not be treated as a psychological, medical or learning-disability diagnosis. Use them as a reference for reflection, teacher discussion and improving upcoming assessment results.",
  nonAi:"This version does not use artificial intelligence. Each result comes from published calculation rules and the evidence available in Evidara.",
};
