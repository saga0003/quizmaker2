-- Evidara V6: trusted shared-benchmark access and school controls.
-- Apply after migrations 11, 12 and 13.

drop policy if exists "students may insert own benchmark facts" on public.benchmark_attempt_facts;
revoke insert,update,delete,truncate,references,trigger on public.benchmark_attempt_facts from anon,authenticated;

create or replace function public.list_shareable_school_papers(p_organization_id uuid)
returns table(id uuid,title text,exam_type text,duration_minutes integer,total_marks numeric,total_questions integer,status text,access_mode text)
language sql stable security definer set search_path=public as $$
 select p.id,p.title,p.exam_type,p.duration_minutes,p.total_marks,p.total_questions,p.status::text,p.access_mode::text
 from public.question_papers p
 where p.organization_id=p_organization_id and p.status::text='published' and public.is_school_manager(p_organization_id)
 order by p.updated_at desc,p.title
$$;
grant execute on function public.list_shareable_school_papers(uuid) to authenticated;

create or replace function public.ensure_school_shared_benchmark(p_paper_id uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_paper public.question_papers%rowtype;v_id uuid;
begin
 if auth.uid() is null then raise exception 'Login required.';end if;
 select * into v_paper from public.question_papers where id=p_paper_id;
 if v_paper.id is null then raise exception 'Question paper not found.';end if;
 if v_paper.organization_id is null or not public.is_school_manager(v_paper.organization_id) then raise exception 'School manager permission required.';end if;
 if v_paper.status::text<>'published' then raise exception 'Publish the paper before sharing it.';end if;
 insert into public.shared_paper_benchmarks(paper_id,owner_organization_id,paper_version,title,is_active,minimum_sample_size,opens_at,closes_at,created_by,updated_at)
 values(v_paper.id,v_paper.organization_id,1,v_paper.title,true,20,v_paper.available_from,v_paper.available_until,auth.uid(),now())
 on conflict(paper_id,paper_version) do update set title=excluded.title,opens_at=excluded.opens_at,closes_at=excluded.closes_at,updated_at=now()
 returning id into v_id;
 return v_id;
end;
$$;
grant execute on function public.ensure_school_shared_benchmark(uuid) to authenticated;

create or replace function public.set_shared_benchmark_active(p_benchmark_id uuid,p_is_active boolean)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_org uuid;
begin
 select owner_organization_id into v_org from public.shared_paper_benchmarks where id=p_benchmark_id for update;
 if v_org is null then raise exception 'Shared benchmark not found.';end if;
 if not public.is_school_manager(v_org) then raise exception 'School manager permission required.';end if;
 update public.shared_paper_benchmarks set is_active=p_is_active,updated_at=now() where id=p_benchmark_id;
 return p_is_active;
end;
$$;
grant execute on function public.set_shared_benchmark_active(uuid,boolean) to authenticated;

create or replace function public.list_school_shared_benchmarks(p_organization_id uuid)
returns table(id uuid,paper_id uuid,title text,share_token uuid,paper_version integer,is_active boolean,minimum_sample_size integer,opens_at timestamptz,closes_at timestamptz,created_at timestamptz)
language sql stable security definer set search_path=public as $$
 select b.id,b.paper_id,b.title,b.share_token,b.paper_version,b.is_active,b.minimum_sample_size,b.opens_at,b.closes_at,b.created_at
 from public.shared_paper_benchmarks b where b.owner_organization_id=p_organization_id and public.is_school_manager(p_organization_id)
 order by b.updated_at desc,b.created_at desc
$$;
grant execute on function public.list_school_shared_benchmarks(uuid) to authenticated;
