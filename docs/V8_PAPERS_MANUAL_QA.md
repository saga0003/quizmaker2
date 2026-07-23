# Evidara V8 Papers — Manual Supabase Acceptance Runbook

This runbook is for a separate V8 test Supabase project only. Do not apply these migrations to the production project until the Papers module has passed this complete matrix and the user explicitly approves deployment.

## 1. Test boundary

- Branch: `evidara-v8-papers`
- Draft PR: `#19`
- V7 baseline: `evidara-v7-final`
- Vercel deployment: disabled
- Production deployment: prohibited during this test
- Product, pricing, entitlement, test-taking, results and analytics: outside this module

## 2. Preparation

1. Create or select a disposable Supabase test project.
2. Confirm migrations 1–31 have already been applied in the test project.
3. Export a database backup before applying V8 migrations.
4. Record the Supabase project reference and backup timestamp in the test report.
5. Configure the local/Codespaces branch with the test project's public URL and publishable key.
6. Do not place service-role keys in browser environment variables.
7. Keep `vercel.json` with `deploymentEnabled: false`.

## 3. Apply V8 migrations

Run complete files in this exact order:

1. `supabase/32_v8_paper_builder_foundation.sql`
2. `supabase/33_v8_paper_generation_engine.sql`
3. `supabase/34_v8_paper_review_publish_export.sql`
4. `supabase/35_v8_safe_autosave_templates_workflow.sql`

Stop immediately when any migration reports an error. Do not skip a failed statement and continue.

## 4. Basic schema verification

Confirm these tables exist:

- `paper_programmes`
- `paper_subjects`
- `paper_versions`
- `paper_blueprints`
- `paper_generation_runs`
- `paper_templates`
- `paper_reviews`
- `paper_review_comments`
- `paper_validation_results`
- `paper_audit_history`

Confirm these functions exist and are executable by authenticated staff:

- `save_paper_definition_v8`
- `duplicate_question_paper_v8`
- `create_paper_version_v8`
- `search_eligible_questions_v8`
- `paper_question_availability_v8`
- `validate_paper_v8`
- `save_paper_blueprints_v8`
- `refresh_paper_blueprint_availability_v8`
- `generate_paper_from_blueprint_v8`
- `replace_paper_question_v8`
- `submit_paper_review_v8`
- `add_paper_review_comment_v8`
- `resolve_paper_review_comment_v8`
- `decide_paper_review_v8`
- `publish_paper_definition_v8`
- `export_paper_definition_v8`
- `save_paper_as_template_v8`
- `create_paper_from_template_v8`

Confirm row-level security is enabled on every new V8 table.

## 5. Programme verification

Verify the catalogue contains separate records for:

- Foundation Grade 7
- Foundation Grade 8
- Foundation Grade 9
- Foundation Grade 10
- NEET
- JEE Main
- JEE Advanced
- KCET

Verify the existing taxonomy supplies the expected subjects:

- Physics
- Chemistry
- Mathematics
- Biology
- Logical Reasoning

No duplicate Question Bank should be created.

## 6. Test accounts

Prepare one account for each role:

- Super Admin
- Evidara Admin
- School Admin for School A
- School Teacher for School A
- School Admin or Teacher for School B
- Student

Use two separate school organizations to test tenant isolation.

## 7. Role matrix

### Super Admin

Must be able to:

- view and manage Evidara master papers
- use all creation modes
- duplicate papers
- manage templates
- review and approve
- publish paper definitions
- create new versions
- export and view audit history

### Evidara Admin

Must be able to perform the operational platform-paper workflow allowed by policy, including review and publication.

### School Admin

Must be able to:

- create and edit papers only inside the assigned school
- use approved Evidara questions and approved school-owned questions allowed by Question Bank policy
- duplicate and template school papers
- participate in the school review workflow
- publish only where the V8 policy permits

Must not see or modify another school's papers, templates, reviews or audit records.

### School Teacher

Must be able to perform the school paper-building and review actions allowed by the membership policy. Confirm any publish restriction expected for the role.

### Student

Must not be able to:

- open the admin or school Papers workspace
- query Question Bank answer data through paper-builder tables
- query paper snapshots, review comments, validation results or audit history
- create, edit, duplicate, review, publish or export paper definitions

## 8. Manual paper creation

1. Create a new paper without entering every field.
2. Confirm partial draft saving succeeds.
3. Confirm a unique paper code is generated.
4. Add programme, subjects and sections.
5. Add approved questions from multiple server-side pages.
6. Reload the browser.
7. Confirm every saved field, section and question reappears.
8. Modify the paper and allow autosave to run.
9. Confirm revision and last-saved information update.
10. Confirm no product, assignment or student access record is created.

## 9. Non-destructive autosave

1. Create sections and a blueprint.
2. Generate questions.
3. Edit the paper title or instructions.
4. Wait for autosave.
5. Reload the paper.
6. Confirm section IDs are unchanged.
7. Confirm blueprint rows still exist.
8. Confirm generation history still exists.
9. Confirm generated questions remain linked to their blueprint rows.
10. Move one generated question to another section and save.
11. Confirm that moved question becomes manual and its blueprint link is cleared without affecting unrelated questions.

## 10. Manual Question Bank selection

Test filters independently and in combination:

- programme
- subject
- chapter
- topic
- difficulty
- question type
- language
- text search
- question ID/external ID search
- unused only
- prefer unused

Verify pagination does not fetch the complete Question Bank into the browser.

Verify only approved questions can be added.

## 11. Automatic generation

1. Create blueprint rows with sufficient availability.
2. Refresh availability.
3. Confirm requested, available and shortage values are correct.
4. Generate the paper.
5. Record the random seed.
6. Re-run with the same seed in a clean equivalent paper and verify reproducible selection.
7. Regenerate the full paper.
8. Regenerate a single section.
9. Regenerate one blueprint row.
10. Confirm row-only regeneration does not delete unrelated questions in the same section.

## 12. Hybrid generation

1. Manually add questions to a hybrid section.
2. Lock selected manual questions.
3. Add blueprint requirements for the remaining count.
4. Generate the paper.
5. Confirm locked questions remain unchanged.
6. Regenerate the full paper and section.
7. Confirm only eligible unlocked generated questions change.

## 13. Shortage handling

1. Request more questions than are available.
2. Confirm the shortage is shown before generation.
3. Confirm generation is blocked.
4. Reduce the requested count or broaden filters.
5. Confirm availability updates and generation succeeds.
6. Test shortage calculations with `only unused` enabled.

## 14. Generated-question replacement

1. Select an unlocked generated question.
2. Replace it.
3. Confirm the replacement follows the same blueprint criteria.
4. Confirm the old question is excluded.
5. Confirm marks, section and display position remain appropriate.
6. Confirm a generation/audit record is created.
7. Lock a generated question and confirm replacement is blocked.

## 15. Duplication

Test every copy scope:

- entire paper
- settings only
- settings and sections
- settings, sections and blueprint
- settings, sections and questions

For every duplicate confirm:

- a fresh code is generated
- status is Draft
- publication date is empty
- availability windows are empty
- access code is empty
- no student access or product is created
- the original paper is unchanged

## 16. Templates

1. Save templates using every supported copy scope.
2. Create a draft from each template.
3. Confirm the new paper is Draft with a fresh code.
4. Confirm the template-created paper references its template.
5. Archive a template.
6. Confirm it disappears from the active template list.
7. Confirm papers already created from it remain unchanged.
8. Confirm School A cannot use School B templates.

## 17. Validation

Create deliberate failures and confirm validation detects them:

- no programme
- no subject
- no section
- no question
- no duration
- no paper code
- compulsory empty section
- unapproved question reference
- missing answer options
- missing correct answer
- blueprint shortage
- attempt count greater than section question count

Create deliberate warnings and confirm they appear:

- missing solution
- missing topic
- missing estimated time
- estimated duration pressure

## 18. Review workflow

1. Submit a valid draft for review.
2. Confirm a review record is created.
3. Add a paper-level comment.
4. Add a section-level comment.
5. Add a question-level comment.
6. Attempt approval with unresolved comments and confirm it is blocked.
7. Resolve comments.
8. Request changes and confirm the paper returns to editable state.
9. Resubmit.
10. Approve the paper.
11. Test rejection with a reason.
12. Confirm every decision appears in audit history.

## 19. Publication boundary

1. Attempt publication before approval and confirm it is blocked for ordinary authorised admins.
2. Attempt publication with critical validation errors and confirm it is blocked.
3. Attempt publication with warnings but no acceptance reason and confirm it is blocked.
4. Enter a warning-acceptance reason and publish.
5. Confirm workflow status is Published.
6. Confirm an immutable `paper_versions` snapshot exists.
7. Confirm the published snapshot itself records Published status.
8. Confirm the editable published definition cannot be overwritten.
9. Confirm no product, price, bundle, entitlement, access code, attempt, result or analytics record is created.

## 20. Versions

1. Create a new version from a published paper.
2. Confirm the new record is Draft.
3. Confirm the previous version remains unchanged.
4. Confirm version number increments.
5. Confirm change summary is stored.
6. Confirm version history is visible in the lifecycle workspace.

## 21. Exports

Test all formats:

- Question paper HTML
- Answer key HTML
- Solutions HTML
- Excel-compatible question list
- Question list CSV
- Answers and solutions CSV
- Blueprint CSV
- Validation JSON
- Complete JSON backup
- Print current preview

Verify:

- questions and sections are in the correct order
- marks and negative marks are correct
- question and option images are present where supported
- correct answers and solutions are excluded from the student question-paper export
- answer and solution exports contain the expected data
- the JSON backup includes paper, subjects, sections, questions, blueprint, validation and versions

## 22. Audit history

Confirm audit records exist for:

- paper creation
- draft save
- duplication
- blueprint save
- generation
- replacement
- review submission
- review comment and resolution
- review decision
- publication
- version creation
- template save

Verify search, action filter and pagination.

## 23. Large-data checks

Use production-sized test data where possible:

- at least 10,000 approved questions
- multiple schools
- multiple programme and subject combinations
- papers with 180–300 questions
- repeated generation runs

Record page load time, Question Bank search time, availability refresh time, generation time and autosave time.

## 24. Failure and recovery checks

- disable the network during autosave and confirm the UI shows failure without losing the in-memory draft
- retry save after restoring the network
- delete or archive a source question in the test environment and confirm validation catches the issue
- remove a template source paper and confirm the template error is clear
- attempt duplicate codes and slugs and confirm the error is understandable
- confirm failed generation does not partially replace a valid paper

## 25. Acceptance report

Record each test as:

- Pass
- Fail
- Blocked
- Not applicable

For every failure capture:

- role
- paper ID
- browser route
- exact action
- expected result
- actual result
- browser console error
- Supabase error
- screenshot

The V8 Papers module is not final until all critical tests pass and the user explicitly approves deployment.
