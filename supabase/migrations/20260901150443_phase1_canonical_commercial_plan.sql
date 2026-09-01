alter table public.school_subscriptions
  drop constraint if exists school_subscriptions_phase1_annual_rate_check;

alter table public.school_subscriptions
  add constraint school_subscriptions_phase1_annual_rate_check
  check (annual_price_per_student_paise = 19900);

comment on constraint school_subscriptions_phase1_annual_rate_check on public.school_subscriptions is
  'Evidara Phase 1 canonical institution licence rate: ₹199 per licensed student per annual licence period. Manual payment amount/reference fields remain independent settlement records.';
