import { segmentDefinitions, type SegmentKey } from "@/lib/evidaraMetrics";

export const SEGMENT_RULE_VERSION = "2026.07-v1";
export const SEGMENT_MINIMUM_ASSESSMENTS = 3;

export type SegmentEvidence = {
  assessmentCount: number;
  percentile: number | null;
  accuracy: number | null;
  scoreChange: number | null;
  avoidableLossShare: number | null;
  responseTimeRatio: number | null;
  evidenceWindow: string;
  calculatedAt: string;
};

export type CriterionResult = {
  label: string;
  actual: string;
  required: string;
  passed: boolean;
};

export type SegmentEvaluation = {
  key: SegmentKey;
  label: string;
  ruleVersion: string;
  rule: string;
  nextAction: string;
  evidenceWindow: string;
  calculatedAt: string;
  evidenceStatus: "sufficient" | "limited";
  criteria: CriterionResult[];
  reviewTrigger: string;
  responsibleUse: string;
};

function display(value: number | null, suffix = "") {
  return value === null ? "Not available" : `${value}${suffix}`;
}

function check(label: string, value: number | null, required: string, passed: boolean, suffix = ""): CriterionResult {
  return { label, actual: display(value, suffix), required, passed };
}

function finish(key: SegmentKey, evidence: SegmentEvidence, criteria: CriterionResult[]): SegmentEvaluation {
  const definition = segmentDefinitions[key];
  return {
    key,
    label: definition.label,
    ruleVersion: SEGMENT_RULE_VERSION,
    rule: definition.rule,
    nextAction: definition.nextAction,
    evidenceWindow: evidence.evidenceWindow,
    calculatedAt: evidence.calculatedAt,
    evidenceStatus: evidence.assessmentCount >= SEGMENT_MINIMUM_ASSESSMENTS ? "sufficient" : "limited",
    criteria,
    reviewTrigger: "Recalculate after the next valid comparable assessment or corrected evidence.",
    responsibleUse: "This pattern supports teaching and practice planning only. It must not decide admission, discipline, promotion, fees or access.",
  };
}

export function evaluateStudentSegment(evidence: SegmentEvidence): SegmentEvaluation {
  if (evidence.assessmentCount < SEGMENT_MINIMUM_ASSESSMENTS) {
    return finish("not_assessed", evidence, [
      check("Comparable assessments", evidence.assessmentCount, "At least 3", false),
    ]);
  }

  const advanced = [
    check("Percentile", evidence.percentile, "95 or higher", (evidence.percentile ?? -1) >= 95),
    check("Accuracy", evidence.accuracy, "88% or higher", (evidence.accuracy ?? -1) >= 88, "%"),
    check("Response-time ratio", evidence.responseTimeRatio, "1.00 or lower", (evidence.responseTimeRatio ?? 99) <= 1),
  ];
  if (advanced.every((item) => item.passed)) return finish("academic_elite", evidence, advanced);

  const improving = [
    check("Score change", evidence.scoreChange, "+12 points or more", (evidence.scoreChange ?? -99) >= 12, " points"),
    check("Accuracy", evidence.accuracy, "60% or higher", (evidence.accuracy ?? -1) >= 60, "%"),
  ];
  if (improving.every((item) => item.passed)) return finish("fast_improver", evidence, improving);

  const avoidable = [
    check("Percentile", evidence.percentile, "75 or higher", (evidence.percentile ?? -1) >= 75),
    check("Avoidable loss share", evidence.avoidableLossShare, "20% or higher", (evidence.avoidableLossShare ?? -1) >= 20, "%"),
  ];
  if (avoidable.every((item) => item.passed)) return finish("high_potential_careless", evidence, avoidable);

  const pacing = [
    check("Accuracy", evidence.accuracy, "80% or higher", (evidence.accuracy ?? -1) >= 80, "%"),
    check("Response-time ratio", evidence.responseTimeRatio, "1.20 or higher", (evidence.responseTimeRatio ?? -1) >= 1.2),
  ];
  if (pacing.every((item) => item.passed)) return finish("accurate_slow", evidence, pacing);

  return finish("developing", evidence, [
    check("Comparable assessments", evidence.assessmentCount, "At least 3", true),
  ]);
}
