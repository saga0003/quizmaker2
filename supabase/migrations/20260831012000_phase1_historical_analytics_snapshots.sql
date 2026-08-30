-- Evidara Phase 1 P0.6: immutable test-time taxonomy for historical analytics.
--
-- A published/tested paper must remain analytically reproducible even if the
-- source question is later reclassified. paper_questions.question_snapshot is
-- therefore enriched at insert/update time with subject/chapter/topic IDs AND
-- display names. Analytics reads prefer the frozen snapshot and use live
-- question/taxonomy rows only as compatibility fallback for pre-migration data.

create or replace function public.freeze_paper_question_taxonomy_v20()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_snapshot jsonb := coalesce(new.question_snapshot, '{}'::jsonb);
  v_question public.questions%rowtype;
  v_section_subject uuid;
  v_subject_id uuid;
  v_chapter_id uuid;
  v_topic_id uuid;
  v_subject_name text;
  v_chapter_name text;
  v_topic_name text;
begin
  if new.question_id is not null then
    select * into v_question from public.questions where id = new.question_id;
  end if;

  if new.section_id is not null then
    select subject_id into v_section_subject
    from public.paper_sections
    where id = new.section_id;
  end if;

  begin
    v_subject_id := nullif(v_snapshot->>'subject_id','')::uuid;
  exception when others then
    v_subject_id := null;
  end;
  begin
    v_chapter_id := nullif(v_snapshot->>'chapter_id','')::uuid;
  exception when others then
    v_chapter_id := null;
  end;
  begin
    v_topic_id := nullif(v_snapshot->>'topic_id','')::uuid;
  exception when others then
    v_topic_id := null;
  end;

  v_subject_id := coalesce(v_subject_id, v_question.subject_id, v_section_subject);
  v_chapter_id := coalesce(v_chapter_id, v_question.chapter_id);
  v_topic_id := coalesce(v_topic_id, v_question.topic_id);

  if v_subject_id is not null then
    select name into v_subject_name from public.subjects where id = v_subject_id;
  end if;
  if v_chapter_id is not null then
    select name into v_chapter_name from public.chapters where id = v_chapter_id;
  end if;
  if v_topic_id is not null then
    select name into v_topic_name from public.topics where id = v_topic_id;
  end if;

  if not (v_snapshot ? 'subject_id') then
    v_snapshot := jsonb_set(v_snapshot, '{subject_id}', coalesce(to_jsonb(v_subject_id), 'null'::jsonb), true);
  end if;
  if not (v_snapshot ? 'subject_name') then
    v_snapshot := jsonb_set(v_snapshot, '{subject_name}', coalesce(to_jsonb(v_subject_name), 'null'::jsonb), true);
  end if;
  if not (v_snapshot ? 'chapter_id') then
    v_snapshot := jsonb_set(v_snapshot, '{chapter_id}', coalesce(to_jsonb(v_chapter_id), 'null'::jsonb), true);
  end if;
  if not (v_snapshot ? 'chapter_name') then
    v_snapshot := jsonb_set(v_snapshot, '{chapter_name}', coalesce(to_jsonb(v_chapter_name), 'null'::jsonb), true);
  end if;
  if not (v_snapshot ? 'topic_id') then
    v_snapshot := jsonb_set(v_snapshot, '{topic_id}', coalesce(to_jsonb(v_topic_id), 'null'::jsonb), true);
  end if;
  if not (v_snapshot ? 'topic_name') then
    v_snapshot := jsonb_set(v_snapshot, '{topic_name}', coalesce(to_jsonb(v_topic_name), 'null'::jsonb), true);
  end if;
  if not (v_snapshot ? 'taxonomy_snapshot_version') then
    v_snapshot := jsonb_set(v_snapshot, '{taxonomy_snapshot_version}', '1'::jsonb, true);
  end if;

  new.question_snapshot := v_snapshot;
  return new;
end;
$$;

revoke all on function public.freeze_paper_question_taxonomy_v20() from public, anon, authenticated;

DROP TRIGGER IF EXISTS phase1_freeze_paper_question_taxonomy_v20 ON public.paper_questions;
create trigger phase1_freeze_paper_question_taxonomy_v20
before insert or update of question_id, section_id, question_snapshot
on public.paper_questions
for each row execute function public.freeze_paper_question_taxonomy_v20();

-- Best-effort compatibility backfill. At the time this migration was introduced
-- production had no paper_questions, so no real student history is being
-- rewritten. On any restored/older environment we only fill fields that are
-- absent and never overwrite taxonomy already frozen in the snapshot.
update public.paper_questions pq
set question_snapshot =
  coalesce(pq.question_snapshot, '{}'::jsonb)
  || case when coalesce(pq.question_snapshot,'{}'::jsonb) ? 'subject_id' then '{}'::jsonb else jsonb_build_object('subject_id', coalesce(nullif(pq.question_snapshot->>'subject_id','')::uuid, q.subject_id, ps.subject_id)) end
  || case when coalesce(pq.question_snapshot,'{}'::jsonb) ? 'subject_name' then '{}'::jsonb else jsonb_build_object('subject_name', s.name) end
  || case when coalesce(pq.question_snapshot,'{}'::jsonb) ? 'chapter_id' then '{}'::jsonb else jsonb_build_object('chapter_id', q.chapter_id) end
  || case when coalesce(pq.question_snapshot,'{}'::jsonb) ? 'chapter_name' then '{}'::jsonb else jsonb_build_object('chapter_name', c.name) end
  || case when coalesce(pq.question_snapshot,'{}'::jsonb) ? 'topic_id' then '{}'::jsonb else jsonb_build_object('topic_id', q.topic_id) end
  || case when coalesce(pq.question_snapshot,'{}'::jsonb) ? 'topic_name' then '{}'::jsonb else jsonb_build_object('topic_name', t.name) end
  || case when coalesce(pq.question_snapshot,'{}'::jsonb) ? 'taxonomy_snapshot_version' then '{}'::jsonb else jsonb_build_object('taxonomy_snapshot_version', 1) end
from public.questions q
left join public.paper_sections ps on ps.id = pq.section_id
left join public.subjects s on s.id = coalesce(nullif(pq.question_snapshot->>'subject_id','')::uuid, q.subject_id, ps.subject_id)
left join public.chapters c on c.id = coalesce(nullif(pq.question_snapshot->>'chapter_id','')::uuid, q.chapter_id)
left join public.topics t on t.id = coalesce(nullif(pq.question_snapshot->>'topic_id','')::uuid, q.topic_id)
where q.id = pq.question_id
  and (
    not (coalesce(pq.question_snapshot,'{}'::jsonb) ? 'subject_name')
    or not (coalesce(pq.question_snapshot,'{}'::jsonb) ? 'chapter_name')
    or not (coalesce(pq.question_snapshot,'{}'::jsonb) ? 'topic_name')
    or not (coalesce(pq.question_snapshot,'{}'::jsonb) ? 'taxonomy_snapshot_version')
  );

-- Patch the live student analytics contract so snapshot taxonomy wins over
-- mutable question-bank taxonomy. Fail migration loudly if expected source
-- fragments drift, rather than silently leaving historical analytics mutable.
do $$
declare
  v_def text;
  v_oid oid;
  old_fragment text;
  new_fragment text;
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_live_student_analytics_v12'
  order by p.oid desc limit 1;
  if v_oid is null then raise exception 'get_live_student_analytics_v12 not found'; end if;
  v_def := pg_get_functiondef(v_oid);

  old_fragment := 'coalesce(question.subject_id, section_row.subject_id) as subject_id,';
  new_fragment := 'coalesce(nullif(paper_question.question_snapshot->>''subject_id'','''')::uuid, question.subject_id, section_row.subject_id) as subject_id,';
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 subject-id analytics fragment drifted'; end if;
  v_def := replace(v_def, old_fragment, new_fragment);

  old_fragment := 'coalesce(subject.name, section_subject.name, paper_question.question_snapshot->>''subject_name'', section_row.title, ''General'') as subject_name,';
  new_fragment := 'coalesce(nullif(paper_question.question_snapshot->>''subject_name'',''''), subject.name, section_subject.name, section_row.title, ''General'') as subject_name,';
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 subject-name analytics fragment drifted'; end if;
  v_def := replace(v_def, old_fragment, new_fragment);

  old_fragment := 'question.chapter_id,';
  new_fragment := 'coalesce(nullif(paper_question.question_snapshot->>''chapter_id'','''')::uuid, question.chapter_id) as chapter_id,';
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 chapter-id analytics fragment drifted'; end if;
  v_def := replace(v_def, old_fragment, new_fragment);

  old_fragment := 'coalesce(chapter.name, paper_question.question_snapshot->>''chapter_name'', ''Unassigned chapter'') as chapter_name,';
  new_fragment := 'coalesce(nullif(paper_question.question_snapshot->>''chapter_name'',''''), chapter.name, ''Unassigned chapter'') as chapter_name,';
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 chapter-name analytics fragment drifted'; end if;
  v_def := replace(v_def, old_fragment, new_fragment);

  old_fragment := 'question.topic_id,';
  new_fragment := 'coalesce(nullif(paper_question.question_snapshot->>''topic_id'','''')::uuid, question.topic_id) as topic_id,';
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 topic-id analytics fragment drifted'; end if;
  v_def := replace(v_def, old_fragment, new_fragment);

  old_fragment := 'coalesce(topic.name, paper_question.question_snapshot->>''topic_name'', ''Unassigned topic'') as topic_name,';
  new_fragment := 'coalesce(nullif(paper_question.question_snapshot->>''topic_name'',''''), topic.name, ''Unassigned topic'') as topic_name,';
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 topic-name analytics fragment drifted'; end if;
  v_def := replace(v_def, old_fragment, new_fragment);

  old_fragment := 'coalesce(question.difficulty::text, paper_question.question_snapshot->>''difficulty'', ''moderate'') as difficulty,';
  new_fragment := 'coalesce(nullif(paper_question.question_snapshot->>''difficulty'',''''), question.difficulty::text, ''moderate'') as difficulty,';
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 difficulty analytics fragment drifted'; end if;
  v_def := replace(v_def, old_fragment, new_fragment);

  execute v_def;
end $$;

-- Answer review must show the test-time subject label rather than a later rename.
do $$
declare
  v_def text;
  v_oid oid;
  old_fragment text := '''subject_name'', coalesce(subject.name, paper_section.title, paper_question.question_snapshot->>''subject_name'', ''General'')';
  new_fragment text := '''subject_name'', coalesce(nullif(paper_question.question_snapshot->>''subject_name'',''''), subject.name, paper_section.title, ''General'')';
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_student_test_review_v12'
  order by p.oid desc limit 1;
  if v_oid is null then raise exception 'get_student_test_review_v12 not found'; end if;
  v_def := pg_get_functiondef(v_oid);
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 test-review subject fragment drifted'; end if;
  execute replace(v_def, old_fragment, new_fragment);
end $$;

-- Reflection analytics must follow the topic captured in the paper snapshot.
do $$
declare
  v_def text;
  v_oid oid;
  old_fragment text := 'and q.topic_id = p_topic_id';
  new_fragment text := 'and coalesce(nullif(pq.question_snapshot->>''topic_id'','''')::uuid, q.topic_id) = p_topic_id';
begin
  select p.oid into v_oid
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='get_topic_reflection_analytics_v13'
  order by p.oid desc limit 1;
  if v_oid is null then raise exception 'get_topic_reflection_analytics_v13 not found'; end if;
  v_def := pg_get_functiondef(v_oid);
  if position(old_fragment in v_def)=0 then raise exception 'P0.6 topic-reflection fragment drifted'; end if;
  execute replace(v_def, old_fragment, new_fragment);
end $$;

comment on function public.freeze_paper_question_taxonomy_v20()
is 'Freezes paper-question subject/chapter/topic identity and names for reproducible historical analytics.';
