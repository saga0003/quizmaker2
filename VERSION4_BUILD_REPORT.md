# ScholarOS Version 4 Build Report

## Implemented

- Fixed `application/octet-stream` failures for images extracted from ZIP files.
- Detects image MIME type from file signatures and file extensions.
- Supports JPG, JPEG, JFIF, PNG, WEBP, GIF, SVG, BMP, AVIF, ICO, TIFF and HEIC/HEIF uploads up to 10 MB.
- Expanded the Supabase `question-assets` bucket MIME allow-list.
- Added image-format test CSV and matching ZIP.
- Added administrator and school question-paper lists.
- Added section-based paper builder with approved-question search and filtering.
- Added marks, negative marks, duration, attempts, schedule, access mode and access-code controls.
- Added paper preview with correct answers and solutions for authorised paper managers.
- Added publish/archive controls.
- Added student available-tests page and private code lookup.
- Added secure server-created attempts.
- Added autosaved responses, timer, question palette, mark-for-review and automatic submission.
- Added tab-hidden, window-blur and fullscreen-exit event logging.
- Added automatic evaluation and stored student results.
- Added direct-answer security hardening so students cannot query question-bank answers from Supabase.
- Prevents changing a paper's questions after student attempts exist.

## Validation performed

- TypeScript: passed with `npx tsc --noEmit`.
- Next.js production static export: passed; 36 routes generated.
- PostgreSQL syntax: parsed successfully with `pglast`.
- New static routes confirmed under `out/admin/papers`, `out/school/papers`, `out/student/tests` and `out/student/results`.
- npm registry references checked; no internal OpenAI registry URL is present.

## Deliberate limitations

- HEIC/HEIF and TIFF can be stored and imported, but browser preview depends on the student's browser and operating system. JPG/JPEG, PNG, WEBP, GIF, SVG, BMP and AVIF are the recommended delivery formats.
- Section-level “questions to attempt” is displayed but strict choice-section evaluation will be extended later.
- Detailed chapter analytics and test-to-test improvement graphs remain Version 5 work.
