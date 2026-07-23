-- Evidara V8.1 — configurable academic settings, dynamic import templates and taxonomy governance
-- Run after migration 32.

begin;

create table if not exists public.assessment_options (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  option_group text not null check (option_group in ('grade','exam_type','test_type')),
  value text not null,
  label text not null,
  code text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists assessment_options_scope_value_unique
  on public.assessment_options(option_group, coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(value));
create index if not exists assessment_options_scope_idx
  on public.assessment_options(organization_id, option_group, is_active, display_order);

alter table public.assessment_options enable row level security;

drop policy if exists assessment_options_select_visible on public.assessment_options;
create policy assessment_options_select_visible on public.assessment_options
for select to authenticated
using (
  organization_id is null
  or public.is_evidara_super_admin()
  or exists (
    select 1 from public.organization_members membership
    where membership.organization_id = assessment_options.organization_id
      and membership.user_id = auth.uid()
      and membership.is_active = true
  )
);

-- Settings are changed through authenticated server routes after Super Admin verification.
revoke insert, update, delete on public.assessment_options from authenticated;
grant select on public.assessment_options to authenticated;
grant all on public.assessment_options to service_role;

insert into public.assessment_options(option_group,value,label,display_order)
values
  ('grade','Grade 7','Grade 7',10),
  ('grade','Grade 8','Grade 8',20),
  ('grade','Grade 9','Grade 9',30),
  ('grade','Grade 10','Grade 10',40),
  ('grade','Grade 11','Grade 11',50),
  ('grade','Grade 12','Grade 12',60),
  ('grade','NEET Long Term','NEET Long Term',70),
  ('grade','JEE Long Term','JEE Long Term',80),
  ('exam_type','NEET','NEET',10),
  ('exam_type','JEE Main','JEE Main',20),
  ('exam_type','JEE Advanced','JEE Advanced',30),
  ('exam_type','KCET','KCET',40),
  ('exam_type','School MCQ','School MCQ',50),
  ('exam_type','Olympiad','Olympiad',60),
  ('exam_type','Foundation','Foundation',70),
  ('exam_type','Scholarship Exam','Scholarship Exam',80),
  ('exam_type','Board','Board',90),
  ('test_type','full_length_mock','Full-length mock test',10),
  ('test_type','subject_test','Subject test',20),
  ('test_type','chapter_test','Chapter test',30),
  ('test_type','topic_test','Topic test',40),
  ('test_type','unit_test','Unit test',50),
  ('test_type','diagnostic_test','Diagnostic test',60),
  ('test_type','scholarship_test','Scholarship test',70),
  ('test_type','previous_year_paper','Previous-year paper',80),
  ('test_type','practice_test','Practice test',90),
  ('test_type','foundation_test','Foundation test',100),
  ('test_type','school_test','School test',110),
  ('test_type','custom_test','Custom test',120)
on conflict do nothing;

insert into public.subjects(organization_id,code,name,exam_types,is_active)
values(null,'LR','Logical Reasoning','{Foundation,Olympiad,Scholarship Exam,School MCQ}'::text[],true)
on conflict do nothing;

update public.subjects
set name='Logical Reasoning',
    exam_types=array(select distinct value from unnest(coalesce(exam_types,'{}'::text[]) || array['Foundation','Olympiad','Scholarship Exam','School MCQ']) as value),
    is_active=true
where organization_id is null and code='LR';

-- Biology remains one subject. Division is stored independently so Botany and Zoology
-- can use their own chapters/topics while still rolling up to Biology analytics.
update public.questions
set metadata = (coalesce(metadata,'{}'::jsonb) - 'test_type' - 'custom_test_type')
where coalesce(metadata,'{}'::jsonb) ?| array['test_type','custom_test_type'];

create or replace function public.bulk_manage_question_taxonomy_v8(
  p_entity text,
  p_action text,
  p_ids uuid[],
  p_parent_id uuid default null,
  p_name text default null,
  p_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_deleted uuid[] := '{}';
  v_archived uuid[] := '{}';
  v_updated uuid[] := '{}';
  v_referenced boolean;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can alter or delete academic settings.' using errcode='42501';
  end if;
  if p_entity not in ('subject','chapter','topic') then raise exception 'Unsupported taxonomy entity.'; end if;
  if coalesce(array_length(p_ids,1),0)=0 then raise exception 'Select at least one item.'; end if;

  if p_action='rename' then
    if array_length(p_ids,1)<>1 or length(btrim(coalesce(p_name,'')))<2 then raise exception 'Choose one item and enter a valid name.'; end if;
    if p_entity='subject' then
      update public.subjects set name=btrim(p_name), code=coalesce(nullif(upper(btrim(p_code)),''),code) where id=p_ids[1];
    elsif p_entity='chapter' then
      update public.chapters set name=btrim(p_name) where id=p_ids[1];
    else
      update public.topics set name=btrim(p_name) where id=p_ids[1];
    end if;
    v_updated := p_ids;
  elsif p_action='move' then
    if p_parent_id is null then raise exception 'Choose the new parent.'; end if;
    if p_entity='chapter' then
      update public.chapters set subject_id=p_parent_id where id=any(p_ids);
    elsif p_entity='topic' then
      update public.topics set chapter_id=p_parent_id where id=any(p_ids);
    else
      raise exception 'Subjects cannot be moved.';
    end if;
    v_updated := p_ids;
  elsif p_action='restore' then
    if p_entity='subject' then update public.subjects set is_active=true where id=any(p_ids);
    elsif p_entity='chapter' then update public.chapters set is_active=true where id=any(p_ids);
    else update public.topics set is_active=true where id=any(p_ids);
    end if;
    v_updated := p_ids;
  elsif p_action='delete' then
    foreach v_id in array p_ids loop
      if p_entity='topic' then
        select exists(select 1 from public.questions where topic_id=v_id) into v_referenced;
        if v_referenced then update public.topics set is_active=false where id=v_id; v_archived:=array_append(v_archived,v_id);
        else delete from public.topics where id=v_id; v_deleted:=array_append(v_deleted,v_id); end if;
      elsif p_entity='chapter' then
        select exists(select 1 from public.questions where chapter_id=v_id) or exists(select 1 from public.topics where chapter_id=v_id) into v_referenced;
        if v_referenced then update public.chapters set is_active=false where id=v_id; v_archived:=array_append(v_archived,v_id);
        else delete from public.chapters where id=v_id; v_deleted:=array_append(v_deleted,v_id); end if;
      else
        select exists(select 1 from public.questions where subject_id=v_id)
          or exists(select 1 from public.chapters where subject_id=v_id)
          or exists(select 1 from public.paper_sections where subject_id=v_id)
        into v_referenced;
        if v_referenced then update public.subjects set is_active=false where id=v_id; v_archived:=array_append(v_archived,v_id);
        else delete from public.subjects where id=v_id; v_deleted:=array_append(v_deleted,v_id); end if;
      end if;
    end loop;
  else
    raise exception 'Unsupported taxonomy action.';
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,'taxonomy.'||p_action,p_entity,array_to_string(p_ids,','),jsonb_build_object('deleted',v_deleted,'archived',v_archived,'updated',v_updated));
  return jsonb_build_object('deleted',v_deleted,'archived',v_archived,'updated',v_updated);
end;
$$;

grant execute on function public.bulk_manage_question_taxonomy_v8(text,text,uuid[],uuid,text,text) to authenticated,service_role;

commit;
