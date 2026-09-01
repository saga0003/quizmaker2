-- Production hotfix discovered during E8 load-fixture setup.
-- The original C5 validator referenced the removed `question_text` field.
-- Use the live question content model: text, LaTeX, or one/more images.

create or replace function public.validate_question_analytics_ready_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_subject_org uuid;
  v_chapter_subject uuid;
  v_chapter_org uuid;
  v_topic_chapter uuid;
  v_topic_org uuid;
begin
  if new.status is distinct from 'approved' then
    return new;
  end if;

  if nullif(btrim(coalesce(new.stem_text, '')), '') is null
     and nullif(btrim(coalesce(new.stem_latex, '')), '') is null
     and nullif(btrim(coalesce(new.question_image_url, '')), '') is null
     and coalesce(cardinality(new.question_image_urls), 0) = 0 then
    raise exception 'Question cannot be approved: question text, LaTeX or image is required';
  end if;

  if new.subject_id is null or new.chapter_id is null or new.topic_id is null then
    raise exception 'Question cannot be approved: subject, chapter and topic are required for analytics';
  end if;

  if new.marks is null or new.marks <= 0 then
    raise exception 'Question cannot be approved: marks must be greater than zero';
  end if;

  if new.negative_marks is null or new.negative_marks < 0 then
    raise exception 'Question cannot be approved: negative marks must be zero or greater';
  end if;

  if new.negative_marks > new.marks then
    raise exception 'Question cannot be approved: negative marks cannot exceed marks';
  end if;

  if new.difficulty is null then
    raise exception 'Question cannot be approved: difficulty is required';
  end if;

  select s.organization_id into v_subject_org
  from public.subjects s
  where s.id = new.subject_id and s.is_active = true;
  if not found then
    raise exception 'Question cannot be approved: subject is missing or inactive';
  end if;

  select c.subject_id, c.organization_id into v_chapter_subject, v_chapter_org
  from public.chapters c
  where c.id = new.chapter_id and c.is_active = true;
  if not found or v_chapter_subject is distinct from new.subject_id then
    raise exception 'Question cannot be approved: chapter is missing, inactive or outside the selected subject';
  end if;

  select t.chapter_id, t.organization_id into v_topic_chapter, v_topic_org
  from public.topics t
  where t.id = new.topic_id and t.is_active = true;
  if not found or v_topic_chapter is distinct from new.chapter_id then
    raise exception 'Question cannot be approved: topic is missing, inactive or outside the selected chapter';
  end if;

  if new.organization_id is null then
    if v_subject_org is not null or v_chapter_org is not null or v_topic_org is not null then
      raise exception 'Question cannot be approved: platform questions may only use global taxonomy';
    end if;
  else
    if (v_subject_org is not null and v_subject_org is distinct from new.organization_id)
       or (v_chapter_org is not null and v_chapter_org is distinct from new.organization_id)
       or (v_topic_org is not null and v_topic_org is distinct from new.organization_id) then
      raise exception 'Question cannot be approved: taxonomy belongs to a different institution';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.validate_question_analytics_ready_v1() from public, anon, authenticated;
grant execute on function public.validate_question_analytics_ready_v1() to service_role;

comment on function public.validate_question_analytics_ready_v1() is
  'Phase 1 C5: blocks approved question state unless analytics taxonomy, scoring metadata, current content fields and tenant-safe taxonomy relationships are valid.';
