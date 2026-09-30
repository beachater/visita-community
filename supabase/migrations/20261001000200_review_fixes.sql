-- Fixes from the Tier 1 branch review.

-- 1. Review photos stay under their own review. Authors can write photo_url
--    over the API, and several routes delete "the review's photo" from R2,
--    so without this a visitor could point it at a scan, the basemap or
--    someone's proof and have the server delete that file.
update public.reviews set photo_url = null
where photo_url is not null and not (photo_url like 'reviews/' || id::text || '/%' and photo_url !~ '\.\.');

alter table public.reviews
  add constraint reviews_photo_location check (
    photo_url is null or (photo_url like 'reviews/' || id::text || '/%' and photo_url !~ '\.\.')
  );


-- 2. Owners no longer read their venue's claims (which carry claimants'
--    phone numbers, proof and review notes). Co-owners are listed by name
--    and role only, through a function.
drop policy "owners read their venue's owners" on public.venue_owners;

create or replace function public.venue_owner_names(p_venue_id uuid)
returns table (claim_id uuid, display_name text, role_title text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_venue_owner(p_venue_id) or public.is_admin()) then
    raise exception 'only this venue''s owners can list its owners' using errcode = '42501';
  end if;
  return query
    select o.id, p.display_name, o.role_title
    from public.venue_owners o
    join public.profiles p on p.id = o.profile_id
    where o.venue_id = p_venue_id and o.status = 'approved'
    order by o.reviewed_at;
end;
$$;

revoke execute on function public.venue_owner_names(uuid) from public, anon;
grant execute on function public.venue_owner_names(uuid) to authenticated;


-- 6a. One analytics event per session, venue and type per hour, so a
--     script replaying one session can't inflate an owner's numbers.
alter table public.analytics_events add column occurred_hour timestamptz;

create or replace function public.analytics_events_set_hour()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.occurred_hour := date_trunc('hour', new.occurred_at at time zone 'UTC') at time zone 'UTC';
  return new;
end;
$$;

create trigger analytics_events_set_hour
  before insert on public.analytics_events
  for each row execute function public.analytics_events_set_hour();

update public.analytics_events set occurred_hour = date_trunc('hour', occurred_at at time zone 'UTC') at time zone 'UTC';
delete from public.analytics_events a using public.analytics_events b
where a.id > b.id and a.venue_id = b.venue_id and a.type = b.type and a.session_id = b.session_id and a.occurred_hour = b.occurred_hour;
alter table public.analytics_events alter column occurred_hour set not null;

create unique index analytics_events_dedupe_idx on public.analytics_events (venue_id, type, session_id, occurred_hour);

-- 6b. Demand requests carry a one-way daily code of the requester's network
--     address (keyed with a server secret), so /api/demand can cap requests
--     per network per venue per day. Erased after two days.
alter table public.demand_requests add column ip_hash text;
create index demand_requests_ip_hash_idx on public.demand_requests (venue_id, ip_hash, created_at) where ip_hash is not null;

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

  update public.demand_requests set ip_hash = null
  where ip_hash is not null and created_at < now() - interval '2 days';
end;
$$;

revoke execute on function public.purge_old_analytics() from public, anon, authenticated;
