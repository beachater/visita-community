-- Platform settings: switches an admin flips without a deploy. One row only,
-- enforced by the boolean primary key that can only be true.
--
--   in_app_directions  "Get directions" shows the route inside Visita instead
--                      of handing off to Google Maps / Apple Maps. Off by
--                      default, so nothing changes until an admin turns it on.
--
-- Everyone can read the settings (the consumer site needs them signed out);
-- only admins can change them. The row can't be inserted or deleted through
-- the API: there are no insert/delete policies or grants.

create table public.platform_settings (
  id                boolean primary key default true check (id),
  in_app_directions boolean not null default false,
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles (id) on delete set null default auth.uid()
);

insert into public.platform_settings (id) values (true);

create trigger platform_settings_set_updated_at
  before update on public.platform_settings
  for each row execute function public.set_updated_at();

create or replace function public.platform_settings_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := auth.uid();
  return new;
end;
$$;

create trigger platform_settings_stamp
  before update on public.platform_settings
  for each row execute function public.platform_settings_stamp();

alter table public.platform_settings enable row level security;

create policy "anyone reads platform settings" on public.platform_settings
  for select to anon, authenticated
  using (true);

create policy "admins change platform settings" on public.platform_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Explicit grants: hosted projects don't grant new tables by default, while the
-- local stack grants everything, so revoke first and both end up the same.
-- Only the flag columns are writable; RLS limits updates to admins.
revoke insert, update, delete, truncate on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
grant update (in_app_directions) on public.platform_settings to authenticated;
