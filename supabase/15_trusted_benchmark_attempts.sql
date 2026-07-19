-- Evidara V6: routable benchmark starts and trusted completed-attempt facts.

create table if not exists public.benchmark_attempt_links(
 id uuid primary key default gen_random_uuid(),
 benchmark_id uuid not null references public.shared_paper_benchmarks(id) on delete cascade,
 attempt_id uuid not null,
 student_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 unique(benchmark_id,attempt_id),unique(attempt_id,student_id)
);
alter table public.benchmark_attempt_links enable row level security;
revoke select,insert,update,delete,truncate,references,trigger on public.benchmark_attempt_links from anon,authenticated;

create or replace function public.get_shared_benchmark_landing(p_share_token uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare b public.shared_paper_benchmarks%rowtype;p public.question_papers%rowtype;s jsonb;
begin
 select * into b from public.shared_paper_benchmarks where share_token=p_share_token and is_active and (opens_at is null or opens_at<=now()) and (closes_at is null or closes_at>=now());
 if b.id is null then return jsonb_build_object('available',false,'reason','benchmark_not_available');end if;
 select * into p from public.question_papers where id=b.paper_id and status::text='published';
 if p.id is null then return jsonb_build_object('available',false,'reason','paper_not_available');end if;
 s:=public.get_shared_benchmark_snapshot(p_share_token);
 return jsonb_build_object('available',true,'benchmark_id',b.id,'share_token',b.share_token,'paper_id',p.id,'paper_title',b.title,'paper_version',b.paper_version,'exam_type',p.exam_type,'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,'opens_at',b.opens_at,'closes_at',b.closes_at,'minimum_sample_size',b.minimum_sample_size,'snapshot',s,'privacy',jsonb_build_object('school_identity_disclosed',false,'student_identity_disclosed',false,'individual_response_disclosed',false));
end;
$$;
revoke all on function public.get_shared_benchmark_landing(uuid) from public;
grant execute on function public.get_shared_benchmark_landing(uuid) to anon,authenticated;

create or replace function public.start_shared_benchmark_attempt(p_share_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare b public.shared_paper_benchmarks%rowtype;v_attempt uuid;
begin
 if auth.uid() is null then raise exception 'Login required.';end if;
 select * into b from public.shared_paper_benchmarks where share_token=p_share_token and is_active and (opens_at is null or opens_at<=now()) and (closes_at is null or closes_at>=now());
 if b.id is null then raise exception 'This shared assessment is not currently available.';end if;
 select public.start_exam_attempt(b.paper_id,null) into v_attempt;
 insert into public.benchmark_attempt_links(benchmark_id,attempt_id,student_id) values(b.id,v_attempt,auth.uid()) on conflict(attempt_id,student_id) do nothing;
 return jsonb_build_object('attempt_id',v_attempt,'benchmark_id',b.id,'paper_id',b.paper_id);
end;
$$;
grant execute on function public.start_shared_benchmark_attempt(uuid) to authenticated;

create or replace function public.record_my_shared_benchmark_attempt(p_benchmark_id uuid,p_attempt_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare b public.shared_paper_benchmarks%rowtype;r record;v_org uuid;
begin
 if auth.uid() is null then raise exception 'Login required.';end if;
 select sb.* into b from public.shared_paper_benchmarks sb join public.benchmark_attempt_links l on l.benchmark_id=sb.id where sb.id=p_benchmark_id and l.attempt_id=p_attempt_id and l.student_id=auth.uid();
 if b.id is null then raise exception 'This attempt is not linked to the shared benchmark.';end if;
 select x.* into r from public.list_my_attempt_results() x where x.attempt_id=p_attempt_id and x.paper_id=b.paper_id and x.submitted_at is not null limit 1;
 if r.attempt_id is null then raise exception 'A completed attempt on this exact paper is required.';end if;
 select m.organization_id into v_org from public.student_school_memberships m where m.student_id=auth.uid() and m.status::text='active' order by m.updated_at desc limit 1;
 insert into public.benchmark_attempt_facts(benchmark_id,attempt_key,student_id,organization_id,score,max_marks,accuracy,is_valid,submitted_at)
 values(b.id,p_attempt_id::text,auth.uid(),v_org,r.score,r.maximum_marks,r.percentage,true,r.submitted_at)
 on conflict(benchmark_id,attempt_key) do update set score=excluded.score,max_marks=excluded.max_marks,accuracy=excluded.accuracy,organization_id=excluded.organization_id,is_valid=true,invalid_reason=null,submitted_at=excluded.submitted_at;
 return true;
end;
$$;
revoke all on function public.record_my_shared_benchmark_attempt(uuid,uuid) from public;
grant execute on function public.record_my_shared_benchmark_attempt(uuid,uuid) to authenticated;

create or replace function public.sync_my_shared_benchmark_facts()
returns integer language plpgsql security definer set search_path=public as $$
declare l record;v_count integer:=0;
begin
 if auth.uid() is null then return 0;end if;
 for l in select benchmark_id,attempt_id from public.benchmark_attempt_links where student_id=auth.uid() loop
  begin
   if public.record_my_shared_benchmark_attempt(l.benchmark_id,l.attempt_id) then v_count:=v_count+1;end if;
  exception when others then null;
  end;
 end loop;
 return v_count;
end;
$$;
grant execute on function public.sync_my_shared_benchmark_facts() to authenticated;

comment on function public.record_my_shared_benchmark_attempt(uuid,uuid) is 'Derives score and validity from the authenticated completed exam attempt. Client-provided marks are never accepted.';
