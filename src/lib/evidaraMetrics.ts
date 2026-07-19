export type MetricDefinition = {
  title: string;
  definition: string;
  evaluatedFrom: string;
  whyItMatters: string;
  caution?: string;
};

export const metricDefinitions = {
  schoolAccounts: {
    title: "School accounts",
    definition: "The number of school workspaces currently registered on the Evidara platform.",
    evaluatedFrom: "Distinct school records visible to the authorised platform administrator, including the current subscription status of each school.",
    whyItMatters: "It shows the operating footprint that requires onboarding, support, renewal and data-governance attention.",
    caution: "A registered school is not automatically an active or paying school. Review subscription status alongside this count.",
  },
  activePlans: {
    title: "Active annual plans",
    definition: "School subscriptions whose access window is active and not suspended or expired.",
    evaluatedFrom: "Subscription start date, expiry date and administrative status at the time the dashboard is opened.",
    whyItMatters: "It shows how many schools can currently publish assessments and use subscription-controlled resources.",
    caution: "This count does not describe utilisation. Participation and publishing activity should be reviewed separately.",
  },
  studentsCovered: {
    title: "Students covered",
    definition: "The number of active student records within currently visible school rosters.",
    evaluatedFrom: "Active, non-revoked student records associated with the authorised schools. Duplicate and revoked records are excluded.",
    whyItMatters: "It indicates the size of the learner population currently served by the platform.",
    caution: "Coverage is not the same as assessment participation or learning impact.",
  },
  publishedAssessments: {
    title: "Published assessments",
    definition: "Assessments that have moved from draft into a student-accessible published state.",
    evaluatedFrom: "Unique published paper versions visible within the selected school, organisation or platform scope.",
    whyItMatters: "It shows the volume of assessment opportunities made available to learners.",
    caution: "Publishing volume does not by itself indicate quality, participation or improvement.",
  },
  activeStudents: {
    title: "Active students",
    definition: "Students currently eligible to use the school workspace and receive assigned assessments or resources.",
    evaluatedFrom: "Active roster records after excluding revoked, graduated, duplicate or otherwise ineligible student records.",
    whyItMatters: "It supports seat governance, assignment planning and annual student promotion.",
    caution: "An active record does not confirm that the student has logged in or attempted an assessment.",
  },
  interventions: {
    title: "Teacher interventions",
    definition: "Open, recorded teacher actions created in response to a specific evidence pattern.",
    evaluatedFrom: "Intervention records that remain open or scheduled, including the linked students, need, action and review date.",
    whyItMatters: "It shows whether assessment evidence is being converted into a practical teaching response.",
    caution: "More interventions are not automatically better. Their relevance, completion and reassessment outcome matter.",
  },
  participation: {
    title: "Assessment participation",
    definition: "The percentage of eligible assigned learners who submitted a valid attempt during the assessment window.",
    evaluatedFrom: "Valid submitted attempts divided by the active eligible roster assigned to the paper. Revoked, ineligible and invalid attempts are excluded.",
    whyItMatters: "It shows whether the available performance evidence represents most of the intended cohort or only a small subset.",
    caution: "A high participation rate improves evidence coverage but does not by itself indicate learning quality or improvement.",
  },
  score: {
    title: "Assessment score",
    definition: "Marks earned under the paper's published scoring and negative-marking rules.",
    evaluatedFrom: "Correct, incorrect and unattempted responses evaluated against the exact question-paper version.",
    whyItMatters: "It summarises performance on that assessment and supports comparison with the learner's own previous comparable papers.",
    caution: "Scores from papers with different difficulty, syllabus coverage or maximum marks should not be compared without context.",
  },
  accuracy: {
    title: "Accuracy",
    definition: "The percentage of attempted questions answered correctly.",
    evaluatedFrom: "Correct responses divided by attempted responses on the selected assessment or evidence window.",
    whyItMatters: "It separates answer quality from the number of questions attempted and helps reveal avoidable losses.",
    caution: "High accuracy with very few attempts can hide pacing or coverage problems. Review attempt rate alongside it.",
  },
  correctAnswers: {
    title: "Correct answers",
    definition: "The number of questions evaluated as correct in the selected assessment.",
    evaluatedFrom: "The submitted response to each question compared with the answer key for the exact published paper version.",
    whyItMatters: "It provides a direct count behind the score and accuracy metrics.",
    caution: "Question marks and negative marking can make this count different from the final score.",
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
    evaluatedFrom: "Only completed, valid attempts on the same assessment version are included. Shared percentiles are suppressed until the privacy minimum sample is reached.",
    whyItMatters: "It adds context to a raw mark and shows relative standing without revealing another learner or school's identity.",
    caution: "A percentile is specific to the participating group and assessment. It does not measure the whole student or guarantee future outcomes.",
  },
  readiness: {
    title: "Readiness index",
    definition: "A 0–100 evidence summary combining current accuracy, topic coverage, consistency and time behaviour.",
    evaluatedFrom: "40% latest accuracy, 25% topic-mastery coverage, 20% consistency across recent assessments and 15% pacing against expected question time.",
    whyItMatters: "It gives a quick overview before the underlying evidence and recommended next steps are reviewed.",
    caution: "Readiness is a navigation aid, not a diagnosis. Always inspect its component metrics and assessment context.",
  },
  speed: {
    title: "Speed index",
    definition: "How efficiently the learner uses time relative to the expected time for correctly answered questions.",
    evaluatedFrom: "Median response time is compared with the expected time assigned to each question. Incorrect rapid guesses are not rewarded.",
    whyItMatters: "It identifies whether time management, rather than concept knowledge, is limiting performance.",
    caution: "Faster is not always better. Accuracy and reasoning quality must be reviewed alongside speed.",
  },
  averageQuestionTime: {
    title: "Average question time",
    definition: "The mean time spent per recorded question response in the selected evidence window.",
    evaluatedFrom: "Total valid response time divided by questions with a reliable start and answer timestamp. Paused or invalid sessions are excluded.",
    whyItMatters: "It provides a simple pacing reference before question-level timing is reviewed.",
    caution: "An average can hide very slow and very fast questions. Use the question-level distribution for intervention decisions.",
  },
  overtimeQuestions: {
    title: "Overtime questions",
    definition: "Questions where recorded response time exceeded the expected time threshold.",
    evaluatedFrom: "Question response time compared with its configured expected time, normally flagged when the learner exceeds the threshold by 20% or more.",
    whyItMatters: "It identifies where pacing may be consuming exam time even when the final answer is correct.",
    caution: "A difficult or unfamiliar question may reasonably take longer. Review correctness and method before acting.",
  },
  mastery: {
    title: "Topic mastery",
    definition: "The current strength of evidence for a topic based on correct responses, difficulty and recency.",
    evaluatedFrom: "A recency-weighted score from the latest eligible questions, with harder questions contributing more evidence. At least five question responses are required.",
    whyItMatters: "It helps teachers and students prioritise specific concepts instead of repeating entire subjects.",
    caution: "Topics with too few responses are shown as limited evidence rather than labelled weak.",
  },
  errorCauses: {
    title: "Error-cause distribution",
    definition: "The share of lost-mark responses assigned to the most likely immediate cause.",
    evaluatedFrom: "The selected response, correct solution, response time, question skill and prior evidence on the same concept. Teacher review can refine the classification.",
    whyItMatters: "It separates a concept need from a method, checking, interpretation or pacing need so the next action is more precise.",
    caution: "Automated classifications are evidence-based estimates and should be reviewed when the available response evidence is incomplete.",
  },
  segment: {
    title: "Student development segment",
    definition: "A temporary evidence-based grouping used to choose a suitable next action.",
    evaluatedFrom: "Latest percentile, recent improvement, accuracy consistency and pacing. Segments are recalculated after each valid assessment.",
    whyItMatters: "It helps teachers organise support by shared need, such as pacing or avoidable loss, rather than by marks alone.",
    caution: "Segments describe current evidence, not identity or ability. They must never become permanent labels.",
  },
  recoverableMarks: {
    title: "Recoverable marks",
    definition: "Estimated marks lost on questions where the learner showed enough evidence that improvement is practical in the next cycle.",
    evaluatedFrom: "Avoidable, procedural and overtime errors on previously demonstrated concepts. Pure concept gaps are excluded.",
    whyItMatters: "It identifies the quickest responsible opportunities for improvement without promising a future score.",
    caution: "This is an evidence estimate, not a guaranteed mark increase.",
  },
  target: {
    title: "Current target",
    definition: "The next agreed score or outcome used to organise the learner's immediate practice plan.",
    evaluatedFrom: "The learner's recent comparable evidence, upcoming assessment type and an explicitly selected school, teacher or learner goal.",
    whyItMatters: "It gives the development plan a measurable destination for the next review cycle.",
    caution: "A target is a planning aid, not a forecast or promise of rank, admission or examination result.",
  },
  benchmark: {
    title: "Shared benchmark",
    definition: "An anonymous comparison created when many learners answer the exact same question-paper version.",
    evaluatedFrom: "Valid completed attempts are aggregated across participating schools. Names, school identities, phone numbers and individual responses are excluded from the shared result.",
    whyItMatters: "A school can understand how its cohort performed relative to a broader sample while keeping every participant private.",
    caution: "Results must remain hidden until the minimum privacy sample is reached and must show sample size, paper version and assessment window.",
  },
} satisfies Record<string, MetricDefinition>;

export type SegmentKey = "academic_elite" | "fast_improver" | "high_potential_careless" | "accurate_slow" | "developing" | "not_assessed";

export const segmentDefinitions: Record<SegmentKey, { label: string; rule: string; nextAction: string }> = {
  academic_elite: {
    label: "Academic elite",
    rule: "Latest percentile at or above 95, accuracy at or above 88%, and stable pacing across at least three comparable assessments.",
    nextAction: "Increase challenge, protect consistency and monitor fatigue rather than adding repetitive volume.",
  },
  fast_improver: {
    label: "Fast improver",
    rule: "Score improvement of at least 12 points across the latest five comparable assessments, with no major accuracy decline.",
    nextAction: "Continue the current intervention, then verify retention after 21 days.",
  },
  high_potential_careless: {
    label: "High potential, avoidable loss",
    rule: "Percentile at or above 75 with at least 20% of lost marks classified as avoidable or procedural rather than conceptual.",
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
