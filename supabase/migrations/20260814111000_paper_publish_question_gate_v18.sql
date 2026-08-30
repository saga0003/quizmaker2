create or replace function public.guard_and_refresh_paper_before_publish_v18()
returns trigger
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_total integer;
  v_unapproved integer;
  v_marks numeric;
begin
  if new.status in ('approved','published') and old.status is distinct from new.status then
    select count(*), count(*) filter(where q.status <> 'approved'), coalesce(sum(pq.marks),0)
      into v_total,v_unapproved,v_marks
    from public.paper_questions pq
    join public.questions q on q.id=pq.question_id
    where pq.paper_id=new.id;

    if v_total=0 then
      raise exception 'A paper cannot be approved or published without questions.';
    end if;
    if v_unapproved>0 then
      raise exception 'This paper still contains % question(s) that are not approved. Approve or replace them before publishing.',v_unapproved;
    end if;

    update public.paper_questions pq
    set question_snapshot=jsonb_build_object(
      'id',q.id,'stem_text',q.stem_text,'stem_latex',q.stem_latex,'question_image_url',q.question_image_url,
      'passage_text',q.passage_text,'question_type',q.question_type,'difficulty',q.difficulty,
      'correct_answer',q.correct_answer,'solution_text',q.solution_text,'solution_latex',q.solution_latex,
      'subject_id',q.subject_id,'chapter_id',q.chapter_id,'topic_id',q.topic_id,'exam_types',q.exam_types,
      'class_level',q.class_level,'metadata',q.metadata,'version_number',q.version_number,
      'options',coalesce((select jsonb_agg(jsonb_build_object(
        'option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,
        'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order
      ) order by o.display_order) from public.question_options o where o.question_id=q.id),'[]'::jsonb)
    )
    from public.questions q
    where pq.paper_id=new.id and q.id=pq.question_id;

    new.total_questions:=v_total;
    new.total_marks:=v_marks;
    new.settings:=coalesce(new.settings,'{}'::jsonb)||jsonb_build_object('question_snapshots_refreshed_at',now(),'publish_gate','v18');
  end if;
  return new;
end $$;

revoke all on function public.guard_and_refresh_paper_before_publish_v18() from public,anon,authenticated;

drop trigger if exists trg_guard_and_refresh_paper_before_publish_v18 on public.question_papers;
create trigger trg_guard_and_refresh_paper_before_publish_v18
before update of status on public.question_papers
for each row execute function public.guard_and_refresh_paper_before_publish_v18();
