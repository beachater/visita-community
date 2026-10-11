-- PRD 4.5 admin demand queue (Tier 2): the cafes visitors most want to see
-- inside, built from "I want to see inside" taps (demand_requests). Admins
-- get totals per venue only; device ids and network codes never leave the
-- database. Google Places requests (no venue_id) join this once the Places
-- fallback exists.

create function public.admin_demand_queue()
returns table (
  venue_id     uuid,
  name         text,
  slug         text,
  address      text,
  is_published boolean,
  scanned      boolean,
  has_owner    boolean,
  total        bigint,
  last_7_days  bigint,
  last_30_days bigint,
  signed_in    bigint,
  first_at     timestamptz,
  last_at      timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'only admins can see the demand queue' using errcode = '42501';
  end if;

  return query
  select
    v.id,
    v.name,
    v.slug,
    v.address,
    v.is_published,
    v.splat_url is not null,
    exists (select 1 from public.venue_owners o where o.venue_id = v.id and o.status = 'approved'),
    count(*),
    count(*) filter (where d.created_at >= now() - interval '7 days'),
    count(*) filter (where d.created_at >= now() - interval '30 days'),
    count(d.profile_id),
    min(d.created_at),
    max(d.created_at)
  from public.demand_requests d
  join public.venues v on v.id = d.venue_id
  group by v.id
  order by 10 desc, 8 desc, 13 desc;
end;
$$;

revoke execute on function public.admin_demand_queue() from public, anon;
grant execute on function public.admin_demand_queue() to authenticated;
