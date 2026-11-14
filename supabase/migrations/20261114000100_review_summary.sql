-- Reviews past 100 (BEA-18).
--
-- Cafe pages used to read the newest 100 reviews and average them in the
-- app, so a cafe with more reviews showed the wrong count and rating. The
-- count and average now come from this aggregate, and the list is read a
-- page at a time.

-- Average (one decimal) and count of a venue's visible reviews. Runs as the
-- caller, so RLS applies as it does to the list itself; the status filter
-- keeps an author's own hidden review out of the public numbers.
create or replace function public.venue_review_summary(p_venue_id uuid)
returns table (average numeric, review_count integer)
language sql
stable
set search_path = ''
as $$
  select round(avg(r.rating)::numeric, 1), count(*)::integer
  from public.reviews r
  where r.venue_id = p_venue_id and r.status = 'visible';
$$;

revoke execute on function public.venue_review_summary(uuid) from public;
grant execute on function public.venue_review_summary(uuid) to anon, authenticated;

-- Pages are read newest first with (created_at, id) as the cursor; id breaks
-- ties between reviews written in the same instant.
drop index if exists public.reviews_venue_visible_idx;
create index reviews_venue_visible_idx on public.reviews (venue_id, created_at desc, id desc)
  where status = 'visible';
