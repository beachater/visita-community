-- Badge catalog and awarded badges. The catalog starts empty: badge names and
-- thresholds are a product decision. Awards are written by Workers only.

create table public.badges (
  id          text primary key check (id ~ '^[a-z0-9_]+$'),
  name        text not null,
  description text,
  category    text not null,
  threshold   integer check (threshold > 0),
  created_at  timestamptz not null default now()
);

create table public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_id   text not null references public.badges (id) on delete restrict,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create index user_badges_badge_idx on public.user_badges (badge_id);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

create policy "badges are public"
  on public.badges for select
  to anon, authenticated
  using (true);

create policy "admins manage badges"
  on public.badges for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "earned badges are public"
  on public.user_badges for select
  to anon, authenticated
  using (true);

create policy "admins manage user badges"
  on public.user_badges for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
