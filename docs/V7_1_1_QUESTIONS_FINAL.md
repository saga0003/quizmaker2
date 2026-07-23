# Evidara V7.1.1 — Final Questions Module

## Preserved checkpoints

- V7.0: `evidara-v7-0-snapshot`
- V7.1: `evidara-v7-1-snapshot`
- Active final Questions build: `evidara-v7-super-ui`

## Required Supabase migrations

Run these complete files in order in Supabase SQL Editor:

1. `supabase/30_v7_1_question_import_stabilization.sql`
2. `supabase/31_v7_1_1_question_module_finalization.sql`

Migration 31 adds the audited permanent-deletion function. It does not automatically delete any question.

### Verify migration 31

```sql
select to_regprocedure(
  'public.bulk_delete_questions_v71(uuid[])'
) is not null as bulk_question_delete_ready;

select to_regclass(
  'public.question_deletion_audit'
) is not null as question_delete_audit_ready;
```

Both results must be `true`.

## Bulk question deletion

Permanent deletion is available only to:

- Super Admin
- Evidara Admin

The database function enforces the same restriction even when a browser request is manually modified.

The Questions table provides:

- individual row selection
- select the current page
- select all questions matching the active filters
- clear selection
- delete selected
- individual permanent-delete action
- branded confirmation dialog

A deletion audit snapshot is written before a question is deleted.

Questions already referenced by a paper, test or result are protected from permanent deletion. The user receives an instruction to archive those questions instead.

School Admins and School Teachers do not receive permanent-delete controls and cannot call the database function.

## Bulk import review

After a source file is analysed, Evidara opens a branded summary dialog showing:

- detected questions
- ready questions
- questions needing correction
- local image references

The reviewer can start from question 1 or jump directly to the first issue.

During review, the toolbar provides:

- First issue
- Previous issue
- Next issue
- direct issue-question selector
- Undo
- Redo

Keyboard history controls:

- `Ctrl+Z` or `Cmd+Z`: Undo
- `Ctrl+Shift+Z` or `Cmd+Shift+Z`: Redo
- `Ctrl+Y`: Redo

This is the same component for Evidara master imports and school-owned imports. The organization scope and publication permissions remain role-specific.

Cancelling an unfinished import uses an Evidara-branded discard dialog. It no longer uses the browser or Chrome confirmation window.

## Protected live-test content

For every test taker except Super Admin inspection mode, the live assessment blocks ordinary browser actions for:

- context menu/right-click
- copying question and option text
- cutting text
- dragging images
- text selection outside answer inputs
- Save Page
- Print
- View Source
- common developer-tool shortcuts
- direct image interaction

Blocked attempts are recorded through the existing exam-event function.

Question and option images are non-draggable, non-clickable and covered by the protected assessment layer.

### Security boundary

These controls prevent ordinary copying, right-click saving and casual link access inside the Evidara test interface. A web application cannot guarantee prevention of operating-system screenshots, external cameras, browser extensions or determined network inspection. Stronger future controls may include private image delivery, short-lived signed URLs, per-user watermarking and native locked-down exam clients.

## Manual QA matrix

### Super Admin

- sees selection and permanent-delete controls
- can delete unused master or school questions
- receives audit records
- receives protected-question guidance when a question is linked
- receives Super Admin inspection mode in a live exam

### Evidara Admin

- sees selection and permanent-delete controls
- can delete unused master or school questions
- cannot bypass linked-question protection
- receives protected-content mode during a live exam

### School Admin

- does not see permanent-delete controls
- cannot call the deletion RPC
- receives the complete import-summary, issue-navigation, undo/redo and discard workflow
- receives protected-content mode during a live exam

### School Teacher

- does not see permanent-delete controls
- cannot call the deletion RPC
- retains Draft/In Review publication restrictions
- receives the same import-review workflow for school-owned questions
- receives protected-content mode during a live exam

### Student

- does not receive the Questions management workspace
- receives protected-content mode during a live exam

## Codespaces update

```bash
git switch evidara-v7-super-ui
git pull --ff-only origin evidara-v7-super-ui
npm run dev:codespaces
```

Hard refresh the browser after the development server is ready.

## Release boundary

V7.1.1 remains on draft PR #18 until migrations 30 and 31 and the role matrix are manually validated. No merge or production deployment is performed by this build.
