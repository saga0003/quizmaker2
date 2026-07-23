-- Evidara V8 Papers Phase 3: Question Bank selection and hybrid generation studio
-- Run after migrations 32 through 36 in a disposable V8 Supabase test project.
-- This migration only adds approved Question Bank records to paper definitions.
-- It does not create products, prices, entitlements, student attempts or results.

begin;

create or replace function public.append_questions_to_paper_v8(
  p_paper_id uuid,
  p_section_id uuid,
  p_question_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  actor uuid := auth.uid();
  paper_record public.question_papers%rowtype;
  question_record public.questions%rowtype;
  question_id_value uuid;
  next_order integer;
  added_ids uuid[] := '{}';
  skipped_ids uuid[] := '{}';
  total_questions_value integer;
  total_marks_value numeric(10,2);
begin
  if actor is null then
    raise exception 'Please sign in before adding questions.' using errcode='42501';
  end if;

  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_record.deleted_at is not null then
    raise exception 'Restore the deleted paper before adding questions.' using errcode='55000';
  end if;
  if paper_record.workflow_status in ('published','closed','archived','approved','submitted_for_review') then
    raise exception 'Create or restore an editable draft before changing selected questions.' using errcode='55000';
  end if;
  if not exists(
    select 1 from public.paper_sections section
    where section.id=p_section_id and section.paper_id=p_paper_id
  ) then
    raise exception 'Destination section not found in this paper.' using errcode='P0002';
  end if;

  select coalesce(max(display_order),-1)+1
  into next_order
  from public.paper_questions
  where paper_id=p_paper_id;

  for question_id_value in
    select distinct value from unnest(coalesce(p_question_ids,array[]::uuid[])) value
  loop
    if exists(
      select 1 from public.paper_questions item
      where item.paper_id=p_paper_id and item.question_id=question_id_value
    ) then
      skipped_ids := array_append(skipped_ids,question_id_value);
      continue;
    end if;

    select * into question_record
    from public.questions question
    where question.id=question_id_value
      and question.status::text='approved'
      and (
        public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
        or (question.organization_id is null and public.is_evidara_school_staff(paper_record.organization_id))
        or (
          paper_record.organization_id is not null
          and question.organization_id=paper_record.organization_id
          and public.is_evidara_school_staff(paper_record.organization_id)
        )
      );

    if not found then
      skipped_ids := array_append(skipped_ids,question_id_value);
      continue;
    end if;

    insert into public.paper_questions(
      paper_id,section_id,question_id,display_order,marks,negative_marks,
      original_marks,original_negative_marks,is_mandatory,is_locked,
      generation_source,shuffle_restricted,position_locked,is_bonus,is_cancelled,
      grace_marks,metadata,question_snapshot
    ) values (
      p_paper_id,p_section_id,question_record.id,next_order,
      question_record.marks,question_record.negative_marks,
      question_record.marks,question_record.negative_marks,true,false,
      'manual',false,false,false,false,0,
      jsonb_build_object('added_from','phase3_question_generation_studio','added_at',now()),
      public.paper_question_snapshot_v8(question_record.id)
    );

    added_ids := array_append(added_ids,question_record.id);
    next_order := next_order+1;
  end loop;

  select count(*),coalesce(sum(marks),0)
  into total_questions_value,total_marks_value
  from public.paper_questions
  where paper_id=p_paper_id;

  update public.question_papers set
    total_questions=total_questions_value,
    total_marks=total_marks_value,
    updated_by=actor,
    updated_at=now(),
    last_saved_at=now(),
    draft_revision=draft_revision+1
  where id=p_paper_id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,new_value)
  values(
    p_paper_id,actor,public.current_evidara_role(),'paper.questions_appended',
    jsonb_build_object(
      'section_id',p_section_id,
      'added_question_ids',added_ids,
      'skipped_question_ids',skipped_ids,
      'source','phase3_question_generation_studio'
    )
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'section_id',p_section_id,
    'added_count',coalesce(cardinality(added_ids),0),
    'skipped_count',coalesce(cardinality(skipped_ids),0),
    'added_question_ids',added_ids,
    'skipped_question_ids',skipped_ids,
    'total_questions',total_questions_value,
    'total_marks',total_marks_value,
    'workflow_status','draft',
    'definition_published',false,
    'product_created',false,
    'student_access_created',false
  );
end
$$;

grant execute on function public.append_questions_to_paper_v8(uuid,uuid,uuid[])
to authenticated,service_role;

create or replace function public.set_paper_question_lock_v8(
  p_paper_question_id uuid,
  p_locked boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  actor uuid := auth.uid();
  item public.paper_questions%rowtype;
  paper_record public.question_papers%rowtype;
begin
  if actor is null then
    raise exception 'Please sign in before changing question locks.' using errcode='42501';
  end if;

  select * into item
  from public.paper_questions
  where id=p_paper_question_id
  for update;
  if not found then
    raise exception 'Paper question not found.' using errcode='P0002';
  end if;

  select * into paper_record
  from public.question_papers
  where id=item.paper_id;
  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_record.deleted_at is not null or paper_record.workflow_status in ('published','closed','archived','approved','submitted_for_review') then
    raise exception 'Question locks can only be changed in an editable draft.' using errcode='55000';
  end if;

  update public.paper_questions set
    is_locked=coalesce(p_locked,false),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('lock_updated_at',now(),'lock_updated_by',actor)
  where id=p_paper_question_id;

  update public.question_papers set
    updated_by=actor,updated_at=now(),last_saved_at=now(),draft_revision=draft_revision+1
  where id=item.paper_id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,previous_value,new_value)
  values(
    item.paper_id,actor,public.current_evidara_role(),'paper.question_lock_changed',
    jsonb_build_object('paper_question_id',item.id,'is_locked',item.is_locked),
    jsonb_build_object('paper_question_id',item.id,'is_locked',coalesce(p_locked,false))
  );

  return jsonb_build_object(
    'paper_id',item.paper_id,
    'paper_question_id',item.id,
    'is_locked',coalesce(p_locked,false),
    'workflow_status','draft'
  );
end
$$;

grant execute on function public.set_paper_question_lock_v8(uuid,boolean)
to authenticated,service_role;

commit;
