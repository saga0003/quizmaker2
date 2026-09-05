# Phase 1 Acceptance Evidence — R7 to R9

Verified on 2 September 2026 against the existing same-project isolated synthetic tenant **Evidara School** (`evidara-school-acceptance`, organization `4effce90-bccb-4263-9f5a-a75b6df301f2`). No St. Mary's or future-client data was used.

## R7 — Approve questions

Acceptance exposed a role-taxonomy drift: current `school_admin` members could import institution questions but `can_review_org_question()` still recognized only legacy institute-owner/admin/reviewer roles. Migration `20260902232500_phase1_r7_school_admin_question_review.sql` adds active `school_admin` review parity while keeping anonymous execution blocked. Exact functional commit `fa945496b97db02bb7d18acc7efcde1f5d975b86` passed complete Phase 1 release gate `33663448733`.

The 500 synthetic R6 questions were assigned the isolated tenant taxonomy Physics → Kinematics → Motion in One Dimension and difficulty `moderate`, satisfying the analytics-ready approval guard. Under the authenticated acceptance School Admin identity, canonical `bulk_review_questions_v13` returned `requested_count=500`, `reviewed_count=500`, `status_updated_count=500`, `decision=approved`. Post-verification found exactly 500 approved questions, 500 `approved_at` timestamps, and 500 approval rows in `question_reviews`.

## R8 — Create Physics test and assign Grade 11 section/programme

Using the canonical `save_question_paper` path under the authenticated acceptance School Admin identity, created paper `e5801a88-1e7f-4b4f-a715-ad44ce2b3c43` (`R8-PHY-20260902`) with one Physics section, 20 approved synthetic Physics questions, 80 total marks, 30-minute duration, Grade 11, NEET exam type, and open-forever acceptance schedule.

Canonical `preview_paper_assignment_v19` for academic year `2026-27`, Grade 11, Section A (`bdc62336-81c6-4cfc-9d7c-1c77662d6f5b`), track/programme `NEET` returned exactly 100 eligible active students. `assign_paper_audience_v19` materialized exactly 100 assignments. `get_paper_publish_readiness_v1` returned `ready=true` with approved-question, duration, marks, audience, schedule and result-policy checks all passing. Canonical `set_question_paper_status_v8` then published the paper. Final database verification found status `published`, Physics section/subject, Grade 11, 20 questions, 80 marks, audience `{academic_year: 2026-27, grades:[11], section_ids:[...], tracks:[NEET]}`, and exactly 100 materialized assignments.

## R9 — Student starts assigned test

The synthetic acceptance Student account previously completed protected rendered-browser authenticated readiness. Using that same acceptance Student identity (`937bc187-9d34-4609-851e-7f526bafb21e`), canonical `start_exam_attempt` started assigned paper `e5801a88-1e7f-4b4f-a715-ad44ce2b3c43` and returned attempt `d970d756-f56c-4e9a-9057-f2c775658719`.

`get_exam_attempt_payload` verified the attempt is `in_progress`, contains one section and 20 questions, has no saved responses yet, reports a 30-minute duration, and does not expose `correct_answer` in the learner payload. The attempt remains intentionally in progress for R10 offline/reconnect recovery acceptance.

## Production protection

All acceptance mutations in this evidence are scoped to `evidara-school-acceptance`. Permanent production deployment was not changed. R10 must exercise the rendered client offline/reconnect path before submission; this evidence does not claim R10 or any later acceptance item.
