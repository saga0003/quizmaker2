create or replace function public.start_exam_attempt(p_paper_id uuid, p_access_code text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_paper public.question_papers%rowtype;
  v_existing uuid;
  v_attempt uuid;
  v_number integer;
  v_order uuid[];
  v_expiry timestamptz;
  v_product_id uuid;
  v_entitlement public.entitlements%rowtype;
  v_product_attempts integer := 0;
  v_metadata jsonb;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_paper_id::text || ':' || v_user::text, 0));

  select * into v_paper from public.question_papers where id=p_paper_id and status='published';
  if not found then raise exception 'This test is not available.'; end if;
  if v_paper.available_from is not null and now()<v_paper.available_from then raise exception 'This test has not opened yet.'; end if;
  if v_paper.available_until is not null and now()>v_paper.available_until then raise exception 'This test has closed.'; end if;

  if v_paper.organization_id is not null then
    if not public.school_can_run_new_activity_v19(v_paper.organization_id) then
      raise exception 'This institution licence is not active. Contact your school administrator.' using errcode='42501';
    end if;
    if not public.is_org_member(v_paper.organization_id) and not public.paper_assignment_allows_student_v19(v_paper.id,v_user) then
      raise exception 'This test is not assigned to your student account.' using errcode='42501';
    end if;
  end if;

  if v_paper.access_mode='code' and upper(btrim(coalesce(p_access_code,'')))<>upper(btrim(coalesce(v_paper.access_code,''))) then
    raise exception 'Invalid test access code.';
  end if;

  select id into v_existing from public.exam_attempts
  where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at>now()
  order by started_at desc limit 1;
  if v_existing is not null then return v_existing; end if;

  update public.exam_attempts set status='expired'
  where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at<=now();

  select count(*)+1 into v_number from public.exam_attempts where paper_id=p_paper_id and student_id=v_user;
  if v_number>v_paper.attempt_limit then raise exception 'You have used all attempts for this test.'; end if;

  select pp.product_id into v_product_id
  from public.product_papers pp
  where pp.paper_id=p_paper_id
  order by pp.display_order,pp.created_at
  limit 1;

  if v_product_id is not null then
    select entitlement.* into v_entitlement from public.entitlements entitlement
    where entitlement.id=(
      select candidate.id from (
        select direct_entitlement.id,0 as priority from public.entitlements direct_entitlement
        where direct_entitlement.product_id=v_product_id and direct_entitlement.user_id=v_user
          and direct_entitlement.status='active'
          and (direct_entitlement.expires_at is null or direct_entitlement.expires_at>now())
        union all
        select school_entitlement.id,1 as priority from public.entitlements school_entitlement
        join public.student_school_memberships membership
          on membership.organization_id=school_entitlement.organization_id
         and membership.student_id=v_user and membership.status::text='active'
        where school_entitlement.product_id=v_product_id
          and school_entitlement.organization_id is not null
          and school_entitlement.status='active'
          and (school_entitlement.expires_at is null or school_entitlement.expires_at>now())
          and (school_entitlement.seat_limit is null or exists(
            select 1 from public.product_seat_assignments seat
            where seat.entitlement_id=school_entitlement.id and seat.student_id=v_user and seat.status='active'
          ))
      ) candidate order by candidate.priority,candidate.id limit 1
    ) for update;

    if not found then
      raise exception 'Purchase this paper series or ask your school to assign a product seat before starting the test.';
    end if;

    select count(*)::integer into v_product_attempts
    from public.product_attempt_usage usage
    where usage.entitlement_id=v_entitlement.id and usage.entitlement_started_at=v_entitlement.starts_at;

    if v_entitlement.attempts_limit is not null and v_product_attempts>=v_entitlement.attempts_limit then
      raise exception 'You have used all purchased attempts for this paper series.';
    end if;
  end if;

  if v_paper.shuffle_questions then
    select array_agg(id order by random()) into v_order
    from public.paper_questions where paper_id=p_paper_id and is_active;
  else
    select array_agg(id order by display_order,id) into v_order
    from public.paper_questions where paper_id=p_paper_id and is_active;
  end if;

  if coalesce(cardinality(v_order),0)=0 then raise exception 'This test has no active questions.'; end if;

  v_expiry:=now()+make_interval(mins=>v_paper.duration_minutes);
  if v_paper.available_until is not null then v_expiry:=least(v_expiry,v_paper.available_until); end if;

  v_metadata := jsonb_strip_nulls(jsonb_build_object(
    'paper_snapshot_version',1,
    'paper_content_revision',v_paper.content_revision,
    'paper_title',v_paper.title,
    'paper_description',v_paper.description,
    'paper_exam_type',v_paper.exam_type,
    'duration_minutes',v_paper.duration_minutes,
    'total_marks',v_paper.total_marks,
    'total_questions',v_paper.total_questions,
    'paper_instructions',v_paper.instructions,
    'shuffle_options',v_paper.shuffle_options,
    'result_mode_at_start',v_paper.result_mode::text
  ));

  insert into public.exam_attempts(
    paper_id,student_id,organization_id,attempt_number,status,expires_at,
    question_order,maximum_marks,unanswered_count,metadata
  ) values(
    p_paper_id,v_user,v_paper.organization_id,v_number,'in_progress',v_expiry,
    coalesce(v_order,'{}'),v_paper.total_marks,v_paper.total_questions,v_metadata
  ) returning id into v_attempt;

  if v_product_id is not null then
    insert into public.product_attempt_usage(
      entitlement_id,product_id,paper_id,student_id,attempt_id,entitlement_started_at,attempts_used
    ) values(
      v_entitlement.id,v_product_id,p_paper_id,v_user,v_attempt,v_entitlement.starts_at,v_product_attempts+1
    );
    update public.entitlements
      set attempts_used=v_product_attempts+1,updated_at=now()
      where id=v_entitlement.id;
  end if;

  return v_attempt;
end
$function$;

create or replace function public.get_exam_attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_attempt public.exam_attempts%rowtype;
  v_paper public.question_papers%rowtype;
  v_sections jsonb;
  v_questions jsonb;
  v_responses jsonb;
  v_meta jsonb;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and student_id=auth.uid();
  if not found then raise exception 'Attempt not found.'; end if;

  if v_attempt.status='in_progress' and v_attempt.expires_at<=now() then
    update public.exam_attempts set status='expired' where id=v_attempt.id;
    v_attempt.status:='expired';
  end if;

  select * into v_paper from public.question_papers where id=v_attempt.paper_id;
  v_meta := coalesce(v_attempt.metadata,'{}'::jsonb);

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'instructions',s.instructions,
    'questions_to_attempt',s.questions_to_attempt,'display_order',s.display_order
  ) order by s.display_order),'[]'::jsonb)
  into v_sections
  from public.paper_sections s
  where exists(
    select 1 from public.paper_questions pq
    where pq.section_id=s.id and pq.id=any(coalesce(v_attempt.question_order,'{}'::uuid[]))
  );

  select coalesce(jsonb_agg(
    (pq.question_snapshot - 'correct_answer' - 'solution_text' - 'solution_latex' - 'solution_image_url' - 'solution_image_urls')
    || jsonb_build_object(
      'paper_question_id',pq.id,'section_id',pq.section_id,'display_order',pq.display_order,
      'marks',pq.marks,'negative_marks',pq.negative_marks,'is_mandatory',pq.is_mandatory,
      'options',coalesce((
        select jsonb_agg(opt-'is_correct' order by coalesce((opt->>'display_order')::integer,0))
        from jsonb_array_elements(coalesce(pq.question_snapshot->'options','[]'::jsonb)) opt
      ),'[]'::jsonb)
    )
    order by array_position(v_attempt.question_order,pq.id)
  ),'[]'::jsonb)
  into v_questions
  from public.paper_questions pq
  where pq.id=any(coalesce(v_attempt.question_order,'{}'::uuid[]));

  select coalesce(jsonb_agg(jsonb_build_object(
    'paper_question_id',r.paper_question_id,'response',r.response,
    'marked_for_review',r.marked_for_review,'visited',r.visited
  )),'[]'::jsonb)
  into v_responses
  from public.exam_responses r where r.attempt_id=v_attempt.id;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,
    'status',v_attempt.status,
    'started_at',v_attempt.started_at,
    'expires_at',v_attempt.expires_at,
    'paper',jsonb_build_object(
      'id',v_paper.id,
      'title',coalesce(v_meta->>'paper_title',v_paper.title),
      'description',coalesce(v_meta->>'paper_description',v_paper.description),
      'exam_type',coalesce(v_meta->>'paper_exam_type',v_paper.exam_type),
      'duration_minutes',coalesce(nullif(v_meta->>'duration_minutes','')::integer,v_paper.duration_minutes),
      'total_marks',v_attempt.maximum_marks,
      'total_questions',cardinality(coalesce(v_attempt.question_order,'{}'::uuid[])),
      'instructions',coalesce(v_meta->>'paper_instructions',v_paper.instructions),
      'shuffle_options',coalesce(nullif(v_meta->>'shuffle_options','')::boolean,v_paper.shuffle_options),
      'result_mode',v_paper.result_mode
    ),
    'sections',v_sections,
    'questions',v_questions,
    'responses',v_responses
  );
end
$function$;

create or replace function public.save_exam_response(
  p_attempt_id uuid,
  p_paper_question_id uuid,
  p_response jsonb,
  p_marked_for_review boolean default false,
  p_time_spent_seconds integer default 0
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_status public.attempt_status;
  v_expiry timestamptz;
  v_order uuid[];
begin
  select status,expires_at,question_order into v_status,v_expiry,v_order
  from public.exam_attempts
  where id=p_attempt_id and student_id=auth.uid()
  for update;

  if not found then raise exception 'Attempt not found.'; end if;
  if v_status<>'in_progress' or v_expiry<=now() then raise exception 'This attempt is no longer active.'; end if;

  if not p_paper_question_id=any(coalesce(v_order,'{}'::uuid[])) then
    raise exception 'Question does not belong to this attempt.';
  end if;

  insert into public.exam_responses(
    attempt_id,paper_question_id,response,marked_for_review,visited,time_spent_seconds,saved_at
  ) values(
    p_attempt_id,p_paper_question_id,p_response,p_marked_for_review,true,greatest(p_time_spent_seconds,0),now()
  )
  on conflict(attempt_id,paper_question_id) do update set
    response=excluded.response,
    marked_for_review=excluded.marked_for_review,
    visited=true,
    time_spent_seconds=greatest(public.exam_responses.time_spent_seconds,excluded.time_spent_seconds),
    saved_at=now();
end
$function$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_attempt public.exam_attempts%rowtype;
  v_paper public.question_papers%rowtype;
  v_item record;
  v_response jsonb;
  v_correct boolean;
  v_score numeric(10,2) := 0;
  v_correct_count integer := 0;
  v_incorrect integer := 0;
  v_unanswered integer := 0;
  v_percentage numeric(8,2) := 0;
  v_release text;
  v_released boolean;
  v_receipt_id uuid;
  v_submission_confirmed_at timestamptz;
begin
  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id and student_id = auth.uid()
  for update;
  if not found then raise exception 'Attempt not found.'; end if;

  select * into v_paper from public.question_papers where id = v_attempt.paper_id;
  if not found then raise exception 'Paper not found.'; end if;

  if v_attempt.status <> 'submitted' then
    for v_item in
      select pq.id,pq.marks,pq.negative_marks,
        (pq.question_snapshot->>'question_type')::public.question_type as question_type,
        pq.question_snapshot->'correct_answer' as expected,
        r.response
      from public.paper_questions pq
      left join public.exam_responses r
        on r.paper_question_id=pq.id and r.attempt_id=v_attempt.id
      where pq.id=any(coalesce(v_attempt.question_order,'{}'::uuid[]))
      order by array_position(v_attempt.question_order,pq.id)
    loop
      v_response := v_item.response;
      if v_response is null or v_response='null'::jsonb or v_response='[]'::jsonb or v_response='""'::jsonb then
        v_unanswered := v_unanswered + 1;
        update public.exam_responses
          set is_correct=null,marks_awarded=0
          where attempt_id=v_attempt.id and paper_question_id=v_item.id;
      else
        v_correct := public.answer_matches(v_item.expected,v_response,v_item.question_type);
        if v_correct then
          v_correct_count:=v_correct_count+1;
          v_score:=v_score+v_item.marks;
        else
          v_incorrect:=v_incorrect+1;
          v_score:=v_score-v_item.negative_marks;
        end if;
        update public.exam_responses
          set is_correct=v_correct,
              marks_awarded=case when v_correct then v_item.marks else -v_item.negative_marks end
          where attempt_id=v_attempt.id and paper_question_id=v_item.id;
      end if;
    end loop;

    if v_attempt.maximum_marks>0 then
      v_percentage:=round((v_score/v_attempt.maximum_marks)*100,2);
    end if;

    v_receipt_id:=gen_random_uuid();
    v_submission_confirmed_at:=now();

    update public.exam_attempts
    set status='submitted',submitted_at=v_submission_confirmed_at,score=v_score,percentage=v_percentage,
        correct_count=v_correct_count,incorrect_count=v_incorrect,unanswered_count=v_unanswered,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
          'submission_receipt_id',v_receipt_id::text,
          'submission_receipt_version',1,
          'submission_confirmed_at',v_submission_confirmed_at
        )
    where id=v_attempt.id
    returning * into v_attempt;
  else
    begin
      v_receipt_id:=nullif(v_attempt.metadata->>'submission_receipt_id','')::uuid;
    exception when invalid_text_representation then
      v_receipt_id:=null;
    end;

    if v_receipt_id is null then
      v_receipt_id:=gen_random_uuid();
      v_submission_confirmed_at:=coalesce(v_attempt.submitted_at,now());
      update public.exam_attempts
      set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
        'submission_receipt_id',v_receipt_id::text,
        'submission_receipt_version',1,
        'submission_confirmed_at',v_submission_confirmed_at
      )
      where id=v_attempt.id
      returning * into v_attempt;
    end if;
  end if;

  if v_receipt_id is null then
    begin
      v_receipt_id:=nullif(v_attempt.metadata->>'submission_receipt_id','')::uuid;
    exception when invalid_text_representation then
      v_receipt_id:=null;
    end;
  end if;

  v_submission_confirmed_at:=coalesce(
    nullif(v_attempt.metadata->>'submission_confirmed_at','')::timestamptz,
    v_attempt.submitted_at
  );

  v_release:=public.student_result_release_level(v_attempt.paper_id,v_attempt.student_id);
  v_released:=v_release in ('score','answers','analytics');

  return jsonb_build_object(
    'attempt_id',v_attempt.id,
    'paper_id',v_attempt.paper_id,
    'paper_title',coalesce(v_attempt.metadata->>'paper_title',v_paper.title),
    'status',v_attempt.status,
    'submission_receipt_id',v_receipt_id,
    'submission_confirmed_at',v_submission_confirmed_at,
    'submission_receipt',jsonb_build_object(
      'receipt_id',v_receipt_id,'attempt_id',v_attempt.id,'paper_id',v_attempt.paper_id,
      'paper_title',coalesce(v_attempt.metadata->>'paper_title',v_paper.title),
      'submitted_at',v_attempt.submitted_at,'confirmed_at',v_submission_confirmed_at,'status','confirmed'
    ),
    'score',case when v_released then v_attempt.score else null end,
    'maximum_marks',case when v_released then v_attempt.maximum_marks else null end,
    'percentage',case when v_released then v_attempt.percentage else null end,
    'correct_count',case when v_released then v_attempt.correct_count else null end,
    'incorrect_count',case when v_released then v_attempt.incorrect_count else null end,
    'unanswered_count',case when v_released then v_attempt.unanswered_count else null end,
    'started_at',v_attempt.started_at,
    'submitted_at',v_attempt.submitted_at,
    'result_mode',v_paper.result_mode,
    'result_release_level',v_release,
    'result_released',v_released,
    'answers_released',v_release in ('answers','analytics'),
    'analytics_released',v_release='analytics',
    'available_until',v_paper.available_until
  );
end
$function$;