-- V14.0.1: fix server-only Access Control functions.
-- SECURITY DEFINER changes current_user to the function owner, so authorization
-- is enforced through EXECUTE grants plus API-side authentication/role scope.
create or replace function public.admin_account_directory_service_v14(
  p_actor_id uuid,
  p_organization_id uuid default null::uuid,
  p_search text default null::text,
  p_role text default null::text,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public','auth'
as $$
declare
  v_actor_role text;
  v_actor_org uuid;
  v_page integer:=greatest(coalesce(p_page,1),1);
  v_size integer:=least(100,greatest(coalesce(p_page_size,50),1));
  v_total integer:=0;
  v_accounts jsonb:='[]'::jsonb;
begin
  select role::text into v_actor_role from public.profiles where id=p_actor_id;
  if v_actor_role is null then raise exception 'Actor profile not found.' using errcode='P0002'; end if;
  if v_actor_role not in ('super_admin','evidara_admin') then
    select organization_id into v_actor_org from public.organization_members
    where user_id=p_actor_id and is_active=true and member_role::text in ('institute_owner','institute_admin','school_owner','school_admin')
    order by created_at limit 1;
    if v_actor_org is null then raise exception 'Access Control permission is required.' using errcode='42501'; end if;
    if p_organization_id is not null and p_organization_id<>v_actor_org then raise exception 'School Admin can view only their own school.' using errcode='42501'; end if;
    p_organization_id:=v_actor_org;
  end if;
  with filtered as (
    select p.id,p.full_name,p.phone,p.role::text role,p.avatar_url,p.created_at,u.email,u.last_sign_in_at
    from public.profiles p left join auth.users u on u.id=p.id
    where (p_organization_id is null
      or exists(select 1 from public.organization_members m where m.user_id=p.id and m.organization_id=p_organization_id and m.is_active=true)
      or exists(select 1 from public.student_school_memberships sm where sm.student_id=p.id and sm.organization_id=p_organization_id and sm.status='active'))
      and (p_role is null or p.role::text=p_role)
      and (nullif(btrim(coalesce(p_search,'')),'') is null or coalesce(p.full_name,'') ilike '%'||btrim(p_search)||'%' or coalesce(u.email,'') ilike '%'||btrim(p_search)||'%' or coalesce(p.phone,'') ilike '%'||btrim(p_search)||'%')
  ), counted as (select count(*)::integer total from filtered), page_rows as (
    select * from filtered order by lower(coalesce(full_name,email,'')),id offset (v_page-1)*v_size limit v_size
  )
  select counted.total,coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,'full_name',coalesce(r.full_name,split_part(coalesce(r.email,''),'@',1),'Account'),'email',r.email,'phone',r.phone,'role',r.role,
    'avatar_url',r.avatar_url,'created_at',r.created_at,'last_sign_in_at',r.last_sign_in_at,
    'memberships',coalesce((select jsonb_agg(jsonb_build_object('organization_id',m.organization_id,'organization_name',o.name,'role',m.member_role::text,'is_active',m.is_active) order by o.name) from public.organization_members m join public.organizations o on o.id=m.organization_id where m.user_id=r.id),'[]'::jsonb)
  ) order by lower(coalesce(r.full_name,r.email,''))) filter(where r.id is not null),'[]'::jsonb)
  into v_total,v_accounts from counted left join page_rows r on true group by counted.total;
  return jsonb_build_object('accounts',v_accounts,'page',v_page,'pageSize',v_size,'total',v_total,'totalPages',greatest(1,ceil(v_total::numeric/v_size)::integer));
end $$;

revoke all on function public.admin_account_directory_service_v14(uuid,uuid,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.admin_account_directory_service_v14(uuid,uuid,text,text,integer,integer) to service_role;

-- Preserve scoped role-management function, but remove the invalid SECURITY DEFINER current_user guard.
create or replace function public.assign_account_role_service_v14(
  p_actor_id uuid,
  p_user_id uuid,
  p_role text,
  p_organization_id uuid default null::uuid
)
returns void
language plpgsql
security definer
set search_path to 'public','auth'
as $$
declare v_actor text; v_target text; v_role text:=lower(btrim(p_role)); v_actor_org uuid;
begin
  select role::text into v_actor from public.profiles where id=p_actor_id;
  select role::text into v_target from public.profiles where id=p_user_id;
  if v_actor is null or v_target is null then raise exception 'Actor or target profile not found.' using errcode='P0002'; end if;
  if v_actor='super_admin' then
    if v_role not in ('super_admin','evidara_admin','school_admin','school_teacher','student') then raise exception 'Unsupported role.' using errcode='22023'; end if;
  elsif v_actor='evidara_admin' then
    if v_target in ('super_admin','evidara_admin') or v_role not in ('school_admin','school_teacher','student') or p_organization_id is null then raise exception 'Evidara Admin can manage only school-scoped accounts.' using errcode='42501'; end if;
  elsif v_actor='school_admin' then
    select organization_id into v_actor_org from public.organization_members where user_id=p_actor_id and is_active=true and member_role::text in ('school_admin','school_owner','institute_admin','institute_owner') order by created_at limit 1;
    if v_actor_org is null or p_organization_id is distinct from v_actor_org or v_target in ('super_admin','evidara_admin','school_admin') or v_role not in ('school_teacher','student') then raise exception 'School Admin can manage only teachers and students in their own school.' using errcode='42501'; end if;
  else raise exception 'Role management permission is required.' using errcode='42501'; end if;
  perform set_config('app.evidara_role_change_actor_id',p_actor_id::text,true);
  perform set_config('app.evidara_role_change_source','access_control_v14',true);
  update public.profiles set role=v_role::public.app_role where id=p_user_id;
  if v_role in ('school_admin','school_teacher') then
    if p_organization_id is null then raise exception 'School is required for this role.' using errcode='22023'; end if;
    insert into public.organization_members(organization_id,user_id,member_role,is_active)
    values(p_organization_id,p_user_id,v_role::public.organization_member_role,true)
    on conflict(organization_id,user_id) do update set member_role=excluded.member_role,is_active=true,updated_at=now();
  end if;
  perform set_config('app.evidara_role_change_actor_id','',true);
  perform set_config('app.evidara_role_change_source','',true);
end $$;

revoke all on function public.assign_account_role_service_v14(uuid,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.assign_account_role_service_v14(uuid,uuid,text,uuid) to service_role;
