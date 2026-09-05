export type MetricDefinition = {
  title: string;
  definition: string;
  evaluatedFrom: string;
  whyItMatters: string;
  caution?: string;
};

export type AnalyticsMetricDefinition = MetricDefinition & {
  id: 'testsTaken' | 'uniqueQuestions' | 'questionOutcomes' | 'attempted' | 'unanswered' | 'accuracy' | 'scorePercentage' | 'participation';
  unit: 'count' | 'percentage';
  emptyDisplay: 'Not assessed';
  canonicalFormula: string;
  denominatorRule?: string;
};

/**
 * Phase 1 canonical analytics metric dictionary.
 *
 * These definitions are product contracts, not presentation copy. Student,
 * teacher, institution, exports and future database aggregates must preserve
 * these semantics. A dashboard may shorten a label, but it must not change the
 * numerator, denominator or evidence scope.
 */
export const analyticsMetricDefinitions = {
  testsTaken: {
    id: 'testsTaken',
    title: 'Tests Taken',
    unit: 'count',
    emptyDisplay: 'Not assessed',
    definition: 'The number of submitted test attempts in the selected evidence scope.',
    evaluatedFrom: "Count of exam attempts whose final server state is 'submitted'. In-progress, abandoned or duplicate/replayed starts are excluded.",
    canonicalFormula: 'count(submitted attempts)',
    whyItMatters: 'It describes how many completed assessment events contribute evidence to the view.',
    caution: 'A resumed attempt is not another test taken, and repeated starts that resolve to one attempt count once.',
  },
  uniqueQuestions: {
    id: 'uniqueQuestions',
    title: 'Unique Questions',
    unit: 'count',
    emptyDisplay: 'Not assessed',
    definition: 'The number of distinct canonical question records represented by submitted-test evidence in the selected scope.',
    evaluatedFrom: 'Distinct question_id values from the exact paper-question snapshots/outcomes included in submitted attempts. Re-exposure to the same canonical question counts once here.',
    canonicalFormula: 'count(distinct canonical question_id)',
    whyItMatters: 'It separates breadth of question exposure from repeated practice on the same question.',
    caution: 'Do not use total question outcomes as a substitute; repeated exposure deliberately increases outcomes but not unique questions.',
  },
  questionOutcomes: {
    id: 'questionOutcomes',
    title: 'Question Outcomes',
    unit: 'count',
    emptyDisplay: 'Not assessed',
    definition: 'The total number of question instances presented across submitted tests in the selected scope.',
    evaluatedFrom: 'One outcome for every paper question in every submitted attempt, regardless of whether the student answered it. Repeated exposure counts again.',
    canonicalFormula: 'correct + incorrect + unanswered',
    whyItMatters: 'It is the evidence denominator for coverage and outcome counts and preserves repeated practice as repeated evidence.',
    caution: 'Question Outcomes is not Unique Questions; one canonical question can contribute multiple outcomes across tests.',
  },
  attempted: {
    id: 'attempted',
    title: 'Attempted',
    unit: 'count',
    emptyDisplay: 'Not assessed',
    definition: 'Question outcomes with an evaluable submitted answer.',
    evaluatedFrom: 'Correct plus incorrect outcomes. Unanswered outcomes are excluded.',
    canonicalFormula: 'correct + incorrect',
    whyItMatters: 'It measures answered coverage independently of answer quality.',
    caution: 'Do not label attempted/question-outcomes as Participation; that ratio is question attempt rate, not test participation.',
  },
  unanswered: {
    id: 'unanswered',
    title: 'Unanswered',
    unit: 'count',
    emptyDisplay: 'Not assessed',
    definition: 'Question outcomes for which no evaluable answer was submitted.',
    evaluatedFrom: 'Presented paper questions in submitted attempts without a correct or incorrect outcome.',
    canonicalFormula: 'question outcomes - attempted',
    whyItMatters: 'It identifies uncovered assessment evidence without guessing why a question was left unanswered.',
    caution: 'Unanswered is an observed outcome, not an inference about effort, time pressure or intent.',
  },
  accuracy: {
    id: 'accuracy',
    title: 'Accuracy',
    unit: 'percentage',
    emptyDisplay: 'Not assessed',
    definition: 'The percentage of attempted question outcomes answered correctly.',
    evaluatedFrom: 'Correct outcomes divided by correct plus incorrect outcomes in the selected evidence scope.',
    canonicalFormula: '100 × correct / attempted',
    denominatorRule: 'If attempted = 0, Accuracy has no denominator and must display Not assessed rather than 0%.',
    whyItMatters: 'It measures answer quality separately from how much of the assessment was attempted.',
    caution: 'High accuracy with low attempted coverage must not be presented as equivalent to broad mastery.',
  },
  scorePercentage: {
    id: 'scorePercentage',
    title: 'Score %',
    unit: 'percentage',
    emptyDisplay: 'Not assessed',
    definition: 'Marks earned as a percentage of the marks available across the selected evidence scope.',
    evaluatedFrom: "Sum of marks awarded under each exact published paper's scoring/negative-marking rules divided by the sum of marks available for those outcomes.",
    canonicalFormula: '100 × sum(marks awarded) / sum(marks available)',
    denominatorRule: 'If available marks = 0, Score % has no denominator and must display Not assessed rather than 0%.',
    whyItMatters: 'It preserves weighting and negative marking, which Accuracy alone cannot represent.',
    caution: 'Do not substitute an unweighted average of per-test percentages when papers have different maximum marks.',
  },
  participation: {
    id: 'participation',
    title: 'Participation',
    unit: 'percentage',
    emptyDisplay: 'Not assessed',
    definition: 'The share of eligible assigned assessment opportunities that resulted in a submitted attempt.',
    evaluatedFrom: 'For a student scope: submitted assigned tests divided by eligible assigned tests. For a cohort/test scope: eligible assigned students with a submitted attempt divided by eligible assigned students.',
    canonicalFormula: '100 × submitted eligible assignments / eligible assignments',
    denominatorRule: 'The denominator must come from the frozen/materialized eligible assignment audience for the selected scope. If there are no eligible assignments, display Not assessed.',
    whyItMatters: 'It measures assessment participation without confusing it with how many questions a student attempted inside a test.',
    caution: 'Never derive Participation from attempted questions, question outcomes, account count or currently active students.',
  },
} satisfies Record<string, AnalyticsMetricDefinition>;

export type AnalyticsMetricId = keyof typeof analyticsMetricDefinitions;

export const metricDefinitions = {
  score: {
    title: 'Assessment score',
    definition: "Marks earned under the paper's published scoring and negative-marking rules.",
    evaluatedFrom: 'The submitted responses evaluated against the exact published paper version.',
    whyItMatters: 'It summarises the result of that assessment and links directly to the underlying question outcomes.',
    caution: 'Scores from papers with different difficulty, syllabus coverage or maximum marks need context before comparison.',
  },
  accuracy: {
    title: 'Accuracy',
    definition: 'The percentage of attempted questions answered correctly.',
    evaluatedFrom: 'Correct responses divided by correct plus incorrect responses. Unanswered questions are shown separately.',
    whyItMatters: 'It separates answer quality from coverage and helps identify where revision may improve reliability.',
    caution: 'High accuracy with few attempts can hide a coverage or pacing problem.',
  },
  correctAnswers: {
    title: 'Correct answers',
    definition: 'The number of question outcomes evaluated as correct.',
    evaluatedFrom: 'Each submitted response compared with the answer key stored for the exact paper question snapshot.',
    whyItMatters: 'It provides the direct evidence behind score and accuracy.',
    caution: 'Different questions may carry different marks, so this count does not always move in the same way as score.',
  },
  attemptedQuestions: {
    title: 'Attempted questions',
    definition: 'Questions with a submitted answer that could be evaluated as correct or incorrect.',
    evaluatedFrom: 'Correct plus incorrect outcomes in the selected assessment or evidence window.',
    whyItMatters: 'It shows how much of the paper the student actively answered.',
    caution: 'Attempt volume should be read together with accuracy and unanswered questions.',
  },
  unansweredQuestions: {
    title: 'Unanswered questions',
    definition: 'Questions for which no evaluable answer was submitted.',
    evaluatedFrom: 'Published paper questions without a correct or incorrect response in the completed attempt.',
    whyItMatters: 'It identifies lost coverage without guessing why the question was left unanswered.',
    caution: 'The platform does not label the cause; the student or teacher can review the actual question when needed.',
  },
  timeUsed: {
    title: 'Time used',
    definition: 'The recorded duration of the completed attempt and its question-response timing evidence.',
    evaluatedFrom: 'Attempt start and submission timestamps, plus valid time-spent records saved for individual responses.',
    whyItMatters: 'It helps compare coverage and accuracy with the time actually used.',
    caution: 'Timing is an observation, not proof of understanding, effort or the reason for an answer.',
  },
  attemptsAvailable: {
    title: 'Attempts available',
    definition: 'The number of starts still permitted by both the paper limit and any purchased product entitlement.',
    evaluatedFrom: 'Paper attempt limit, completed and active attempts, entitlement cycle and purchased attempt usage.',
    whyItMatters: 'It prevents accidental overuse and makes access rules clear before a student starts.',
    caution: 'A resumed in-progress attempt does not consume another purchased attempt.',
  },
} satisfies Record<string, MetricDefinition>;
