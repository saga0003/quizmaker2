from pathlib import Path
import subprocess

marker = '## 2026-09-03 17:46:44–18:01:41 IST — R13 rendered analytics acceptance hardening'
p = Path('PHASE1_PROGRESS_LOG.md')
s = p.read_text()
if marker not in s:
    block = '''

## 2026-09-03 17:46:44–18:01:41 IST — R13 rendered analytics acceptance hardening

- **Checklist item:** R13 — Verify student subject/chapter/topic/question analytics. R13 remains intentionally unchecked.
- **Run start/end:** 2026-09-03 17:46:44 IST → 2026-09-03 18:01:41 IST.
- **Active engineering/review span:** approximately **15 minutes** in the observable execution window; no time was padded.
- **Branch work:** R13 hardening commits include `08da28f89c23d42a3b15e5637feecc2f6b746462`, `3f26e6fe2a0e4cc1bab3c4e16aa79214c4870bba`, `79cc9df631f1453a5d69c1e7701bc61a9f1337b0`, `4d5cb03cff8b5bcd3d1d2bd36f3d08c9454fa906`, and guarded rendered trigger `521ee66f90563f41108b3b508dcd80b8cf72bb97`.
- **Complete gate:** Phase 1 release gate `33754900944` on exact candidate `4d5cb03cff8b5bcd3d1d2bd36f3d08c9454fa906` — **PASS**, including hardening checks, TypeScript, lint, regressions, production build and final enforcement. Matching Vercel preview is READY.
- **Production / Supabase health:** Vercel production 24-hour runtime-error aggregation returned no errors; permanent production was not changed or promoted. Supabase `SMIS QP` remained `ACTIVE_HEALTHY`; fresh database size was `219344019` bytes. All acceptance reads/mutations were guarded to `Evidara School` / `evidara-school-acceptance`; no St. Mary's/future-client data and no separate/paid project were used.
- **Authoritative R13 evidence:** Supabase independently re-confirmed attempt `134ddbe2-bc9f-4863-9aba-3b9def08d69e` at `8/80`, `10%`, `2 correct`, `0 incorrect`, `18 unanswered`; all 20 paper rows retain frozen `Physics → Kinematics → Motion in One Dimension` taxonomy, with Q1/Q2 correct `A` responses worth `+4` each.
- **Acceptance rework:** GitHub Actions has neither server-key secret, so privileged mode control was separated from browser proof instead of weakening authorization. Only exact synthetic paper `e5801a88-1e7f-4b4f-a715-ad44ce2b3c43` was guarded-switched to `in_depth_analytics`. Rendered run `33755339031` passed tenant/database/production preflight but failed at protected-preview bootstrap because stored Actions `EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL` no longer grants the latest branch alias deployment. The exact synthetic paper was immediately restored to `score_only` after failure.
- **Safety / verification status:** no R13 credit was awarded. Acceptance remains **12/19 verified** and overall checklist remains **108/129 (83.7%)**. Production remains protected.
- **Blocker:** refresh GitHub Actions secret `EVIDARA_ACCEPTANCE_VERCEL_SHARE_URL` with the newly issued protected-preview share URL for the current branch alias; connected GitHub tooling cannot mutate repository secrets and the credential was not committed.
- **Exact next action:** after secret refresh, guarded-switch only the exact synthetic paper to `in_depth_analytics`, rerun R13 rendered acceptance, restore/verify `score_only` regardless of result, confirm the complete descendant Phase 1 release gate, then and only then check R13 and proceed to R14 Teacher/School Admin drilldowns.
'''
    p.write_text(s + block)
subprocess.run(['git', 'add', 'PHASE1_PROGRESS_LOG.md'], check=True)
print('Phase 1 R13 heartbeat staged.')
