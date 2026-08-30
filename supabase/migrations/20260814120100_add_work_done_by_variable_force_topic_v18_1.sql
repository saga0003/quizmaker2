-- Evidara V18.1 taxonomy addition used by Re-NEET 2026 variable-friction PYQ.
insert into public.topics(chapter_id,name,display_order,is_active)
select c.id,'Work done by variable force',coalesce((select max(t.display_order)+1 from public.topics t where t.chapter_id=c.id),1),true
from public.chapters c
join public.subjects s on s.id=c.subject_id
where lower(s.name)='physics' and lower(c.name)='work, energy and power'
and not exists(select 1 from public.topics t where t.chapter_id=c.id and lower(t.name)=lower('Work done by variable force'));
