# Evidara NEET PYQ Import Patch

This is a small overlay patch for the current Evidara V14/V15 working folder.

## Apply
1. Stop `TEST_EVIDARA.bat` if it is running.
2. Extract this ZIP directly into the current Evidara project root.
3. Choose **Replace files in the destination**.
4. Delete `.next` (`rmdir /S /Q .next`) and restart `TEST_EVIDARA.bat`.

The required Supabase staging importer migration has already been applied to project `xzfozpnzvznqrvcsoail`.

## Use
Super Admin → Questions → Evidara Question Bank → **Import NEET PYQ Archive**.
Choose `NEET_2016_2026_ALL_BATCHES.json` from the separate import-data ZIP. The browser streams the archive in 25-question chunks and is retry-safe.

Imported questions go to the **PYQ Review Queue**, not directly to Approved/Public. Super Admin can select complete rows and **Promote selected**; this creates normal Evidara questions with status **In Review**. Then use the regular Question Bank editor/review flow to map chapter/topic, correct visual/equation issues and approve.
