begin;

-- Publication is a governed action. Teachers may create drafts and submit them
-- for review, but only Super Admin, Evidara Admin and School Admin can publish,
-- reject or archive questions. The trigger protects the database even if a user
-- bypasses the V7 interface and calls the existing save_question RPC directly.
create or replace function public.enforce_question_publication_permissions()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
begin
  -- Service-role server routes are validated before writing and have no auth.uid().
  if actor_id is null then
    if new.status = 'approved'
      and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
      new.metadata := jsonb_set(
        coalesce(new.metadata, '{}'::jsonb),
        '{published_at}',
        to_jsonb(now()::text),
        true
      );
    end if;
    return new;
  end if;

  select lower(btrim(coalesce(profile.role, 'student')))
  into actor_role
  from public.profiles profile
  where profile.id = actor_id;

  actor_role := case actor_role
    when 'admin' then 'evidara_admin'
    when 'platform_admin' then 'evidara_admin'
    when 'institute_owner' then 'school_admin'
    when 'institute_admin' then 'school_admin'
    when 'school_owner' then 'school_admin'
    when 'teacher' then 'school_teacher'
    when 'reviewer' then 'school_teacher'
    when 'invigilator' then 'school_teacher'
    else coalesce(actor_role, 'student')
  end;

  if actor_role = 'student' then
    raise exception 'Students cannot create or change question-bank records.';
  end if;

  if actor_role = 'school_teacher' then
    if tg_op = 'UPDATE' and old.status in ('approved', 'rejected', 'archived') then
      raise exception 'Teachers can view the decision but cannot modify approved, rejected or archived questions.';
    end if;
    if new.status not in ('draft', 'in_review') then
      raise exception 'Teachers can save a draft or submit a question for review. Publishing, rejecting and archiving require an administrator.';
    end if;
  end if;

  if new.status = 'approved'
    and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.metadata := jsonb_set(
      coalesce(new.metadata, '{}'::jsonb),
      '{published_at}',
      to_jsonb(now()::text),
      true
    );
  end if;

  return new;
end
$$;

revoke all on function public.enforce_question_publication_permissions()
  from public, anon, authenticated;
grant execute on function public.enforce_question_publication_permissions()
  to service_role;

drop trigger if exists questions_enforce_publication_permissions
  on public.questions;
create trigger questions_enforce_publication_permissions
before insert or update on public.questions
for each row execute function public.enforce_question_publication_permissions();

-- Question search and date filters use these fields frequently. The indexes are
-- additive and do not alter existing question, paper or attempt contracts.
create index if not exists questions_topic_created_idx
  on public.questions (organization_id, topic_id, created_at, id);
create index if not exists questions_chapter_created_idx
  on public.questions (organization_id, chapter_id, created_at, id);
create index if not exists questions_published_at_idx
  on public.questions ((metadata ->> 'published_at'));
create index if not exists chapters_subject_name_idx
  on public.chapters (subject_id, lower(name));
create index if not exists topics_chapter_name_idx
  on public.topics (chapter_id, lower(name));

commit;
