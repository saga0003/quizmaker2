# Evidara V12 — Reference HTML Analytics Implementation

V12 replaces the earlier simplified analytics surface with a complete reference-driven dashboard.

## Integration

- Student route: `/student/analytics/`
- Super Admin route: `/admin/student-analytics/`
- The Evidara student home navigation exposes an `Analytics V12` dropdown.
- Query-string navigation opens the matching view directly, for example `?view=subject`, `?view=chapter`, `?view=topic`, or `?view=behaviour`.

## Implemented reference views

- Overview
- Subject analysis
- Chapter analysis
- Topic analysis
- Learning Behaviour
- Practice
- Test History
- Goals

## Reference UI reproduced

- Inter typography and reference sizing
- 34 px page headings and compact 15 px supporting copy
- four-card metric row
- performance profile radar
- subject comparison chart with direct subject drill-down
- performance trend with visible X and Y axes
- average, highest and custom percentile line controls
- custom percentile precision up to four decimal places
- reference subject selector strip
- chapter mastery and concept performance table
- question-difficulty analysis
- chapter tabs, topic mastery, accuracy-versus-time and stacked error breakdown
- topic sub-concept mastery, difficulty analysis, performance rings, common mistakes and recommended practice
- fixed right-side strengths and focus drawer
- collapsed overlay navigation that does not compress content
- compact PDF and refresh controls

## Learning Behaviour boundary

Learning Behaviour remains rule-based and non-AI. It describes assessment patterns and does not diagnose psychological, medical or learning-disability conditions.
