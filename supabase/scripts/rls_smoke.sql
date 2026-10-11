-- RLS smoke test. Runs everything in one transaction and rolls back.
-- Usage: pnpm db:test:rls  (requires `pnpm db:start`)
\set ON_ERROR_STOP 1
begin;

-- Fixtures (rolled back at the end).
insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-1111-1111-111111111111', 'a@test', '{"full_name":"Alice"}', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'b@test', '{"name":"Bob"}',        'authenticated', 'authenticated'),
  ('33333333-3333-3333-3333-333333333333', 'c@test', '{}',                    'authenticated', 'authenticated');
insert into public.user_roles values ('33333333-3333-3333-3333-333333333333', 'admin');
insert into public.venues (id, slug, name, is_published) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'pub-cafe', 'Pub', true),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'draft-cafe', 'Draft', false),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'owned-cafe', 'Owned', true);
insert into public.badges (id, name, category) values ('test_badge', 'Test', 'test');

create function pg_temp.expect_error(stmt text, label text) returns void
language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL (no error): %', label;
exception
  when others then
    if sqlerrm like 'FAIL (no error)%' then raise; end if;
    raise notice 'PASS %  [%]', label, sqlerrm;
end $$;
grant execute on function pg_temp.expect_error(text, text) to anon, authenticated;

create function pg_temp.pass(label text) returns void language plpgsql as $$
begin raise notice 'PASS %', label; end $$;
grant execute on function pg_temp.pass(text) to anon, authenticated;

do $$ begin
  assert (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alice';
  assert (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'Bob';
end $$;
select pg_temp.pass('profile trigger creates profiles from Google metadata');

-- ---------- anon ----------
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin assert (select count(*) from public.venues where slug in ('pub-cafe', 'draft-cafe')) = 1, 'anon sees drafts'; end $$;
select pg_temp.pass('anon sees only published venues');
do $$ begin assert (select count(*) from public.check_ins) = 0; assert (select count(*) from public.referrals) = 0; end $$;
select pg_temp.expect_error($q$insert into public.venues (slug, name) values ('x', 'x')$q$, 'anon cannot insert venues');
select pg_temp.expect_error($q$insert into public.reviews (venue_id, rating) values ('aaaaaaaa-0000-0000-0000-000000000001', 5)$q$, 'anon cannot write reviews');

-- ---------- Alice ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin assert (select count(*) from public.venues where slug in ('pub-cafe', 'draft-cafe')) = 1, 'user sees drafts'; end $$;
select pg_temp.pass('user sees only published venues');
do $$ begin assert not public.is_admin(); end $$;
select pg_temp.pass('is_admin() false for regular user');

select pg_temp.expect_error($q$insert into public.reviews (id, venue_id, rating) values (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000001', 4)$q$, 'user cannot choose review id');
insert into public.reviews (venue_id, rating, body)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 4, 'Quiet, good outlets');
-- Pin a known id for the rest of the script (as postgres).
reset role;
update public.reviews set id = 'bbbbbbbb-0000-0000-0000-000000000001';
set local role authenticated;
do $$ begin assert (select author_id from public.reviews where id = 'bbbbbbbb-0000-0000-0000-000000000001') = '11111111-1111-1111-1111-111111111111'; end $$;
select pg_temp.pass('user can review a published venue; author_id defaults to auth.uid()');

select pg_temp.expect_error($q$insert into public.reviews (venue_id, rating) values ('aaaaaaaa-0000-0000-0000-000000000002', 5)$q$, 'user cannot review an unpublished venue');
select pg_temp.expect_error($q$insert into public.reviews (venue_id, rating) values ('aaaaaaaa-0000-0000-0000-000000000001', 3)$q$, 'second review on same venue rejected');
select pg_temp.expect_error($q$insert into public.reviews (venue_id, author_id, rating) values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 1)$q$, 'user cannot review as someone else');
select pg_temp.expect_error($q$update public.reviews set status = 'hidden' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 'author cannot change review status');
select pg_temp.expect_error($q$update public.reviews set author_id = '22222222-2222-2222-2222-222222222222' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 'author cannot reassign review');
update public.reviews set rating = 5 where id = 'bbbbbbbb-0000-0000-0000-000000000001';
do $$ begin assert (select rating from public.reviews where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 5; end $$;
select pg_temp.pass('author can edit own rating');

select pg_temp.expect_error($q$insert into public.point_events (user_id, amount, reason) values ('11111111-1111-1111-1111-111111111111', 1000, 'review')$q$, 'user cannot mint points');
select pg_temp.expect_error($q$insert into public.user_roles values ('11111111-1111-1111-1111-111111111111', 'admin')$q$, 'user cannot grant self admin');
select pg_temp.expect_error($q$insert into public.user_badges (user_id, badge_id) values ('11111111-1111-1111-1111-111111111111', 'x')$q$, 'user cannot award self badges');
select pg_temp.expect_error($q$insert into public.check_ins (user_id, venue_id) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 'user cannot write check-ins');
select pg_temp.expect_error($q$insert into public.referrals (referrer_id, referred_id) values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111')$q$, 'user cannot write referrals');

update public.profiles set display_name = 'Mallory' where id = '22222222-2222-2222-2222-222222222222';
do $$ begin assert (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222') = 'Bob', 'profile hijack'; end $$;
select pg_temp.pass('user cannot edit another profile (0 rows updated)');
update public.profiles set display_name = 'Alice P.' where id = '11111111-1111-1111-1111-111111111111';
do $$ begin assert (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111') = 'Alice P.'; end $$;
select pg_temp.pass('user can edit own profile');
insert into public.saved_venues (venue_id) values ('aaaaaaaa-0000-0000-0000-000000000001');
do $$ begin assert (select profile_id from public.saved_venues limit 1) = '11111111-1111-1111-1111-111111111111'; end $$;
select pg_temp.pass('visitor saves a cafe; profile_id defaults to them');
select pg_temp.expect_error($q$insert into public.saved_venues (profile_id, venue_id) values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 'visitor cannot save for someone else');
select pg_temp.expect_error($q$insert into public.saved_venues (venue_id) values ('aaaaaaaa-0000-0000-0000-000000000001')$q$, 'saving twice is refused');

-- ---------- service role (Workers) ----------
reset role;
set local role service_role;
insert into public.point_events (user_id, amount, reason, source_id) values
  ('11111111-1111-1111-1111-111111111111', 10, 'review', 'bbbbbbbb-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 50, 'admin_adjustment', null);
select pg_temp.expect_error($q$insert into public.point_events (user_id, amount, reason, source_id) values ('11111111-1111-1111-1111-111111111111', 10, 'review', 'bbbbbbbb-0000-0000-0000-000000000001')$q$, 'duplicate award for same source rejected (idempotency)');
select pg_temp.expect_error($q$insert into public.review_awards (review_id, giver_id, points) values ('bbbbbbbb-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 5)$q$, 'self-award rejected');
insert into public.review_awards (review_id, giver_id, points) values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 5);
select pg_temp.expect_error($q$insert into public.referrals (referrer_id, referred_id) values ('11111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111')$q$, 'self-referral rejected');
select pg_temp.expect_error($q$update public.venues set scanned_at = now() where slug = 'pub-cafe'$q$, 'scan date without a scan rejected');
select pg_temp.expect_error($q$update public.venues set splat_preview_url = 'splats/x/v1-preview.sog' where slug = 'pub-cafe'$q$, 'preview without a full scan rejected');
select pg_temp.expect_error($q$update public.venues set amenities = '{"jacuzzi": {"value": true}}' where slug = 'pub-cafe'$q$, 'undefined amenity key rejected');
select pg_temp.expect_error($q$update public.venues set amenities = '{"power_outlets": {"value": "lots"}}' where slug = 'pub-cafe'$q$, 'amenity value of wrong type rejected');
select pg_temp.expect_error($q$update public.venues set amenities = '{"wifi": {}}' where slug = 'pub-cafe'$q$, 'empty amenity entry rejected');
update public.venues set amenities = '{"wifi": {"label": "100 Mbps", "value": true}, "power_outlets": {"label": "7 inside, 2 outside", "value": 9}, "payment_methods": {"value": ["Cash", "GCash"]}}' where slug = 'pub-cafe';
select pg_temp.pass('valid amenities accepted');
select pg_temp.expect_error($q$update public.venues set hours = '{"mon": ["8am", "5pm"]}' where slug = 'pub-cafe'$q$, 'malformed hours rejected');
update public.venues set hours = '{"mon": ["18:00", "02:00"], "sun": null}' where slug = 'pub-cafe';
select pg_temp.pass('overnight and closed hours accepted');
select pg_temp.expect_error($q$update public.venues set menu = '[{"name": "Latte", "price_php": "120"}]' where slug = 'pub-cafe'$q$, 'menu price as text rejected');
update public.venues set menu = '[{"name": "Latte", "price_php": 120}, {"name": "Turon"}]' where slug = 'pub-cafe';
select pg_temp.pass('valid menu accepted');

-- ---------- demand requests ("I want to see inside") ----------
insert into public.demand_requests (venue_id, device_id)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'device-aaaaaaaaaaaaaaaa');
select pg_temp.pass('service role records a demand request');
select pg_temp.expect_error($q$insert into public.demand_requests (venue_id, device_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'device-aaaaaaaaaaaaaaaa')$q$, 'one request per device per venue');
select pg_temp.expect_error($q$insert into public.demand_requests (device_id) values ('device-bbbbbbbbbbbbbbbb')$q$, 'a request needs a venue or place');
select pg_temp.expect_error($q$insert into public.demand_requests (venue_id, device_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'x')$q$, 'device id must look like one');

-- ---------- Alice again: ledger visibility ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.point_events) = 1, 'user sees others points';
  assert (select balance from public.point_balances) = 10;
  assert (select count(*) from public.point_balances) = 1;
end $$;
select pg_temp.pass('user sees only own points and balance');
do $$ begin assert (select count(*) from public.demand_requests) = 0, 'user reads demand queue'; end $$;
select pg_temp.pass('visitors cannot read the demand queue');
select pg_temp.expect_error($q$insert into public.demand_requests (venue_id, device_id) values ('aaaaaaaa-0000-0000-0000-000000000001', 'device-cccccccccccccccc')$q$, 'visitors cannot write demand directly');

-- ---------- Bob: saved cafes are private ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$ begin assert (select count(*) from public.saved_venues) = 0, 'bob sees alice saves'; end $$;
select pg_temp.pass('visitors cannot see other people''s saved cafes');
delete from public.saved_venues;
reset role;
do $$ begin assert (select count(*) from public.saved_venues) = 1, 'bob deleted alice saves'; end $$;
select pg_temp.pass('visitors cannot remove other people''s saved cafes');
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.expect_error($q$insert into public.saved_venues (profile_id, venue_id) values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001')$q$, 'signed-out visitors cannot save to an account');

-- ---------- admin ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$ begin assert public.is_admin(); assert (select count(*) from public.venues where slug in ('pub-cafe', 'draft-cafe')) = 2; end $$;
select pg_temp.pass('admin sees drafts');
update public.reviews set status = 'hidden' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
do $$ begin assert (select status from public.reviews where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'hidden'; end $$;
select pg_temp.pass('admin can hide a review');
do $$ begin assert (select count(*) from public.point_balances) = 2; end $$;
select pg_temp.pass('admin sees all balances');
do $$ begin assert (select count(*) from public.demand_requests) = 1; end $$;
select pg_temp.pass('admin reads the demand queue');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin assert (select count(*) from public.reviews) = 0; end $$;
select pg_temp.pass('hidden review invisible to public');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin assert (select count(*) from public.reviews) = 1; end $$;
select pg_temp.pass('author still sees own hidden review');

-- ---------- venue owners: claims and approvals (PRD 4.4, 4.5) ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
insert into public.venue_owners (venue_id, role_title, contact_phone)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'Owner', '+63 917 123 4567');
do $$ begin
  assert (select status from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'pending';
  assert (select profile_id from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = '22222222-2222-2222-2222-222222222222';
end $$;
select pg_temp.pass('a claim starts pending and belongs to the claimant');
select pg_temp.expect_error($q$insert into public.venue_owners (venue_id, role_title, contact_phone, status) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Owner', '+63 917 123 4567', 'approved')$q$, 'claimant cannot file an approved claim');
select pg_temp.expect_error($q$update public.venue_owners set status = 'approved'$q$, 'claimant cannot approve their own claim');
select pg_temp.expect_error($q$insert into public.venue_owners (venue_id, role_title, contact_phone) values ('aaaaaaaa-0000-0000-0000-000000000003', 'Manager', '+63 917 123 4567')$q$, 'one open claim per person per venue');
select pg_temp.expect_error($q$insert into public.venue_owners (venue_id, role_title, contact_phone) values ('aaaaaaaa-0000-0000-0000-000000000002', 'Owner', '+63 917 123 4567')$q$, 'cannot claim an unpublished listing');
select pg_temp.expect_error($q$insert into public.venue_owners (venue_id, role_title, contact_phone) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Owner', 'call me')$q$, 'contact number must look like one');
insert into public.venue_owners (venue_id, role_title, contact_phone) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Manager', '(088) 856-1234');
select pg_temp.pass('a landline with an area code in brackets is accepted');
insert into public.venue_owners (proposed_venue, role_title, contact_phone)
  values ('{"name": "Bagong Kape", "address": "Divisoria, CDO"}', 'Owner', '09171234567');
select pg_temp.pass('a claim can request a new listing');
update public.venue_owners set proof_key = 'owner-proofs/' || id || '/permit.jpg' where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$ begin assert (select proof_key from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') like 'owner-proofs/%/permit.jpg'; end $$;
select pg_temp.pass('claimant attaches proof to a pending claim');
select pg_temp.expect_error($q$update public.venue_owners set proof_key = 'splats/sonnys/v1.sog' where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$, 'proof must be filed under its own claim');
do $$ begin assert not public.is_venue_owner('aaaaaaaa-0000-0000-0000-000000000003'); end $$;
update public.venues set name = 'Hijacked' where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select pg_temp.expect_error($q$select public.review_owner_claim((select id from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'approved', null)$q$, 'only admins review claims');

reset role;
do $$ begin assert (select name from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Owned', 'pending owner edited venue'; end $$;
select pg_temp.pass('a pending owner cannot touch the venue');

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin assert (select count(*) from public.venue_owners) = 0, 'alice sees bob claims'; end $$;
select pg_temp.pass('people cannot see other people''s claims');

-- Admin, who also claims a cafe of their own.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.venue_owners (venue_id, role_title, contact_phone) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Owner', '+63 917 000 0000');
select pg_temp.expect_error($q$select public.review_owner_claim((select id from public.venue_owners where profile_id = '33333333-3333-3333-3333-333333333333'), 'approved', null)$q$, 'an admin cannot approve their own claim');
do $$ begin assert (select count(*) from public.venue_owners) = 4; end $$;
select pg_temp.pass('admins see every claim');
select public.review_owner_claim((select id from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'approved', 'Permit checked');
select public.review_owner_claim((select id from public.venue_owners where proposed_venue is not null), 'approved', null);
do $$ begin
  assert (select status from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'approved';
  assert (select reviewed_by from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = '33333333-3333-3333-3333-333333333333';
  assert (select is_published from public.venues where slug = 'bagong-kape') = false;
  assert (select v.slug from public.venue_owners o join public.venues v on v.id = o.venue_id where o.proposed_venue is not null) = 'bagong-kape';
end $$;
select pg_temp.pass('approving a new-listing claim creates an unpublished listing for it');
select pg_temp.expect_error($q$select public.review_owner_claim((select id from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'rejected', null)$q$, 'a reviewed claim is final');
select pg_temp.expect_error($q$select public.review_owner_claim((select id from public.venue_owners where profile_id = '33333333-3333-3333-3333-333333333333'), 'pending', null)$q$, 'a review approves or rejects');

-- Bob, now an approved owner of "Owned" and of the new listing.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$ begin
  assert public.is_venue_owner('aaaaaaaa-0000-0000-0000-000000000003');
  assert not public.is_venue_owner('aaaaaaaa-0000-0000-0000-000000000001');
end $$;
select pg_temp.pass('the owner of venue A is not an owner of venue B');
do $$ begin assert (select review_note from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Permit checked'; end $$;
select pg_temp.pass('claimants read the reviewer''s note');
do $$ begin assert (select count(*) from public.venues where slug = 'bagong-kape') = 1; end $$;
select pg_temp.pass('owners read their own unpublished listing');
select pg_temp.expect_error($q$insert into public.reviews (venue_id, rating) values ('aaaaaaaa-0000-0000-0000-000000000003', 5)$q$, 'owners cannot review their own venue');
select pg_temp.expect_error($q$update public.venue_owners set proof_key = 'owner-proofs/' || id || '/other.jpg' where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'$q$, 'proof is fixed once a claim is reviewed');

-- Alice owns nothing, so she can't read the owner list of Bob's venue.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
do $$ begin assert (select count(*) from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 0; end $$;
select pg_temp.pass('non-owners cannot read a venue''s owner list');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.expect_error($q$insert into public.venue_owners (venue_id, role_title, contact_phone) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Owner', '+63 917 123 4567')$q$, 'signed-out visitors cannot file claims');
do $$ begin assert not public.is_venue_owner('aaaaaaaa-0000-0000-0000-000000000003'); end $$;
select pg_temp.pass('signed-out visitors own nothing');
reset role;

-- ---------- owner workflow: listing edits, amenity requests, events, occupancy, replies (PRD 4.4) ----------
-- Bob is the approved owner of "Owned" (aaaa…0003) from the block above.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
insert into public.reviews (venue_id, rating, body) values ('aaaaaaaa-0000-0000-0000-000000000003', 4, 'Nice patio');
select pg_temp.expect_error($q$select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000003', '{"menu": []}')$q$, 'non-owners cannot edit a listing');
select pg_temp.expect_error($q$select public.set_occupancy('aaaaaaaa-0000-0000-0000-000000000003', 'full')$q$, 'non-owners cannot set occupancy');
select pg_temp.expect_error($q$insert into public.venue_events (venue_id, title, starts_at, ends_at) values ('aaaaaaaa-0000-0000-0000-000000000003', 'Fake', now(), now() + interval '1 hour')$q$, 'non-owners cannot post events');
select pg_temp.expect_error($q$insert into public.review_replies (review_id, body) values ((select id from public.reviews where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'Thanks!')$q$, 'non-owners cannot reply to reviews');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000003',
  '{"menu": [{"name": "Latte", "price_php": 140, "section": "Coffee"}], "hours": {"mon": ["08:00", "20:00"], "fri": ["18:00", "02:00"], "sun": null}}');
do $$ begin
  assert (select menu -> 0 ->> 'name' from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Latte';
  assert (select hours -> 'fri' ->> 1 from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') = '02:00';
end $$;
select pg_temp.pass('an owner edits their menu and hours, including overnight');
select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000003', '{"hours": null}');
do $$ begin
  assert (select hours from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') is null;
  assert (select menu -> 0 ->> 'name' from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Latte';
end $$;
select pg_temp.pass('a patch changes only the fields it names');
select pg_temp.expect_error($q$select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000003', '{"name": "Renamed"}')$q$, 'owners cannot edit fields outside menu and hours');
select pg_temp.expect_error($q$select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000003', '{"amenities": {"wifi": {"value": true}}}')$q$, 'verified amenities cannot be edited directly');
select pg_temp.expect_error($q$select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000003', '{"menu": [{"name": "Latte", "price_php": "cheap"}]}')$q$, 'menu edits are validated');
select pg_temp.expect_error($q$select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000003', '{"hours": {"mon": ["8am", "8pm"]}}')$q$, 'hours edits are validated');
select pg_temp.expect_error($q$select public.owner_update_listing('aaaaaaaa-0000-0000-0000-000000000001', '{"menu": []}')$q$, 'the owner of venue A cannot edit venue B');
update public.venues set menu = '[]' where id = 'aaaaaaaa-0000-0000-0000-000000000003';

-- Amenity change requests
insert into public.amenity_change_requests (venue_id, amenity_key, entry) values ('aaaaaaaa-0000-0000-0000-000000000003', 'wifi', '{"value": true, "label": "Fibre, 100 Mbps"}');
do $$ begin assert (select status from public.amenity_change_requests where amenity_key = 'wifi') = 'pending'; end $$;
select pg_temp.pass('an owner requests a verified amenity change, pending review');
select pg_temp.expect_error($q$insert into public.amenity_change_requests (venue_id, amenity_key, entry) values ('aaaaaaaa-0000-0000-0000-000000000003', 'wifi', '{"value": false}')$q$, 'one pending request per amenity');
select pg_temp.expect_error($q$insert into public.amenity_change_requests (venue_id, amenity_key, entry) values ('aaaaaaaa-0000-0000-0000-000000000003', 'jacuzzi', '{"value": true}')$q$, 'requests must name a defined amenity');
select pg_temp.expect_error($q$insert into public.amenity_change_requests (venue_id, amenity_key, entry) values ('aaaaaaaa-0000-0000-0000-000000000003', 'power_outlets', '{"value": "lots"}')$q$, 'requested values are validated');
select pg_temp.expect_error($q$insert into public.amenity_change_requests (venue_id, amenity_key, entry) values ('aaaaaaaa-0000-0000-0000-000000000001', 'parking', '{"value": true}')$q$, 'owners cannot request changes for venues they do not own');
select pg_temp.expect_error($q$select public.review_amenity_change((select id from public.amenity_change_requests where amenity_key = 'wifi'), 'approved', null)$q$, 'owners cannot approve their own amenity requests');
insert into public.amenity_change_requests (venue_id, amenity_key, entry) values ('aaaaaaaa-0000-0000-0000-000000000003', 'outdoor', null);
select pg_temp.pass('an owner can request removing an amenity');

-- Events
insert into public.venue_events (venue_id, title, description, starts_at, ends_at)
  values ('aaaaaaaa-0000-0000-0000-000000000003', 'Open mic', 'Bring a song', now() + interval '1 day', now() + interval '1 day 3 hours');
select pg_temp.pass('an owner posts an event');
select pg_temp.expect_error($q$insert into public.venue_events (venue_id, title, starts_at, ends_at) values ('aaaaaaaa-0000-0000-0000-000000000003', 'Backwards', now(), now() - interval '1 hour')$q$, 'an event ends after it starts');
update public.venue_events set title = 'Open mic night' where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003';
do $$ begin assert (select title from public.venue_events where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Open mic night'; end $$;
select pg_temp.pass('an owner edits their event');
select pg_temp.expect_error($q$update public.venue_events set venue_id = 'aaaaaaaa-0000-0000-0000-000000000001'$q$, 'events cannot move to another venue');

-- Occupancy
select public.set_occupancy('aaaaaaaa-0000-0000-0000-000000000003', 'moderate');
select public.set_occupancy('aaaaaaaa-0000-0000-0000-000000000003', 'full');
do $$ begin
  assert (select level from public.venue_occupancy where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'full';
  assert (select expires_at - set_at from public.venue_occupancy where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = interval '3 hours';
end $$;
select pg_temp.pass('occupancy is one tap and expires three hours after it is set');
select pg_temp.expect_error($q$insert into public.venue_occupancy (venue_id, level, set_at) values ('aaaaaaaa-0000-0000-0000-000000000003', 'quiet', now() + interval '1 day')$q$, 'occupancy is set only through set_occupancy');

-- Review replies
insert into public.review_replies (review_id, body) values ((select id from public.reviews where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'Thanks for visiting!');
select pg_temp.pass('an owner replies to a review of their venue');
select pg_temp.expect_error($q$insert into public.review_replies (review_id, body) values ((select id from public.reviews where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003'), 'Again')$q$, 'one reply per review');
select pg_temp.expect_error($q$insert into public.review_replies (review_id, body) values ('bbbbbbbb-0000-0000-0000-000000000001', 'Not my venue')$q$, 'owners cannot reply to reviews of other venues');

-- What the public sees
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin
  assert (select count(*) from public.venue_events where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 1;
  assert (select level from public.venue_occupancy where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'full';
  assert (select body from public.review_replies) = 'Thanks for visiting!';
  assert (select count(*) from public.amenity_change_requests) = 0;
end $$;
select pg_temp.pass('visitors see events, current occupancy and replies, not amenity requests');
do $$ begin assert (select menu -> 0 ->> 'name' from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Latte', 'direct update got through'; end $$;
select pg_temp.pass('owners cannot bypass the RPC with a direct update');

reset role;
update public.venue_occupancy set set_at = now() - interval '4 hours', expires_at = now() - interval '1 hour' where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003';
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$ begin assert (select count(*) from public.venue_occupancy) = 0; end $$;
select pg_temp.pass('expired occupancy is not shown');

-- Admin reviews amenity requests
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
select public.review_amenity_change((select id from public.amenity_change_requests where amenity_key = 'wifi'), 'approved', 'Checked on the rescan');
select public.review_amenity_change((select id from public.amenity_change_requests where amenity_key = 'outdoor'), 'rejected', 'The patio is still there');
do $$ begin
  assert (select amenities -> 'wifi' ->> 'label' from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'Fibre, 100 Mbps';
  assert (select status from public.amenity_change_requests where amenity_key = 'outdoor') = 'rejected';
end $$;
select pg_temp.pass('approving an amenity request updates the listing');
select pg_temp.expect_error($q$select public.review_amenity_change((select id from public.amenity_change_requests where amenity_key = 'wifi'), 'rejected', null)$q$, 'a reviewed amenity request is final');
reset role;

-- ---------- analytics (PRD 4.4): raw events private, owners get totals ----------
reset role;
set local role service_role;
insert into public.analytics_events (venue_id, type, session_id, props, occurred_at) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'profile_view',     'sess-aaaaaaaaaaaaaaaa', '{}', '2026-09-28 11:05+08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'profile_view',     'sess-bbbbbbbbbbbbbbbb', '{"filters": ["wifi", "open247"]}', '2026-09-28 11:40+08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'profile_view',     'sess-cccccccccccccccc', '{"filters": ["wifi"]}', '2026-09-29 19:10+08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'profile_view',     'sess-dddddddddddddddd', '{}', '2026-09-29 19:20+08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'walkthrough_open', 'sess-aaaaaaaaaaaaaaaa', '{}', '2026-09-28 11:06+08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'directions_tap',   'sess-aaaaaaaaaaaaaaaa', '{}', '2026-09-28 11:08+08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'search_appearance','sess-eeeeeeeeeeeeeeee', '{}', '2026-09-29 09:00+08'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'profile_view',     'sess-ffffffffffffffff', '{}', '2024-01-10 10:00+08'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'profile_view',     'sess-aaaaaaaaaaaaaaaa', '{}', '2026-09-28 12:00+08');
select pg_temp.pass('the Worker (service role) records events');
select pg_temp.expect_error($q$insert into public.analytics_events (venue_id, type, session_id) values ('aaaaaaaa-0000-0000-0000-000000000003', 'page_scroll', 'sess-aaaaaaaaaaaaaaaa')$q$, 'unknown event types are refused');
select pg_temp.expect_error($q$insert into public.analytics_events (venue_id, type, session_id) values ('aaaaaaaa-0000-0000-0000-000000000003', 'profile_view', 'x')$q$, 'session ids must look like one');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.expect_error($q$insert into public.analytics_events (venue_id, type, session_id) values ('aaaaaaaa-0000-0000-0000-000000000003', 'profile_view', 'sess-aaaaaaaaaaaaaaaa')$q$, 'visitors cannot write events directly');
select pg_temp.expect_error($q$select public.venue_stats('aaaaaaaa-0000-0000-0000-000000000003', '2026-09-01', '2026-10-01')$q$, 'signed-out visitors get no stats');

-- Bob owns "Owned" (aaaa…0003).
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select pg_temp.expect_error($q$select count(*) from public.analytics_events$q$, 'owners cannot read raw events');
do $$
declare s jsonb := public.venue_stats('aaaaaaaa-0000-0000-0000-000000000003', '2026-09-01 00:00+08', '2026-10-01 00:00+08');
begin
  assert (s -> 'totals' ->> 'profile_view')::int = 4, 'profile views: ' || s::text;
  assert (s -> 'totals' ->> 'walkthrough_open')::int = 1;
  assert (s -> 'totals' ->> 'directions_tap')::int = 1;
  assert (s -> 'totals' ->> 'search_appearance')::int = 1;
  assert (s ->> 'conversion')::numeric = 0.25, 'conversion: ' || (s ->> 'conversion');
  -- Monday 28 Sep 2026, 11:00 Manila: two views. ISO weekday 1 = Monday.
  assert exists (select 1 from jsonb_array_elements(s -> 'peak') p where (p ->> 'dow')::int = 1 and (p ->> 'hour')::int = 11 and (p ->> 'count')::int = 2), 'peak: ' || (s -> 'peak')::text;
  assert (s -> 'filters' -> 0 ->> 'filter') = 'wifi' and (s -> 'filters' -> 0 ->> 'count')::int = 2, 'filters: ' || (s -> 'filters')::text;
  assert jsonb_array_length(s -> 'daily') = 2;
end $$;
select pg_temp.pass('an owner gets totals, conversion, peak hours (Manila time), top filters and a daily series');
select pg_temp.expect_error($q$select public.venue_stats('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-01', '2026-10-01')$q$, 'the owner of venue A cannot read venue B''s stats');
select pg_temp.expect_error($q$select public.venue_stats('aaaaaaaa-0000-0000-0000-000000000003', '2025-01-01', '2026-10-01')$q$, 'stats cover at most a year per request');

-- Demand before sign-up: requests made before the venue's first owner was approved.
reset role;
insert into public.demand_requests (venue_id, device_id, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'device-dddddddddddddddd', now() - interval '30 days'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'device-eeeeeeeeeeeeeeee', now() + interval '1 day');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$ begin assert (public.venue_stats('aaaaaaaa-0000-0000-0000-000000000003', now() - interval '7 days', now()) ->> 'demand_before_signup')::int = 1; end $$;
select pg_temp.pass('owners see how many visitors asked for a scan before they joined');

-- Admins can read any venue's stats.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$ begin assert (public.venue_stats('aaaaaaaa-0000-0000-0000-000000000001', '2026-09-01 00:00+08', '2026-10-01 00:00+08') -> 'totals' ->> 'profile_view')::int = 1; end $$;
select pg_temp.pass('admins read any venue''s stats');

-- Retention: raw events older than 24 months become daily totals.
reset role;
select public.purge_old_analytics();
do $$ begin
  assert (select count(*) from public.analytics_events where occurred_at < now() - interval '24 months') = 0;
  assert (select count from public.analytics_daily where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003' and day = '2024-01-10' and type = 'profile_view') = 1;
  assert (select count(*) from public.analytics_events) = 9 - 1;
end $$;
select pg_temp.pass('events older than 24 months are kept only as daily totals');
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
select pg_temp.expect_error($q$select count(*) from public.analytics_daily$q$, 'owners cannot read the rollup table directly');
reset role;

-- ---------- admin panel (PRD 4.5): venue management and moderation ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
insert into public.venues (slug, name, lat, lng, is_published) values ('new-cafe', 'New Cafe', 8.48, 124.64, false);
update public.venues set is_published = true, is_top_pick = true, amenities = '{"wifi": {"value": true, "label": "Fibre"}}' where slug = 'new-cafe';
do $$ begin assert (select is_published and is_top_pick from public.venues where slug = 'new-cafe'); end $$;
select pg_temp.pass('admins create, publish and feature a venue');
select pg_temp.expect_error($q$update public.venues set amenities = '{"wifi": {"value": "yes"}}' where slug = 'new-cafe'$q$, 'admin amenity edits are validated too');
update public.venues set splat_url = 'splats/new-cafe/v1.sog', splat_preview_url = 'splats/new-cafe/v1-preview.sog', scanned_at = now() where slug = 'new-cafe';
select pg_temp.pass('admins attach a scan and its preview');
update public.venues set is_published = false where slug = 'new-cafe';
update public.reviews set status = 'visible' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
do $$ begin assert (select status from public.reviews where id = 'bbbbbbbb-0000-0000-0000-000000000001') = 'visible'; end $$;
select pg_temp.pass('admins unhide a review');
update public.reviews set status = 'hidden' where id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- Owners and visitors can't do admin work.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
update public.venues set is_published = true where slug = 'new-cafe';
update public.venues set is_top_pick = true where id = 'aaaaaaaa-0000-0000-0000-000000000003';
select pg_temp.expect_error($q$insert into public.venues (slug, name) values ('sneaky', 'Sneaky')$q$, 'non-admins cannot create venues');
update public.reviews set status = 'hidden' where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003';
reset role;
do $$ begin
  assert (select is_published from public.venues where slug = 'new-cafe') = false, 'owner published a venue';
  assert (select is_top_pick from public.venues where id = 'aaaaaaaa-0000-0000-0000-000000000003') = false, 'owner featured their venue';
end $$;
select pg_temp.pass('owners cannot publish or feature venues');
do $$ begin assert (select status from public.reviews where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 'visible', 'owner hid a review'; end $$;
select pg_temp.pass('owners cannot hide reviews of their venue');

-- ---------- final review fixes ----------
-- 1. A review photo can only live under its own review, so nothing that
--    deletes "the review's photo" can be pointed at a scan or someone's proof.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select pg_temp.expect_error($q$update public.reviews set photo_url = 'splats/sonnys/v1.sog' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 'a review photo cannot point at a scan');
select pg_temp.expect_error($q$update public.reviews set photo_url = 'reviews/cccccccc-0000-0000-0000-000000000009/x.jpg' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 'a review photo cannot point at another review''s folder');
select pg_temp.expect_error($q$update public.reviews set photo_url = 'reviews/bbbbbbbb-0000-0000-0000-000000000001/../../splats/x.sog' where id = 'bbbbbbbb-0000-0000-0000-000000000001'$q$, 'a review photo cannot climb out of its folder');
update public.reviews set photo_url = 'reviews/bbbbbbbb-0000-0000-0000-000000000001/a.jpg' where id = 'bbbbbbbb-0000-0000-0000-000000000001';
select pg_temp.pass('a review photo under its own review is fine');

-- 2. Co-owners see each other's names and roles, never other claimants or phone numbers.
insert into public.venue_owners (venue_id, role_title, contact_phone) values ('aaaaaaaa-0000-0000-0000-000000000003', 'Manager', '0918 999 0000');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';
do $$ begin
  assert (select count(*) from public.venue_owners where profile_id = '11111111-1111-1111-1111-111111111111') = 0, 'owner sees a pending claimant';
  assert (select count(*) from public.venue_owners where venue_id = 'aaaaaaaa-0000-0000-0000-000000000003') = 1, 'owner sees more than their own claim';
end $$;
select pg_temp.pass('owners cannot read other people''s claims on their venue');
do $$
declare names jsonb := (select jsonb_agg(to_jsonb(o)) from public.venue_owner_names('aaaaaaaa-0000-0000-0000-000000000003') o);
begin
  assert jsonb_array_length(names) = 1, names::text;
  assert names -> 0 ->> 'role_title' = 'Owner';
  assert not (names -> 0 ? 'contact_phone');
end $$;
select pg_temp.pass('owners see their approved co-owners by name and role only');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select pg_temp.expect_error($q$select * from public.venue_owner_names('aaaaaaaa-0000-0000-0000-000000000003')$q$, 'non-owners cannot list a venue''s owners');

-- 6. Stats and demand resist scripted repeats.
reset role;
set local role service_role;
insert into public.analytics_events (venue_id, type, session_id, occurred_at) values ('aaaaaaaa-0000-0000-0000-000000000003', 'directions_tap', 'sess-dup0000000000000', '2026-09-29 10:05+08');
select pg_temp.expect_error($q$insert into public.analytics_events (venue_id, type, session_id, occurred_at) values ('aaaaaaaa-0000-0000-0000-000000000003', 'directions_tap', 'sess-dup0000000000000', '2026-09-29 10:50+08')$q$, 'one event per session, venue and type per hour');
insert into public.analytics_events (venue_id, type, session_id, occurred_at) values ('aaaaaaaa-0000-0000-0000-000000000003', 'directions_tap', 'sess-dup0000000000000', '2026-09-29 11:05+08');
select pg_temp.pass('the same session counts again in a later hour');
reset role;
insert into public.demand_requests (venue_id, device_id, ip_hash, created_at) values ('aaaaaaaa-0000-0000-0000-000000000001', 'device-ffffffffffffffff', 'hash-old', now() - interval '3 days');
select public.purge_old_analytics();
do $$ begin assert (select ip_hash from public.demand_requests where device_id = 'device-ffffffffffffffff') is null; end $$;
select pg_temp.pass('demand network hashes are erased after two days');
reset role;

-- 7. Admin demand queue: totals per venue, admins only.
insert into public.demand_requests (venue_id, device_id, profile_id, created_at) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'device-q1aaaaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', now() - interval '2 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'device-q4aaaaaaaaaaaaaa', null, now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'device-q2aaaaaaaaaaaaaa', null, now() - interval '20 days'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'device-q3aaaaaaaaaaaaaa', null, now() - interval '90 days');
set local role authenticated;
set local request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';
do $$
declare q record;
begin
  select * into q from public.admin_demand_queue() where slug = 'draft-cafe';
  assert q.total = 4, 'demand total';
  assert q.last_7_days = 2 and q.last_30_days = 3, 'demand windows';
  assert q.signed_in = 1, 'signed-in requests';
  assert not q.scanned and not q.has_owner, 'scan and owner flags';
  assert (select slug from public.admin_demand_queue() limit 1) = 'draft-cafe', 'busiest venue first';
end $$;
select pg_temp.pass('admins see demand totals per venue, busiest first');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
select pg_temp.expect_error($q$select * from public.admin_demand_queue()$q$, 'visitors cannot read the demand queue totals');
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select pg_temp.expect_error($q$select * from public.admin_demand_queue()$q$, 'signed-out visitors cannot read the demand queue totals');
reset role;

rollback;
\echo ALL RLS SMOKE TESTS PASSED
