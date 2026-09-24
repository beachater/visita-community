-- Check-ins: GPS presence plus a dwell period, verified by a Worker.
--
-- Stores distance from the venue, not raw coordinates, to keep personal
-- location data out of the database (RA 10173). Spoofing checks such as
-- implausible travel speed between check-ins can use the venues' own
-- coordinates. Only the service role writes here.

create type public.check_in_status as enum ('pending', 'verified', 'rejected');

create table public.check_ins (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  venue_id         uuid not null references public.venues (id) on delete cascade,
  status           public.check_in_status not null default 'pending',
  started_at       timestamptz not null default now(),
  verified_at      timestamptz,
  start_distance_m real check (start_distance_m >= 0),
  end_distance_m   real check (end_distance_m >= 0),
  accuracy_m       real check (accuracy_m >= 0),
  rejection_reason text,

  constraint check_ins_verified_at check ((status = 'verified') = (verified_at is not null)),
  constraint check_ins_rejection_reason check (status = 'rejected' or rejection_reason is null)
);

create index check_ins_user_idx on public.check_ins (user_id, started_at desc);
create index check_ins_venue_idx on public.check_ins (venue_id, started_at desc);

alter table public.check_ins enable row level security;

create policy "users read own check-ins"
  on public.check_ins for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "admins read all check-ins"
  on public.check_ins for select
  to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.check_ins from anon, authenticated;
