-- Phase 1 C11: exact duplicate prevention across every question write path.
-- The canonical fingerprint covers text, LaTeX, passage, images and option content.
-- Correct-answer flags, taxonomy and source metadata are intentionally excluded: changing
-- those fields must not make an otherwise identical question a new question.

create or replace function public.normalize_question_duplicate_component_v2(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select lower(regexp_replace(coalesce(p_value, ''), '\s+', '', 'g'));
$$;

create or replace function public.question_duplicate_hash_v2_payload(
  p_question_type text,
  p_stem_text text,
  p_stem_latex text,
  p_question_image_url text,
  p_question_image_urls text[],
  p_passage_text text,
  p_options jsonb
)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  with image_parts as (
    select distinct public.normalize_question_duplicate_component_v2(x) as normalized
    from unnest(
      coalesce(p_question_image_urls, '{}'::text[])
      || case
           when nullif(btrim(coalesce(p_question_image_url, '')), '') is null then '{}'::text[]
           else array[p_question_image_url]
         end
    ) x
    where nullif(btrim(coalesce(x, '')), '') is not null
  ), option_parts as (
    select
      upper(coalesce(value ->> 'option_key', '')) || ':' ||
      public.normalize_question_duplicate_component_v2(value ->> 'content_text') || ':' ||
      public.normalize_question_duplicate_component_v2(value ->> 'content_latex') || ':' ||
      public.normalize_question_duplicate_component_v2(value ->> 'image_url') as normalized,
      upper(coalesce(value ->> 'option_key', '')) as option_key,
      coalesce(nullif(value ->> 'display_order', '')::integer, ordinality::integer) as display_order,
      ordinality
    from jsonb_array_elements(coalesce(p_options, '[]'::jsonb)) with ordinality
  )
  select encode(
    extensions.digest(
      public.normalize_question_duplicate_component_v2(p_question_type) || '|' ||
      public.normalize_question_duplicate_component_v2(p_stem_text) || '|' ||
      public.normalize_question_duplicate_component_v2(p_stem_latex) || '|' ||
      public.normalize_question_duplicate_component_v2(p_passage_text) || '|' ||
      coalesce((select string_agg(normalized, '|' order by normalized) from image_parts), '') || '|' ||
      coalesce((select string_agg(normalized, '|' order by option_key, display_order, ordinality) from option_parts), ''),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function public.question_duplicate_hash_v2(p_question_id uuid)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select public.question_duplicate_hash_v2_payload(
    q.question_type::text,
    q.stem_text,
    q.stem_latex,
    q.question_image_url,
    q.question_image_urls,
    q.passage_text,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'option_key', o.option_key,
            'content_text', o.content_text,
            'content_latex', o.content_latex,
            'image_url', o.image_url,
            'display_order', o.display_order
          )
          order by upper(coalesce(o.option_key, '')), o.display_order, o.id
        )
        from public.question_options o
        where o.question_id = q.id
      ),
      '[]'::jsonb
    )
  )
  from public.questions q
  where q.id = p_question_id;
$$;

revoke all on function public.question_duplicate_hash_v2(uuid) from public, anon, authenticated;
grant execute on function public.question_duplicate_hash_v2(uuid) to service_role;

create or replace function public.prepare_question_duplicate_hash_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Never trust a legacy/client-supplied hash while canonical content is changing.
  new.duplicate_hash := null;
  return new;
end;
$$;

create or replace function public.finalize_question_duplicate_hash_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_question_id uuid;
  v_hash text;
begin
  v_question_id := case
    when tg_table_name = 'question_options' and tg_op = 'DELETE' then old.question_id
    when tg_table_name = 'question_options' then new.question_id
    when tg_op = 'DELETE' then old.id
    else new.id
  end;

  if v_question_id is null or not exists (select 1 from public.questions where id = v_question_id) then
    return null;
  end if;

  v_hash := public.question_duplicate_hash_v2(v_question_id);

  update public.questions
  set duplicate_hash = v_hash
  where id = v_question_id
    and duplicate_hash is distinct from v_hash;

  return null;
end;
$$;

-- Existing rows are preflighted before any uniqueness boundary is installed.
do $$
declare
  v_duplicate_groups integer;
  v_sentinel_orgs integer;
begin
  select count(*) into v_sentinel_orgs
  from public.organizations
  where id = '00000000-0000-0000-0000-000000000000'::uuid;

  if v_sentinel_orgs <> 0 then
    raise exception 'C11 cannot use the reserved platform scope UUID because it exists as an institution.';
  end if;

  with fingerprints as (
    select
      coalesce(q.organization_id, '00000000-0000-0000-0000-000000000000'::uuid) as scope_id,
      public.question_duplicate_hash_v2(q.id) as duplicate_hash
    from public.questions q
  ), duplicate_groups as (
    select scope_id, duplicate_hash
    from fingerprints
    group by scope_id, duplicate_hash
    having count(*) > 1
  )
  select count(*) into v_duplicate_groups from duplicate_groups;

  if v_duplicate_groups <> 0 then
    raise exception 'C11 preflight found % exact duplicate group(s); resolve them before enabling uniqueness.', v_duplicate_groups;
  end if;
end
$$;

-- Backfill without rewriting question updated_at/audit history. The DDL lock keeps this
-- short trigger-disabled window transactionally isolated; any failure restores trigger state.
lock table public.questions in share row exclusive mode;
alter table public.questions disable trigger user;
update public.questions q
set duplicate_hash = public.question_duplicate_hash_v2(q.id);
alter table public.questions enable trigger user;

-- Platform questions (organization_id IS NULL) form one bank; each institution forms its own.
drop index if exists public.questions_duplicate_scope_hash_uidx;
create unique index questions_duplicate_scope_hash_uidx
on public.questions (
  (coalesce(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)),
  duplicate_hash
)
where duplicate_hash is not null;

-- Clear legacy hashes before content-changing writes, then recompute from final transaction state.
drop trigger if exists trg_question_duplicate_prepare_v2 on public.questions;
create trigger trg_question_duplicate_prepare_v2
before insert or update of organization_id, question_type, stem_text, stem_latex,
  question_image_url, question_image_urls, passage_text
on public.questions
for each row execute function public.prepare_question_duplicate_hash_v2();

drop trigger if exists trg_question_duplicate_finalize_v2 on public.questions;
create constraint trigger trg_question_duplicate_finalize_v2
after insert or update of organization_id, question_type, stem_text, stem_latex,
  question_image_url, question_image_urls, passage_text
on public.questions
deferrable initially deferred
for each row execute function public.finalize_question_duplicate_hash_v2();

drop trigger if exists trg_question_option_duplicate_finalize_v2 on public.question_options;
create constraint trigger trg_question_option_duplicate_finalize_v2
after insert or delete or update of question_id, option_key, content_text, content_latex, image_url, display_order
on public.question_options
deferrable initially deferred
for each row execute function public.finalize_question_duplicate_hash_v2();

-- Keep import duplicate preview aligned with the same canonical representation used by storage.
create or replace function public.preview_paper_import_duplicates_service_v18(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  r jsonb;
  v_hash text;
  v_stem text;
  v_out jsonb := '[]'::jsonb;
  v_exact jsonb;
  v_near jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Server authorization is required.' using errcode='42501';
  end if;

  for r in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_stem := coalesce(r ->> 'stem_text', r ->> 'question', '');
    v_hash := public.question_duplicate_hash_v2_payload(
      coalesce(r ->> 'question_type', 'single_correct'),
      v_stem,
      r ->> 'stem_latex',
      r ->> 'question_image_url',
      coalesce(array(select jsonb_array_elements_text(coalesce(r -> 'question_image_urls', '[]'::jsonb))), '{}'::text[]),
      r ->> 'passage_text',
      coalesce(r -> 'options', '[]'::jsonb)
    );

    select jsonb_build_object(
      'id', q.id, 'stem_text', q.stem_text, 'status', q.status, 'source', q.source,
      'source_year', q.source_year, 'subject', s.name, 'chapter', c.name, 'topic', t.name,
      'similarity', 1.0
    ) into v_exact
    from public.questions q
    left join public.subjects s on s.id=q.subject_id
    left join public.chapters c on c.id=q.chapter_id
    left join public.topics t on t.id=q.topic_id
    where q.duplicate_hash = v_hash
    order by q.updated_at desc
    limit 1;

    if nullif(btrim(v_stem), '') is null then
      v_near := '[]'::jsonb;
    else
      select coalesce(jsonb_agg(x), '[]'::jsonb) into v_near
      from (
        select jsonb_build_object(
          'id', q.id, 'stem_text', q.stem_text, 'status', q.status, 'source', q.source,
          'source_year', q.source_year, 'subject', s.name, 'chapter', c.name, 'topic', t.name,
          'similarity', round(extensions.similarity(lower(q.stem_text), lower(v_stem))::numeric, 3)
        ) x
        from public.questions q
        left join public.subjects s on s.id=q.subject_id
        left join public.chapters c on c.id=q.chapter_id
        left join public.topics t on t.id=q.topic_id
        where q.duplicate_hash is distinct from v_hash
          and nullif(btrim(q.stem_text), '') is not null
          and extensions.similarity(lower(q.stem_text), lower(v_stem)) >= 0.82
        order by extensions.similarity(lower(q.stem_text), lower(v_stem)) desc, q.updated_at desc
        limit 3
      ) z;
    end if;

    v_out := v_out || jsonb_build_array(jsonb_build_object(
      'client_id', r ->> 'client_id',
      'exact', v_exact,
      'near', v_near
    ));
  end loop;

  return v_out;
end
$$;

comment on function public.question_duplicate_hash_v2_payload(text,text,text,text,text[],text,jsonb)
is 'C11 canonical exact-question fingerprint: type + rich prompt + images + option content; independent of taxonomy/source/correct-answer metadata.';
comment on index public.questions_duplicate_scope_hash_uidx
is 'C11 concurrency-safe exact duplicate boundary scoped independently to platform and each institution.';
