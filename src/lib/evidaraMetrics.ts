export type MetricDefinition = {
  title: string;
  definition: string;
  evaluatedFrom: string;
  whyItMatters: string;
  caution?: string;
};

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
