-- Evidara V13: student confidence, topic reflection analytics and question intelligence
alter table public.exam_response_self_classifications
  alter column classification drop not null;

alter table public.exam_response_self_classifications
  add column if not exists confidence_rating smallint,
  add column if not exists confidence_recorded_at timestamptz;

alter table public.exam_response_self_classifications
  drop constraint if exists response_confidence_rating_range;
alter table public.exam_response_self_classifications
  add constraint response_confidence_rating_range
  check (confidence_rating is null or confidence_rating between 1 and 5);

create or replace function public.save_exam_response_reflection_v13(
  p_response_id uuid,
  p_confidence_rating smallint,
  p_classification public.student_error_classification default null,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_response public.exam_responses%rowtype; v_attempt public.exam_attempts%rowtype;
begin
  if p_confidence_rating is null or p_confidence_rating < 1 or p_confidence_rating > 5 then
    raise exception 'Confidence rating must be between 1 and 5';
  end if;
  select * into v_response from public.exam_responses where id=p_response_id;
  if not found then raise exception 'Response not found'; end if;
  select * into v_attempt from public.exam_attempts where id=v_response.attempt_id;
  if v_attempt.student_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if v_attempt.status <> 'submitted' then raise exception 'Reflection is available only after submission'; end if;
  if coalesce(v_response.is_correct,false)=true and p_classification is not null then
    raise exception 'Correct responses cannot have an error classification';
  end if;
  insert into public.exam_response_self_classifications(
    response_id,attempt_id,student_id,classification,note,confidence_rating,confidence_recorded_at
  ) values(
    p_response_id,v_attempt.id,v_attempt.student_id,p_classification,nullif(btrim(p_note),''),p_confidence_rating,now()
  ) on conflict(response_id) do update set
    classification=case when coalesce(v_response.is_correct,false)=true then null else excluded.classification end,
    note=excluded.note,
    confidence_rating=excluded.confidence_rating,
    confidence_recorded_at=now(),updated_at=now();
  return jsonb_build_object('saved',true,'response_id',p_response_id,'confidence_rating',p_confidence_rating,'classification',p_classification);
end $$;
revoke all on function public.save_exam_response_reflection_v13(uuid,smallint,public.student_error_classification,text) from public;
grant execute on function public.save_exam_response_reflection_v13(uuid,smallint,public.student_error_classification,text) to authenticated;

create or replace function public.list_post_test_reflection_queue_v13(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_attempt public.exam_attempts%rowtype;
begin
 select * into v_attempt from public.exam_attempts where id=p_attempt_id;
 if not found or v_attempt.student_id<>auth.uid() then raise exception 'Not allowed'; end if;
 if v_attempt.status<>'submitted' then raise exception 'Attempt is not submitted'; end if;
 return jsonb_build_object('attempt_id',p_attempt_id,'items',coalesce((
   select jsonb_agg(jsonb_build_object(
     'response_id',r.id,'paper_question_id',r.paper_question_id,
     'is_correct',coalesce(r.is_correct,false),'is_skipped',(r.response is null),
     'time_spent_seconds',r.time_spent_seconds,'classification',c.classification,
     'confidence_rating',c.confidence_rating,'note',c.note
   ) order by r.saved_at)
   from public.exam_responses r left join public.exam_response_self_classifications c on c.response_id=r.id
   where r.attempt_id=p_attempt_id
 ),'[]'::jsonb));
end $$;
revoke all on function public.list_post_test_reflection_queue_v13(uuid) from public;
grant execute on function public.list_post_test_reflection_queue_v13(uuid) to authenticated;

create or replace function public.get_topic_reflection_analytics_v13(p_student_id uuid, p_topic_id uuid)
returns jsonb language sql security definer set search_path=public stable as $$
with eligible as (
  select r.id, coalesce(r.is_correct,false) is_correct, (r.response is null) is_skipped,
         r.time_spent_seconds, c.confidence_rating, c.classification
  from public.exam_responses r
  join public.exam_attempts a on a.id=r.attempt_id and a.status='submitted'
  join public.paper_questions pq on pq.id=r.paper_question_id
  join public.questions q on q.id=pq.question_id
  left join public.exam_response_self_classifications c on c.response_id=r.id
  where a.student_id=p_student_id and (p_student_id=auth.uid() or public.is_super_admin())
    and q.topic_id=p_topic_id
), aggregate as (
 select count(*) total_responses,
        count(confidence_rating) confidence_responses,
        round(avg(confidence_rating)::numeric,2) confidence_index,
        round((100.0*sum(case when is_correct then 1 else 0 end)/nullif(count(*),0))::numeric,1) accuracy,
        jsonb_build_object(
          'concept_gap',count(*) filter(where classification='concept_gap'),
          'calculation_error',count(*) filter(where classification='calculation_error'),
          'careless_error',count(*) filter(where classification='careless_error'),
          'guessed',count(*) filter(where classification='guessed'),
          'ran_out_of_time',count(*) filter(where classification='ran_out_of_time'),
          'other',count(*) filter(where classification='other'),
          'unclassified',count(*) filter(where not is_correct and classification is null)
        ) error_breakdown,
        count(*) filter(where not is_correct) reviewable_errors,
        count(classification) filter(where not is_correct) classified_errors
 from eligible
)
select jsonb_build_object(
 'total_responses',total_responses,'confidence_responses',confidence_responses,
 'confidence_index',confidence_index,'accuracy',accuracy,
 'confidence_coverage',round((100.0*confidence_responses/nullif(total_responses,0))::numeric,1),
 'calibration_score',case when confidence_index is null or accuracy is null then null else round(greatest(0,100-abs(accuracy-(confidence_index/5.0*100)))::numeric,1) end,
 'error_breakdown',error_breakdown,'reviewable_errors',reviewable_errors,'classified_errors',classified_errors
) from aggregate;
$$;
revoke all on function public.get_topic_reflection_analytics_v13(uuid,uuid) from public;
grant execute on function public.get_topic_reflection_analytics_v13(uuid,uuid) to authenticated;
