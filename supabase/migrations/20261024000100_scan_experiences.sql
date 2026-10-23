-- A scan is prepared privately by an admin before its keys and experience are
-- copied to the public venue. Older live scans remain usable without metadata.
create table public.venue_scans (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  version integer not null check (version > 0),
  splat_key text not null unique,
  preview_key text,
  scanned_at timestamptz,
  experience jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, version)
);

create unique index venue_scans_one_published_per_venue
  on public.venue_scans (venue_id) where status = 'published';

create trigger venue_scans_set_updated_at
  before update on public.venue_scans
  for each row execute function public.set_updated_at();

alter table public.venue_scans enable row level security;
create policy "admins manage scan drafts"
  on public.venue_scans for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

alter table public.venues add column scan_experience jsonb;

-- All three public values switch together. Direct writes to venue_scans use
-- RLS; publishing is a single transaction with validation at the database.
create or replace function public.publish_venue_scan(p_scan_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  scan_row public.venue_scans%rowtype;
  polygon jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can publish scans';
  end if;
  select * into scan_row from public.venue_scans where id = p_scan_id for update;
  if not found then raise exception 'Scan draft not found'; end if;
  if scan_row.status <> 'draft' then raise exception 'Only draft scans can be published'; end if;
  polygon := scan_row.experience->'walkable';
  if jsonb_typeof(scan_row.experience->'start') <> 'object'
     or jsonb_typeof(polygon) <> 'array'
     or jsonb_array_length(polygon) < 3
     or jsonb_typeof(scan_row.experience->'stops') <> 'array' then
    raise exception 'Set a starting view and a walkable area before publishing';
  end if;
  update public.venue_scans set status = 'archived'
    where venue_id = scan_row.venue_id and status = 'published';
  update public.venue_scans set status = 'published' where id = p_scan_id;
  update public.venues
     set splat_url = scan_row.splat_key,
         splat_preview_url = scan_row.preview_key,
         scanned_at = scan_row.scanned_at,
         scan_experience = scan_row.experience
   where id = scan_row.venue_id;
end;
$$;

revoke all on function public.publish_venue_scan(uuid) from public;
grant execute on function public.publish_venue_scan(uuid) to authenticated;
