# Phase 1 Role Acceptance Checklist

Use this before moving the pilot URL to paying institutions.

## Super Admin
- Login succeeds and platform administration is available.
- Parked advanced modules remain available only where intended for Super Admin.
- Institution records and subscription activation remain manageable.

## School Admin
- Dashboard contains no fake/demo institution evidence when cloud data is unavailable.
- School Questions → Academic Setup can add/bulk add/edit/archive the institution's taxonomy.
- Question import can validate, classify, import questions and create a draft paper.
- Imported questions cannot leak into another institution.
- Student roster supports add/edit/filter/select/promote/password/lifecycle operations.
- Subscription page shows real plan state, unlimited policy and Study Resources access.

## Teacher
- Teacher can see only the institution/question-paper capabilities granted by existing role/assignment rules.
- Student roster is assigned-section scoped and read-only.
- School Admin identity/password/destructive student controls are not available.

## Student
- Student sees only their own institution/test/result context.
- Test submission remains authoritative and autosaved by the existing exam engine.
- Analytics are generated from real submitted evidence.
- Study Resources continue to respect membership/subscription eligibility.

## Cross-tenant checks
- School A cannot read School B's student roster.
- School A cannot update School B's student membership.
- School A cannot manage School B's Subject/Chapter/Topic IDs.
- School A question imports are organization-scoped.
- Direct URLs do not restore Phase 1 parked public/school modules.
