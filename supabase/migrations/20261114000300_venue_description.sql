-- Cafe description, "About this cafe" (approved 2026-11-14). The owner's own
-- words, shown after the 3D view on the visitor site and labelled "Written by
-- the cafe". Plain text, up to 400 characters, optional. Owners edit it
-- directly through owner_update_listing(), like menu and hours; admins can
-- edit or clear it.

alter table public.venues
  add column description text
    check (description is null or (char_length(description) between 1 and 400));

comment on column public.venues.description is
  'Owner-written "About this cafe", plain text, at most 400 characters. Not verified by Visita.';

-- Same function as before, now also accepting "description" (a string, or
-- null / empty to clear it).
create or replace function public.owner_update_listing(p_venue_id uuid, p_patch jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  extra text;
  new_description text;
begin
  if not (public.is_venue_owner(p_venue_id) or public.is_admin()) then
    raise exception 'only this venue''s owners can edit its listing' using errcode = '42501';
  end if;
  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be a json object' using errcode = '22023';
  end if;
  select k into extra from jsonb_object_keys(p_patch) k where k not in ('menu', 'hours', 'description') limit 1;
  if extra is not null then
    raise exception 'owners edit menu, hours and description directly; "%" is not editable here', extra using errcode = '42501';
  end if;
  if p_patch ? 'description' and jsonb_typeof(p_patch -> 'description') not in ('string', 'null') then
    raise exception 'description must be text' using errcode = '22023';
  end if;
  new_description := nullif(btrim(p_patch ->> 'description'), '');

  -- The venues_validate_json trigger checks menu and hours; the column check
  -- limits the description to 400 characters.
  update public.venues
  set menu = case when p_patch ? 'menu' then p_patch -> 'menu' else menu end,
      hours = case
        when not p_patch ? 'hours' then hours
        when jsonb_typeof(p_patch -> 'hours') = 'null' then null
        else p_patch -> 'hours'
      end,
      description = case when p_patch ? 'description' then new_description else description end
  where id = p_venue_id;
end;
$$;

revoke execute on function public.owner_update_listing(uuid, jsonb) from public, anon;
grant execute on function public.owner_update_listing(uuid, jsonb) to authenticated;
