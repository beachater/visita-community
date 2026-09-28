-- PRD 4.1 dock "Saved" and PRD 4.2 accounts: cafes a signed-in visitor keeps.
-- Signed-out visitors keep them on the device only; on sign-in the device list
-- is merged into this table (union, device order first) by /api/saved.
--
-- Private to the visitor: nobody else, admins included, reads another
-- person's saved list.

create table public.saved_venues (
  profile_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  venue_id   uuid not null references public.venues (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, venue_id)
);

create index saved_venues_profile_idx on public.saved_venues (profile_id, created_at);

alter table public.saved_venues enable row level security;

create policy "visitors read own saved cafes"
  on public.saved_venues for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "visitors save cafes for themselves"
  on public.saved_venues for insert
  to authenticated
  with check (profile_id = (select auth.uid()));

create policy "visitors remove own saved cafes"
  on public.saved_venues for delete
  to authenticated
  using (profile_id = (select auth.uid()));

revoke all on public.saved_venues from anon;
revoke update on public.saved_venues from authenticated;
