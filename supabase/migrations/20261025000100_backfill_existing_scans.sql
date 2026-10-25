-- Scans published before venue_scans existed already have a live R2 key on
-- venues. Register that same file for the admin editor without changing the
-- public venue or uploading another .sog.
insert into public.venue_scans
  (venue_id, version, splat_key, preview_key, scanned_at, experience, status)
select
  v.id,
  greatest(
    coalesce(substring(v.splat_url from '/v([0-9]+)[.]sog$')::integer, 1),
    coalesce((select max(s.version) + 1 from public.venue_scans s where s.venue_id = v.id), 1)
  ),
  v.splat_url,
  v.splat_preview_url,
  v.scanned_at,
  coalesce(v.scan_experience, '{}'::jsonb),
  'published'
from public.venues v
where v.splat_url is not null
  and not exists (
    select 1 from public.venue_scans s
    where s.venue_id = v.id and s.status = 'published'
  )
  and not exists (
    select 1 from public.venue_scans s where s.splat_key = v.splat_url
  )
on conflict do nothing;
