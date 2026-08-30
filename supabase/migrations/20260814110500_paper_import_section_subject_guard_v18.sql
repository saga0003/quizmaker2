create or replace function public.sync_imported_paper_section_subject_v18()
returns trigger
language plpgsql
set search_path=public
as $$
declare
  v_subject uuid;
  v_distinct integer;
begin
  select count(distinct q.subject_id), min(q.subject_id::text)::uuid
  into v_distinct,v_subject
  from public.paper_questions pq join public.questions q on q.id=pq.question_id
  where pq.section_id=new.section_id and q.subject_id is not null;
  update public.paper_sections set subject_id=case when v_distinct=1 then v_subject else null end where id=new.section_id;
  return new;
end $$;
drop trigger if exists trg_sync_imported_paper_section_subject_v18 on public.paper_questions;
create trigger trg_sync_imported_paper_section_subject_v18 after insert or update of question_id,section_id on public.paper_questions
for each row execute function public.sync_imported_paper_section_subject_v18();
