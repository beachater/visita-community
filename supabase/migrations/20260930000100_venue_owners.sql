-- PRD 4.4 "Owner accounts" and 4.5 "Owner approvals": self-registration with
-- manual approval, so nobody can claim a venue they don't own.
--
-- A claim is either for an existing listing (venue_id) or asks for a new one
-- (proposed_venue). It stays pending until an admin approves or rejects it
-- through review_owner_claim(); claimants can't change its status, and nobody
-- reviews their own claim. Proof (a business permit photo or a storefront
-- selfie) lives in R2 under owner-proofs/<claim id>/, which is never served
-- publicly: the owner app's Worker streams it to admins only.

create type public.owner_claim_status as enum ('pending', 'approved', 'rejected');

create table public.venue_owners (
  id             uuid primary key default gen_random_uuid(),
  venue_id       uuid references public.venues (id) on delete cascade,
  profile_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  status         public.owner_claim_status not null default 'pending',
  role_title     text not null check (char_length(trim(role_title)) between 1 and 80),
  contact_phone  text not null check (contact_phone ~ '^\+?[0-9][0-9 ()-]{6,19}$'),
  proof_key      text,
  -- For a new listing: {"name": "...", "address": "...", "lat": 8.4, "lng": 124.6}.
  proposed_venue jsonb,
  review_note    text check (char_length(review_note) <= 1000),
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),

  constraint venue_owners_target check (venue_id is not null or proposed_venue is not null),
  constraint venue_owners_proposed_shape check (
    proposed_venue is null or (
      jsonb_typeof(proposed_venue) = 'object'
      and jsonb_typeof(proposed_venue -> 'name') = 'string'
      and char_length(trim(proposed_venue ->> 'name')) between 1 and 120
      and (proposed_venue -> 'address' is null or jsonb_typeof(proposed_venue -> 'address') = 'string')
      and (proposed_venue -> 'lat' is null) = (proposed_venue -> 'lng' is null)
      and (proposed_venue -> 'lat' is null or (jsonb_typeof(proposed_venue -> 'lat') = 'number' and jsonb_typeof(proposed_venue -> 'lng') = 'number'))
    )
  ),
  -- Proof is always filed under its own claim, so a claimant can't point an
  -- admin at some other file in the bucket.
  constraint venue_owners_proof_location check (
    proof_key is null or (proof_key like 'owner-proofs/' || id::text || '/%' and proof_key !~ '\.\.')
  ),
  constraint venue_owners_reviewed check ((status = 'pending') = (reviewed_at is null))
);

-- One open (pending or approved) claim per person per venue.
create unique index venue_owners_open_claim_idx
  on public.venue_owners (venue_id, profile_id)
  where venue_id is not null and status in ('pending', 'approved');
create index venue_owners_profile_idx on public.venue_owners (profile_id, created_at desc);
create index venue_owners_pending_idx on public.venue_owners (created_at) where status = 'pending';

-- security definer so policies elsewhere (venues, reviews, and later the
-- listing editor) can ask without the caller reading venue_owners. Wrap as
-- (select public.is_venue_owner(x)) in policies where x is constant.
create or replace function public.is_venue_owner(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.venue_owners
    where venue_id = p_venue_id
      and profile_id = (select auth.uid())
      and status = 'approved'
  );
$$;

revoke execute on function public.is_venue_owner(uuid) from public;
grant execute on function public.is_venue_owner(uuid) to anon, authenticated;

-- Claimants may only attach proof, and only while their claim is pending.
-- (Column grants limit what they can write; this limits when.)
create or replace function public.venue_owners_guard_claimant()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() and old.status <> 'pending' then
    raise exception 'this claim has been reviewed and can no longer change'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger venue_owners_guard_claimant
  before update on public.venue_owners
  for each row execute function public.venue_owners_guard_claimant();

alter table public.venue_owners enable row level security;

create policy "people read own claims"
  on public.venue_owners for select
  to authenticated
  using (profile_id = (select auth.uid()));

create policy "owners read their venue's owners"
  on public.venue_owners for select
  to authenticated
  using (venue_id is not null and public.is_venue_owner(venue_id));

create policy "people file own claims"
  on public.venue_owners for insert
  to authenticated
  with check (
    profile_id = (select auth.uid())
    and status = 'pending'
    and (venue_id is null or exists (select 1 from public.venues v where v.id = venue_id and v.is_published))
  );

create policy "claimants update own claims"
  on public.venue_owners for update
  to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

create policy "admins read claims"
  on public.venue_owners for select
  to authenticated
  using ((select public.is_admin()));

revoke insert, update, delete on public.venue_owners from anon, authenticated;
grant insert (venue_id, role_title, contact_phone, proposed_venue) on public.venue_owners to authenticated;
grant update (proof_key) on public.venue_owners to authenticated;


-- Slug for a new listing: "Bagong Kape" → bagong-kape, bagong-kape-2, …
create or replace function public.unique_venue_slug(p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  base text := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  candidate text;
  n int := 1;
begin
  if base = '' then
    base := 'cafe';
  end if;
  base := left(base, 60);
  candidate := base;
  while exists (select 1 from public.venues where slug = candidate) loop
    n := n + 1;
    candidate := base || '-' || n;
  end loop;
  return candidate;
end;
$$;

revoke execute on function public.unique_venue_slug(text) from public, anon, authenticated;


-- The only way a claim's status changes. Approving a new-listing claim
-- creates the listing, unpublished, for the owner to fill in.
create or replace function public.review_owner_claim(
  p_claim_id uuid,
  p_decision public.owner_claim_status,
  p_note text
)
returns public.venue_owners
language plpgsql
security definer
set search_path = ''
as $$
declare
  claim public.venue_owners;
  new_venue_id uuid;
begin
  if not public.is_admin() then
    raise exception 'only admins review owner claims' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'a review approves or rejects' using errcode = '22023';
  end if;

  select * into claim from public.venue_owners where id = p_claim_id for update;
  if not found then
    raise exception 'claim not found' using errcode = 'P0002';
  end if;
  if claim.profile_id = (select auth.uid()) then
    raise exception 'you cannot review your own claim' using errcode = '42501';
  end if;
  if claim.status <> 'pending' then
    raise exception 'this claim has already been reviewed' using errcode = '22023';
  end if;

  if p_decision = 'approved' and claim.venue_id is null then
    insert into public.venues (slug, name, address, lat, lng, is_published)
    values (
      public.unique_venue_slug(claim.proposed_venue ->> 'name'),
      trim(claim.proposed_venue ->> 'name'),
      nullif(trim(claim.proposed_venue ->> 'address'), ''),
      (claim.proposed_venue ->> 'lat')::double precision,
      (claim.proposed_venue ->> 'lng')::double precision,
      false
    )
    returning id into new_venue_id;
    claim.venue_id := new_venue_id;
  end if;

  update public.venue_owners
  set status = p_decision,
      venue_id = claim.venue_id,
      review_note = nullif(trim(p_note), ''),
      reviewed_by = (select auth.uid()),
      reviewed_at = now()
  where id = p_claim_id
  returning * into claim;

  return claim;
end;
$$;

revoke execute on function public.review_owner_claim(uuid, public.owner_claim_status, text) from public, anon;
grant execute on function public.review_owner_claim(uuid, public.owner_claim_status, text) to authenticated;


-- Owners see their own listing even before it's published.
create policy "owners read own venues"
  on public.venues for select
  to authenticated
  using (public.is_venue_owner(id));

-- Owners can't review the venue they own (PRD 4.3/4.4: reviews stay honest).
drop policy "users write own reviews" on public.reviews;
create policy "users write own reviews"
  on public.reviews for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.venues v where v.id = venue_id and v.is_published)
    and not public.is_venue_owner(venue_id)
  );
