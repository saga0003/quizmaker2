-- Keep mathematical option content in content_latex instead of displaying $...$ literally
-- from content_text. This also protects future imports and editor saves.

create or replace function public.normalize_inline_math_for_latex(p_content text)
returns text
language plpgsql
immutable
strict
set search_path = public
as $$
declare
  v_parts text[];
  v_result text := '';
  v_segment text;
  v_clean text;
  v_index integer;
  v_count integer;
  v_dollar_count integer;
begin
  v_dollar_count := length(p_content) - length(replace(p_content, '$', ''));
  if v_dollar_count = 0 or mod(v_dollar_count, 2) <> 0 then
    return p_content;
  end if;

  v_parts := string_to_array(p_content, '$');
  v_count := coalesce(array_length(v_parts, 1), 0);

  for v_index in 1..v_count loop
    v_segment := coalesce(v_parts[v_index], '');
    if mod(v_index, 2) = 0 then
      v_result := v_result || trim(v_segment);
    elsif trim(v_segment) <> '' then
      v_clean := trim(v_segment);
      v_clean := replace(v_clean, '\', '\textbackslash{}');
      v_clean := replace(v_clean, '{', '\{');
      v_clean := replace(v_clean, '}', '\}');
      v_clean := replace(v_clean, '%', '\%');
      v_clean := replace(v_clean, '#', '\#');
      v_clean := replace(v_clean, '&', '\&');
      v_clean := replace(v_clean, '_', '\_');
      if v_result <> '' then
        v_result := v_result || '\;';
      end if;
      v_result := v_result || '\text{' || v_clean || '}';
      if v_index < v_count then
        v_result := v_result || '\;';
      end if;
    end if;
  end loop;

  return nullif(trim(v_result), '');
end;
$$;

create or replace function public.normalize_question_option_latex_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if nullif(trim(coalesce(new.content_latex, '')), '') is not null
     and position('$' in new.content_latex) > 0 then
    new.content_latex := public.normalize_inline_math_for_latex(new.content_latex);
  elsif nullif(trim(coalesce(new.content_latex, '')), '') is null
        and position('$' in coalesce(new.content_text, '')) > 0 then
    new.content_latex := public.normalize_inline_math_for_latex(new.content_text);
    new.content_text := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_normalize_question_option_latex_fields on public.question_options;
create trigger trg_normalize_question_option_latex_fields
before insert or update of content_text, content_latex
on public.question_options
for each row
execute function public.normalize_question_option_latex_fields();

-- Correct the restricted JEE Main Re-Check pilot already imported into the master bank.
update public.question_options qo
set
  content_latex = public.normalize_inline_math_for_latex(qo.content_text),
  content_text = null
from public.questions q
where q.id = qo.question_id
  and q.source_key = 'HOSTSERVER001_JEE_MAINS_PYQS_LATEX'
  and q.tags @> array['Re-Check']::text[]
  and qo.content_latex is null
  and position('$' in coalesce(qo.content_text, '')) > 0;
