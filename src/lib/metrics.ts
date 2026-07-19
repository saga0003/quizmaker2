export type MetricDefinition = {
  key: string;
  label: string;
  summary: string;
  calculation: string;
  evidenceWindow: string;
  use: string;
  limitation: string;
};

export const METRICS: Record<string, MetricDefinition> = {
  participation: {
    key: "participation",
    label: "Participation",
    summary: "The share of eligible students who submitted the assessment.",
    calculation: "Completed eligible attempts divided by eligible assigned students, multiplied by 100.",
    evidenceWindow: "The selected assessment or reporting period.",
    use: "Check whether a comparison represents most of the intended group.",
    limitation: "High participation improves coverage but does not prove assessment quality.",
  },
  score: {
    key: "score",
    label: "Score",
    summary: "Marks earned after positive and negative marking rules are applied.",
    calculation: "Awarded marks minus applicable negative marks.",
    evidenceWindow: "One submitted assessment unless a trend view is selected.",
    use: "Understand the result under the paper's marking scheme.",
    limitation: "Scores from different papers should not be compared without considering difficulty and maximum marks.",
  },
  percentage: {
    key: "percentage",
    label: "Percentage",
    summary: "The score expressed as a proportion of the maximum available marks.",
    calculation: "Score divided by maximum marks, multiplied by 100.",
    evidenceWindow: "One submitted assessment.",
    use: "Compare performance across papers with different maximum marks.",
    limitation: "It does not adjust for paper difficulty or cohort strength.",
  },
  percentile: {
    key: "percentile",
    label: "Percentile",
    summary: "The percentage of valid participants whose score is at or below this student's score.",
    calculation: "Rank position within the valid anonymous cohort, converted to a 0-100 percentile.",
    evidenceWindow: "All valid attempts included in the current benchmark snapshot.",
    use: "Understand relative standing on the same question paper.",
    limitation: "It changes when the cohort changes and does not reveal a student's absolute mastery.",
  },
  cohortAverage: {
    key: "cohortAverage",
    label: "Cohort average",
    summary: "The mean score of all valid anonymous attempts on the same paper.",
    calculation: "Sum of valid scores divided by the number of valid attempts.",
    evidenceWindow: "The current benchmark snapshot for one paper.",
    use: "Place a student or school result in the context of everyone who took the same paper.",
    limitation: "Averages can be influenced by unusually high or low scores, so median and sample size are shown alongside it.",
  },
  median: {
    key: "median",
    label: "Median",
    summary: "The middle score after all valid scores are ordered from lowest to highest.",
    calculation: "The central score, or the mean of the two central scores for an even-sized cohort.",
    evidenceWindow: "The current benchmark snapshot for one paper.",
    use: "Understand a typical result without being overly affected by extreme scores.",
    limitation: "It does not describe how widely scores are spread.",
  },
  trend: {
    key: "trend",
    label: "Trend",
    summary: "The direction and consistency of performance across repeated assessments.",
    calculation: "A weighted change using the latest five comparable assessments, with more weight on recent evidence.",
    evidenceWindow: "Up to five comparable completed assessments; at least three are required for a confident trend.",
    use: "See whether performance is improving, stable or variable over time.",
    limitation: "A trend is observation, not prediction. Paper difficulty and participation can affect it.",
  },
  improvement: {
    key: "improvement",
    label: "Improvement",
    summary: "The change between a recent result and the student's established baseline.",
    calculation: "Latest comparable percentage minus the average of the earliest two comparable assessments.",
    evidenceWindow: "Usually the latest five comparable assessments.",
    use: "Recognise progress even when the current score is not yet high.",
    limitation: "Large changes based on very few attempts are marked as low-confidence.",
  },
  accuracy: {
    key: "accuracy",
    label: "Accuracy",
    summary: "The share of attempted questions answered correctly.",
    calculation: "Correct answers divided by attempted questions, multiplied by 100.",
    evidenceWindow: "One assessment or the selected reporting period.",
    use: "Separate knowledge and method quality from speed or skipped questions.",
    limitation: "A student can have high accuracy while attempting too few questions.",
  },
  speedIndex: {
    key: "speedIndex",
    label: "Speed index",
    summary: "A normalised indication of response pace compared with the expected time for the paper.",
    calculation: "Expected response time divided by actual average response time, capped and converted to a 0-100 index.",
    evidenceWindow: "The latest completed assessment, with context from recent attempts where available.",
    use: "Identify pacing opportunities without treating faster as automatically better.",
    limitation: "Fast incorrect answers do not represent strong performance; speed must be read with accuracy.",
  },
  readiness: {
    key: "readiness",
    label: "Readiness index",
    summary: "A combined evidence indicator across knowledge, execution, pace and consistency.",
    calculation: "Weighted combination of recent accuracy, comparable score, response-time control and trend confidence.",
    evidenceWindow: "Up to five recent comparable assessments, with at least one current assessment.",
    use: "Prioritise the next development action and monitor whether support is working.",
    limitation: "It is not a predicted rank, guaranteed outcome or permanent label.",
  },
  recoverableMarks: {
    key: "recoverableMarks",
    label: "Recoverable marks",
    summary: "Estimated marks lost through errors that can reasonably be reduced with targeted practice.",
    calculation: "Marks linked to careless, procedural, interpretation or pacing errors, excluding clear concept gaps.",
    evidenceWindow: "The latest reviewed assessment.",
    use: "Focus intervention on marks most likely to improve in the next practice cycle.",
    limitation: "It is an instructional estimate, not a promise of future marks.",
  },
  mastery: {
    key: "mastery",
    label: "Topic evidence",
    summary: "Current evidence of understanding for a topic based on relevant questions.",
    calculation: "Weighted accuracy, difficulty and recency across valid topic-tagged responses.",
    evidenceWindow: "Recent topic-tagged questions, normally capped at the last 30 valid responses.",
    use: "Choose what to review, practise and retest next.",
    limitation: "Low question counts are shown as limited evidence rather than strong conclusions.",
  },
  sampleSize: {
    key: "sampleSize",
    label: "Sample size",
    summary: "The number of valid anonymous attempts included in a benchmark.",
    calculation: "Count of completed, non-duplicate, eligible attempts after quality checks.",
    evidenceWindow: "The current benchmark snapshot.",
    use: "Judge how stable and representative the comparison may be.",
    limitation: "A large sample can still be unrepresentative if participation is concentrated in one type of student or region.",
  },
  segment: {
    key: "segment",
    label: "Development segment",
    summary: "A constructive grouping that describes the student's current evidence pattern and next priority.",
    calculation: "Rules combine recent accuracy, percentile, pace, trend, consistency and recoverable error evidence.",
    evidenceWindow: "Normally the latest five comparable assessments; provisional when fewer than three exist.",
    use: "Organise support and communicate the next action in plain language.",
    limitation: "Segments are temporary evidence summaries, not ability labels or predictions of destiny.",
  },
};

export type SegmentDefinition = {
  key: string;
  name: string;
  when: string;
  meaning: string;
  nextStep: string;
};

export const SEGMENTS: SegmentDefinition[] = [
  {
    key: "consistent-progress",
    name: "Consistently progressing",
    when: "At least three comparable assessments, positive trend, stable accuracy and no major pacing decline.",
    meaning: "Recent support appears to be working and the student is sustaining improvement.",
    nextStep: "Increase challenge gradually and schedule a retention check.",
  },
  {
    key: "accurate-pacing",
    name: "Accurate, pacing opportunity",
    when: "Accuracy is strong while completion rate or response-time control remains below the paper expectation.",
    meaning: "Understanding is visible, but exam execution is limiting the score.",
    nextStep: "Use timed sets and a first-pass question strategy without sacrificing accuracy.",
  },
  {
    key: "high-potential-variable",
    name: "High potential, variable execution",
    when: "Strong performance appears in parts of the evidence, but score or error patterns vary noticeably.",
    meaning: "The student can perform at a high level but is not yet doing so consistently.",
    nextStep: "Identify recurring careless, procedural or interpretation errors and retest under controlled conditions.",
  },
  {
    key: "foundation-developing",
    name: "Foundation developing",
    when: "Topic evidence shows repeated concept gaps across more than one assessment.",
    meaning: "More guided understanding is needed before additional mixed-paper volume will help.",
    nextStep: "Repair priority concepts, practise in small sets and reassess after instruction.",
  },
  {
    key: "limited-evidence",
    name: "Evidence still developing",
    when: "Fewer than three comparable assessments or insufficient valid topic responses are available.",
    meaning: "There is not enough stable evidence for a confident development segment.",
    nextStep: "Complete additional comparable assessments before drawing a strong conclusion.",
  },
];
