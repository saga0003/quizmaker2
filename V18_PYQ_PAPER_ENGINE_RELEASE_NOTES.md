# Evidara V18 — PYQ Paper Engine

V18 is built on `Evidara_FINAL_V16_UI_VERIFIED_2026-08-14(1).zip` and includes the V17 NEET taxonomy enrichment.

## What changed

- First-class official PYQ paper identities: exam, year, variant, code and expected question count.
- A single Question Bank question can belong to multiple official previous-year papers without duplication.
- Question Editor can add multiple PYQ occurrences such as NEET 2018, Re-NEET 2024 and NEET 2026.
- Papers can build an exact official PYQ paper only after every required question position is linked and approved.
- Manual paper builder can mark a platform paper as a PYQ and records the selected questions as that paper's official occurrences.
- JSON / LaTeX paper import creates a draft paper and new questions together.
- Exact duplicates are reused automatically. Near duplicates require an explicit side-by-side choice before commit.
- New questions from paper file import enter Question Bank as `in_review`.
- Product paper picker exposes PYQ year / variant / paper code filters so PYQ packs can be assembled without duplicating products or questions.
- V17 taxonomy and the V18 source-paper metadata are included in the NEET 2016–2026 import workflow.

## NEET archive

Use `NEET_2016_2026_ALL_BATCHES_PYQ_V18_READY.json`, not the older V16/V17 master files.

The archive contains 14 source papers and 2,620 questions. Import from Super Admin → Questions → Evidara Question Bank → Import NEET PYQ Archive.

After promotion and approval, go to Papers → Build PYQ Paper. Evidara will enable Build only when the selected source paper is complete and approved.

## Safety

Official-paper generation uses the question ↔ paper occurrence table as the source of truth. Reusing the same question in a later year adds another occurrence; it does not create a duplicate Question Bank row.
