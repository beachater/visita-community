-- Local landlines are often written with the area code in brackets:
-- "(088) 856-1234". Allow a leading bracket.
alter table public.venue_owners drop constraint venue_owners_contact_phone_check;
alter table public.venue_owners
  add constraint venue_owners_contact_phone_check check (contact_phone ~ '^\+?[0-9(][0-9 ()-]{6,19}$');
