-- PRD 4.4 owner workflow: approved owners keep their listing current.
--   • menu and hours: edited directly, through owner_update_listing()
--   • verified amenities: requested in amenity_change_requests, shown as
--     "Pending review" until an admin approves
--   • events and promotions: venue_events
--   • occupancy: one tap, quiet / moderate / full, expiring after 3 hours
--   • public replies to reviews: review_replies
-- Owners never update venues directly; everything they can change is listed here.


-- ---------- direct listing edits ----------
create or replace function public.owner_update_listing(p_venue_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  extra text;
begin
  if not (public.is_venue_owner(p_venue_id) or public.is_admin()) then
    raise exception 'only this venue''s owners can edit its listing' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a json object' using errcode = '22023';
  end if;
  select k into extra from jsonb_object_keys(p_patch) k where k not in ('menu', 'hours') limit 1;
  if extra is not null then
    raise exception 'owners edit menu and hours directly; "%" is not editable here', extra using errcode = '42501';
  end if;

  -- The venues_validate_json trigger checks the shapes.
  update public.venues
  set menu = case when p_patch ? 'menu' then p_patch -> 'menu' else menu end,
      hours = case
        when not p_patch ? 'hours' then hours
        when jsonb_typeof(p_patch -> 'hours') = 'null' then null
        else p_patch -> 'hours'
      end
  where id = p_venue_id;
end;
$$;

revoke execute on function public.owner_update_listing(uuid, jsonb) from public, anon;
grant execute on function public.owner_update_listing(uuid, jsonb) to authenticated;


-- ---------- verified amenity changes ----------
create type public.change_request_status as enum ('pending', 'approved', 'rejected');

create table public.amenity_change_requests (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid not null references public.venues (id) on delete cascade,
  requested_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amenity_key  text not null,
  -- The new {label?, value?} entry; null asks to remove the amenity.
  entry        jsonb,
  status       public.change_request_status not null default 'pending',
  review_note  text check (char_length(review_note) <= 1000),
  reviewed_by  uuid references public.profiles (id) on delete set null,
  reviewed_at  timestamptz,
  created_at   timestamptz not null default now(),

  constraint amenity_change_requests_reviewed check ((status = 'pending') = (reviewed_at is null))
);

create unique index amenity_change_requests_one_pending_idx
  on public.amenity_change_requests (venue_id, amenity_key) where status = 'pending';
create index amenity_change_requests_queue_idx on public.amenity_change_requests (created_at) where status = 'pending';

-- A request must name a defined amenity and carry a valid entry, checked with
-- the same rules as venues.amenities.
create or replace function public.amenity_change_requests_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  vtype public.venue_type;
begin
  select venue_type into vtype from public.venues where id = new.venue_id;
  if not exists (select 1 from public.amenity_definitions d where d.venue_type = vtype and d.key = new.amenity_key and d.is_active) then
    raise exception 'amenity "%" is not defined for this venue', new.amenity_key using errcode = '22023';
  end if;
  if new.entry is not null then
    perform public.validate_venue_amenities(vtype, jsonb_build_object(new.amenity_key, new.entry));
  end if;
  return new;
end;
$$;

create trigger amenity_change_requests_validate
  before insert on public.amenity_change_requests
  for each row execute function public.amenity_change_requests_validate();

alter table public.amenity_change_requests enable row level security;

create policy "owners read their venue's amenity requests"
  on public.amenity_change_requests for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "owners request amenity changes"
  on public.amenity_change_requests for insert
  to authenticated
  with check (requested_by = (select auth.uid()) and status = 'pending' and public.is_venue_owner(venue_id));

create policy "owners withdraw pending requests"
  on public.amenity_change_requests for delete
  to authenticated
  using (status = 'pending' and public.is_venue_owner(venue_id));

create policy "admins read amenity requests"
  on public.amenity_change_requests for select
  to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.amenity_change_requests from anon, authenticated;
grant insert (venue_id, amenity_key, entry) on public.amenity_change_requests to authenticated;
grant delete on public.amenity_change_requests to authenticated;

create or replace function public.review_amenity_change(
  p_request_id uuid,
  p_decision public.change_request_status,
  p_note text
)
returns public.amenity_change_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.amenity_change_requests;
begin
  if not public.is_admin() then
    raise exception 'only admins review amenity changes' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'a review approves or rejects' using errcode = '22023';
  end if;
  select * into req from public.amenity_change_requests where id = p_request_id for update;
  if not found then
    raise exception 'request not found' using errcode = 'P0002';
  end if;
  if req.status <> 'pending' then
    raise exception 'this request has already been reviewed' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    update public.venues
    set amenities = case
      when req.entry is null then amenities - req.amenity_key
      else jsonb_set(amenities, array[req.amenity_key], req.entry, true)
    end
    where id = req.venue_id;
  end if;

  update public.amenity_change_requests
  set status = p_decision, review_note = nullif(trim(p_note), ''), reviewed_by = (select auth.uid()), reviewed_at = now()
  where id = p_request_id
  returning * into req;
  return req;
end;
$$;

revoke execute on function public.review_amenity_change(uuid, public.change_request_status, text) from public, anon;
grant execute on function public.review_amenity_change(uuid, public.change_request_status, text) to authenticated;


-- ---------- events and promotions ----------
create table public.venue_events (
  id          uuid primary key default gen_random_uuid(),
  venue_id    uuid not null references public.venues (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 120),
  description text check (char_length(description) <= 2000),
  starts_at   timestamptz not null,
  ends_at     timestamptz not null,
  -- R2 key under events/<event id>/, served publicly.
  photo_url   text,
  created_by  uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint venue_events_order check (ends_at > starts_at),
  constraint venue_events_photo_location check (photo_url is null or photo_url like 'events/' || id::text || '/%')
);

create index venue_events_venue_idx on public.venue_events (venue_id, ends_at);

create trigger venue_events_set_updated_at
  before update on public.venue_events
  for each row execute function public.set_updated_at();

alter table public.venue_events enable row level security;

create policy "events of published venues are public"
  on public.venue_events for select
  to anon, authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and v.is_published));

create policy "owners read their events"
  on public.venue_events for select
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "owners post events"
  on public.venue_events for insert
  to authenticated
  with check (public.is_venue_owner(venue_id));

create policy "owners edit their events"
  on public.venue_events for update
  to authenticated
  using (public.is_venue_owner(venue_id))
  with check (public.is_venue_owner(venue_id));

create policy "owners delete their events"
  on public.venue_events for delete
  to authenticated
  using (public.is_venue_owner(venue_id));

create policy "admins manage events"
  on public.venue_events for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke insert, update on public.venue_events from anon, authenticated;
grant insert (venue_id, title, description, starts_at, ends_at) on public.venue_events to authenticated;
grant update (title, description, starts_at, ends_at, photo_url) on public.venue_events to authenticated;


-- ---------- occupancy ----------
create type public.occupancy_level as enum ('quiet', 'moderate', 'full');

create table public.venue_occupancy (
  venue_id   uuid primary key references public.venues (id) on delete cascade,
  level      public.occupancy_level not null,
  set_at     timestamptz not null default now(),
  -- Always set_at + 3 hours; only set_occupancy() writes this table.
  expires_at timestamptz not null,
  set_by     uuid references public.profiles (id) on delete set null
);

alter table public.venue_occupancy enable row level security;

-- Expired rows are simply not visible, so a stale "quiet" never shows.
create policy "current occupancy of published venues is public"
  on public.venue_occupancy for select
  to anon, authenticated
  using (expires_at > now() and exists (select 1 from public.venues v where v.id = venue_id and v.is_published));

create policy "owners read their occupancy"
  on public.venue_occupancy for select
  to authenticated
  using (public.is_venue_owner(venue_id));

revoke insert, update, delete on public.venue_occupancy from anon, authenticated;

-- The server clock sets the time, so nobody can post "quiet" for tomorrow.
create or replace function public.set_occupancy(p_venue_id uuid, p_level public.occupancy_level)
returns public.venue_occupancy
language plpgsql
security definer
set search_path = ''
as $$
declare
  row public.venue_occupancy;
begin
  if not (public.is_venue_owner(p_venue_id) or public.is_admin()) then
    raise exception 'only this venue''s owners can set how busy it is' using errcode = '42501';
  end if;
  if p_level is null then
    delete from public.venue_occupancy where venue_id = p_venue_id;
    return null;
  end if;
  insert into public.venue_occupancy (venue_id, level, set_at, expires_at, set_by)
  values (p_venue_id, p_level, now(), now() + interval '3 hours', (select auth.uid()))
  on conflict (venue_id) do update
    set level = excluded.level, set_at = excluded.set_at, expires_at = excluded.expires_at, set_by = excluded.set_by
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.set_occupancy(uuid, public.occupancy_level) from public, anon;
grant execute on function public.set_occupancy(uuid, public.occupancy_level) to authenticated;

-- Live updates on the cafe page and walkthrough (Supabase Realtime applies RLS).
alter publication supabase_realtime add table public.venue_occupancy;


-- ---------- replies to reviews ----------
create table public.review_replies (
  review_id  uuid primary key references public.reviews (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger review_replies_set_updated_at
  before update on public.review_replies
  for each row execute function public.set_updated_at();

create or replace function public.review_venue_id(p_review_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select venue_id from public.reviews where id = p_review_id;
$$;

revoke execute on function public.review_venue_id(uuid) from public;
grant execute on function public.review_venue_id(uuid) to anon, authenticated;

alter table public.review_replies enable row level security;

-- A reply is as visible as the review it answers.
create policy "replies to visible reviews are public"
  on public.review_replies for select
  to anon, authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id));

create policy "owners reply to their venue's reviews"
  on public.review_replies for insert
  to authenticated
  with check (author_id = (select auth.uid()) and public.is_venue_owner(public.review_venue_id(review_id)));

create policy "owners edit their venue's replies"
  on public.review_replies for update
  to authenticated
  using (public.is_venue_owner(public.review_venue_id(review_id)))
  with check (public.is_venue_owner(public.review_venue_id(review_id)));

create policy "owners delete their venue's replies"
  on public.review_replies for delete
  to authenticated
  using (public.is_venue_owner(public.review_venue_id(review_id)));

create policy "admins manage replies"
  on public.review_replies for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke insert, update on public.review_replies from anon, authenticated;
grant insert (review_id, body) on public.review_replies to authenticated;
grant update (body) on public.review_replies to authenticated;
