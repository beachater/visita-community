-- PRD 4.5 admin review of visitor amenity reports (Tier 2). Admins close
-- every open "something's changed" report for one venue amenity at once:
-- 'resolved' when the listing was corrected (or a rescan is booked),
-- 'dismissed' when the listing was already right. Confirmations stay open;
-- they feed the public "confirmed recently" count.

create function public.admin_resolve_amenity_reports(
  p_venue_id    uuid,
  p_amenity_key text,
  p_status      public.amenity_report_status,
  p_note        text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  closed integer;
  note text := nullif(trim(p_note), '');
begin
  if not public.is_admin() then
    raise exception 'admins only' using errcode = '42501';
  end if;
  if p_status not in ('resolved', 'dismissed') then
    raise exception 'reports close as resolved or dismissed' using errcode = '22023';
  end if;

  update public.amenity_reports
     set status = p_status,
         resolved_by = auth.uid(),
         resolved_at = now(),
         resolution_note = note
   where venue_id = p_venue_id
     and amenity_key = p_amenity_key
     and verdict = 'dispute'
     and status = 'open';
  get diagnostics closed = row_count;
  return closed;
end;
$$;

revoke execute on function public.admin_resolve_amenity_reports(uuid, text, public.amenity_report_status, text) from public, anon;
grant execute on function public.admin_resolve_amenity_reports(uuid, text, public.amenity_report_status, text) to authenticated;
