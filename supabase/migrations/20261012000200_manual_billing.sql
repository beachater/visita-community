-- PRD 4.4 billing, manual for now (Tier 2): the business can't take payments
-- in the app until it's registered, so an admin records each payment against
-- the venue and the owner sees their status and history.
--
--   venue_billing     one row per billed venue: plan, fee, status, admin note
--   billing_payments  every payment received; never deleted, only voided
--
-- Pricing isn't decided yet, so the plan name and amounts are whatever the
-- admin enters. "Paid through" is the latest period a valid payment covers,
-- so it can't drift from the payments. Admins write; owners read their own
-- venue through owner_billing(), which leaves out the admin-only notes.

create type public.billing_status as enum ('trial', 'active', 'paused', 'cancelled');
create type public.payment_method as enum ('cash', 'gcash', 'bank_transfer', 'other');
create type public.payment_kind as enum ('onboarding', 'subscription', 'other');

create table public.venue_billing (
  venue_id        uuid primary key references public.venues (id) on delete cascade,
  plan            text not null check (length(trim(plan)) between 1 and 80),
  monthly_fee_php numeric(10, 2) check (monthly_fee_php >= 0),
  status          public.billing_status not null default 'active',
  -- Admin-only: never shown to owners.
  admin_note      text check (length(admin_note) <= 1000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null default auth.uid()
);

create trigger venue_billing_set_updated_at
  before update on public.venue_billing
  for each row execute function public.set_updated_at();

create or replace function public.venue_billing_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger venue_billing_stamp
  before insert or update on public.venue_billing
  for each row execute function public.venue_billing_stamp();

create table public.billing_payments (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  kind         public.payment_kind not null default 'subscription',
  amount_php   numeric(10, 2) not null check (amount_php > 0),
  paid_on      date not null,
  method       public.payment_method not null,
  -- GCash or bank reference number, receipt number.
  reference    text check (length(reference) <= 120),
  -- The months a subscription payment covers. Other kinds may leave it empty.
  period_start date,
  period_end   date,
  note         text check (length(note) <= 500),
  recorded_by  uuid references public.profiles (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  -- A mistake is voided with a reason, so the history stays complete.
  voided_at    timestamptz,
  void_reason  text check (length(void_reason) <= 500),

  constraint billing_payments_period check (
    (period_start is null and period_end is null)
    or (period_start is not null and period_end is not null and period_end >= period_start)
  ),
  constraint billing_payments_subscription_period check (kind <> 'subscription' or period_start is not null),
  constraint billing_payments_void_reason check (voided_at is null or coalesce(length(trim(void_reason)), 0) > 0)
);

create index billing_payments_venue_idx on public.billing_payments (venue_id, paid_on desc);

-- Once voided, a payment stays voided; nothing else about it changes.
create or replace function public.billing_payments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.voided_at is not null then
    raise exception 'this payment was voided and can no longer change' using errcode = '42501';
  end if;
  if new.voided_at is null then
    raise exception 'payments are corrected by voiding them and recording a new one' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger billing_payments_guard
  before update on public.billing_payments
  for each row execute function public.billing_payments_guard();

alter table public.venue_billing enable row level security;
alter table public.billing_payments enable row level security;

create policy "admins manage billing" on public.venue_billing
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "admins read payments" on public.billing_payments
  for select to authenticated using ((select public.is_admin()));
create policy "admins record payments" on public.billing_payments
  for insert to authenticated with check ((select public.is_admin()));
create policy "admins void payments" on public.billing_payments
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Explicit grants: hosted projects don't grant new tables by default. RLS
-- still limits every one of these to admins.
revoke all on public.venue_billing from anon;
revoke all on public.billing_payments from anon;
revoke all on public.venue_billing from authenticated;
revoke all on public.billing_payments from authenticated;
grant select on public.venue_billing, public.billing_payments to authenticated;
grant insert (venue_id, plan, monthly_fee_php, status, admin_note) on public.venue_billing to authenticated;
grant update (plan, monthly_fee_php, status, admin_note) on public.venue_billing to authenticated;
grant insert (venue_id, kind, amount_php, paid_on, method, reference, period_start, period_end, note)
  on public.billing_payments to authenticated;
grant update (voided_at, void_reason) on public.billing_payments to authenticated;


-- ---------- reading billing ----------

-- Every venue with a plan, for the admin billing list.
create function public.admin_billing_overview()
returns table (
  venue_id        uuid,
  name            text,
  slug            text,
  plan            text,
  monthly_fee_php numeric,
  status          public.billing_status,
  paid_through    date,
  last_paid_on    date,
  total_paid_php  numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'only admins can see billing' using errcode = '42501';
  end if;

  return query
  select
    v.id,
    v.name,
    v.slug::text,
    b.plan,
    b.monthly_fee_php,
    b.status,
    max(p.period_end) filter (where p.voided_at is null),
    max(p.paid_on) filter (where p.voided_at is null),
    coalesce(sum(p.amount_php) filter (where p.voided_at is null), 0)
  from public.venue_billing b
  join public.venues v on v.id = b.venue_id
  left join public.billing_payments p on p.venue_id = b.venue_id
  group by v.id, b.venue_id
  order by v.name;
end;
$$;

revoke execute on function public.admin_billing_overview() from public, anon;
grant execute on function public.admin_billing_overview() to authenticated;

-- An owner's view of their venue's billing: plan, status, paid-through and
-- valid payments. No admin notes, no voided payments, no who-recorded-it.
create function public.owner_billing(p_venue_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  plan_row public.venue_billing;
begin
  if not (public.is_venue_owner(p_venue_id) or public.is_admin()) then
    raise exception 'only this venue''s owners can see its billing' using errcode = '42501';
  end if;

  select * into plan_row from public.venue_billing where venue_id = p_venue_id;

  return jsonb_build_object(
    'plan', case when plan_row.venue_id is null then null else jsonb_build_object(
      'plan', plan_row.plan,
      'monthly_fee_php', plan_row.monthly_fee_php,
      'status', plan_row.status
    ) end,
    'paid_through', (
      select max(period_end) from public.billing_payments
      where venue_id = p_venue_id and voided_at is null
    ),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'kind', p.kind,
        'amount_php', p.amount_php,
        'paid_on', p.paid_on,
        'method', p.method,
        'reference', p.reference,
        'period_start', p.period_start,
        'period_end', p.period_end
      ) order by p.paid_on desc, p.created_at desc)
      from public.billing_payments p
      where p.venue_id = p_venue_id and p.voided_at is null
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.owner_billing(uuid) from public, anon;
grant execute on function public.owner_billing(uuid) to authenticated;
