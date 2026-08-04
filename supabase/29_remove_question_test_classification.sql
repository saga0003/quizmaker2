-- Evidara V7: questions are reusable content assets.
-- Test-series classification belongs to paper/test creation, not question creation.

update public.questions
set metadata = (coalesce(metadata, '{}'::jsonb) - 'test_type') - 'custom_test_type'
where coalesce(metadata, '{}'::jsonb) ? 'test_type'
   or coalesce(metadata, '{}'::jsonb) ? 'custom_test_type';

create or replace function public.strip_question_test_classification()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.metadata := (coalesce(new.metadata, '{}'::jsonb) - 'test_type') - 'custom_test_type';
  return new;
end;
$$;

drop trigger if exists strip_question_test_classification_trigger on public.questions;
create trigger strip_question_test_classification_trigger
before insert or update of metadata on public.questions
for each row
execute function public.strip_question_test_classification();

comment on function public.strip_question_test_classification() is
  'Keeps questions reusable by removing paper/test-series classification from question metadata.';
