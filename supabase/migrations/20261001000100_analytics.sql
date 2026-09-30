-- PRD 4.4 owner analytics: profile views, walkthrough opens, directions taps,
-- conversion, search appearances, peak hours, which filters brought people
-- in, and demand-button interest from before sign-up.
--
-- Events are recorded only with the visitor's consent (the RA 10173 notice),
-- by the /api/track Worker route using the service role. Nobody else reads
-- or writes raw events: owners and admins get totals from venue_stats().
-- Sessions are random per browser tab and never linked to an account.
-- Retention (privacy policy): raw events for 24 months, then daily totals.

create type public.analytics_event_type as enum (
  'profile_view',
  'walkthrough_open',
  'directions_tap',
  'search_appearance',
  'filter_click',
  'demand_tap'
);

create table public.analytics_events (
  id          bigint generated always as identity primary key,
  venue_id    uuid not null references public.venues (id) on delete cascade,
  type        public.analytics_event_type not null,
  session_id  text not null check (session_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  -- Small, known keys only (the Worker validates): {"filters": ["wifi", …]}.
  props       jsonb not null default '{}'::jsonb check (jsonb_typeof(props) = 'object' and pg_column_size(props) < 2048),
  occurred_at timestamptz not null default now()
);

create index analytics_events_venue_time_idx on public.analytics_events (venue_id, occurred_at);
create index analytics_events_time_idx on public.analytics_events (occurred_at);

alter table public.analytics_events enable row level security;
revoke all on public.analytics_events from anon, authenticated;

-- What survives after 24 months: counts per venue, day (Manila) and type.
create table public.analytics_daily (
  venue_id uuid not null references public.venues (id) on delete cascade,
  day      date not null,
  type     public.analytics_event_type not null,
  count    integer not null check (count >= 0),
  primary key (venue_id, day, type)
);

alter table public.analytics_daily enable row level security;
revoke all on public.analytics_daily from anon, authenticated;


-- Totals for one venue between p_from and p_to (at most ~a year). Owners of
-- the venue and admins only. Everything is an aggregate; no event, session or
-- timestamp of an individual visit leaves the database.
create or replace function public.venue_stats(p_venue_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  totals jsonb;
  views int;
  taps int;
  first_owner timestamptz;
begin
  if not (public.is_venue_owner(p_venue_id) or public.is_admin()) then
    raise exception 'only this venue''s owners can see its stats' using errcode = '42501';
  end if;
  if p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'pick a range of up to a year' using errcode = '22023';
  end if;

  select coalesce(jsonb_object_agg(t.type, t.n), '{}'::jsonb)
  into totals
  from (
    select type::text as type, count(*) as n
    from public.analytics_events
    where venue_id = p_venue_id and occurred_at >= p_from and occurred_at < p_to
    group by type
  ) t;
  totals := jsonb_build_object(
    'profile_view', 0, 'walkthrough_open', 0, 'directions_tap', 0,
    'search_appearance', 0, 'filter_click', 0, 'demand_tap', 0
  ) || totals;
  views := (totals ->> 'profile_view')::int;
  taps := (totals ->> 'directions_tap')::int;

  select min(reviewed_at) into first_owner
  from public.venue_owners
  where venue_id = p_venue_id and status = 'approved';

  return jsonb_build_object(
    'totals', totals,
    'conversion', case when views > 0 then round(taps::numeric / views, 4) else null end,
    -- Profile views by ISO weekday (1 = Monday) and hour, in Manila time.
    'peak', coalesce((
      select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'count', n) order by dow, hour)
      from (
        select extract(isodow from occurred_at at time zone 'Asia/Manila')::int as dow,
               extract(hour from occurred_at at time zone 'Asia/Manila')::int as hour,
               count(*) as n
        from public.analytics_events
        where venue_id = p_venue_id and type = 'profile_view' and occurred_at >= p_from and occurred_at < p_to
        group by 1, 2
      ) p
    ), '[]'::jsonb),
    -- Filters that were on when someone opened this venue.
    'filters', coalesce((
      select jsonb_agg(jsonb_build_object('filter', f, 'count', n) order by n desc, f)
      from (
        select f, count(*) as n
        from public.analytics_events e, jsonb_array_elements_text(coalesce(e.props -> 'filters', '[]'::jsonb)) f
        where e.venue_id = p_venue_id and e.type = 'profile_view' and e.occurred_at >= p_from and e.occurred_at < p_to
        group by f
        order by n desc, f
        limit 10
      ) x
    ), '[]'::jsonb),
    -- One row per Manila day with any activity.
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object('day', day, 'profile_view', pv, 'walkthrough_open', wo, 'directions_tap', dt) order by day)
      from (
        select (occurred_at at time zone 'Asia/Manila')::date as day,
               count(*) filter (where type = 'profile_view') as pv,
               count(*) filter (where type = 'walkthrough_open') as wo,
               count(*) filter (where type = 'directions_tap') as dt
        from public.analytics_events
        where venue_id = p_venue_id and occurred_at >= p_from and occurred_at < p_to
        group by 1
      ) d
    ), '[]'::jsonb),
    -- "I want to see inside" taps before the venue's first owner joined (all time).
    'demand_before_signup', (
      select count(*) from public.demand_requests
      where venue_id = p_venue_id and (first_owner is null or created_at < first_owner)
    )
  );
end;
$$;

revoke execute on function public.venue_stats(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.venue_stats(uuid, timestamptz, timestamptz) to authenticated;


-- Retention: roll raw events older than 24 months into daily totals, then
-- delete them. Scheduled daily below; safe to run again.
create or replace function public.purge_old_analytics()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - interval '24 months';
begin
  insert into public.analytics_daily (venue_id, day, type, count)
  select venue_id, (occurred_at at time zone 'Asia/Manila')::date, type, count(*)
  from public.analytics_events
  where occurred_at < cutoff
  group by 1, 2, 3
  on conflict (venue_id, day, type) do update set count = public.analytics_daily.count + excluded.count;

  delete from public.analytics_events where occurred_at < cutoff;
end;
$$;

revoke execute on function public.purge_old_analytics() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('purge-old-analytics', '17 3 * * *', 'select public.purge_old_analytics()');
