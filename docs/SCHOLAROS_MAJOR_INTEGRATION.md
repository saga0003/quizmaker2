# ScholarOS major integration

## Subscription model

A school receives annual platform access with a configurable seat limit and expiry. The plan controls test publishing, resource access and the active school roster.

## Academic-year rollover

1. Review the current student roster.
2. Revoke students who left the school.
3. Promote one eligible student or all eligible active students.
4. Renew the annual school subscription.

A revoked membership sets `promotion_locked = true`. Bulk promotion selects only active, unlocked memberships, so a revoked student cannot accidentally return.

## Eligibility rules

- Previous-year board papers require matching board and grade.
- Grade 10 and Grade 12 board papers are assigned only to those grades.
- NEET, JEE and KCET resources require Grade 11 or 12 and the matching preparation track.
- Olympiad and Foundation resources target Grades 8–10 and require the assigned track.
- Every subscription-gated resource also requires an active school subscription.

## Functional source integration

The supplied offline build contributed functional requirements and implementation patterns for question imports, paper construction, secure attempts, evaluation and commerce. ScholarOS uses a new information architecture and interface rather than copying the previous brand design.
