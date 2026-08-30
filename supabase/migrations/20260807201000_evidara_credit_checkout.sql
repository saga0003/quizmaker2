create table if not exists public.evidara_credit_reservations (
  order_id uuid primary key references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_paise integer not null check (amount_paise > 0),
  status text not null default 'reserved' check (status in ('reserved','captured','released')),
  expires_at timestamptz not null default (now()+interval '30 minutes'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists evidara_credit_reservations_user_idx on public.evidara_credit_reservations(user_id,status,expires_at);
alter table public.evidara_credit_reservations enable row level security;
revoke all on public.evidara_credit_reservations from anon,authenticated;

drop policy if exists evidara_credit_reservations_read_own on public.evidara_credit_reservations;
create policy evidara_credit_reservations_read_own on public.evidara_credit_reservations for select to authenticated using ((select auth.uid())=user_id or public.is_evidara_platform_admin());
grant select on public.evidara_credit_reservations to authenticated;

create or replace function public.reserve_evidara_credit_for_order(p_order_id uuid,p_requested_paise integer default null)
returns integer language plpgsql security definer set search_path=public as $$
declare v_order public.orders%rowtype; v_balance bigint; v_reserved bigint; v_use integer;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status<>'created' or v_order.organization_id is not null then return 0; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_order.user_id::text,0));
  select coalesce(sum(amount_paise),0) into v_balance from public.evidara_credit_ledger where user_id=v_order.user_id;
  select coalesce(sum(amount_paise),0) into v_reserved from public.evidara_credit_reservations where user_id=v_order.user_id and status='reserved' and expires_at>now() and order_id<>p_order_id;
  v_use:=greatest(0,least((v_balance-v_reserved)::integer,coalesce(p_requested_paise,v_order.amount_paise),greatest(v_order.amount_paise-100,0)));
  if v_use<=0 then return 0; end if;
  insert into public.evidara_credit_reservations(order_id,user_id,amount_paise,status,expires_at) values(v_order.id,v_order.user_id,v_use,'reserved',now()+interval '30 minutes')
  on conflict(order_id) do update set amount_paise=excluded.amount_paise,status='reserved',expires_at=excluded.expires_at,updated_at=now();
  update public.orders set discount_paise=discount_paise+v_use,amount_paise=amount_paise-v_use,commerce_metadata=coalesce(commerce_metadata,'{}'::jsonb)||jsonb_build_object('evidara_credit_reserved_paise',v_use),updated_at=now() where id=v_order.id;
  return v_use;
end; $$;
revoke all on function public.reserve_evidara_credit_for_order(uuid,integer) from public,anon,authenticated;
grant execute on function public.reserve_evidara_credit_for_order(uuid,integer) to service_role;

create or replace function public.release_evidara_credit_reservation(p_order_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_res public.evidara_credit_reservations%rowtype;
begin
  select * into v_res from public.evidara_credit_reservations where order_id=p_order_id for update;
  if not found or v_res.status<>'reserved' then return; end if;
  update public.evidara_credit_reservations set status='released',updated_at=now() where order_id=p_order_id;
  update public.orders set discount_paise=greatest(0,discount_paise-v_res.amount_paise),amount_paise=amount_paise+v_res.amount_paise,commerce_metadata=coalesce(commerce_metadata,'{}'::jsonb)-'evidara_credit_reserved_paise',updated_at=now() where id=p_order_id and status='created';
end; $$;
revoke all on function public.release_evidara_credit_reservation(uuid) from public,anon,authenticated;
grant execute on function public.release_evidara_credit_reservation(uuid) to service_role;

create or replace function public.capture_evidara_credit_reservation()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_res public.evidara_credit_reservations%rowtype;
begin
  if new.status<>'paid' or (tg_op='UPDATE' and old.status='paid') then return new; end if;
  select * into v_res from public.evidara_credit_reservations where order_id=new.id for update;
  if not found or v_res.status<>'reserved' then return new; end if;
  insert into public.evidara_credit_ledger(user_id,amount_paise,entry_type,order_id,note) values(v_res.user_id,-v_res.amount_paise,'redemption',new.id,'Credit used on Evidara purchase');
  update public.evidara_credit_reservations set status='captured',updated_at=now() where order_id=new.id;
  return new;
end; $$;
revoke all on function public.capture_evidara_credit_reservation() from public,anon,authenticated;
drop trigger if exists trg_capture_evidara_credit on public.orders;
create trigger trg_capture_evidara_credit after insert or update of status on public.orders for each row execute function public.capture_evidara_credit_reservation();
