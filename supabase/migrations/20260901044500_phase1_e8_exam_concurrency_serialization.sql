-- Phase 1 E8 preparation: serialize the three mutation boundaries exercised by
-- concurrent exam load.  E8 remains unverified until the real concurrent load
-- acceptance run passes; this migration removes races found during preflight.

do $phase1_e8$
declare
  v_def text;
  v_new text;
  v_needle text;
begin
  select pg_get_functiondef('public.start_exam_attempt(uuid,text)'::regprocedure) into v_def;
  if position('pg_advisory_xact_lock(hashtextextended(p_paper_id::text || '':'' || v_user::text, 0))' in v_def) = 0 then
    v_needle := 'if v_user is null then raise exception ''Login required.''; end if;';
    if position(v_needle in v_def) = 0 then
      raise exception 'E8 start_exam_attempt patch marker not found';
    end if;
    v_new := replace(
      v_def,
      v_needle,
      v_needle || E'\n  -- Serialize starts for one learner + paper so concurrent requests reuse the same active attempt.\n  perform pg_advisory_xact_lock(hashtextextended(p_paper_id::text || '':'' || v_user::text, 0));'
    );
    execute v_new;
  end if;

  select pg_get_functiondef('public.save_exam_response(uuid,uuid,jsonb,boolean,integer)'::regprocedure) into v_def;
  if position('where id=p_attempt_id and student_id=auth.uid() for update;' in replace(v_def, E'\r', '')) = 0 then
    v_needle := 'select status,expires_at into v_status,v_expiry from public.exam_attempts where id=p_attempt_id and student_id=auth.uid();';
    if position(v_needle in replace(v_def, E'\r', '')) = 0 then
      raise exception 'E8 save_exam_response patch marker not found';
    end if;
    v_new := replace(replace(v_def, E'\r', ''), v_needle,
      'select status,expires_at into v_status,v_expiry from public.exam_attempts where id=p_attempt_id and student_id=auth.uid() for update;');
    execute v_new;
  end if;
end;
$phase1_e8$;

-- Keep the mutation boundary least-privileged after replacement.
revoke all on function public.start_exam_attempt(uuid,text) from public;
revoke all on function public.start_exam_attempt(uuid,text) from anon;
grant execute on function public.start_exam_attempt(uuid,text) to authenticated;
revoke all on function public.save_exam_response(uuid,uuid,jsonb,boolean,integer) from public;
revoke all on function public.save_exam_response(uuid,uuid,jsonb,boolean,integer) from anon;
grant execute on function public.save_exam_response(uuid,uuid,jsonb,boolean,integer) to authenticated;
