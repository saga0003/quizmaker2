create or replace function public.sync_question_seo_v15()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_subject text; v_chapter text; v_exam text; v_complete boolean; v_was_published boolean:=false;
begin
  select s.name, c.name into v_subject, v_chapter
  from public.subjects s left join public.chapters c on c.id=new.chapter_id
  where s.id=new.subject_id;
  v_exam := coalesce(new.exam_types[1], 'exam');
  v_complete := new.status='approved'
    and length(trim(coalesce(nullif(trim(new.stem_text),''),new.stem_latex,''))) > 8
    and new.correct_answer is not null and new.correct_answer <> '[]'::jsonb and new.correct_answer <> '{}'::jsonb
    and length(trim(coalesce(nullif(trim(new.solution_text),''),new.solution_latex,''))) > 8
    and lower(coalesce(new.source_rights_status,'')) not in ('restricted','blocked','copyright_blocked','do_not_publish');
  if new.seo_slug is null or new.seo_slug='' then
    new.seo_slug := public.seo_slugify_v15(concat_ws('-',v_exam,v_subject,v_chapter,'question',left(new.id::text,8)));
  end if;
  new.seo_title := coalesce(nullif(new.seo_title,''), concat_ws(' ',v_exam,v_subject,coalesce(v_chapter,''),'Solved Question | Evidara'));
  new.seo_description := coalesce(nullif(new.seo_description,''), left(regexp_replace(coalesce(nullif(trim(new.stem_text),''),new.stem_latex,''),'\s+',' ','g'),145) || ' — answer and detailed solution on Evidara.');
  if tg_op='UPDATE' then v_was_published := old.seo_status='published'; end if;
  new.seo_status := case when v_complete then 'published' else 'draft' end;
  if new.seo_status='published' and (not v_was_published or new.seo_published_at is null) then new.seo_published_at:=now(); end if;
  return new;
end $$;

drop trigger if exists sync_question_seo_v15 on public.questions;
create trigger sync_question_seo_v15 before insert or update on public.questions for each row execute function public.sync_question_seo_v15();
