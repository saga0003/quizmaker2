-- Evidara V6.7: immutable evidence-change history.
-- Apply after 19_achievement_uuid_aggregate_compatibility.sql.

create or replace function public.audit_student_achievement_evidence_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.rule_version is distinct from new.rule_version
     or old.source_type is distinct from new.source_type
     or old.source_id is distinct from new.source_id
     or old.evidence is distinct from new.evidence then
    insert into public.achievement_audit_events(
      achievement_id,
      student_id,
      organization_id,
      actor_id,
      event_type,
      details
    ) values (
      new.id,
      new.student_id,
      new.organization_id,
      auth.uid(),
      'achievement.evidence_re_evaluated',
      jsonb_build_object(
        'previous_rule_version', old.rule_version,
        'rule_version', new.rule_version,
        'previous_source_type', old.source_type,
        'source_type', new.source_type,
        'previous_source_id', old.source_id,
        'source_id', new.source_id,
        'previous_evidence', old.evidence,
        'evidence', new.evidence,
        'evaluated_at', new.last_evaluated_at
      )
    );
  end if;
  return new;
end;
$$;

revoke all on function public.audit_student_achievement_evidence_change() from public, anon, authenticated;
grant execute on function public.audit_student_achievement_evidence_change() to service_role;

drop trigger if exists student_achievement_evidence_audit on public.student_achievements;
create trigger student_achievement_evidence_audit
after update of rule_version, source_type, source_id, evidence
on public.student_achievements
for each row
execute function public.audit_student_achievement_evidence_change();

comment on function public.audit_student_achievement_evidence_change() is
  'Preserves the previous and current rule version, source and observed values whenever an achievement is re-evaluated.';
