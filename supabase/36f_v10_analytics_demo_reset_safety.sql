-- Evidara V10 Analytics Phase 2 — demo reset safety
-- Run after 36e_v10_analytics_comparison_engine.sql.

begin;

alter table public.analytics_demo_batches
  add column if not exists previous_tracks text[];

create or replace function public.capture_analytics_demo_previous_tracks_v11()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.previous_tracks is null and new.membership_id is not null then
    select membership.tracks into new.previous_tracks
    from public.student_school_memberships membership
    where membership.id=new.membership_id;
  end if;
  return new;
end;
$$;

drop trigger if exists capture_analytics_demo_previous_tracks_v11 on public.analytics_demo_batches;
create trigger capture_analytics_demo_previous_tracks_v11
before insert on public.analytics_demo_batches
for each row execute function public.capture_analytics_demo_previous_tracks_v11();

do $$
begin
  if to_regprocedure('public.reset_analytics_demo_data_base_v12(text,text,text)') is null then
    if to_regprocedure('public.reset_analytics_demo_data_v10(text,text,text)') is not null then
      execute 'alter function public.reset_analytics_demo_data_v10(text,text,text) rename to reset_analytics_demo_data_base_v12';
    end if;
  end if;
end;
$$;

create or replace function public.reset_analytics_demo_data_v10(
  p_email text,
  p_confirm_email text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_batch public.analytics_demo_batches%rowtype;
  v_result jsonb;
begin
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can reset generated demo data.' using errcode='42501';
  end if;
  if lower(btrim(p_email))<>lower(btrim(p_confirm_email)) then
    raise exception 'The confirmation email does not match the target account.';
  end if;
  if p_confirmation<>'RESET DEMO ANALYTICS' then
    raise exception 'Type RESET DEMO ANALYTICS exactly to confirm the second deletion step.';
  end if;

  select * into v_batch
  from public.analytics_demo_batches
  where lower(target_email)=lower(btrim(p_email)) and status in ('ready','failed','generating')
  order by created_at desc
  limit 1;
  if v_batch.id is null then raise exception 'No generated demo dataset exists for this email.'; end if;

  v_result:=public.reset_analytics_demo_data_base_v12(p_email,p_confirm_email,p_confirmation);

  if v_batch.membership_id is not null and v_batch.previous_tracks is not null then
    update public.student_school_memberships
    set tracks=v_batch.previous_tracks,updated_at=now()
    where id=v_batch.membership_id;
  end if;

  return v_result||jsonb_build_object('original_tracks_restored',v_batch.previous_tracks is not null);
end;
$$;

grant execute on function public.reset_analytics_demo_data_v10(text,text,text) to authenticated;
revoke execute on function public.reset_analytics_demo_data_base_v12(text,text,text) from authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.demo_reset_safety_v11_ready','system','36f_v10_analytics_demo_reset_safety',
  jsonb_build_object('previous_tracks_captured',true,'previous_tracks_restored',true));

commit;
