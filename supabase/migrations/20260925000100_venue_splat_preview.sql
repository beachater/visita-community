-- Preview-then-full walkthrough loading (decided 2026-09-25 after phone tests).
--
-- splat_preview_url is the R2 key of a small decimated copy of the same scan
-- (about 300K splats, ~6 MB). The viewer shows it within seconds, then swaps
-- in splat_url once that's on screen. Optional: without it the full scan
-- loads on its own.

alter table public.venues
  add column splat_preview_url text;

alter table public.venues
  add constraint venues_preview_needs_scan
  check (splat_preview_url is null or splat_url is not null);

comment on column public.venues.splat_preview_url is
  'R2 key of the preview .sog (splats/<slug>/v<n>-preview.sog). A decimated copy of splat_url, shown while it loads.';
