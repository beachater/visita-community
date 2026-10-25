-- Editing a published walkthrough keeps the existing .sog while switching
-- its scan record and the public venue metadata in one transaction.
create or replace function public.update_published_scan_experience(p_scan_id uuid, p_experience jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  scan_row public.venue_scans%rowtype;
  polygon jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can edit published scans';
  end if;
  select * into scan_row from public.venue_scans where id = p_scan_id for update;
  if not found or scan_row.status <> 'published' then
    raise exception 'Published scan not found';
  end if;
  polygon := p_experience->'walkable';
  if jsonb_typeof(p_experience->'rotation') is distinct from 'array'
     or jsonb_typeof(p_experience->'start') is distinct from 'object'
     or jsonb_typeof(polygon) is distinct from 'array'
     or jsonb_array_length(polygon) < 3
     or jsonb_typeof(p_experience->'stops') is distinct from 'array' then
    raise exception 'Set orientation, a starting view, and a walkable area before saving';
  end if;
  update public.venue_scans set experience = p_experience where id = p_scan_id;
  update public.venues set scan_experience = p_experience where id = scan_row.venue_id;
end;
$$;

revoke all on function public.update_published_scan_experience(uuid, jsonb) from public;
grant execute on function public.update_published_scan_experience(uuid, jsonb) to authenticated;
