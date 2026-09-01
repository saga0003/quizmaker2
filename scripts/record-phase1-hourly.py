from pathlib import Path
import re

checklist = Path('PHASE1_RELEASE_CHECKLIST.md')
text = checklist.read_text()
replacements = {
    '- [ ] D3 Simplified five-step flow: Details → Questions → Audience → Settings → Preview & Publish.': '- [x] **D3 Simplified five-step flow: Details → Questions → Audience → Settings → Preview & Publish** — verified 1 Sep 2026. The paper builder exposes the required five-step guided flow and gates final publish/submit actions to Preview & Publish. Permanent 11-point D3 regression is release-gated; exact candidate `61d08fa5bc8181c5ebe00e21a2b12aa01507b624` passed complete release-gate run `33456793430` in approximately 2m29s. Permanent production was not promoted.',
    '- [ ] D4 Assignment preview shows exact student count and eligibility warnings before publish.': '- [x] **D4 Assignment preview shows exact student count and eligibility warnings before publish** — verified 1 Sep 2026. Live `preview_paper_assignment_v19` returns exact eligible active-student count with a bounded sample and explicit lifecycle, licence, selected-student and frozen-cohort warnings; anonymous execution is denied and authenticated access remains permission-scoped. UI blocks materialization on blocking warnings. Permanent D4 regressions are release-gated; exact candidate `61d08fa5bc8181c5ebe00e21a2b12aa01507b624` passed complete run `33456793430`. Permanent production was not promoted.',
    '- [ ] D5 Clone-as-new-version for papers that already have attempts.': '- [x] **D5 Clone-as-new-version for papers that already have attempts** — verified 1 Sep 2026. Live `clone_paper_as_new_version_v1` is an authorized server-side transaction for attempt-bearing papers: it serializes lineage/version numbering, creates a fresh draft with new section IDs, preserves frozen question snapshots, clears publication/access/assignment/demo state, does not copy assignments, writes audit provenance and denies anonymous execution. Permanent 13-point D5 regression is release-gated; after correcting a formatting-fragile assertion, exact candidate `61d08fa5bc8181c5ebe00e21a2b12aa01507b624` passed complete run `33456793430`. Permanent production was not promoted.'
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit(f'missing checklist item: {old}')
checklist.write_text(text)

checked = len(re.findall(r'^- \[x\]', text, flags=re.M))
pending = len(re.findall(r'^- \[ \]', text, flags=re.M))
overall = 100 * checked / max(1, checked + pending)
entry = f'''\n\n## 1 Sep 2026 — 06:59:54–07:11 IST — Section D hourly heartbeat
- **Active engineering span:** approximately 11 minutes of continuous implementation/review in this execution window; the 45–50 minute target was not reached because the automation execution window ended earlier. No artificial padding.
- **Section worked:** D — Paper/test builder and assignment workflow.
- **Checklist completed this run:** D3, D4 and D5 were formally recorded as verified from exact candidate `61d08fa5bc8181c5ebe00e21a2b12aa01507b624`, complete release-gate run `33456793430` (~2m29s).
- **Current item:** D6 pre-publish checklist. Implemented live/repository server-authoritative readiness evaluation for approved questions, duration, marks, audience, schedule and result policy; added a deferred database publish guard plus a permanent 14-point D6 regression.
- **Still pending:** D6 visible Preview & Publish checklist integration and final clean full-gate/preview verification; D7 real first-class Test Results / Analytics / Export actions. Existing normalized-access D7 smoke is supporting access hardening, not D7 checklist completion.
- **Branch head entering heartbeat:** `ba01a8efcae6dcede7f82f5e72094d3233f0b523`.
- **Commits created:** `a2c89841ab1cac8e4c3be0b84de523f1535271d7` D6 DB guard; `514a1bf8d73d1bfc7bd88a5f6d6427a840899748` D6 regression; `4972d51fec6cfa01a9703bcccde63ec06fe0898c` release-gate wiring; `ba01a8efcae6dcede7f82f5e72094d3233f0b523` D4 regression-label correction, plus recorder/rework commits.
- **CI:** starting verified baseline run `33456793430` PASS. Intermediate run `33459492746` failed because the renamed D4 audience smoke still asserted its old workflow label; corrected in `ba01a8ef...`. Run `33459605523` for that correction was in progress at heartbeat preparation; subsequent documentation/recorder commits queued newer gates.
- **Rework/failures/blockers:** one recorder attempt could not push a workflow-file mutation because the Actions token lacked workflow permission; two initial hourly-recorder definitions were rejected before jobs started and were replaced by a minimal recorder. A separate connector attempt to add the visible D6 checklist component was blocked before repository mutation; D6 remains unchecked rather than over-credited.
- **Supabase:** `phase1_paper_publish_readiness` applied live. Internal readiness/trigger helpers are not browser executable; only the authorized readiness endpoint is authenticated. All 3 existing question papers are platform drafts and none are published, so the guard did not invalidate an existing production paper.
- **Vercel:** permanent production healthy with no error/fatal runtime logs observed in the preceding 24 hours; no production promotion performed.
- **Section D progress:** 5/7 verified = 71.4%.
- **Overall checklist progress:** {checked}/{checked+pending} verified = {overall:.1f}%.
- **Why this run stopped:** execution window ended before the requested 45–50 productive-minute target; D6 is deliberately left unchecked until visible checklist integration and a clean complete release gate pass.
- **Exact next action:** integrate `get_paper_publish_readiness_v1` into Preview & Publish as the visible six-dimension preflight, refresh after Save Draft, then run the permanent D6 regression + complete release gate + matching Vercel preview. If green, check D6 and immediately implement D7’s actual Test Results / Analytics / Export row actions.
'''
progress = Path('PHASE1_PROGRESS_LOG.md')
if '06:59:54–07:11 IST — Section D hourly heartbeat' not in progress.read_text():
    progress.write_text(progress.read_text() + entry)
