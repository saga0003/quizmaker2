-- Evidara Phase 1 C9: server-side question-bank search/filter/pagination.
-- The browser receives bounded question IDs plus aggregate metadata, never the entire bank.

create or replace function public.search_question_bank_v1(
  p_bank_scope text,
  p_organization_id uuid default null,
  p_only_mine boolean default false,
  p_search text default '',
  p_subject_id uuid default null,
  p_chapter_id uuid default null,
  p_topic_id uuid default null,
  p_status text default null,
  p_difficulty text default null,
  p_grade text default null,
  p_exam text default null,
  p_date_mode text default 'updated',
  p_date_from date default null,
  p_date_to date default null,
  p_sort text default 'recent',
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language sql
stable
security invoker
set search_path = public, auth
as $$
with params as (
  select
    greatest(coalesce(p_page, 1), 1) as page_no,
    least(greatest(coalesce(p_page_size, 20), 1), 100) as page_size,
    lower(trim(coalesce(p_search, ''))) as term
),
base as (
  select q.*,
         s.name as subject_name,
         c.name as chapter_name,
         t.name as topic_name,
         o.name as organization_name
  from public.questions q
  left join public.subjects s on s.id = q.subject_id
  left join public.chapters c on c.id = q.chapter_id
  left join public.topics t on t.id = q.topic_id
  left join public.organizations o on o.id = q.organization_id
  where
    case
      when p_bank_scope = 'platform' then q.organization_id is null
      when p_bank_scope = 'school' and p_organization_id is not null then q.organization_id = p_organization_id
      when p_bank_scope = 'school' then q.organization_id is not null
      else false
    end
    and (not coalesce(p_only_mine, false) or q.created_by = auth.uid())
),
filtered as (
  select b.*
  from base b cross join params p
  where
    (p.term = '' or position(p.term in lower(concat_ws(' ',
      coalesce(b.stem_text, ''), coalesce(b.stem_latex, ''), coalesce(b.solution_text, ''),
      coalesce(b.solution_latex, ''), coalesce(b.correct_answer::text, ''),
      coalesce(b.subject_name, ''), coalesce(b.chapter_name, ''), coalesce(b.topic_name, ''),
      coalesce(array_to_string(b.tags, ' '), ''), coalesce(array_to_string(b.exam_types, ' '), ''),
      coalesce(b.class_level, ''), coalesce(b.organization_name, ''), coalesce(b.source, '')
    ))) > 0
      or exists (
        select 1 from public.question_options qo
        where qo.question_id = b.id
          and position(p.term in lower(concat_ws(' ', coalesce(qo.content_text, ''), coalesce(qo.content_latex, ''), coalesce(qo.image_url, '')))) > 0
      )
    )
    and (p_subject_id is null or b.subject_id = p_subject_id)
    and (p_chapter_id is null or b.chapter_id = p_chapter_id)
    and (p_topic_id is null or b.topic_id = p_topic_id)
    and (p_status is null or b.status::text = p_status)
    and (p_difficulty is null or b.difficulty::text = p_difficulty)
    and (p_grade is null or b.class_level = p_grade)
    and (p_exam is null or p_exam = any(coalesce(b.exam_types, array[]::text[])))
    and (p_date_from is null or (
      case when p_date_mode = 'published' then
        case
          when coalesce(b.metadata->>'published_at','') ~ '^\\d{4}-\\d{2}-\\d{2}([T ][0-9:.+-]+Z?)?$' then (b.metadata->>'published_at')::timestamptz
          when b.status::text = 'approved' then b.updated_at
          else null
        end
      else b.updated_at end
    ) >= p_date_from::timestamptz)
    and (p_date_to is null or (
      case when p_date_mode = 'published' then
        case
          when coalesce(b.metadata->>'published_at','') ~ '^\\d{4}-\\d{2}-\\d{2}([T ][0-9:.+-]+Z?)?$' then (b.metadata->>'published_at')::timestamptz
          when b.status::text = 'approved' then b.updated_at
          else null
        end
      else b.updated_at end
    ) < (p_date_to + 1)::timestamptz)
),
ordered as (
  select f.*
  from filtered f
  order by
    case when p_sort = 'oldest' then f.updated_at end asc,
    case when p_sort = 'subject' then lower(coalesce(f.subject_name,'')) end asc,
    case when p_sort = 'topic' then lower(coalesce(f.topic_name, f.chapter_name,'')) end asc,
    case when p_sort not in ('oldest','subject','topic') then f.updated_at end desc,
    f.id asc
),
paged as (
  select o.id
  from ordered o cross join params p
  offset ((select page_no - 1 from params) * (select page_size from params))
  limit (select page_size from params)
),
base_stats as (
  select
    count(*)::int as total,
    count(*) filter (where status::text = 'approved')::int as approved,
    count(*) filter (where status::text = 'in_review')::int as review,
    count(distinct topic_id) filter (where topic_id is not null)::int as topics
  from base
),
school_groups as (
  select jsonb_agg(jsonb_build_object(
    'id', x.organization_id,
    'name', x.organization_name,
    'count', x.question_count,
    'review', x.review_count,
    'updated', x.updated_at
  ) order by x.organization_name) as value
  from (
    select organization_id, max(organization_name) as organization_name,
           count(*)::int as question_count,
           count(*) filter (where status::text = 'in_review')::int as review_count,
           max(updated_at) as updated_at
    from base
    where p_bank_scope = 'school' and organization_id is not null
    group by organization_id
  ) x
),
facets as (
  select
    coalesce(jsonb_agg(distinct class_level) filter (where class_level is not null), '[]'::jsonb) as grades,
    coalesce((select jsonb_agg(exam order by exam) from (select distinct unnest(coalesce(exam_types,array[]::text[])) exam from base) e where exam <> ''), '[]'::jsonb) as exams
  from base
)
select jsonb_build_object(
  'ids', coalesce((select jsonb_agg(id) from paged), '[]'::jsonb),
  'total', (select count(*)::int from filtered),
  'stats', to_jsonb((select s from base_stats s)),
  'grades', (select grades from facets),
  'exams', (select exams from facets),
  'school_groups', coalesce((select value from school_groups), '[]'::jsonb),
  'page', (select page_no from params),
  'page_size', (select page_size from params)
);
$$;

revoke all on function public.search_question_bank_v1(text,uuid,boolean,text,uuid,uuid,uuid,text,text,text,text,text,date,date,text,integer,integer) from public, anon;
grant execute on function public.search_question_bank_v1(text,uuid,boolean,text,uuid,uuid,uuid,text,text,text,text,text,date,date,text,integer,integer) to authenticated, service_role;

create index if not exists questions_org_updated_id_idx on public.questions(organization_id, updated_at desc, id);
create index if not exists questions_org_status_idx on public.questions(organization_id, status);
create index if not exists questions_org_taxonomy_idx on public.questions(organization_id, subject_id, chapter_id, topic_id);

comment on function public.search_question_bank_v1(text,uuid,boolean,text,uuid,uuid,uuid,text,text,text,text,text,date,date,text,integer,integer) is
'Phase 1 C9: RLS-preserving bounded question-bank search/filter/pagination with aggregate counts and facets.';
