# Evidara Phase 1 Release

Release version: `19.1.0-phase1`
Git tag: `phase1-v19.1.0`
Production commit: `cfcbade06e86d08b1019e6922b75ab479b4b630c`
Production deployment: `dpl_Ecs2jJRVCJNqmeMTK6WpFn9FzxSV`
Release date: 6 Sep 2026

## Sign-off summary

- R1-R18 acceptance verified.
- L1-L6 load acceptance verified against the isolated `evidara-school-acceptance` tenant.
- Production build and full Phase 1 release gate passed before cutover.
- Production web release deployed READY from `main`.
- Coordinated credential hardening activated only after the MFA/password-gated web release was READY.
- J3 legal review remains an external gate and is not self-certified by engineering.

## Security cutover

The Phase 1 release activates privileged AAL2 enforcement, student first-login password replacement state, and the production credential-security gate. No St. Mary's or future-client data was used for acceptance testing.
