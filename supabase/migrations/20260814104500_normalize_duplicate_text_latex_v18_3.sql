create or replace function public.normalize_question_render_fields_v18_3()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if nullif(btrim(new.stem_latex),'') is not null
     and lower(regexp_replace(coalesce(new.stem_text,''),'\s+','','g')) = lower(regexp_replace(coalesce(new.stem_latex,''),'\s+','','g')) then
    new.stem_latex := null;
  end if;
  if nullif(btrim(new.solution_latex),'') is not null
     and nullif(btrim(new.solution_text),'') is not null
     and lower(regexp_replace(coalesce(new.solution_text,''),'\s+','','g')) = lower(regexp_replace(coalesce(new.solution_latex,''),'\s+','','g')) then
    new.solution_latex := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_normalize_question_render_fields_v18_3 on public.questions;
create trigger trg_normalize_question_render_fields_v18_3
before insert or update of stem_text,stem_latex,solution_text,solution_latex on public.questions
for each row execute function public.normalize_question_render_fields_v18_3();

create or replace function public.normalize_question_option_render_fields_v18_3()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if nullif(btrim(new.content_latex),'') is not null
     and lower(regexp_replace(coalesce(new.content_text,''),'\s+','','g')) = lower(regexp_replace(coalesce(new.content_latex,''),'\s+','','g')) then
    new.content_latex := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_normalize_question_option_render_fields_v18_3 on public.question_options;
create trigger trg_normalize_question_option_render_fields_v18_3
before insert or update of content_text,content_latex on public.question_options
for each row execute function public.normalize_question_option_render_fields_v18_3();

update public.questions
set stem_latex = null,
    solution_latex = case
      when nullif(btrim(solution_latex),'') is not null
       and nullif(btrim(solution_text),'') is not null
       and lower(regexp_replace(coalesce(solution_text,''),'\s+','','g')) = lower(regexp_replace(coalesce(solution_latex,''),'\s+','','g'))
      then null else solution_latex end,
    updated_at = now()
where source_key like 'NEET_PYQ_%'
  and nullif(btrim(stem_latex),'') is not null
  and lower(regexp_replace(coalesce(stem_text,''),'\s+','','g')) = lower(regexp_replace(coalesce(stem_latex,''),'\s+','','g'));

update public.question_options qo
set content_latex = null
where exists (
  select 1 from public.questions q
  where q.id=qo.question_id and q.source_key like 'NEET_PYQ_%'
)
and nullif(btrim(qo.content_latex),'') is not null
and lower(regexp_replace(coalesce(qo.content_text,''),'\s+','','g')) = lower(regexp_replace(coalesce(qo.content_latex,''),'\s+','','g'));
