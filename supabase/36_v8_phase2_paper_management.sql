-- Evidara V8 Papers Phase 2: core paper management and recoverable deletion
-- Run after migrations 32 through 35 in a disposable V8 test Supabase project.
-- This migration does not create products, prices, entitlements, student attempts,
-- payments, agent codes, results or analytics.

begin;

alter table public.question_papers
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references public.profiles(id) on delete set null,
  add column if not exists deletion_reason text;

create index if not exists question_papers_active_management_idx
  on public.question_papers(organization_id,workflow_status,updated_at desc)
  where deleted_at is null;

create index if not exists question_papers_deleted_management_idx
  on public.question_papers(organization_id,deleted_at desc)
  where deleted_at is not null;

-- A soft-deleted definition may only be restored through the dedicated restore
-- function. This blocks stale browser tabs and direct save RPC calls from silently
-- modifying deleted paper records.
create or replace function public.prevent_deleted_paper_mutation_v8()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.deleted_at is not null and new.deleted_at is not null then
    raise exception 'Deleted paper definitions cannot be modified. Restore the paper first.'
      using errcode='55000';
  end if;
  return new;
end
$$;

drop trigger if exists prevent_deleted_paper_mutation_v8 on public.question_papers;
create trigger prevent_deleted_paper_mutation_v8
before update on public.question_papers
for each row execute function public.prevent_deleted_paper_mutation_v8();

create or replace function public.manage_paper_status_v8(
  p_paper_id uuid,
  p_next_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  actor uuid := auth.uid();
  paper_record public.question_papers%rowtype;
  next_status text := lower(trim(coalesce(p_next_status,'')));
  legacy_status public.paper_status;
  has_published_version boolean;
begin
  if actor is null then
    raise exception 'Please sign in before managing a paper.' using errcode='42501';
  end if;

  if next_status not in ('draft','paused','closed','archived') then
    raise exception 'Unsupported paper-management status.' using errcode='22023';
  end if;

  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  if paper_record.deleted_at is not null then
    raise exception 'Restore the deleted paper before changing its status.' using errcode='55000';
  end if;

  select exists(
    select 1
    from public.paper_versions version
    where version.paper_id=p_paper_id
      and version.workflow_status='published'
  ) into has_published_version;

  if next_status='draft' and (
    paper_record.workflow_status='published'
    or paper_record.published_at is not null
    or has_published_version
  ) then
    raise exception 'Published paper history cannot be reopened as a draft. Create a new version instead.'
      using errcode='55000';
  end if;

  if next_status='draft' and paper_record.workflow_status not in ('archived','paused','closed','changes_requested','draft') then
    raise exception 'This paper cannot be restored to Draft from its current workflow state.'
      using errcode='23514';
  end if;

  legacy_status := case
    when next_status='archived' then 'archived'::public.paper_status
    else 'draft'::public.paper_status
  end;

  update public.question_papers set
    workflow_status=next_status,
    status=legacy_status,
    updated_by=actor,
    updated_at=now()
  where id=p_paper_id;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,previous_value,new_value,reason
  ) values (
    p_paper_id,actor,public.current_evidara_role(),'paper.management_status_changed',
    jsonb_build_object('workflow_status',paper_record.workflow_status),
    jsonb_build_object('workflow_status',next_status),
    nullif(trim(coalesce(p_reason,'')),'')
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'workflow_status',next_status,
    'definition_published',false,
    'product_created',false,
    'student_access_created',false
  );
end
$$;

grant execute on function public.manage_paper_status_v8(uuid,text,text)
to authenticated,service_role;

create or replace function public.soft_delete_paper_definition_v8(
  p_paper_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  actor uuid := auth.uid();
  paper_record public.question_papers%rowtype;
  has_published_version boolean;
  deletion_time timestamptz := now();
begin
  if actor is null then
    raise exception 'Please sign in before deleting a paper.' using errcode='42501';
  end if;

  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  if paper_record.deleted_at is not null then
    return jsonb_build_object(
      'paper_id',p_paper_id,
      'deleted',true,
      'deleted_at',paper_record.deleted_at,
      'already_deleted',true
    );
  end if;

  select exists(
    select 1
    from public.paper_versions version
    where version.paper_id=p_paper_id
      and version.workflow_status='published'
  ) into has_published_version;

  if paper_record.workflow_status in ('published','approved','submitted_for_review')
     or paper_record.published_at is not null
     or has_published_version then
    raise exception 'Published, approved or review-active papers cannot be deleted. Archive them or create a new version.'
      using errcode='55000';
  end if;

  if paper_record.workflow_status not in ('draft','changes_requested','paused','closed','archived') then
    raise exception 'This paper cannot be deleted from its current workflow state.' using errcode='23514';
  end if;

  update public.question_papers set
    deleted_at=deletion_time,
    deleted_by=actor,
    deletion_reason=nullif(trim(coalesce(p_reason,'')),''),
    workflow_status='archived',
    status='archived',
    updated_by=actor,
    updated_at=deletion_time
  where id=p_paper_id;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,previous_value,new_value,reason
  ) values (
    p_paper_id,actor,public.current_evidara_role(),'paper.soft_deleted',
    jsonb_build_object('workflow_status',paper_record.workflow_status,'deleted_at',paper_record.deleted_at),
    jsonb_build_object('workflow_status','archived','deleted_at',deletion_time),
    nullif(trim(coalesce(p_reason,'')),'')
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'deleted',true,
    'deleted_at',deletion_time,
    'recoverable',true,
    'definition_published',false,
    'product_created',false,
    'student_access_created',false
  );
end
$$;

grant execute on function public.soft_delete_paper_definition_v8(uuid,text)
to authenticated,service_role;

create or replace function public.restore_deleted_paper_definition_v8(
  p_paper_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  actor uuid := auth.uid();
  paper_record public.question_papers%rowtype;
begin
  if actor is null then
    raise exception 'Please sign in before restoring a paper.' using errcode='42501';
  end if;

  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  if paper_record.deleted_at is null then
    return jsonb_build_object('paper_id',p_paper_id,'restored',true,'already_active',true);
  end if;

  update public.question_papers set
    deleted_at=null,
    deleted_by=null,
    deletion_reason=null,
    workflow_status='draft',
    status='draft',
    updated_by=actor,
    updated_at=now()
  where id=p_paper_id;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,previous_value,new_value,reason
  ) values (
    p_paper_id,actor,public.current_evidara_role(),'paper.soft_delete_restored',
    jsonb_build_object('deleted_at',paper_record.deleted_at,'workflow_status',paper_record.workflow_status),
    jsonb_build_object('deleted_at',null,'workflow_status','draft'),
    nullif(trim(coalesce(p_reason,'')),'')
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'restored',true,
    'workflow_status','draft',
    'definition_published',false,
    'product_created',false,
    'student_access_created',false
  );
end
$$;

grant execute on function public.restore_deleted_paper_definition_v8(uuid,text)
to authenticated,service_role;

commit;
