-- Reviews and review awards.
--
-- One review per user per venue: the simplest guard against farming review
-- points. Moderation hides rather than deletes, so the audit trail survives.

create type public.review_status as enum ('visible', 'hidden');

create table public.reviews (
  id         uuid primary key default gen_random_uuid(),
  venue_id   uuid not null references public.venues (id) on delete cascade,
  author_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text check (char_length(body) <= 5000),
  photo_url  text,
  status     public.review_status not null default 'visible',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (venue_id, author_id)
);

create index reviews_venue_visible_idx on public.reviews (venue_id, created_at desc)
  where status = 'visible';
create index reviews_author_idx on public.reviews (author_id);

create trigger reviews_set_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

-- Column grants can't tell an author from an admin (both are `authenticated`),
-- so status is guarded here: only admins may set or change it.
create or replace function public.reviews_guard_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.status <> 'visible')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    if current_user in ('anon', 'authenticated') and not public.is_admin() then
      raise exception 'only admins can change review status'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger reviews_guard_status
  before insert or update on public.reviews
  for each row execute function public.reviews_guard_status();

alter table public.reviews enable row level security;

create policy "visible reviews are public"
  on public.reviews for select
  to anon, authenticated
  using (status = 'visible');

create policy "authors read own reviews"
  on public.reviews for select
  to authenticated
  using (author_id = (select auth.uid()));

create policy "users write own reviews"
  on public.reviews for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.venues v where v.id = venue_id and v.is_published)
  );

create policy "authors update own reviews"
  on public.reviews for update
  to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors delete own reviews"
  on public.reviews for delete
  to authenticated
  using (author_id = (select auth.uid()));

create policy "admins manage reviews"
  on public.reviews for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Nobody moves a review to another venue or author through the API.
revoke insert, update on public.reviews from anon, authenticated;
grant insert (venue_id, rating, body, photo_url) on public.reviews to authenticated;
grant update (rating, body, photo_url, status) on public.reviews to authenticated;


-- Users spend their own points to award someone else's review. Inserts will go
-- through an RPC that checks the balance and writes the ledger rows in the same
-- transaction, so there is no insert policy for users here.

create table public.review_awards (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews (id) on delete cascade,
  giver_id   uuid not null references public.profiles (id) on delete cascade,
  points     integer not null check (points > 0),
  created_at timestamptz not null default now()
);

create index review_awards_review_idx on public.review_awards (review_id);
create index review_awards_giver_idx on public.review_awards (giver_id);

-- A CHECK can't look at another table, so self-awards are blocked here.
create or replace function public.review_awards_block_self()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.reviews r
    where r.id = new.review_id and r.author_id = new.giver_id
  ) then
    raise exception 'cannot award your own review' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger review_awards_block_self
  before insert on public.review_awards
  for each row execute function public.review_awards_block_self();

alter table public.review_awards enable row level security;

create policy "review awards are public"
  on public.review_awards for select
  to anon, authenticated
  using (true);

create policy "admins manage review awards"
  on public.review_awards for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
