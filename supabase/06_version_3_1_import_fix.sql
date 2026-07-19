-- ScholarOS Version 3.1 - bulk import hotfix
-- Safe to run after 05_version_3_question_bank.sql.
-- Fixes the Supabase pgcrypto schema lookup used while generating duplicate hashes.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.question_duplicate_hash(p_stem text, p_options jsonb)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(
    lower(regexp_replace(coalesce(p_stem,''), '\s+', '', 'g')) || '|' ||
    lower(regexp_replace(coalesce(p_options::text,''), '\s+', '', 'g')),
    'sha256'
  ), 'hex');
$$;

-- Verification: this query must return a 64-character hexadecimal hash.
select public.question_duplicate_hash(
  'ScholarOS import verification question',
  '[{"option_key":"A","content_text":"One"},{"option_key":"B","content_text":"Two"}]'::jsonb
) as verification_hash;
