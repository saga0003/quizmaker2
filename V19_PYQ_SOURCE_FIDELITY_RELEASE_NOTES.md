# Evidara V19 — Source-Fidelity PYQ Rebuild

V19 consolidates the V14–V18 application changes and replaces the earlier NEET/AIPMT PYQ text-only import path with a source-fidelity asset-aware workflow.

## NEET/AIPMT 2016–2026

- The previous 2,620 imported PYQs were removed from the live Question Bank before this build.
- V19 imports the rebuilt 2,620-question archive directly into the normal Question Bank as `in_review`.
- Every archive row has a separate learner-facing physically cropped 144-DPI prompt image and answer/solution image.
- Prompt and solution assets are physically separated before upload; retrying the import reuses deterministic R2 paths and question IDs.
- Exact PYQ identity is preserved: exam, year, variant/phase/Re-NEET, paper code and original question number.
- Questions remain unapproved and unpublished until normal Question Bank review.

## Rendering and typography

- Source-fidelity PYQs render the physically cropped source image rather than showing extracted prose plus a second KaTeX copy.
- Native text remains stored for search, editing, taxonomy, analytics and SEO text fallback.
- Native KaTeX is reserved for genuine mathematical content and is sized to sit naturally with Evidara text; KaTeX text fragments inherit the surrounding UI font.
- Prompt and solution visuals are separate, so a learner-facing question never leaks the answer/solution crop.

## Publication protection

A V19 source-fidelity question cannot become SEO-published unless it is approved, has an answer and textual solution, and has complete uploaded prompt + solution asset URLs.

## Review workflow

The V18.4 review improvements are included: Edit from the review modal plus Previous/Next navigation across the currently filtered and sorted Question Bank set.

## Import

Use **Super Admin → Questions → Import NEET PYQ Archive → Choose V19 Folder** and select the extracted `NEET_2016_2026_EVIDARA_PYQ_V19_READY` root folder.
