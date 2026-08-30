-- Isolated authorization test for the V13 post-test reflection contract.
-- Run only against a disposable local/test database after the historical schema
-- and current timestamped migrations are applied. The transaction is rolled back.

begin;

do $$
begin
  if to_regclass('public.exam_response_self_classifications') is null
     or to_regprocedure('public.list_post_test_reflection_queue_v13(uuid)') is null
     or to_regprocedure('public.save_exam_response_reflection_v13(uuid,smallint,public.student_error_classification,text)') is null then
    raise exception 'Required V13 post-test reflection schema is not installed.';
  end if;
end
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('10000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'reflection-owner@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Paper Owner"}', now(), now()),
  ('10000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'reflection-student-a@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Student A"}', now(), now()),
  ('10000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'reflection-student-b@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Student B"}', now(), now());

insert into public.questions (
  id, created_by, question_type, status, difficulty, stem_text, correct_answer
)
values (
  '10000000-0000-4000-8000-000000000010',
  '10000000-0000-4000-8000-000000000001',
  'single_correct', 'approved', 'moderate',
  'Isolated reflection authorization test question', '["A"]'::jsonb
);

insert into public.question_papers (
  id, created_by, title, code, status, duration_minutes, access_mode,
  attempt_limit, result_mode, total_marks, total_questions, published_at
)
values (
  '10000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000001',
  'Isolated Reflection Authorization Paper', 'REFLECTION-AUTHZ-TEST',
  'published', 30, 'public', 3, 'score_only', 4, 1, now()
);

insert into public.paper_sections (id, paper_id, title, display_order)
values (
  '10000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000020',
  'Authorization', 0
);

insert into public.paper_questions (
  id, paper_id, section_id, question_id, display_order, marks,
  negative_marks, question_snapshot
)
values (
  '10000000-0000-4000-8000-000000000022',
  '10000000-0000-4000-8000-000000000020',
  '10000000-0000-4000-8000-000000000021',
  '10000000-0000-4000-8000-000000000010',
  0, 4, 1,
  '{"question_type":"single_correct","correct_answer":["A"],"stem_text":"Authorization fixture"}'::jsonb
);

insert into public.exam_attempts (
  id, paper_id, student_id, attempt_number, status, started_at, expires_at,
  submitted_at, question_order, score, maximum_marks, percentage,
  correct_count, incorrect_count, unanswered_count
)
values
  (
    '10000000-0000-4000-8000-000000000030',
    '10000000-0000-4000-8000-000000000020',
    '10000000-0000-4000-8000-000000000002',
    1, 'submitted', now() - interval '20 minutes', now() + interval '10 minutes', now(),
    array['10000000-0000-4000-8000-000000000022'::uuid], 3, 4, 75, 0, 1, 0
  ),
  (
    '10000000-0000-4000-8000-000000000031',
    '10000000-0000-4000-8000-000000000020',
    '10000000-0000-4000-8000-000000000003',
    1, 'submitted', now() - interval '20 minutes', now() + interval '10 minutes', now(),
    array['10000000-0000-4000-8000-000000000022'::uuid], 4, 4, 100, 1, 0, 0
  ),
  (
    '10000000-0000-4000-8000-000000000032',
    '10000000-0000-4000-8000-000000000020',
    '10000000-0000-4000-8000-000000000002',
    2, 'in_progress', now(), now() + interval '30 minutes', null,
    array['10000000-0000-4000-8000-000000000022'::uuid], 0, 4, 0, 0, 0, 1
  );

insert into public.exam_responses (
  id, attempt_id, paper_question_id, response, time_spent_seconds,
  is_correct, marks_awarded
)
values
  (
    '10000000-0000-4000-8000-000000000040',
    '10000000-0000-4000-8000-000000000030',
    '10000000-0000-4000-8000-000000000022',
    '["B"]'::jsonb, 41, false, -1
  ),
  (
    '10000000-0000-4000-8000-000000000041',
    '10000000-0000-4000-8000-000000000031',
    '10000000-0000-4000-8000-000000000022',
    '["A"]'::jsonb, 22, true, 4
  ),
  (
    '10000000-0000-4000-8000-000000000042',
    '10000000-0000-4000-8000-000000000032',
    '10000000-0000-4000-8000-000000000022',
    '["B"]'::jsonb, 8, null, null
  );

create or replace function pg_temp.set_reflection_auth(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end
$$;

create or replace function pg_temp.expect_failure(p_sql text, p_test_name text)
returns void
language plpgsql
security invoker
as $$
declare
  failed_as_expected boolean := false;
begin
  begin
    execute p_sql;
  exception when others then
    failed_as_expected := true;
  end;

  if not failed_as_expected then
    raise exception 'FAILED: % unexpectedly succeeded', p_test_name;
  end if;
end
$$;

set local role authenticated;
select pg_temp.set_reflection_auth('10000000-0000-4000-8000-000000000002');

-- An authenticated student can save and safely retry their own submitted response.
select public.save_exam_response_reflection_v13(
  '10000000-0000-4000-8000-000000000040', 3, 'concept_gap', null
);
select public.save_exam_response_reflection_v13(
  '10000000-0000-4000-8000-000000000040', 4, 'careless_error', null
);

-- Another student's response and an unsubmitted attempt must be rejected.
select pg_temp.expect_failure(
  $$select public.save_exam_response_reflection_v13(
    '10000000-0000-4000-8000-000000000041', 5, null, null
  )$$,
  'student classifying another student response'
);
select pg_temp.expect_failure(
  $$select public.save_exam_response_reflection_v13(
    '10000000-0000-4000-8000-000000000042', 2, 'guessed', null
  )$$,
  'student classifying an unsubmitted response'
);

-- The enum contract rejects unsupported client values before any write occurs.
select pg_temp.expect_failure(
  $$select public.save_exam_response_reflection_v13(
    '10000000-0000-4000-8000-000000000040',
    4,
    'invented_reason'::public.student_error_classification,
    null
  )$$,
  'unsupported classification value'
);

-- Attempt IDs supplied by the client are authorization checked by the queue RPC.
select pg_temp.expect_failure(
  $$select public.list_post_test_reflection_queue_v13(
    '10000000-0000-4000-8000-000000000031'
  )$$,
  'student loading another student reflection queue'
);
select pg_temp.expect_failure(
  $$select public.list_post_test_reflection_queue_v13(
    '10000000-0000-4000-8000-000000000032'
  )$$,
  'student loading an unsubmitted reflection queue'
);

reset role;

do $$
begin
  if (select count(*) from public.exam_response_self_classifications
      where response_id = '10000000-0000-4000-8000-000000000040') <> 1 then
    raise exception 'FAILED: retry created a duplicate reflection row';
  end if;

  if not exists (
    select 1 from public.exam_response_self_classifications
    where response_id = '10000000-0000-4000-8000-000000000040'
      and student_id = '10000000-0000-4000-8000-000000000002'
      and attempt_id = '10000000-0000-4000-8000-000000000030'
      and confidence_rating = 4
      and classification = 'careless_error'
  ) then
    raise exception 'FAILED: own reflection was not safely updated';
  end if;

  if not exists (
    select 1 from public.exam_attempts
    where id = '10000000-0000-4000-8000-000000000030'
      and status = 'submitted'
      and score = 3
      and maximum_marks = 4
      and percentage = 75
      and correct_count = 0
      and incorrect_count = 1
      and unanswered_count = 0
  ) then
    raise exception 'FAILED: reflection altered the authoritative attempt result';
  end if;

  if not exists (
    select 1 from public.exam_responses
    where id = '10000000-0000-4000-8000-000000000040'
      and response = '["B"]'::jsonb
      and is_correct = false
      and marks_awarded = -1
  ) then
    raise exception 'FAILED: reflection altered the authoritative answer/outcome';
  end if;

end
$$;

set local role authenticated;
select pg_temp.set_reflection_auth('10000000-0000-4000-8000-000000000002');

do $queue_check$
declare
  queue jsonb;
begin
  queue := public.list_post_test_reflection_queue_v13(
    '10000000-0000-4000-8000-000000000030'
  );

  if jsonb_array_length(queue->'items') <> 1
     or queue->'items'->0->>'classification' <> 'careless_error'
     or (queue->'items'->0->>'confidence_rating')::integer <> 4 then
    raise exception 'FAILED: saved reflection cannot be safely resumed';
  end if;

  raise notice 'Post-test reflection authorization tests passed: ownership, submitted status, enum validation, idempotent retry, resume, and score/answer immutability succeeded.';
end
$queue_check$;

reset role;

rollback;
