export type MetricDefinition = {
  title: string;
  definition: string;
  evaluatedFrom: string;
  whyItMatters: string;
  caution?: string;
};

export const metricDefinitions = {
  participation: {
    title: "Assessment participation",
    definition: "The percentage of eligible assigned learners who submitted a valid attempt during the assessment window.",
    evaluatedFrom: "Valid submitted attempts divided by the active eligible roster assigned to the paper. Revoked, ineligible and invalid attempts are excluded.",
    whyItMatters: "It shows whether the available performance evidence represents most of the intended cohort or only a small subset.",
    caution: "A high participation rate improves coverage but does not by itself indicate learning quality or improvement.",
  },
  score: {
    title: "Assessment score",
    definition: "Marks earned under the paper's published scoring and negative-marking rules.",
    evaluatedFrom: "Correct, incorrect and unattempted responses evaluated against the exact question paper version.",
    whyItMatters: "It summarises performance on that assessment and supports comparison with the learner's own previous comparable papers.",
    caution: "Scores from papers with different difficulty, syllabus coverage or maximum marks should not be compared without context.",
  },
  trend: {
    title: "Improvement trend",
    definition: "The direction and size of change across repeated comparable assessments.",
    evaluatedFrom: "The latest five comparable assessments, with score, accuracy and speed shown separately. A minimum of three attempts is required before a trend is displayed.",
    whyItMatters: "It helps distinguish a one-time score from sustained progress and shows whether the current support plan is working.",
    caution: "Trend is an observation, not a prediction. Changes in paper difficulty, syllabus coverage or participation must be considered.",
  },
  percentile: {
    title: "Percentile",
    definition: "The percentage of valid participants whose score is at or below the learner's score on the same paper or benchmark set.",
    evaluatedFrom: "Only completed, valid attempts on the same assessment version are included. Evidara suppresses shared percentiles until the privacy minimum sample is reached.",
    whyItMatters: "It adds context to a raw mark and shows relative standing without revealing another student or school's identity.",
    caution: "A percentile is specific to the participating group and assessment. It does not measure the whole student or guarantee future outcomes.",
  },
  readiness: {
    title: "Readiness index",
    definition: "A 0-100 evidence summary combining current accuracy, topic coverage, consistency and time behaviour.",
    evaluatedFrom: "40% latest accuracy, 25% topic mastery coverage, 20% consistency across recent assessments and 15% pacing against expected question time.",
    whyItMatters: "It gives a quick overview before reviewing the underlying evidence and recommended next steps.",
    caution: "Readiness is a navigation aid, not a diagnosis. Always inspect the component metrics and assessment context.",
  },
  speed: {
    title: "Speed index",
    definition: "How efficiently the learner uses time relative to the expected time for correctly answered questions.",
    evaluatedFrom: "Median response time is compared with the expected time assigned to each question. Incorrect rapid guesses are not rewarded.",
    whyItMatters: "It identifies whether time management, rather than concept knowledge, is limiting performance.",
    caution: "Faster is not always better. Accuracy and reasoning quality must be reviewed alongside speed.",
  },
  mastery: {
    title: "Topic mastery",
    definition: "The current strength of evidence for a topic based on correct responses, difficulty and recency.",
    evaluatedFrom: "A recency-weighted score from the latest eligible questions, with harder questions contributing more evidence. At least five question responses are required.",
    whyItMatters: "It helps teachers and students prioritise specific concepts instead of repeating entire subjects.",
    caution: "Low-question topics are marked as limited evidence rather than labelled weak.",
  },
  segment: {
    title: "Student segment",
    definition: "A temporary evidence-based grouping used to choose the most suitable next action.",
    evaluatedFrom: "Latest percentile, recent improvement, accuracy consistency and pacing. Segments are recalculated after each valid assessment.",
    whyItMatters: "It helps teachers organise intervention by shared need, such as pacing or careless errors, rather than by marks alone.",
    caution: "Segments describe current evidence, not identity or ability. They must never become permanent labels.",
  },
  benchmark: {
    title: "Shared benchmark",
    definition: "An anonymous comparison created when many learners answer the exact same question paper version.",
    evaluatedFrom: "Valid completed attempts are aggregated across participating schools. Names, school identities, phone numbers and individual responses are excluded from the shared result.",
    whyItMatters: "A school can understand how its cohort performed relative to a broader sample while keeping every participant private.",
    caution: "Results are hidden until the minimum sample is reached and must show sample size, paper version and assessment window.",
  },
  recoverableMarks: {
    title: "Recoverable marks",
    definition: "Estimated marks lost on questions where the learner showed enough evidence that improvement is practical in the next cycle.",
    evaluatedFrom: "Careless errors, procedural errors and overtime responses on previously demonstrated concepts. Pure concept gaps are excluded.",
    whyItMatters: "It identifies the quickest responsible opportunities for improvement without promising a future score.",
    caution: "This is an evidence estimate, not a guaranteed mark increase.",
  },
} satisfies Record<string, MetricDefinition>;

export type SegmentKey = "academic_elite" | "fast_improver" | "high_potential_careless" | "accurate_slow" | "developing" | "not_assessed";

export const segmentDefinitions: Record<SegmentKey, { label: string; rule: string; nextAction: string }> = {
  academic_elite: {
    label: "Academic elite",
    rule: "Latest percentile at or above 95, accuracy at or above 88%, and stable pacing across at least three assessments.",
    nextAction: "Increase challenge, protect consistency and monitor fatigue rather than adding repetitive volume.",
  },
  fast_improver: {
    label: "Fast improver",
    rule: "Score improvement of at least 12 points across the latest five comparable assessments, with no major accuracy decline.",
    nextAction: "Continue the current intervention, then verify retention after 21 days.",
  },
  high_potential_careless: {
    label: "High potential, avoidable loss",
    rule: "Percentile at or above 75 with at least 20% of lost marks classified as careless or procedural rather than conceptual.",
    nextAction: "Use checking routines, method discipline and controlled timed sets.",
  },
  accurate_slow: {
    label: "Accurate, pacing opportunity",
    rule: "Accuracy at or above 80% while median response time exceeds expected time by at least 20%.",
    nextAction: "Build first-pass strategy and gradual time limits without sacrificing reasoning quality.",
  },
  developing: {
    label: "Developing evidence",
    rule: "The learner has enough assessment evidence, but no stronger segment rule is currently met.",
    nextAction: "Prioritise the two clearest topic or process needs and reassess after targeted practice.",
  },
  not_assessed: {
    label: "Not enough evidence",
    rule: "Fewer than three comparable assessments or insufficient valid responses.",
    nextAction: "Collect more reliable evidence before assigning a development segment.",
  },
};
