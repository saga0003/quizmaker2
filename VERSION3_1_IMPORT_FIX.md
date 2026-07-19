# Version 3.1 Import Fix

The question importer must work in both localhost and the Hostinger deployment because both use the same Supabase project.

This hotfix:

- Qualifies the `pgcrypto` hash function as `extensions.digest` for Supabase.
- Corrects whitespace normalization in duplicate hashing.
- Displays row-level database errors after an import.
- Adds `supabase/06_version_3_1_import_fix.sql`, which is safe to run after Version 3.

## Apply to an existing Version 3 setup

1. Run `supabase/06_version_3_1_import_fix.sql` in the Supabase SQL Editor.
2. Refresh the importer and retry the same file.
3. For the improved error display, use this fixed source build and rebuild the web app before the Hostinger upload.

The importer now also:

- Requires the matching image ZIP when spreadsheet rows contain local image filenames.
- Sends the correct MIME type for PNG, JPEG, WebP and SVG uploads to Supabase Storage.
