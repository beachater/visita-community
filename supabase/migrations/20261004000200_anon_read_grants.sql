-- Newer hosted Supabase projects don't grant the anon role access to new
-- tables by default (the local stack still does), so signed-out reads failed
-- with 42501 on the hosted project. Grant read access explicitly, only on the
-- tables that have a SELECT policy for anon; RLS still decides which rows.
grant select on
  public.venues,
  public.amenity_definitions,
  public.reviews,
  public.review_replies,
  public.review_awards,
  public.profiles,
  public.badges,
  public.user_badges,
  public.venue_events,
  public.venue_occupancy
to anon;
