# Evidara V6.7 — Achievements, Badges and Verifiable Certificates

V6.7 adds evidence-backed recognition without turning badges into permanent student labels or public rankings.

## Recognition rules

The first published rule version is `2026.07-v1`.

- **First Evidence:** first submitted assessment
- **Assessment Excellence:** at least 90% with at least 10 evaluated questions
- **Perfect Score:** 100% with at least 5 evaluated questions
- **Growth Milestone:** improvement of at least 15 percentage points between assessments of the same exam type
- **Consistent Performer:** at least 75% in each of the three most recent valid assessments
- **Integrity Streak:** five recent assessments with zero recorded integrity events
- **Shared Benchmark Participant:** first valid benchmark contribution
- **Benchmark Distinction:** at least the 90th external percentile after the benchmark privacy minimum is satisfied

Every achievement stores:

- the exact rule version
- the source attempt or benchmark contribution
- the observed evidence values
- award and last-evaluation timestamps
- active or revoked state
- auditable revocation reason

Every later change to the rule version, source record or observed values writes an immutable audit event containing both the previous and current evidence snapshot.

## Automatic refresh

Achievement evaluation runs after:

- a submitted exam attempt is inserted or materially updated
- a benchmark contribution is inserted or its validity or score changes
- a student or school requests an explicit refresh
- a school runs the active-student backfill

Evidence-window achievements can be automatically revoked when the current evidence no longer meets the published rule. A later valid evaluation can restore an automatically revoked award. Manual school revocation requires Super Admin restoration.

## Certificates

Only certificate-eligible active achievements can issue certificates.

Certificates include a snapshot of:

- learner name
- school name
- achievement title and description
- evidence summary
- rule version
- issue date
- certificate number
- verification code

The verification link is bearer-style and `link_only`. Anyone with the code can confirm the limited certificate snapshot and whether it is active or revoked. Both the HTML verification route and API response use noindex, nofollow and noarchive controls.

Download options:

- branded SVG certificate
- browser print / Save as PDF

Revoked certificates continue to verify as revoked instead of disappearing. An active eligible achievement can issue a new certificate while the revoked historical certificate remains verifiable.

## Privacy and governance

- Students see only their own achievements and certificates.
- Schools see only learners linked to their organization.
- Super Admin sees rule-level counts and governance information.
- Raw achievement evidence, certificate rows and audit events are server-only.
- No public student or school leaderboard is created.
- Recognition cannot be used to decide admission, discipline, promotion, fees, scholarship, access or employment.
- Public Supabase configuration without the server service-role key fails closed with a 503 response rather than selecting demonstration data.

## Routes

- `/student/achievements/`
- `/school/achievements/`
- `/admin/achievements/`
- `/verify/certificate/`
- `/verify/certificate/[code]/`
- `/api/achievements`
- `/api/certificates`

Demo certificate code:

```text
demo-evidara-2026
```

## Supabase migrations

Apply in numeric order after V6.6:

- `17_achievement_badge_schema.sql`
- `18_achievement_certificate_operations.sql`
- `19_achievement_uuid_aggregate_compatibility.sql`
- `20_achievement_evidence_audit_hardening.sql`

Migration 19 provides a portable UUID aggregate used only to retain a representative source-attempt identifier from recent evidence windows. Migration 20 preserves immutable before-and-after history whenever a current achievement’s rule version, source or evidence changes.

Vercel automatic deployment remains paused. Test through GitHub Actions and GitHub Codespaces before intentionally publishing production.
