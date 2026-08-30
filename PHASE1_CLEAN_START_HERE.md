# Evidara Phase 1 Clean — Start Here

Build date: 28 August 2026  
Base: Evidara V19.1 + Phase 1 launch policy

## Before the first local test

1. Extract the ZIP to a normal Windows folder.
2. Copy your existing `.env.local` (or `.env`) into the extracted Evidara folder.
3. In Supabase SQL Editor, run **`APPLY_PHASE1_CLEAN_TO_SUPABASE.sql`** once.
   - This adds the atomic **question import + draft paper creation** service.
   - It keeps new questions in the institution question bank and reuses institution duplicates.
   - It makes `seat_limit = 0` the explicit marker for **unlimited students** on the Founding Institution Plan.
4. Double-click **`TEST_EVIDARA.bat`**.
   - On a fresh machine, the launcher installs/repairs npm dependencies automatically.
   - It validates environment variables, runs the Evidara release QA/build, starts the local server, and opens the browser.

Do not run `PUBLISH_EVIDARA.bat` until local testing is clean for the roles you intend to use.

## What changed in this Phase 1 build

### Question import + paper creation
- A cleaner teacher-friendly import flow: **Upload Source → AI Prepare → Review & Classify → Import & Create Paper**.
- Supports the existing Evidara formats including Excel/CSV/LaTeX and image-ZIP workflows.
- **AI Helper** is provider-independent. It gives a conversion prompt that can be pasted into ChatGPT, Gemini, Claude, or another capable AI, including free tiers where file limits allow.
- School imports can create a **draft paper in the same operation**.
- Existing institution duplicates are reused; genuinely new questions are added to the institution question bank.
- Paper title, exam, grade, duration and set can be reviewed before import.
- Missing taxonomy warnings are dynamic. Evidara tells the teacher exactly whether Subject, Chapter and/or Topic are missing and explains that those gaps reduce the quality of the matching analysis views.

### Academic Setup
- School Admin can maintain **institution-owned Subjects → Chapters → Topics**.
- Add manually or bulk-create taxonomy.
- Institution taxonomy is isolated by organization.
- School Admin cannot attach or manage another institution's taxonomy by guessing IDs.
- Removing taxonomy from active setup is implemented as a safe **archive**, preserving historical question/analysis relationships.
- Platform/global taxonomy remains available but read-only to schools.

### Student operations
- Clean searchable roster with filters, select-all and bulk selection.
- School Admin can edit student identity/contact details, roll number, parent details, grade, section, academic year, tracks/exams and notes.
- School Admin can set a password or generate/reset a temporary password.
- Promote, revoke and remove-from-institution actions are available with confirmation for destructive/lifecycle actions.
- Bulk promotion is available for selected students.
- Removing a student removes the **institution membership**, not the student's global Evidara account.
- Teacher roster access remains **assigned-section read-only**; School Admin-only operations are not exposed to teachers.

### Subscription
- Replaced the raw subscription screen with a clean plan dashboard.
- Phase 1 presents the **Founding Institution Plan — ₹199/student/year**.
- Unlimited tests and unlimited students are represented cleanly.
- Study Resources remain included.
- Placeholder/non-activated subscription state is shown honestly instead of displaying a one-day fake plan.

## Phase 1 role behaviour

| Role | Phase 1 access |
|---|---|
| Super Admin | Full platform administration; advanced parked engines remain retained for later phases. |
| School Admin | Institution questions, papers, students, analytics, subscription, Study Resources, Academic Setup and school access controls. |
| Teacher | School question/paper workflows according to assigned permissions; assigned-section student roster remains read-only. |
| Student | Institution tests/results/analytics/resources according to membership and plan access. |

The public marketplace, public practice, public PYQ/product commerce and related future modules are **parked, not deleted**. Study Resources remains available.

## Recommended first acceptance test

Use one demo institution and verify these flows before production:

1. School Admin login → Academic Setup → add one subject/chapter/topic.
2. Import 5–10 questions → classify → enable **Create paper from this import** → import.
3. Confirm the questions appear in School Questions and the new draft appears under Papers.
4. Add/edit a student, reset their temporary password, change grade/section and assign tracks.
5. Teacher login → confirm assigned student roster is read-only and another school's data is not visible.
6. Student login → take a test and confirm result/analysis/resource access.
7. Subscription → confirm the correct institution plan/status/date information is shown.
