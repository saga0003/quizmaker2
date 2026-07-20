-- Evidara V6.7: concurrency-safe first award creation.
-- Apply after 20_achievement_evidence_audit_hardening.sql.

create or replace function public.achievement_award_lock_key(
  p_student_id uuid,
  p_organization_id uuid,
  p_definition_code text
)
returns bigint
language sql
immutable
parallel safe
as $$
  select hashtextextended(
    p_student_id::text || ':' || p_organization_id::text || ':' || coalesce(p_definition_code, ''),
    0
  )
$$;

revoke all on function public.achievement_award_lock_key(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.achievement_award_lock_key(uuid,uuid,text) to service_role;

create or replace function public.sync_achievement_award(
  p_student_id uuid,
  p_organization_id uuid,
  p_definition_code text,
  p_qualifies boolean,
  p_source_type text,
  p_source_id uuid,
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_definition public.achievement_definitions%rowtype;
  v_existing public.student_achievements%rowtype;
  v_id uuid;
begin
  -- A SELECT FOR UPDATE cannot lock a row that does not exist. Serialise the
  -- first insert for this exact learner, school and rule so overlapping exam,
  -- refresh and backfill evaluations cannot race into the unique constraint.
  perform pg_advisory_xact_lock(
    public.achievement_award_lock_key(p_student_id, p_organization_id, p_definition_code)
  );

  select * into v_definition
  from public.achievement_definitions
  where code = p_definition_code and is_active = true;
  if not found then return null; end if;

  select * into v_existing
  from public.student_achievements
  where student_id = p_student_id
    and organization_id = p_organization_id
    and definition_code = p_definition_code
  for update;

  if p_qualifies then
    if not found then
      insert into public.student_achievements(
        student_id, organization_id, definition_code, rule_version,
        source_type, source_id, evidence, status, awarded_at, last_evaluated_at
      ) values (
        p_student_id, p_organization_id, p_definition_code, v_definition.rule_version,
        p_source_type, p_source_id, coalesce(p_evidence, '{}'::jsonb), 'active', now(), now()
      ) returning id into v_id;

      insert into public.achievement_audit_events(
        achievement_id, student_id, organization_id, actor_id, event_type, details
      ) values (
        v_id, p_student_id, p_organization_id, auth.uid(), 'achievement.awarded',
        jsonb_build_object('definition_code', p_definition_code, 'rule_version', v_definition.rule_version, 'evidence', p_evidence)
      );
      return v_id;
    end if;

    update public.student_achievements
    set rule_version = v_definition.rule_version,
        source_type = p_source_type,
        source_id = p_source_id,
        evidence = coalesce(p_evidence, '{}'::jsonb),
        status = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then 'active'
          else v_existing.status
        end,
        revoked_at = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then null
          else v_existing.revoked_at
        end,
        revoked_by = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then null
          else v_existing.revoked_by
        end,
        revoked_reason = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then null
          else v_existing.revoked_reason
        end,
        last_evaluated_at = now(),
        updated_at = now()
    where id = v_existing.id
    returning id into v_id;

    if v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then
      insert into public.achievement_audit_events(
        achievement_id, student_id, organization_id, actor_id, event_type, details
      ) values (
        v_id, p_student_id, p_organization_id, auth.uid(), 'achievement.automatically_restored',
        jsonb_build_object('definition_code', p_definition_code, 'evidence', p_evidence)
      );
    end if;
    return v_id;
  end if;

  if found then
    if v_existing.status = 'active' then
      update public.student_achievements
      set status = 'revoked',
          revoked_at = now(),
          revoked_by = null,
          revoked_reason = 'automatic_evidence_no_longer_valid',
          last_evaluated_at = now(),
          updated_at = now()
      where id = v_existing.id;

      update public.achievement_certificates
      set status = 'revoked',
          revoked_at = now(),
          revoked_by = null,
          revoked_reason = 'achievement_evidence_no_longer_valid',
          updated_at = now()
      where achievement_id = v_existing.id and status = 'active';

      insert into public.achievement_audit_events(
        achievement_id, student_id, organization_id, actor_id, event_type, details
      ) values (
        v_existing.id, p_student_id, p_organization_id, auth.uid(), 'achievement.automatically_revoked',
        jsonb_build_object('definition_code', p_definition_code)
      );
    else
      update public.student_achievements
      set last_evaluated_at = now(), updated_at = now()
      where id = v_existing.id;
    end if;
    return v_existing.id;
  end if;

  return null;
end;
$$;

revoke all on function public.sync_achievement_award(uuid,uuid,text,boolean,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.sync_achievement_award(uuid,uuid,text,boolean,text,uuid,jsonb) to service_role;

comment on function public.achievement_award_lock_key(uuid,uuid,text) is
  'Stable transaction-lock key that serialises the first achievement insert for one learner, school and rule.';
