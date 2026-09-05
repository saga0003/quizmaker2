# Evidara Phase 1 — Legal Review Packet

Status: **prepared for qualified Indian privacy counsel; not legal approval**.

Checklist relationship: this packet prepares J3. **J3 must remain unchecked until qualified counsel reviews and approves the final Privacy Policy and institution data-processing terms.** Engineering must not self-certify legal compliance.

## 1. Product and processing summary

Evidara Phase 1 is an institution-first online assessment and analytics platform. Institutions license active student seats at ₹199 per student per year. Institution staff maintain question banks, create and assign tests, students take assessments, and Evidara stores assessment evidence and provides authorised results and subject/chapter/topic/question analytics.

Primary roles:

- Institution / school: provisions students and staff, assigns academic scope, creates tests and determines authorised educational use.
- Evidara: hosts and operates the platform, enforces tenant boundaries, stores/serves assessment data, calculates authorised results/analytics, and provides audited support/operations.
- Student: authenticated learner using institution-assigned access.
- Parent/guardian: only optional operational contact data where the institution supplies it; not an analytics dimension.

## 2. Data categories currently in Phase 1

### Identity and tenancy
- Authentication user ID and username/email where provisioning requires it.
- Display/full name.
- Optional phone where operationally required.
- Institution membership, academic year, grade, section, board/programme/track and membership lifecycle state.
- Optional parent/guardian name and phone on membership records; these are excluded from assessment analytics by design.

### Assessment evidence
- Test/paper identifiers and assignment scope.
- Attempt timestamps and authoritative server expiry.
- Student responses, correctness, marks, time spent and submission receipt.
- Frozen paper/taxonomy snapshots used to preserve historical result meaning.
- Integrity events such as tab/window/fullscreen/copy-shortcut evidence. These are presented as review evidence, not an automated misconduct verdict.

### Operations/security
- Metadata-first audit records for privileged actions.
- Sanitised aggregate platform-health evidence.
- Subscription/licence state and seat counts.

Phase 1 deliberately avoids collecting government identifiers, payment-card data, medical data, biometrics, religion/caste, precise location and unrelated demographic profiling.

## 3. Access model and safeguards for counsel review

- Supabase RLS/RPC/server authorisation is authoritative; UI hiding alone does not grant or deny access.
- Students are limited to their own eligible tests/attempts and server-released results/analytics.
- Teachers are institution and teaching-scope constrained.
- School Admins are active-institution constrained.
- Super Admin / platform support uses least-privilege operational access; read-only View As cannot write and support analytics reads are explicitly scoped/audited.
- Multi-institution staff must explicitly select the active institution.
- Private academic resources use authenticated short-lived signed access.
- Upload signatures are validated server-side; SVG is rejected for Phase 1; ZIP extraction is bounded.
- Privileged accounts have a coordinated MFA/AAL2 production cutover requirement before launch.
- Production remains protected until complete release gate, real-school acceptance, load acceptance and sign-off.

## 4. Current service providers / subprocessors to assess

Counsel should confirm contractual role, transfer/data-location treatment, retention and security obligations for the production configuration of:

1. **Supabase** — authentication, PostgreSQL database, relevant storage/services.
2. **Vercel** — application hosting/deployment/runtime.
3. **Cloudflare R2** — object storage where configured for Evidara assets/resources.
4. Any email/SMS/telephony provider later enabled for authentication or operational communication.
5. Any future external AI provider. Current Phase 1 package has no approved automatic external AI data path; any future AI helper must be limited to explicitly selected question-conversion content and must exclude student/parent identity, attempts, answers, marks, rankings, analytics, integrity and support/audit evidence unless separately approved.

Engineering must provide current production-region/account configuration and signed processor terms to counsel before approval.

## 5. Indian legal framework — dated handoff note

This is a factual engineering handoff, not a legal conclusion.

The Digital Personal Data Protection Rules, 2025 were notified in November 2025 with phased commencement. The notified commencement schedule places some provisions into force on publication, a further stage one year after publication, and many substantive processing provisions eighteen months after publication. As of **2 September 2026**, counsel must determine exactly which provisions are legally operative on Evidara's intended launch date and what transition work must be completed before later commencement dates.

Counsel should review the final product/contract against the Digital Personal Data Protection Act, 2023, the Digital Personal Data Protection Rules, 2025 and any other applicable Indian education, child-protection, contract, cybersecurity, record-retention or sector-specific requirements.

## 6. Questions requiring explicit counsel determination

Counsel should provide written conclusions for each item below.

1. **Role allocation:** For each processing purpose, is the institution the Data Fiduciary and Evidara a Data Processor, or does Evidara independently act as a Data Fiduciary for any operational/support/security purpose?
2. **Children's data:** Which student cohorts qualify as children on launch, what verified-parent/guardian consent or other mechanism is required, who obtains/records it, and what age/identity verification is lawful and proportionate?
3. **Notice:** What notice must be shown or supplied to students/guardians and staff, in which languages/form, at what collection point, and how should institutional notices reference Evidara?
4. **Lawful purpose / consent:** Which processing purposes rely on consent versus other lawful bases/legitimate uses, and who is responsible for demonstrating the basis?
5. **Rights workflow:** How should access, correction, erasure and grievance requests be received, identity-verified, routed between institution and Evidara, timed and recorded?
6. **Retention:** Approve concrete retention periods for active/inactive accounts, academic attempts/results, response evidence, frozen snapshots, integrity events, audit logs, backups and object storage.
7. **Termination/export:** Approve institution export scope, recovery window, suspension versus deletion sequence, anonymisation/deletion treatment and records that must remain for legal/accounting/academic integrity reasons.
8. **Breach response:** Define legally required detection/escalation, institution notification, Data Protection Board notification where applicable, affected-person communication, content and timing.
9. **Subprocessors:** Approve Supabase, Vercel, Cloudflare R2 and any future providers, including contractual flow-down, confidentiality, security, deletion/return and audit/assurance clauses.
10. **Cross-border/data location:** Confirm whether the configured regions and provider transfer paths are permissible and what contractual or notice language is required.
11. **Integrity evidence:** Confirm acceptable wording, retention and human-review process for exam-integrity telemetry, especially for minors.
12. **Support access:** Approve audited support access, confidentiality terms and institution authorisation boundaries.
13. **Security commitments:** Identify contractual promises Evidara may safely make without overstating uptime, prevention of cheating or absolute security.
14. **Incident/BCP:** Confirm whether contractual recovery, backup and service-continuity commitments need minimum service levels.
15. **Effective dates:** Identify mandatory compliance milestones before launch and before the later DPDP commencement phases.

## 7. Draft Privacy Policy content counsel must approve

The final Privacy Policy should, at minimum, accurately state:

- who operates Evidara and valid contact/grievance details;
- categories of personal data processed and sources (institution, user, platform activity);
- purposes for account provisioning, assessment delivery, scoring, analytics, support, security and subscription administration;
- institutional relationship and role allocation;
- children/guardian treatment;
- sharing/subprocessors and approved external-AI boundary;
- international/cross-border processing where applicable;
- retention and deletion approach;
- security safeguards described accurately without guarantees;
- rights/request/grievance process and identity verification;
- breach/incident communication approach where legally required;
- policy update/effective-date mechanics.

## 8. Institution Data Processing Terms counsel must approve

The institution agreement / DPA should cover:

- documented processing instructions and permitted purposes;
- role allocation and allocation of student/guardian notice/consent duties;
- confidentiality and staff access controls;
- minimum security safeguards, MFA for privileged access and auditability;
- tenant isolation and scoped support access;
- subprocessors, change notification and contractual flow-down;
- incident/breach cooperation and notification responsibilities;
- data-subject/request cooperation;
- retention, institution export, termination, deletion/return and backup treatment;
- cross-border/data-location terms where applicable;
- audit/assurance mechanism proportionate to the service;
- prohibited institution uploads/use cases and responsibility for lawful source data;
- no use of student assessment data to train an external AI model unless separately and expressly approved under a reviewed change.

## 9. Engineering facts that must not be changed silently after legal approval

A release-impacting privacy review is required if Phase 1 later introduces any of the following:

- new student/parent identity fields or sensitive-data categories;
- behavioural profiling beyond educational assessment analytics;
- automatic external AI transmission;
- advertising/marketing use of learner data;
- biometrics/proctoring camera/microphone capture;
- precise location;
- direct student payment/commerce;
- materially new subprocessors or data regions;
- retention periods inconsistent with the approved policy/contract;
- cross-institution analytics that identify individual students.

## 10. Approval record — mandatory before J3

J3 may be checked only when all fields below are completed and the approved final documents are linked/versioned.

- Counsel / firm: ______________________________
- Reviewer name and designation: ______________________________
- Review date: ______________________________
- Jurisdiction/scope confirmed: ______________________________
- Privacy Policy version/commit: ______________________________
- Institution DPA/terms version/commit: ______________________________
- Subprocessor/transfer review completed: Yes / No
- Children's-data approach approved: Yes / No / Not applicable (explain)
- Retention schedule approved: Yes / No
- Breach workflow approved: Yes / No
- Outstanding conditions before production: ______________________________
- Written approval reference: ______________________________

**Release rule:** any blank mandatory approval field, unresolved material condition or unreviewed final-text change keeps J3 open and blocks Phase 1 production sign-off.
