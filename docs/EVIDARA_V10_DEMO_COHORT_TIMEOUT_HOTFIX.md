# Evidara V10 — Demo Cohort Statement Timeout Hotfix

## Problem

The one-click cohort generator creates 100 students, six products, sixty papers, mapped questions, detailed attempts, comparison results and chapter/topic evidence. Supabase REST requests executed as the authenticated role normally have a short statement timeout, so the generation RPC can be cancelled before it finishes.

## Migration

Apply after `supabase/40a_v10_demo_cohort_studio_hardening.sql`:

```text
supabase/40b_v10_demo_cohort_statement_timeout_hotfix.sql
```

The migration:

- gives only `generate_analytics_demo_data_v10(text,integer)` and its internal generator functions a 60-second statement timeout;
- leaves ordinary authenticated application requests unchanged;
- adds metadata indexes used while creating and resetting the isolated demo batch;
- adds a short lock timeout so a conflicting operation fails clearly instead of hanging.

## Retry sequence

1. Apply migration 40b in the Supabase SQL Editor.
2. Refresh Evidara.
3. Open **Analytics → Demo Cohorts**.
4. Confirm the demo account exists.
5. Select **Create cohort + questions** once.
6. Keep the page open for up to 60 seconds.

A statement timeout aborts the database statement. If the screen still shows no active ready batch, retry after applying 40b. If a failed generated batch is visible, use the protected two-confirmation reset before retrying.

## Scope

No global database timeout or authenticated-role timeout is changed. The exception applies only to the Super Admin cohort generator.
