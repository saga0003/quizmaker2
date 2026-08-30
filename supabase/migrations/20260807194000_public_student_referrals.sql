create table if not exists public.referral_program_settings (
  id boolean primary key default true check (id = true),
  active boolean not null default true,
  minimum_order_paise integer not null default 100000 check (minimum_order_paise >= 0),
  referrer_reward_paise integer not null default 10000 check (referrer_reward_paise >= 0),
  referred_reward_paise integer not null default 10000 check (referred_reward_paise >= 0),
  updated_at timestamptz not null default now()
);
insert into public.referral_program_settings(id) values(true) on conflict(id) do nothing;

create table if not exists public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  code text not null unique check (code = upper(code) and length(code) between 6 and 20),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referred_user_id uuid not null unique references public.profiles(id) on delete cascade,
  referrer_user_id uuid not null references public.profiles(id) on delete cascade,
  referral_code_id uuid not null references public.referral_codes(id) on delete restrict,
  claimed_at timestamptz not null default now(),
  rewarded_at timestamptz,
  qualifying_order_id uuid unique references public.orders(id) on delete set null,
  check (referred_user_id <> referrer_user_id)
);

create table if not exists public.evidara_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_paise integer not null check (amount_paise <> 0),
  entry_type text not null check (entry_type in ('referral_earned','referral_welcome','manual_adjustment','redemption','reversal')),
  referral_attribution_id uuid references public.referral_attributions(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists evidara_credit_ledger_user_idx on public.evidara_credit_ledger(user_id,created_at desc);
create unique index if not exists evidara_credit_referrer_once_idx on public.evidara_credit_ledger(referral_attribution_id,entry_type) where referral_attribution_id is not null and entry_type='referral_earned';
create unique index if not exists evidara_credit_referred_once_idx on public.evidara_credit_ledger(referral_attribution_id,entry_type) where referral_attribution_id is not null and entry_type='referral_welcome';

alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.evidara_credit_ledger enable row level security;
alter table public.referral_program_settings enable row level security;

drop policy if exists referral_codes_read_own on public.referral_codes;
create policy referral_codes_read_own on public.referral_codes for select to authenticated using ((select auth.uid()) = user_id or public.is_evidara_platform_admin());
drop policy if exists referral_attributions_read_related on public.referral_attributions;
create policy referral_attributions_read_related on public.referral_attributions for select to authenticated using ((select auth.uid()) in (referred_user_id,referrer_user_id) or public.is_evidara_platform_admin());
drop policy if exists credit_ledger_read_own on public.evidara_credit_ledger;
create policy credit_ledger_read_own on public.evidara_credit_ledger for select to authenticated using ((select auth.uid()) = user_id or public.is_evidara_platform_admin());

revoke all on public.referral_codes,public.referral_attributions,public.evidara_credit_ledger,public.referral_program_settings from anon,authenticated;
grant select on public.referral_codes,public.referral_attributions,public.evidara_credit_ledger to authenticated;

create or replace function public.get_or_create_my_referral_code()
returns text language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid(); v_code text;
begin
  if v_uid is null then raise exception 'Sign-in required.'; end if;
  select code into v_code from public.referral_codes where user_id=v_uid and active=true;
  if v_code is not null then return v_code; end if;
  loop
    v_code := 'EV' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    begin
      insert into public.referral_codes(user_id,code) values(v_uid,v_code);
      return v_code;
    exception when unique_violation then
      if exists(select 1 from public.referral_codes where user_id=v_uid) then
        select code into v_code from public.referral_codes where user_id=v_uid;
        return v_code;
      end if;
    end;
  end loop;
end; $$;
revoke all on function public.get_or_create_my_referral_code() from public,anon;
grant execute on function public.get_or_create_my_referral_code() to authenticated;

create or replace function public.claim_referral_code(p_code text)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid(); v_ref public.referral_codes%rowtype; v_existing uuid;
begin
  if v_uid is null then raise exception 'Sign-in required.'; end if;
  select * into v_ref from public.referral_codes where code=upper(trim(p_code)) and active=true;
  if not found then raise exception 'Referral code is invalid.'; end if;
  if v_ref.user_id=v_uid then raise exception 'You cannot use your own referral code.'; end if;
  if exists(select 1 from public.orders where user_id=v_uid and status='paid' and organization_id is null) then
    raise exception 'Referral codes must be claimed before the first paid individual purchase.';
  end if;
  select referrer_user_id into v_existing from public.referral_attributions where referred_user_id=v_uid;
  if v_existing is not null then
    if v_existing=v_ref.user_id then return true; end if;
    raise exception 'A different referral code is already attached to this account.';
  end if;
  insert into public.referral_attributions(referred_user_id,referrer_user_id,referral_code_id) values(v_uid,v_ref.user_id,v_ref.id);
  return true;
end; $$;
revoke all on function public.claim_referral_code(text) from public,anon;
grant execute on function public.claim_referral_code(text) to authenticated;

create or replace function public.get_my_referral_summary()
returns table(code text,balance_paise bigint,total_earned_paise bigint,successful_referrals bigint,pending_referrals bigint)
language plpgsql security definer set search_path=public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign-in required.'; end if;
  return query
  select public.get_or_create_my_referral_code(),
    coalesce((select sum(l.amount_paise)::bigint from public.evidara_credit_ledger l where l.user_id=v_uid),0),
    coalesce((select sum(l.amount_paise)::bigint from public.evidara_credit_ledger l where l.user_id=v_uid and l.amount_paise>0),0),
    (select count(*)::bigint from public.referral_attributions a where a.referrer_user_id=v_uid and a.rewarded_at is not null),
    (select count(*)::bigint from public.referral_attributions a where a.referrer_user_id=v_uid and a.rewarded_at is null);
end; $$;
revoke all on function public.get_my_referral_summary() from public,anon;
grant execute on function public.get_my_referral_summary() to authenticated;

create or replace function public.reward_paid_referral()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_attr public.referral_attributions%rowtype; v_settings public.referral_program_settings%rowtype; v_prior bigint;
begin
  if new.status <> 'paid' or new.organization_id is not null then return new; end if;
  if tg_op='UPDATE' and old.status='paid' then return new; end if;
  select * into v_settings from public.referral_program_settings where id=true and active=true;
  if not found or new.amount_paise < v_settings.minimum_order_paise then return new; end if;
  select count(*) into v_prior from public.orders where user_id=new.user_id and organization_id is null and status='paid' and id<>new.id;
  if v_prior>0 then return new; end if;
  select * into v_attr from public.referral_attributions where referred_user_id=new.user_id for update;
  if not found or v_attr.rewarded_at is not null then return new; end if;
  insert into public.evidara_credit_ledger(user_id,amount_paise,entry_type,referral_attribution_id,order_id,note)
  values(v_attr.referrer_user_id,v_settings.referrer_reward_paise,'referral_earned',v_attr.id,new.id,'Referral reward');
  insert into public.evidara_credit_ledger(user_id,amount_paise,entry_type,referral_attribution_id,order_id,note)
  values(v_attr.referred_user_id,v_settings.referred_reward_paise,'referral_welcome',v_attr.id,new.id,'Referral welcome credit');
  update public.referral_attributions set rewarded_at=now(),qualifying_order_id=new.id where id=v_attr.id;
  return new;
end; $$;
revoke all on function public.reward_paid_referral() from public,anon,authenticated;

drop trigger if exists trg_reward_paid_referral on public.orders;
create trigger trg_reward_paid_referral after insert or update of status on public.orders for each row execute function public.reward_paid_referral();

alter table if exists public.evidara_batch004_staging enable row level security;
revoke all on table public.evidara_batch004_staging from anon,authenticated;
revoke execute on function public.handle_new_user() from public,anon,authenticated;
