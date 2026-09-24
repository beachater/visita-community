-- Venues and the amenity catalog. Venue-generic from V1 (PRD 5.5): the UI is
-- cafe-only for now, and other verticals differ only in venue_type and in
-- which amenity definitions exist for them.
--
-- A venue with splat_url = null is unscanned (white pin on the map).

create type public.venue_type as enum (
  'cafe',
  'pickleball_court',
  'function_room',
  'airbnb'
);


-- ─── Amenity catalog ────────────────────────────────────────────────────────
-- Which amenities a venue type can have, how they display, and how they
-- filter. Adding an amenity, or a whole new vertical's amenities, is a row
-- insert here rather than a code change or schema migration.

create type public.amenity_value_type as enum (
  'boolean',  -- Wi-Fi available, restroom, parking
  'number',   -- outlets, seats, minimum spend
  'text',     -- climate: "2 aircons, 2 fans"
  'list'      -- payment methods, table types
);

create table public.amenity_definitions (
  venue_type    public.venue_type not null,
  key           text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  label         text not null,
  -- Icon name resolved by the frontend's icon set, not an emoji or URL.
  icon          text,
  value_type    public.amenity_value_type not null,
  -- Shown after numeric values when no display label is stored ("outlets", "min").
  unit          text,
  -- Offered as a map filter. boolean = toggle, number = minimum, others = contains.
  is_filterable boolean not null default false,
  -- Position in the collapsed three-stat strip; null = not in the strip.
  summary_rank  smallint check (summary_rank > 0),
  sort_order    smallint not null default 100,
  -- Owner edits to this amenity go through the admin approval queue (PRD 4.4).
  requires_verification boolean not null default true,
  -- Hidden from the UI. Stored values are kept, so re-activating loses nothing.
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  primary key (venue_type, key),
  unique (venue_type, summary_rank)
);

create trigger amenity_definitions_set_updated_at
  before update on public.amenity_definitions
  for each row execute function public.set_updated_at();

alter table public.amenity_definitions enable row level security;

create policy "amenity definitions are public"
  on public.amenity_definitions for select
  to anon, authenticated
  using (true);

create policy "admins manage amenity definitions"
  on public.amenity_definitions for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- The cafe catalog (PRD 4.2). This is configuration, not venue data.
-- Open 24/7 and price range are derived from hours and menu, not stored here.
insert into public.amenity_definitions
  (venue_type, key, label, icon, value_type, unit, is_filterable, summary_rank, sort_order)
values
  ('cafe', 'wifi',            'Wi-Fi',         'wifi',          'boolean', null,      true,  1,    10),
  ('cafe', 'power_outlets',   'Power outlets', 'plug',          'number',  'outlets', true,  2,    20),
  ('cafe', 'tables',          'Tables',        'table',         'number',  'tables',  false, 3,    30),
  ('cafe', 'seats',           'Seats',         'chair',         'number',  'seats',   false, null, 40),
  ('cafe', 'payment_methods', 'Payment',       'credit-card',   'list',    null,      false, null, 50),
  ('cafe', 'climate',         'Climate',       'snowflake',     'text',    null,      false, null, 60),
  ('cafe', 'table_types',     'Table types',   'layout',        'list',    null,      false, null, 70),
  ('cafe', 'restroom',        'Restroom',      'restroom',      'boolean', null,      false, null, 80),
  ('cafe', 'parking',         'Parking',       'car',           'boolean', null,      true,  null, 90),
  ('cafe', 'outdoor',         'Outdoor area',  'leaf',          'boolean', null,      true,  null, 100),
  ('cafe', 'min_spend',       'Minimum spend', 'receipt',       'number',  'PHP',     false, null, 110),
  ('cafe', 'time_limit',      'Time limit',    'hourglass',     'number',  'min',     false, null, 120),
  ('cafe', 'accessibility',   'Accessibility', 'accessibility', 'list',    null,      false, null, 130);


-- ─── Validation for the jsonb columns ───────────────────────────────────────

-- amenities: { "<key>": { "label"?: text, "value"?: <per value_type> } }
--   label = what the card shows, e.g. "7 inside, 2 outside"
--   value = what filters use, e.g. 9
-- At least one of the two is required. An unknown amenity is simply absent:
-- never stored as null or a placeholder, so the UI renders only what's known.
create or replace function public.validate_venue_amenities(p_venue_type public.venue_type, p_amenities jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  k text;
  entry jsonb;
  def_type public.amenity_value_type;
  v jsonb;
  value_ok boolean;
begin
  if jsonb_typeof(p_amenities) <> 'object' then
    raise exception 'amenities must be a json object' using errcode = '22023';
  end if;

  for k, entry in select * from jsonb_each(p_amenities) loop
    select d.value_type into def_type
    from public.amenity_definitions d
    where d.venue_type = p_venue_type and d.key = k;

    if not found then
      raise exception 'amenity "%" is not defined for venue type %', k, p_venue_type
        using errcode = '22023';
    end if;

    if jsonb_typeof(entry) <> 'object'
       or exists (select 1 from jsonb_object_keys(entry) x where x not in ('label', 'value'))
       or not (entry ? 'label' or entry ? 'value') then
      raise exception 'amenity "%" must be {label?, value?} with at least one of them', k
        using errcode = '22023';
    end if;

    if entry ? 'label' and (jsonb_typeof(entry -> 'label') <> 'string' or btrim(entry ->> 'label') = '') then
      raise exception 'amenity "%" label must be non-empty text', k using errcode = '22023';
    end if;

    if entry ? 'value' then
      v := entry -> 'value';
      value_ok := case def_type
        when 'boolean' then jsonb_typeof(v) = 'boolean'
        when 'number'  then case when jsonb_typeof(v) = 'number' then (v #>> '{}')::numeric >= 0 else false end
        when 'text'    then jsonb_typeof(v) = 'string'
        when 'list'    then jsonb_typeof(v) = 'array'
                            and not exists (select 1 from jsonb_array_elements(v) e where jsonb_typeof(e) <> 'string')
      end;
      if not value_ok then
        raise exception 'amenity "%" value must be %', k, def_type using errcode = '22023';
      end if;
    end if;
  end loop;
end;
$$;

-- hours: { "mon": ["08:00", "20:00"] | null, ... }
--   missing day = unknown (no open/closed pill), null = closed,
--   close earlier than open = runs past midnight.
create or replace function public.validate_venue_hours(p_hours jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  d text;
  span jsonb;
begin
  if p_hours is null then
    return;
  end if;
  if jsonb_typeof(p_hours) <> 'object' then
    raise exception 'hours must be a json object' using errcode = '22023';
  end if;
  for d, span in select * from jsonb_each(p_hours) loop
    if d not in ('mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun') then
      raise exception 'hours: unknown day "%"', d using errcode = '22023';
    end if;
    if jsonb_typeof(span) = 'null' then
      continue;
    end if;
    if jsonb_typeof(span) <> 'array' or jsonb_array_length(span) <> 2
       or not coalesce((span ->> 0) ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$', false)
       or not coalesce((span ->> 1) ~ '^([01][0-9]|2[0-4]):[0-5][0-9]$', false) then
      raise exception 'hours: "%" must be null or ["HH:MM", "HH:MM"]', d using errcode = '22023';
    end if;
  end loop;
end;
$$;

-- menu: [{ "name": text, "price_php"?: number, "section"?: text, "note"?: text }]
-- Interim home for menus until the owner menu editor gets its own table.
create or replace function public.validate_venue_menu(p_menu jsonb)
returns void
language plpgsql
immutable
set search_path = ''
as $$
declare
  item jsonb;
  price_ok boolean;
begin
  if jsonb_typeof(p_menu) <> 'array' then
    raise exception 'menu must be a json array' using errcode = '22023';
  end if;
  for item in select * from jsonb_array_elements(p_menu) loop
    price_ok := case
      when not (jsonb_typeof(item) = 'object' and item ? 'price_php') then true
      when jsonb_typeof(item -> 'price_php') = 'number' then (item ->> 'price_php')::numeric >= 0
      else false
    end;
    if jsonb_typeof(item) <> 'object'
       or jsonb_typeof(item -> 'name') is distinct from 'string'
       or btrim(item ->> 'name') = ''
       or exists (select 1 from jsonb_object_keys(item) x where x not in ('name', 'price_php', 'section', 'note'))
       or not price_ok
       or (item ? 'section' and jsonb_typeof(item -> 'section') <> 'string')
       or (item ? 'note' and jsonb_typeof(item -> 'note') <> 'string') then
      raise exception 'menu item must be {name, price_php?, section?, note?}: %', item
        using errcode = '22023';
    end if;
  end loop;
end;
$$;


-- ─── Venues ─────────────────────────────────────────────────────────────────

create table public.venues (
  id              uuid primary key default gen_random_uuid(),
  slug            extensions.citext not null unique,
  venue_type      public.venue_type not null default 'cafe',
  name            text not null,
  address         text,
  city            text not null default 'Cagayan de Oro',
  lat             double precision check (lat between -90 and 90),
  lng             double precision check (lng between -180 and 180),
  google_place_id text unique,
  -- Extra phrases search should match ("sonnys", "sonny's diner"). Keep them
  -- distinctive; generic terms like "cafe" match everything.
  search_terms    text[] not null default '{}',
  -- R2 path of the PlayCanvas .sog walkthrough. The file itself lives in R2.
  splat_url       text,
  scanned_at      timestamptz,
  amenities       jsonb not null default '{}'::jsonb,
  hours           jsonb,
  menu            jsonb not null default '[]'::jsonb,
  is_top_pick     boolean not null default false,
  is_published    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint venues_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint venues_lat_lng_together check ((lat is null) = (lng is null)),
  -- A scan date with no scan would claim verification that doesn't exist. The
  -- reverse is allowed: imported legacy scans may have no known date, and the
  -- UI shows no date rather than a guess.
  constraint venues_scan_date_needs_scan check (scanned_at is null or splat_url is not null)
);

create index venues_published_type_idx on public.venues (venue_type) where is_published;
create index venues_search_terms_idx on public.venues using gin (search_terms);

create trigger venues_set_updated_at
  before update on public.venues
  for each row execute function public.set_updated_at();

create or replace function public.venues_validate_json()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT'
     or new.amenities is distinct from old.amenities
     or new.venue_type is distinct from old.venue_type then
    perform public.validate_venue_amenities(new.venue_type, new.amenities);
  end if;
  if tg_op = 'INSERT' or new.hours is distinct from old.hours then
    perform public.validate_venue_hours(new.hours);
  end if;
  if tg_op = 'INSERT' or new.menu is distinct from old.menu then
    perform public.validate_venue_menu(new.menu);
  end if;
  return new;
end;
$$;

create trigger venues_validate_json
  before insert or update on public.venues
  for each row execute function public.venues_validate_json();

alter table public.venues enable row level security;

create policy "published venues are public"
  on public.venues for select
  to anon, authenticated
  using (is_published);

-- Owner write access arrives with the listing editor (amenity edits go through
-- an approval queue), so for now only admins write.
create policy "admins manage venues"
  on public.venues for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
