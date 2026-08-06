-- Re-Check workflow for restricted master-bank draft review.
-- Teachers must be explicitly assigned here. They may edit only tagged draft/in-review
-- master questions through save_question; final approval remains a platform-admin action.

create table if not exists public.question_recheck_reviewers (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  notes text
);

alter table public.question_recheck_reviewers enable row level security;

create index if not exists idx_question_recheck_reviewers_active
  on public.question_recheck_reviewers (is_active)
  where is_active = true;

drop policy if exists question_recheck_reviewers_admin_manage on public.question_recheck_reviewers;
create policy question_recheck_reviewers_admin_manage
  on public.question_recheck_reviewers
  for all
  using (public.is_evidara_platform_admin())
  with check (public.is_evidara_platform_admin());

drop policy if exists question_recheck_reviewers_self_read on public.question_recheck_reviewers;
create policy question_recheck_reviewers_self_read
  on public.question_recheck_reviewers
  for select
  using (user_id = (select auth.uid()));

create or replace function public.is_question_recheck_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(exists (
    select 1
    from public.question_recheck_reviewers reviewer
    where reviewer.user_id = auth.uid()
      and reviewer.is_active = true
  ), false)
$$;

grant execute on function public.is_question_recheck_reviewer() to authenticated;

drop policy if exists questions_recheck_reviewer_read on public.questions;
create policy questions_recheck_reviewer_read
  on public.questions
  for select
  using (
    organization_id is null
    and status in ('draft'::public.question_status, 'in_review'::public.question_status)
    and tags @> array['Re-Check']::text[]
    and public.is_question_recheck_reviewer()
  );

create or replace function public.save_question(p_question_id uuid, p_organization_id uuid, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid := auth.uid();
  v_question uuid;
  v_existing public.questions%rowtype;
  v_options jsonb := coalesce(p_payload -> 'options', '[]'::jsonb);
  v_status public.question_status := coalesce((p_payload ->> 'status')::public.question_status, 'draft');
  v_hash text;
  v_next_version integer;
  v_opt jsonb;
  v_answer jsonb := coalesce(p_payload -> 'correct_answer', '[]'::jsonb);
  v_tags text[];
  v_metadata jsonb;
  v_is_recheck_edit boolean := false;
  v_audit_org uuid;
begin
  if v_user is null then
    raise exception 'Login required.';
  end if;

  v_tags := coalesce(
    array(select jsonb_array_elements_text(coalesce(p_payload -> 'tags', '[]'::jsonb))),
    '{}'::text[]
  );
  v_metadata := coalesce(p_payload -> 'metadata', '{}'::jsonb);

  if p_question_id is null then
    if p_organization_id is null then
      if not public.is_super_admin() then
        raise exception 'Only super admin can create RankMint master questions.';
      end if;
    elsif not public.is_org_question_manager(p_organization_id) then
      raise exception 'Question-bank permission required.';
    end if;
    v_audit_org := p_organization_id;
  else
    select * into v_existing
    from public.questions
    where id = p_question_id
    for update;

    if not found then
      raise exception 'Question not found.';
    end if;

    v_is_recheck_edit := (
      v_existing.organization_id is null
      and v_existing.status in ('draft'::public.question_status, 'in_review'::public.question_status)
      and v_existing.tags @> array['Re-Check']::text[]
      and public.is_question_recheck_reviewer()
    );

    if v_existing.organization_id is null then
      if not public.is_super_admin() and not v_is_recheck_edit then
        raise exception 'Only a platform admin or assigned Re-Check reviewer can edit this master question.';
      end if;
    elsif not public.is_org_question_manager(v_existing.organization_id) then
      raise exception 'Question-bank permission required.';
    end if;

    v_audit_org := v_existing.organization_id;
  end if;

  if length(trim(coalesce(p_payload ->> 'stem_text', ''))) < 5 then
    raise exception 'Question text must contain at least 5 characters.';
  end if;

  if jsonb_array_length(v_options) < 2
     and coalesce(p_payload ->> 'question_type', 'single_correct') in ('single_correct', 'multiple_correct', 'assertion_reason', 'image_based') then
    raise exception 'At least two options are required.';
  end if;

  if v_is_recheck_edit then
    if v_status not in ('draft'::public.question_status, 'in_review'::public.question_status) then
      v_status := v_existing.status;
    end if;
    if not ('Re-Check' = any(v_tags)) then
      v_tags := array_append(v_tags, 'Re-Check');
    end if;
    v_metadata := coalesce(v_existing.metadata, '{}'::jsonb)
      || v_metadata
      || jsonb_build_object(
        'last_recheck_reviewer_id', v_user,
        'last_recheck_reviewed_at', now()
      );
  elsif not public.is_super_admin()
        and not public.can_review_org_question(coalesce(p_organization_id, v_existing.organization_id))
        and v_status in ('approved'::public.question_status, 'rejected'::public.question_status, 'archived'::public.question_status) then
    v_status := 'draft'::public.question_status;
  end if;

  v_hash := public.question_duplicate_hash(p_payload ->> 'stem_text', v_options);

  if p_question_id is null then
    insert into public.questions(
      organization_id, created_by, updated_by, subject_id, chapter_id, topic_id,
      question_type, status, difficulty, stem_text, stem_latex, question_image_url,
      passage_text, solution_text, solution_latex, marks, negative_marks,
      estimated_seconds, correct_answer, exam_types, class_level, source, source_year,
      language, tags, metadata, duplicate_hash, approved_at
    ) values (
      p_organization_id, v_user, v_user,
      nullif(p_payload ->> 'subject_id', '')::uuid,
      nullif(p_payload ->> 'chapter_id', '')::uuid,
      nullif(p_payload ->> 'topic_id', '')::uuid,
      coalesce((p_payload ->> 'question_type')::public.question_type, 'single_correct'),
      v_status,
      coalesce((p_payload ->> 'difficulty')::public.question_difficulty, 'moderate'),
      trim(p_payload ->> 'stem_text'), nullif(p_payload ->> 'stem_latex', ''),
      nullif(p_payload ->> 'question_image_url', ''), nullif(p_payload ->> 'passage_text', ''),
      nullif(p_payload ->> 'solution_text', ''), nullif(p_payload ->> 'solution_latex', ''),
      coalesce((p_payload ->> 'marks')::numeric, 4), coalesce((p_payload ->> 'negative_marks')::numeric, 1),
      nullif(p_payload ->> 'estimated_seconds', '')::integer, v_answer,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'exam_types', '[]'::jsonb))), '{}'::text[]),
      nullif(p_payload ->> 'class_level', ''), nullif(p_payload ->> 'source', ''),
      nullif(p_payload ->> 'source_year', '')::integer, coalesce(nullif(p_payload ->> 'language', ''), 'English'),
      v_tags, v_metadata, v_hash,
      case when v_status = 'approved' then now() else null end
    ) returning id into v_question;
    v_next_version := 1;
  else
    v_next_version := v_existing.version_number + 1;

    insert into public.question_versions(question_id, version_number, snapshot, changed_by, change_note)
    values(v_existing.id, v_existing.version_number, to_jsonb(v_existing), v_user, p_payload ->> 'change_note')
    on conflict do nothing;

    update public.questions set
      subject_id = nullif(p_payload ->> 'subject_id', '')::uuid,
      chapter_id = nullif(p_payload ->> 'chapter_id', '')::uuid,
      topic_id = case
        when v_is_recheck_edit and nullif(p_payload ->> 'topic_id', '') is null then v_existing.topic_id
        else nullif(p_payload ->> 'topic_id', '')::uuid
      end,
      question_type = coalesce((p_payload ->> 'question_type')::public.question_type, question_type),
      status = v_status,
      difficulty = coalesce((p_payload ->> 'difficulty')::public.question_difficulty, difficulty),
      stem_text = trim(p_payload ->> 'stem_text'),
      stem_latex = nullif(p_payload ->> 'stem_latex', ''),
      question_image_url = nullif(p_payload ->> 'question_image_url', ''),
      passage_text = nullif(p_payload ->> 'passage_text', ''),
      solution_text = nullif(p_payload ->> 'solution_text', ''),
      solution_latex = nullif(p_payload ->> 'solution_latex', ''),
      marks = coalesce((p_payload ->> 'marks')::numeric, marks),
      negative_marks = coalesce((p_payload ->> 'negative_marks')::numeric, negative_marks),
      estimated_seconds = nullif(p_payload ->> 'estimated_seconds', '')::integer,
      correct_answer = v_answer,
      exam_types = coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'exam_types', '[]'::jsonb))), '{}'::text[]),
      class_level = nullif(p_payload ->> 'class_level', ''),
      source = nullif(p_payload ->> 'source', ''),
      source_year = nullif(p_payload ->> 'source_year', '')::integer,
      language = coalesce(nullif(p_payload ->> 'language', ''), 'English'),
      tags = v_tags,
      metadata = v_metadata,
      duplicate_hash = v_hash,
      version_number = v_next_version,
      updated_by = v_user,
      updated_at = now(),
      approved_at = case when v_status = 'approved' then coalesce(approved_at, now()) else null end
    where id = p_question_id
    returning id into v_question;

    delete from public.question_options where question_id = v_question;
  end if;

  for v_opt in select * from jsonb_array_elements(v_options)
  loop
    insert into public.question_options(question_id, option_key, content_text, content_latex, image_url, is_correct, display_order)
    values(
      v_question,
      upper(trim(v_opt ->> 'option_key')),
      nullif(v_opt ->> 'content_text', ''),
      nullif(v_opt ->> 'content_latex', ''),
      nullif(v_opt ->> 'image_url', ''),
      coalesce((v_opt ->> 'is_correct')::boolean, false),
      coalesce((v_opt ->> 'display_order')::integer, 0)
    );
  end loop;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(
    v_user,
    v_audit_org,
    case when p_question_id is null then 'question.created' else 'question.updated' end,
    'question',
    v_question::text,
    jsonb_build_object(
      'status', v_status,
      'version', v_next_version,
      'recheck_edit', v_is_recheck_edit
    )
  );

  return v_question;
end;
$function$;
