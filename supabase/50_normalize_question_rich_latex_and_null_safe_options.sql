-- Keep option text null-safe for the editor while preserving mathematical content
-- exclusively in content_latex.
update public.question_options
set content_text = ''
where content_text is null;

alter table public.question_options
  alter column content_text set default '',
  alter column content_text set not null;

create or replace function public.normalize_question_option_latex_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_normalized text;
begin
  new.content_text := coalesce(new.content_text, '');

  if nullif(trim(coalesce(new.content_latex, '')), '') is not null
     and position('$' in new.content_latex) > 0 then
    v_normalized := public.normalize_inline_math_for_latex(new.content_latex);
    if v_normalized is not null then
      new.content_latex := v_normalized;
    end if;
  elsif nullif(trim(coalesce(new.content_latex, '')), '') is null
        and position('$' in new.content_text) > 0 then
    v_normalized := public.normalize_inline_math_for_latex(new.content_text);
    if v_normalized is not null then
      new.content_latex := v_normalized;
      new.content_text := '';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.question_content_has_math_markup(p_content text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select case
    when p_content is null or trim(p_content) = '' then false
    when (length(p_content) - length(replace(p_content, '$', ''))) >= 2 then true
    when p_content ~ E'\\\\(frac|sqrt|pi|ell|lambda|alpha|beta|gamma|mathrm|overset|cos|sin|tan|left|right|longrightarrow|rightarrow|_)' then true
    else false
  end
$$;

create or replace function public.normalize_imported_question_rich_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.source_key = 'HOSTSERVER001_JEE_MAINS_PYQS_LATEX'
     and coalesce(new.tags, '{}'::text[]) @> array['Re-Check']::text[] then
    if nullif(trim(coalesce(new.stem_latex, '')), '') is null
       and public.question_content_has_math_markup(new.stem_text) then
      new.stem_latex := new.stem_text;
    end if;

    if nullif(trim(coalesce(new.solution_latex, '')), '') is null
       and public.question_content_has_math_markup(new.solution_text) then
      new.solution_latex := new.solution_text;
      new.solution_text := null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_normalize_imported_question_rich_fields on public.questions;
create trigger trg_normalize_imported_question_rich_fields
before insert or update of stem_text, stem_latex, solution_text, solution_latex, source_key, tags
on public.questions
for each row
execute function public.normalize_imported_question_rich_fields();

update public.questions
set stem_latex = stem_text
where source_key = 'HOSTSERVER001_JEE_MAINS_PYQS_LATEX'
  and tags @> array['Re-Check']::text[]
  and nullif(trim(coalesce(stem_latex, '')), '') is null
  and public.question_content_has_math_markup(stem_text);

update public.questions
set
  solution_latex = solution_text,
  solution_text = null
where source_key = 'HOSTSERVER001_JEE_MAINS_PYQS_LATEX'
  and tags @> array['Re-Check']::text[]
  and nullif(trim(coalesce(solution_latex, '')), '') is null
  and public.question_content_has_math_markup(solution_text);
