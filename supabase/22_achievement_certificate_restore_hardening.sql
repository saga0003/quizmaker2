-- Evidara V6.7: certificate restoration and reissue hardening.
-- Apply after 21_achievement_concurrency_hardening.sql.

create or replace function public.set_achievement_certificate_status(
  p_certificate_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_certificate public.achievement_certificates%rowtype;
  v_achievement public.student_achievements%rowtype;
  v_other_active uuid;
begin
  if p_status not in ('active','revoked') then
    raise exception 'Unsupported certificate status.';
  end if;

  select * into v_certificate
  from public.achievement_certificates
  where id = p_certificate_id
  for update;

  if not found then raise exception 'Certificate not found.'; end if;

  if not (
    auth.uid() = v_certificate.student_id
    or public.is_school_manager(v_certificate.organization_id)
    or public.is_super_admin()
  ) then
    raise exception 'Certificate-management permission required.';
  end if;

  if v_certificate.status = p_status then return; end if;

  if p_status = 'active' then
    if not public.is_super_admin() then
      raise exception 'Only Super Admin can restore a revoked certificate.';
    end if;

    select * into v_achievement
    from public.student_achievements
    where id = v_certificate.achievement_id
    for update;

    if not found or v_achievement.status <> 'active' then
      raise exception 'Restore the linked achievement before restoring this certificate.';
    end if;

    select id into v_other_active
    from public.achievement_certificates
    where achievement_id = v_certificate.achievement_id
      and status = 'active'
      and id <> v_certificate.id
    limit 1
    for update;

    if v_other_active is not null then
      raise exception 'A newer active certificate already exists for this achievement. Revoke it before restoring this historical certificate.';
    end if;
  end if;

  update public.achievement_certificates
  set status = p_status,
      revoked_at = case when p_status = 'revoked' then now() else null end,
      revoked_by = case when p_status = 'revoked' then auth.uid() else null end,
      revoked_reason = case
        when p_status = 'revoked' then coalesce(nullif(trim(p_reason), ''), 'certificate_withdrawn')
        else null
      end,
      updated_at = now()
  where id = p_certificate_id;

  insert into public.achievement_audit_events(
    achievement_id,
    certificate_id,
    student_id,
    organization_id,
    actor_id,
    event_type,
    details
  ) values (
    v_certificate.achievement_id,
    v_certificate.id,
    v_certificate.student_id,
    v_certificate.organization_id,
    auth.uid(),
    'certificate.status_changed',
    jsonb_build_object(
      'from_status', v_certificate.status,
      'to_status', p_status,
      'reason', p_reason,
      'historical_certificate_restored', p_status = 'active'
    )
  );
end;
$$;

grant execute on function public.set_achievement_certificate_status(uuid,text,text) to authenticated;

comment on function public.set_achievement_certificate_status(uuid,text,text) is
  'Withdraws certificates or, under Super Admin control, restores one historical certificate only when its achievement is active and no replacement certificate is active.';
