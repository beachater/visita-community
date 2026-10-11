-- Visitor confirmations and change reports between venue rescans.
create type public.amenity_verdict as enum ('confirm', 'dispute');
create type public.amenity_report_status as enum ('open', 'resolved', 'dismissed');

create table public.amenity_reports (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  amenity_key text not null,
  verdict public.amenity_verdict not null,
  comment text check (char_length(comment) <= 300),
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status public.amenity_report_status not null default 'open',
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (char_length(resolution_note) <= 500),
  created_at timestamptz not null default now(),
  constraint amenity_reports_confirm_without_comment check (verdict <> 'confirm' or comment is null)
);

create unique index amenity_reports_one_open_per_visitor_idx
  on public.amenity_reports (profile_id, venue_id, amenity_key) where status = 'open';
create index amenity_reports_open_queue_idx
  on public.amenity_reports (created_at) where status = 'open';
create index amenity_reports_recent_confirms_idx
  on public.amenity_reports (venue_id, created_at desc, amenity_key) where verdict = 'confirm';

create function public.amenity_reports_validate()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  venue public.venues%rowtype;
begin
  select * into venue from public.venues where id = new.venue_id;
  if venue.id is null or not venue.is_published then
    raise exception 'venue must be published' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.amenity_definitions d
    where d.venue_type = venue.venue_type and d.key = new.amenity_key and d.is_active
  ) or not (venue.amenities ? new.amenity_key) then
    raise exception 'amenity is not on this listing' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger amenity_reports_validate
  before insert on public.amenity_reports
  for each row execute function public.amenity_reports_validate();

alter table public.amenity_reports enable row level security;

create policy "visitors read their amenity reports"
  on public.amenity_reports for select to authenticated
  using (profile_id = (select auth.uid()));
create policy "admins read amenity reports"
  on public.amenity_reports for select to authenticated
  using ((select public.is_admin()));
create policy "visitors submit amenity reports"
  on public.amenity_reports for insert to authenticated
  with check (profile_id = (select auth.uid()) and status = 'open'
    and resolved_by is null and resolved_at is null and resolution_note is null);
create policy "admins resolve amenity reports"
  on public.amenity_reports for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

revoke all on public.amenity_reports from public, anon, authenticated;
grant select on public.amenity_reports to authenticated;
grant insert (venue_id, amenity_key, verdict, comment) on public.amenity_reports to authenticated;
grant update (status, resolved_by, resolved_at, resolution_note) on public.amenity_reports to authenticated;

-- Aggregate only: this function never returns a visitor identity or comment.
create function public.amenity_confirmations(p_venue_id uuid)
returns table (amenity_key text, confirmations bigint, last_confirmed_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select r.amenity_key, count(*)::bigint, max(r.created_at)
  from public.amenity_reports r
  join public.venues v on v.id = r.venue_id
  where r.venue_id = p_venue_id
    and v.is_published
    and r.verdict = 'confirm'
    and r.status <> 'dismissed'
    and r.created_at >= now() - interval '90 days'
  group by r.amenity_key;
$$;

revoke execute on function public.amenity_confirmations(uuid) from public;
grant execute on function public.amenity_confirmations(uuid) to anon, authenticated;
