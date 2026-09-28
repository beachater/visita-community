-- PRD 4.1 "Demand button": "I want to see inside" on unscanned cafes, building
-- a queue of cafes to sell to next (and later, PRD 4.4 analytics: "demand-button
-- interest from before sign-up").
--
-- Written only by the /api/demand Worker route (service role), which dedupes
-- per device and rate-limits per IP. Visitors can't read or write it directly.
-- Listed venues carry venue_id; Google Places results (Tier 2) carry place data.

create table public.demand_requests (
  id              uuid primary key default gen_random_uuid(),
  venue_id        uuid references public.venues (id) on delete cascade,
  google_place_id text,
  name            text,
  lat             double precision check (lat between -90 and 90),
  lng             double precision check (lng between -180 and 180),
  -- Random per-browser id stored on the device; not linked to a person.
  device_id       text not null check (device_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  -- Set when the visitor was signed in.
  profile_id      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),

  constraint demand_requests_target check (venue_id is not null or google_place_id is not null)
);

-- One request per device per venue (or per Places result).
create unique index demand_requests_venue_device_idx on public.demand_requests (venue_id, device_id) where venue_id is not null;
create unique index demand_requests_place_device_idx on public.demand_requests (google_place_id, device_id) where google_place_id is not null;
create index demand_requests_venue_idx on public.demand_requests (venue_id, created_at desc);

alter table public.demand_requests enable row level security;

create policy "admins read demand"
  on public.demand_requests for select
  to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.demand_requests from anon, authenticated;
