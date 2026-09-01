from pathlib import Path


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

path = Path('src/components/evidara/paper-assignment-center.tsx')
text = path.read_text()
text = replace_once(
    text,
    "import { CheckCircle2, LoaderCircle, Search, ShieldCheck, Users } from 'lucide-react';",
    "import { AlertTriangle, CheckCircle2, LoaderCircle, Search, ShieldCheck, Users } from 'lucide-react';",
    'warning icon import',
)
text = replace_once(
    text,
    "  sample: StudentOption[];\n  materialized?: boolean;",
    "  sample: StudentOption[];\n  warnings?: Array<{ code: string; severity: 'warning' | 'blocking'; count?: number; message: string }>;\n  materialized?: boolean;",
    'warning type',
)
text = replace_once(
    text,
    "disabled={busy !== '' || !preview?.assigned_count} onClick={() => void assign()}",
    "disabled={busy !== '' || !preview?.assigned_count || preview?.warnings?.some((warning) => warning.severity === 'blocking')} onClick={() => void assign()}",
    'blocking assignment guard',
)
needle = "          <div className=\"rounded-xl border border-[var(--line)] p-4\"><div className=\"flex items-center gap-2\"><ShieldCheck className=\"h-4 w-4 text-[var(--teal)]\" /><strong className=\"text-sm\">Institution licence</strong></div><p className=\"mt-2 text-sm capitalize\">State: <strong>{preview.licence?.state || 'unknown'}</strong></p><p className=\"mt-1 text-sm\">Licensed: <strong>{Number(preview.licence?.licensed_students || 0).toLocaleString('en-IN')}</strong> · Active: <strong>{Number(preview.licence?.active_students || 0).toLocaleString('en-IN')}</strong></p></div>\n          {preview.sample?.length ?"
replacement = "          <div className=\"rounded-xl border border-[var(--line)] p-4\"><div className=\"flex items-center gap-2\"><ShieldCheck className=\"h-4 w-4 text-[var(--teal)]\" /><strong className=\"text-sm\">Institution licence</strong></div><p className=\"mt-2 text-sm capitalize\">State: <strong>{preview.licence?.state || 'unknown'}</strong></p><p className=\"mt-1 text-sm\">Licensed: <strong>{Number(preview.licence?.licensed_students || 0).toLocaleString('en-IN')}</strong> · Active: <strong>{Number(preview.licence?.active_students || 0).toLocaleString('en-IN')}</strong></p></div>\n          {preview.warnings?.length ? <div className=\"md:col-span-2 rounded-xl border border-amber-300 bg-amber-50 p-4\"><div className=\"flex items-center gap-2\"><AlertTriangle className=\"h-4 w-4 text-amber-700\" /><strong className=\"text-sm text-amber-950\">Eligibility warnings</strong></div><div className=\"mt-2 space-y-1\">{preview.warnings.map((warning) => <p key={warning.code} className=\"text-sm text-amber-900\"><strong>{warning.severity === 'blocking' ? 'Action required: ' : ''}</strong>{warning.message}</p>)}</div></div> : null}\n          {preview.sample?.length ?"
text = replace_once(text, needle, replacement, 'warning render')
path.write_text(text)

workflow_path = Path('.github/workflows/phase1-release-gate.yml')
workflow = workflow_path.read_text()
workflow = replace_once(
    workflow,
    "      - name: D3 guided paper-builder checks\n        run: node scripts/d3-paper-builder-wizard-smoke.mjs\n",
    "      - name: D3 guided paper-builder checks\n        run: node scripts/d3-paper-builder-wizard-smoke.mjs\n      - name: D4 assignment-preview checks\n        run: node scripts/d4-assignment-preview-smoke.mjs\n",
    'D4 permanent release-gate step',
)
workflow_path.write_text(workflow)

checklist_path = Path('PHASE1_RELEASE_CHECKLIST.md')
checklist = checklist_path.read_text()
checklist = replace_once(
    checklist,
    '- [ ] D3 Simplified five-step flow: Details → Questions → Audience → Settings → Preview & Publish.',
    '- [x] **D3 Simplified five-step paper flow** — verified 1 Sep 2026. School paper creation/editing now follows Details → Questions → Audience → Settings → Preview & Publish. The Audience step embeds the already-hardened exact-preview/materialized-cohort assignment engine against the saved draft; platform papers correctly skip institution audience selection. Settings is step 4 and learner preview plus the final publish/submit action share step 5. The permanent D3 regression passed together with TypeScript, lint, every existing regression and production build on exact cleaned candidate `2fda81ba36cb4f8d036e296aaa4bddfd43f2a52b` in release-gate run `33455616605` (1m56s). Permanent production was not promoted.',
    'D3 verified checklist update',
)
checklist_path.write_text(checklist)
