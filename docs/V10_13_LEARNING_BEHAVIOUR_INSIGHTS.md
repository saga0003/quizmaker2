# Evidara V10.13 — Learning Behaviour Insights

## Product position

Learning Behaviour Insights is a transparent, rule-based analytics layer under the student Analytics tree. It is not an AI feature and it does not attempt to diagnose psychology from marks.

The module converts observable assessment process data into cautious development references:

- exam endurance
- decision balance
- review discipline
- question selection
- performance consistency
- recovery after an error
- revision effectiveness
- speed–accuracy control

## Required evidence

The module should remain in **Limited evidence** state until the learner has at least:

- 3 comparable assessments
- 60 valid question responses
- reliable question-order and response-time records for timing measures
- answer-change history for review measures
- difficulty tags for question-selection measures
- pre-, post- and delayed checks for revision-effectiveness measures

No result should be calculated from marks alone.

## Interpretation rules

1. Describe the current evidence pattern, never the learner's identity.
2. Present observed values and the calculation boundary with every insight.
3. Pair every development gap with one practical next step.
4. Use the learner's own repeated evidence as the primary comparison.
5. Treat response time as contextual process evidence; faster is not automatically better.
6. Do not infer anxiety, ADHD, depression, intelligence, personality, motivation or learning disability.
7. Do not use this module for admission, discipline, promotion, scholarship, fees or other high-impact decisions.
8. Allow teachers to review contextual factors such as paper difficulty, interruptions, syllabus coverage and accommodations.

## Research basis used for product design

The initial rules are informed by established educational and psychometric findings:

- computer-based assessments can use response time as additional process information, but response-time relationships are heterogeneous and should be interpreted with item and person context;
- rapid guessing is a recognised response pattern and should not be rewarded as efficient speed;
- confidence calibration is the relationship between perceived understanding and actual performance, but confidence cannot be claimed unless the product directly collects a confidence response;
- test-anxiety research shows associations can vary across populations and studies, so behavioural traces cannot diagnose anxiety;
- repeated and delayed evidence is more useful than a single immediate score for evaluating revision and retention.

## Required disclaimer

> These learning-behaviour insights are rule-based observations calculated from assessment responses, timing, answer changes and repeated performance. They are informed by educational and psychological research, but individual behaviour and test conditions vary. The results may not be fully accurate for every learner and must not be treated as a psychological, medical or learning-disability diagnosis. Use them as a reference for reflection, teacher discussion and improving upcoming assessment results.
>
> This version does not use artificial intelligence. Each result comes from published calculation rules and the evidence available in Evidara.

## Brand-book implementation

- Evidara Teal `#0E5A5A` for navigation, evidence and primary action
- Insight Amber `#F2B84B` only for selected points and attention signals
- Midnight Ink `#14232B` for authority and premium evidence surfaces
- Cloud White `#F7F9F7` and Evidence Mist `#DCE9E7` for spacious cards and panels
- Inter/system sans typography
- calm, specific and constructive language
- no deterministic labels, alarmist warnings or guaranteed outcomes
- component evidence, sample size and observation/prediction boundaries remain visible

## Current implementation boundary

V10.13 ships the analytics framework, transparent calculations, demo evidence and student route. Production data mapping should connect the `BehaviourEvidence` fields to valid response events only after timestamp quality, answer-change logging and comparable-assessment rules are verified.
