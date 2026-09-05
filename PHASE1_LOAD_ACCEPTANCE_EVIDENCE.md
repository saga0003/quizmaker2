# Evidara Phase 1 Load Acceptance Evidence

Date: 5 Sep 2026
Scope: existing isolated synthetic tenant `Evidara School` (`evidara-school-acceptance`) in existing Supabase project SMIS QP only. No St. Mary's or future-client data was used. No additional Supabase project was created.

## Safety baseline

- Acceptance organization ID: `4effce90-bccb-4263-9f5a-a75b6df301f2`.
- Baseline before load work: 100 canonical student memberships, 500 canonical questions, 1 canonical institutional paper, 3 attempts, database size 219,401,363 bytes.
- Load rows are visibly synthetic and tagged with `phase1_load=true` plus deterministic `PHASE1 LOAD`/`PHASE1-LOAD-*` identifiers.
- Permanent production was not promoted or modified.

## L2 — 50,000 questions / institution

Staged in SMIS QP for the isolated acceptance organization only:

- Canonical questions retained: 500.
- Synthetic scale-only draft questions added: 49,500.
- Total organization questions: **50,000**.
- Synthetic rows are draft rather than approved so option/correct-answer approval invariants are not weakened or bypassed.
- Authenticated School Admin search used the canonical `search_question_bank_v1` RPC with institution scope and a 25-row page; no full-browser 50,000-row load was used.
- Exact synthetic search (`PHASE1 LOAD Q 49500`): PostgreSQL `EXPLAIN ANALYZE` execution time **184.319 ms**.
- General institution first-page query over the 50,000-question dataset: `EXPLAIN ANALYZE` execution time **603.762 ms**.

Status: dataset/search evidence obtained; do not mark checklist L2 complete until the exact evidence checkpoint passes the complete Phase-1 release gate.

## L3 — 1,000 papers dataset

Staged in SMIS QP for the isolated acceptance organization only:

- Canonical institutional paper retained: 1.
- Synthetic scale-only draft papers added: 999.
- Total organization papers: **1,000**.
- Synthetic papers remain draft and unassigned, so they cannot become student-visible test activity.

Status: dataset evidence obtained; do not mark checklist L3 complete until the exact evidence checkpoint passes the complete Phase-1 release gate.

## Storage observation

The first attempted 49,500-question insert was transactionally rolled back after an SEO-slug uniqueness collision. Logical data remained at the 500-question baseline, but PostgreSQL retained dead tuple/index pages. A normal `VACUUM (ANALYZE)` was run on `public.questions` before retrying. The successful L2/L3 staging left database size at approximately **421.5 MB**. This is now treated as a hard reason not to expand L1/auth fixtures until storage headroom is verified; no `VACUUM FULL` or disruptive rewrite was performed.

## Remaining load acceptance

- L1: 2,000 students/institution test dataset — pending safe authenticated-fixture/storage strategy.
- L4: 500 near-concurrent starts — pending L1 and guarded preview configuration.
- L5: 500 concurrent answer-save patterns — pending L1 and guarded preview configuration.
- L6: 500 submissions in finishing window — pending L1 and guarded preview configuration.

Production remains protected until L1-L6 and Z2-Z8 are genuinely green.
