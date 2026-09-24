-- Points ledger. Append-only and the single source of truth for balances.
--
-- Users never write here. Rows are inserted by Cloudflare Workers (service
-- role) or by security definer RPCs, where the points rules are enforced. The
-- partial unique index makes awarding idempotent: a retried request for the
-- same (user, reason, source) can't pay out twice.

create type public.point_reason as enum (
  'review',
  'review_photo',
  'first_review',
  'amenity_confirm',
  'outdated_report',
  'check_in',
  'streak',
  'referral',
  'referral_milestone',
  'award_given',
  'award_received',
  'admin_adjustment'
);

create table public.point_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  amount     integer not null check (amount <> 0),
  reason     public.point_reason not null,
  -- The row that earned or spent the points (review, check-in, referral,
  -- award). Polymorphic on purpose; `reason` says which table it points at.
  source_id  uuid,
  created_at timestamptz not null default now()
);

create unique index point_events_idempotency_idx
  on public.point_events (user_id, reason, source_id)
  where source_id is not null;

create index point_events_user_idx on public.point_events (user_id, created_at desc);

alter table public.point_events enable row level security;

create policy "users read own points"
  on public.point_events for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "admins read all points"
  on public.point_events for select
  to authenticated
  using ((select public.is_admin()));

-- No insert/update/delete for API roles, admins included: corrections are new
-- 'admin_adjustment' rows written by the service role, never edits.
revoke insert, update, delete on public.point_events from anon, authenticated;

-- security_invoker: callers only see balances for rows RLS already lets them
-- read (their own; admins see everyone's).
create view public.point_balances
with (security_invoker = true)
as
  select user_id, sum(amount)::integer as balance
  from public.point_events
  group by user_id;
