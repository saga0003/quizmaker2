# Evidara Phase 1 Privacy & Data Governance Baseline

Status: engineering baseline for Phase 1. This document is not legal advice and does not satisfy checklist J3 by itself. Privacy Policy and institution data-processing terms require qualified legal review before production sign-off.

## 1. Data minimisation — student and parent information

Phase 1 is institution-first. Evidara should collect or expose only data needed to provision school users, assign tests, deliver assessments, calculate authorised results/analytics, operate subscriptions, provide scoped support, and satisfy security/audit obligations.

### Core identity and school membership

- Student account identifiers: authentication user ID, username/email where institution provisioning requires it, display/full name, and optional phone only where operationally required.
- School membership: institution ID, academic year, grade, section/section ID, board/programme/tracks, membership lifecycle status and lifecycle timestamps/reasons.
- Parent/guardian data currently represented by `parent_name` and `parent_phone` on `student_school_memberships` is **optional operational contact data**, not an analytics dimension. Do not require it for test eligibility, scoring, ranking or topic analytics. Do not copy it into attempts, responses, analytics snapshots, exports or AI payloads.
- Avoid collecting home address, government identifiers, financial data, medical data, precise location, biometrics, religion/caste or unrelated demographic profiling in Phase 1 unless a separately reviewed product requirement and lawful basis are approved.

### Assessment and learning evidence

- Test assignment and attempt evidence may contain student ID, institution ID, paper ID, timestamps, response values, correctness/marks, time spent and integrity evidence needed to operate the assessment.
- Analytics should derive from assessment evidence and frozen taxonomy snapshots. Analytics must not enrich a learner profile with unrelated personal data.
- Institution analytics exports must remain institution-scoped and should include only identifiers necessary for the authorised school purpose; parent phone/name must not appear in assessment analytics exports by default.

### Security and operations

- Audit events should be metadata-first: actor, institution/scope, action, target identifier, timestamp and necessary change metadata. Never log passwords, session tokens, API keys, raw authentication secrets, full student answer payloads or parent phone numbers merely for debugging.
- Operational health endpoints must remain aggregate/sanitised. Public health probes must never expose student, institution, contact or usage-detail records.

## 2. Purpose limitation and access boundaries

- Students: access their own eligible tests, own attempts and only results/analytics released by server-side policy.
- Teachers: access students/questions/papers/results only inside assigned institution/teaching scope.
- School Admins: institution-level administration and analytics only for their active institution.
- Super Admin/platform support: least-privilege operational access. Read-only View As remains read-only. Explicit support analytics access must be scoped, intentional and audited.
- Database service credentials and R2 credentials are server-only and are not exposed to browser clients.

No role receives access merely because the UI hides a control; RLS/RPC/server authorization remains authoritative.

## 3. Retention, export, termination and deletion policy

### Retention classes

1. **Account and membership records** — retain while the institution agreement/account is active and while needed to preserve legitimate academic records; inactive membership status must be used instead of silently losing historical attribution.
2. **Assessment records** — submitted attempts, authoritative marks, response evidence and frozen paper/taxonomy snapshots are academic records. Retain for the institution's agreed academic-record period and any legally required period. A deletion request must not silently rewrite historical marks or break the integrity of released result records.
3. **Draft/transient data** — local browser autosaves are user/institution-scoped and cleared on the defined logout/publish lifecycle. Import staging/temporary files should be removed as soon as their operational purpose and troubleshooting window end.
4. **Security/audit records** — retain long enough to investigate privileged changes, access abuse and incidents. Audit retention must be documented in the institution contract and must not contain unnecessary content payloads.
5. **Private resources/object storage** — institution-owned objects remain private and should be deleted after an approved institution termination/export process and expiry of the agreed recovery window, unless legal retention applies.

### Institution export

Before termination/deletion, an authorised institution administrator can request an institution-scoped export. The export package should cover the institution's users/memberships, questions/papers, assignments, submitted assessment records, released analytics/result records and resource inventory as contractually applicable. Export generation must use existing tenant authorization and be auditable. Cross-school data must never be included.

### Termination/deletion workflow

1. Verify requester authority and institution identity.
2. Freeze new institution writes by moving the subscription/institution to the approved inactive/suspended/expired state without destroying historical reads prematurely.
3. Offer/complete the authorised export and record its completion.
4. Determine records that must be retained for legal/contractual/academic integrity reasons versus records eligible for deletion or irreversible anonymisation.
5. Delete eligible private object storage and institution data in dependency-safe batches; never use an ad-hoc unreviewed production cascade.
6. Preserve only the minimum audit/financial/legal evidence required, with access restricted.
7. Verify no active credentials, signed URLs or staff/student access remain for the terminated institution.
8. Record the operator, approval, scope, timestamps and verification result.

Production implementation of destructive institution deletion must be separately tested against a disposable tenant before first use. Until then, termination is fail-safe suspension/deactivation plus controlled export/review—not an untested hard delete.

## 4. External AI helper boundary

Phase 1 has **no automatic external AI SDK/provider dependency in the application package** and no background path that sends student analytics to an AI provider. The AI-helper concept is limited to question-content conversion assistance.

Any future external AI conversion helper must satisfy all of these rules:

- It is an explicit operator action; never silent/background transmission.
- Input is restricted to question/import content required for conversion (question text, options, equations and question assets where explicitly chosen).
- Student identity, parent/guardian data, school contact data, attempts, answers, marks, rankings, weakness/strength analytics, integrity evidence and support/audit records are excluded from the payload.
- UI clearly identifies that an external processor will receive the selected question content before transmission.
- Provider, purpose, retention/training settings, data location/cross-border implications and contractual terms must be approved before enabling production transmission.
- Returned content is treated as untrusted draft input and passes the same validation, duplicate, safety and approval gates as manual imports.
- Adding an AI SDK/API client or server route that can send student/performance fields is a release-gate change and requires privacy/security review.

Question conversion and student analytics remain separate trust domains.

## 5. Support/admin least privilege and audit

- Platform support must prefer aggregate health, institution identifiers and metadata over student-level content.
- Student analytics support access requires an explicit institution scope and emits a support audit event; ambiguous multi-institution history fails closed.
- Privileged writes are covered by the Phase 1 audit layer for institution, subscription, account/membership, credential, question, paper/assignment, result and resource changes.
- Read-only Super Admin View As cannot write.
- Privileged credentials are subject to the coordinated MFA/AAL2 production cutover specified in Z8; do not weaken that gate for support convenience.
- No shared support account. Human operators use individual privileged identities so actions remain attributable.
- Access reviews should remove dormant platform/support users and privileges no longer required.

## 6. Indian privacy legal-review handoff

The engineering baseline must be reviewed against the applicable Indian legal framework before J3 can be checked. As of 2 September 2026, MeitY has notified the Digital Personal Data Protection Rules, 2025 and phased commencement provisions for the Digital Personal Data Protection Act, 2023. The legal review must determine which provisions are in force on the planned production date and how Evidara and each institution are classified/obligated for student data, including children’s data where applicable.

The legal-review packet must cover at minimum:

- controller/data-fiduciary and processor/data-processor roles between Evidara and institutions;
- notice and lawful-purpose/consent basis for students and guardians, including children’s-data requirements;
- rights/request workflow and identity verification;
- retention/deletion and institution termination;
- security safeguards and personal-data-breach workflow/notifications;
- processor/subprocessor and R2/Supabase/Vercel contractual treatment;
- cross-border/data-location implications;
- grievance/contact mechanism;
- institution instructions, audit/support access and confidentiality;
- effective dates and transition obligations under the phased DPDP commencement.

J3 remains open until qualified counsel reviews and approves the actual Privacy Policy and institution data-processing terms. Engineering must not self-certify legal compliance.

## 7. Release evidence required

J1/J2/J4/J5 may be engineering-verified only when this baseline is backed by code/database evidence and a permanent regression in the complete release gate. J3 requires separate legal sign-off. Real-school acceptance must use test/authorised data consistent with the approved policy; production credentials and permanent production remain protected until all release gates are complete.
