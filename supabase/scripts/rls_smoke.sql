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
do $$ begin assert (select count(*) from public.venue_owners) = 3; end $$;
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

rollback;
\echo ALL RLS SMOKE TESTS PASSED
