# Evidara V19.1 — LaTeX Paper Import Merge

## Merged sources

This build is based on `Evidara_V19_PYQ_REBUILD_UPDATED(1).zip` and includes the complete `Evidara_V19_0_1_TYPECHECK_FIX(1).zip` hotfix. No separate patch is required.

NatSciX V6.0.0 + V6.0.1 were reviewed as the reference implementation for structured text/LaTeX/image question import.

## What changed

- Added a NatSciX-style LaTeX paper package importer for `.tex`, `.latex`, `.ltx`, and `.zip` packages.
- ZIP packages may include the paper source plus local question/option/solution images; supported images are uploaded through Evidara's existing question-asset storage path.
- Enforces one complete paper/set per import package so imports are explicit and auditable.
- Captures paper identity: exam, year, variant/set, code, duration, grade, PYQ flag, source key, description, and instructions.
- Preserves original question number and section for every imported occurrence.
- Keeps text and dedicated LaTeX separately for stems, options, and solutions.
- Added mixed KaTeX rendering for `$...$`, `\(...\)`, `$$...$$`, and `\[...\]` embedded in prose.
- Corrected learner/paper/device previews so `stem_text` is no longer hidden when `stem_latex` also exists.
- Reuses the existing V18/V19 `pyq_source_papers` + `question_pyq_occurrences` + `question_papers` engine rather than creating duplicate paper tables.
- Existing exact-duplicate reuse and near-duplicate manual review remain part of paper import.
- The import commits the question set and creates the draft paper in the same workflow.
- Added downloadable Evidara LaTeX paper template and AI conversion prompt in the importer UI.
- Merged the V19.0.1 `live-question-bank.tsx` typecheck callback hotfix.

## Recommended import unit

Use exactly one year + one official paper/set per file/package, for example:

- `NEET_2016_Main.tex`
- `NEET_2017_Main.tex`
- `NEET_2026_Set_A.zip` (LaTeX + images)

The importer then creates a distinct source paper and its ordered question occurrences, allowing Evidara to reproduce that paper immediately and still reuse each question in future custom papers.

## Bundled templates

- `public/templates/Evidara_LaTeX_Paper_Template.tex`
- `public/templates/Evidara_AI_QuestionBank_to_LaTeX_Prompt.txt`
- source copies are also available under `/templates/`

## QA

The complete static regression suite passes after the merge, including:

- V18 PYQ/Paper Engine: 41/41
- V19 Source-Fidelity PYQ Engine: 25/25
- V19.1 LaTeX Paper Import: 19/19

A full dependency-backed Next.js typecheck/build could not be re-run in the isolated packaging environment because `node_modules` is not bundled and dependency installation was unavailable. The V19.0.1 typecheck patch itself is included, and all repository static smoke/regression checks pass.
