-- Referral codes and referrals.
--
-- Codes are kept off profiles so they aren't publicly listable; redeeming a
-- code happens in a Worker (service role), which also runs the fraud checks.
-- A referral pays out only once it's 'qualified', i.e. the referred user has
-- done something real.

create table public.referral_codes (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  code       extensions.citext not null unique
             check (char_length(code) between 4 and 32 and code ~ '^[A-Za-z0-9-]+$'),
  created_at timestamptz not null default now()
);

create type public.referral_status as enum ('pending', 'qualified', 'rejected');

create table public.referrals (
  id           uuid primary key default gen_random_uuid(),
  referrer_id  uuid not null references public.profiles (id) on delete cascade,
  referred_id  uuid not null unique references public.profiles (id) on delete cascade,
  status       public.referral_status not null default 'pending',
  qualified_at timestamptz,
  created_at   timestamptz not null default now(),

  constraint referrals_no_self check (referrer_id <> referred_id),
  constraint referrals_qualified_at check ((status = 'qualified') = (qualified_at is not null))
);

create index referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;

create policy "users read own referral code"
  on public.referral_codes for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "admins read referral codes"
  on public.referral_codes for select
  to authenticated
  using ((select public.is_admin()));

create policy "users read own referrals"
  on public.referrals for select
  to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));

create policy "admins read referrals"
  on public.referrals for select
  to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.referral_codes from anon, authenticated;
revoke insert, update, delete on public.referrals from anon, authenticated;
