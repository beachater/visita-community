-- Shared helpers and the admin role.
--
-- Roles live in their own table, never on profiles: users can update their own
-- profile, so a role column there is one missing column grant away from
-- privilege escalation. user_roles has no write policies at all; grant admin
-- via SQL or the service role only.

create extension if not exists citext with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create type public.app_role as enum ('admin');

create table public.user_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

alter table public.user_roles enable row level security;

-- security definer so policies can call it without the caller needing read
-- access to user_roles. Wrap calls as (select public.is_admin()) in policies so
-- Postgres evaluates it once per statement instead of once per row.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create policy "admins read roles"
  on public.user_roles for select
  to authenticated
  using ((select public.is_admin()));
