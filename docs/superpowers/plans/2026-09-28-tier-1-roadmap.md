# Tier 1 Roadmap Plan

> **For agentic workers:** this is the **roadmap** for all of Tier 1. It fixes scope, schema, file layout, order and dependencies for each subsystem. Each workstream (W1–W8) gets its own detailed task plan (`docs/superpowers/plans/<date>-<workstream>.md`, bite-sized TDD steps) written just before it starts. Execute those with superpowers:executing-plans or superpowers:subagent-driven-development.

**Goal:** everything in Tier 1 built, deployed to the test link, and ready for stakeholder testing on **Mon 9 Nov 2026**.

**Architecture:**
- **Consumer app:** Astro on Cloudflare Workers, with its `/api/*` routes acting as the "small Worker functions" from PRD 5.5.
- **Owner and admin app:** a Vite + React single-page app.
- **Backend:** Supabase for data, auth and access control (RLS); Cloudflare R2 for scans and photos.
- **Shared code:** UI tokens and components move into a shared package so both apps look alike and reskin together.

**Tech stack:** Astro 7, React 19, Tailwind 4 + shadcn/ui, nanostores, PlayCanvas 2.22, mapcn (MapLibre) with Protomaps tiles, Supabase (Postgres, Auth, Realtime), Cloudflare Workers + R2, Vitest.

**Spec:**
- `visita-prd-full.md`, sections 4.1–4.5 and 5;
- the priorities and timeline in memory (`visita-priority-tiers`);
- `docs/visita-launch-timeline.html`.

## Global constraints

- **Brand:** amber (`--verified`) means "scanned and verified" and nothing else. It's never used on a button or for text. One amber element per screen.
- **Type and targets:** Playfair Display for headlines only, DM Sans for everything else. Touch targets are at least 44px.
- **Honesty:** never show anything that isn't real. Where data is unknown, show nothing. Nothing is seeded or invented.
- **Styling:** colours, fonts and radii come only from tokens. The branding is provisional.
- **Terms:** "visitor", "venue owner" and "admin" in code and copy. Everyone is one `profiles` row; ownership is `venue_owners`; admin is `user_roles`.
- **Budget:** $0. No paid APIs in Tier 1: no Google Maps JS, no Places, no routing API.
- **Directions:** hand off to Google Maps (or Apple Maps on Apple devices).
- **Privacy:** usage analytics record nothing unless `hasUsageConsent()` is true (RA 10173).
- **Access:** all access control lives in RLS or in server routes using the service role. Client-side guards are UX only.
- **Git:** commits carry no AI attribution (CLAUDE.md). Deploy only with `pnpm run deploy`, which stops when the build fails.

## Review focus (failure modes most likely to bite a real person)

1. **Signed out or signed in on another device:** saved cafes must merge on sign-in, not overwrite. Test in W3.
2. **Owner edits a listing they aren't approved for** (pending, rejected, or another venue): the database must refuse. RLS tests in W5.
3. **Farming the demand button or analytics** by repeated taps or scripts: dedupe per device per venue and rate-limit per IP. Tests in W2 and W7.
4. **A cafe with almost no data** (no hours, amenities or menu), like Elysée: every screen still makes sense and shows no empty headings or "undefined". Fixture test in W1 and W2.
5. **A slow or failed photo upload while writing a review:** the text isn't lost, and the error says what to do. Tested in W4.

---

## Before W1: setup you need to do (blocking)

| # | What | Why | Needed by |
|---|---|---|---|
| S1 | **Create a hosted Supabase project** (free tier) and share its URL, anon key and service key with me through a local `.env`, not in chat | The test link currently builds from the database on your PC. Sign-in, reviews and owners need a real online database | Fri 9 Oct |
| S2 | **Create a Google OAuth client** in Google Cloud Console (web app), with redirect URI `https://<project>.supabase.co/auth/v1/callback`, and add it in Supabase → Auth → Google | "Google sign-in only" (PRD 4.3) | Fri 9 Oct |
| S3 | **The pre-rendered intro video** (globe to Cagayan de Oro), from the client or designer | PRD 5.7 option 2. Until it arrives, the map opens directly on CDO | Before beta |

## Workstreams, in order

| # | Workstream | Dates | Depends on |
|---|---|---|---|
| W0 | Foundations: shared UI package, Vitest, hosted Supabase, cafe pages served on demand | Mon 5 – Wed 7 Oct | S1 |
| W1 | Discovery map: basemap, pins, pin cards, walkthrough overlay | Wed 7 – Tue 13 Oct | W0 |
| W2 | Discovery tools: search, filters, dock, top picks, saved, recent, demand | Tue 13 – Fri 16 Oct | W1 |
| W3 | Accounts: Google sign-in, session middleware, saved cafes synced | Mon 12 – Fri 16 Oct | S1, S2 |
| W4 | Reviews: write and read, photo upload, moderation status | Mon 19 – Thu 22 Oct | W3 |
| — | **Checkpoint A: visitor flow** | **Fri 23 Oct** | W1–W4 |
| W5 | Owner app: shell, sign-in, registration and claim, admin approvals | Mon 26 – Wed 28 Oct | W3 |
| W6 | Owner workflow: listing editor, amenity requests, events, occupancy, review replies | Wed 28 Oct – Wed 4 Nov | W5 |
| W7 | Analytics: tracking (from Tier 1 visitor pages) and owner dashboard | Mon 19 Oct – Thu 5 Nov | W0; the dashboard needs W5 |
| W8 | Admin panel: venues, scan uploads, amenity queue, review moderation | Thu 29 Oct – Thu 5 Nov | W5 |
| — | **Checkpoint B: owners and admin** | **Fri 6 Nov** | W5–W8 |

---

## Task 1 · W0 · Foundations

**Why first:**
- Both apps need the same UI kit.
- Testing needs a real test runner.
- The online test link needs an online database.
- Cafe pages can't keep being rebuilt by hand: without GitHub there's no automatic deploy hook.

**Decisions, flagged for your review:**
- **Cafe pages switch from "built at deploy" to "rendered on first visit, then cached at Cloudflare's edge for 5 minutes."** Publishing a venue or editing a menu then shows up within minutes, with no rebuild. Link previews (title and og tags) still work, because the page is server-rendered. The other marketing pages stay prerendered.
- **The UI kit moves to `packages/ui`**, shared by the consumer and admin apps.

**Files:**
- Create `packages/ui/`: `package.json`, `src/styles/tokens.css` (moved from consumer `global.css`), `src/components/ui/*` (the shadcn components), `src/components/kit/*.tsx` (React kit pieces), `src/lib/utils.ts`.
- Modify `apps/consumer`: import tokens and components from `@visita/ui`; keep the Astro-only kit components in the app.
- Create `vitest.config.ts` at the root, with tests next to their code (`*.test.ts`).
- Convert the hour-logic checks into `apps/consumer/src/lib/venue/hours.test.ts`, and add tests for `amenities.ts`, `distance.ts` and `directions.ts`.
- Modify `apps/consumer/src/pages/cafe/[slug]/index.astro`: `prerender = false`, load the venue per request, and set `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`.
- Modify `apps/consumer/src/lib/public-data.ts`: work at request time as well as build time.
- Create `.env.production` handling, with docs in the README: the deployed Worker gets `PUBLIC_SUPABASE_URL` and the publishable key as vars; the service key is a Wrangler secret.
- Migrate the hosted database with `supabase link` then `supabase db push`, and load the prototype cafes into it for testing.

**Done when:**
- `pnpm test` runs green in CI style.
- Both apps render with the shared kit.
- The test link reads from the hosted database.
- Editing a venue in Supabase Studio shows up on its page within 5 minutes.

## Task 2 · W1 · Discovery map (PRD 4.1: interactive map, amber pins)

**Scope:**
- **Basemap:** mapcn on MapLibre, using a **Protomaps PMTiles extract of Cagayan de Oro** hosted on R2 (a single small file, $0).
- **Pins:** amber for scanned cafes, white for unscanned.
- **Pin card:**
  - scanned cafes: name, three-stat strip, open now, distance, **Enter 3D walkthrough**, **Get directions**;
  - unscanned cafes: name, known details, **I want to see inside**.
- **Walkthrough overlay:** opens the existing `WalkthroughScreen` over the map and pushes `/cafe/<slug>`. Back returns to the map in the same position.
- **Pages:** `/explore` is the map full screen (bare chrome), and `/` is the map hero plus the marketing placeholder.

**Data:** a cached JSON route, `GET /api/venues.json`, returns every published venue (scanned and unscanned) with the fields the map, cards and filters need. It's generated from the same loader as the cafe page (`lib/venue/load.ts`).

**Files:**
- `apps/consumer/src/components/map/`: `MapExplorer.tsx` (the island), `VenueMarker.tsx`, `PinCard.tsx`, `useVenues.ts`, and `map-style.ts` (the Protomaps style mapped to our tokens).
- `apps/consumer/src/pages/api/venues.json.ts`.
- `infra/r2/README.md`: how the CDO basemap extract is made (`pmtiles extract … --bbox=124.38,8.22,124.88,8.65`) and uploaded.

**Tests:**
- Unit: venue JSON shaping, and the pin kind (scanned or not).
- Fixture test: a venue with no data at all renders a card without empty sections.
- Manual phone check: pan and zoom, tap a pin, overlay open and back.

## Task 3 · W2 · Discovery tools (PRD 4.1: search, filters, top picks, open now, distance, saved, recently viewed, demand)

**Scope:**
- **Search:** over Visita's own venues only (name plus `search_terms`), accent- and case-insensitive. Scanned cafes carry a 3D badge. With an empty search box, it shows Recently viewed.
- **Filters** (PRD list):
  - price range, derived from menu prices;
  - minimum outlets, Wi-Fi, open 24/7 (from hours), outdoor, parking.
  - **The match count** shows as "Show 12 cafes".
  - **Cafes without the relevant data are hidden, with a one-tap "Show them anyway"** (PRD: "hides cafes with no amenity data, with a one-tap override").
- **Dock:** 3D Layout (the list of scanned cafes), Filter, Top Picks (`is_top_pick`), and Saved.
- **Open now:** pill on cards; overnight and closed days are handled by the existing `hours.ts`.
- **Distance:** nearest-first sorting when location is allowed.
- **Demand button:** "I want to see inside".
  - It writes to a new `demand_requests` table through `POST /api/demand`.
  - One request per device per venue, using a random device ID stored locally.
  - Rate-limited per IP, and linked to the account when signed in.

**Schema: migration `demand_requests`**
- Columns: `id`, `venue_id` (FK, nullable), `google_place_id`, `name`, `lat`, `lng`, `device_id`, `profile_id` (nullable), `created_at`.
- Unique on `(venue_id, device_id)`.
- No direct client writes; the service role inserts through the API. Admins read.

**Files:**
- `apps/consumer/src/components/map/`: `SearchBar.tsx`, `FilterSheet.tsx`, `Dock.tsx`.
- `apps/consumer/src/lib/discovery/`: `search.ts`, `filters.ts`, `sort.ts`, each with `*.test.ts`.
- `apps/consumer/src/pages/api/demand.ts`.
- `supabase/migrations/<date>_demand_requests.sql`, plus RLS smoke tests.

**Tests:**
- Unit (filters): each filter; the missing-data rule; "show anyway"; price range from menus; open 24/7 from hours.
- Unit: search normalisation and ranking.
- API: a duplicate demand from the same device is accepted without adding a row; the rate limit returns 429.

## Task 4 · W3 · Accounts (PRD 4.3: accounts; PRD 4.1: saved cafes synced)

**Scope:**
- **Sign-in:** Google only, via Supabase Auth, with `@supabase/ssr` cookies.
- **Middleware:** populates `locals.user`.
- **Routes:** `/auth/login` starts the OAuth flow, `/auth/callback` exchanges the code, and `/auth/logout` is a POST.
- **Header:** the account button becomes a tiny island. Signed out it shows "Sign in"; signed in, an avatar menu with Saved, Your reviews and Sign out.
- **`/me`:** name, photo, and sign out; points come in Tier 3.
- **`/saved`:** server-rendered list.
- **Saved cafes:** the `saved_venues` table. On first sign-in, what's saved on the device is **merged**, not overwritten, and `$saved` then syncs both ways.

**Schema: migration `saved_venues`**
- Columns: `profile_id`, `venue_id`, `created_at`, with the primary key on both IDs.
- RLS: the owner of the row can select, insert and delete.

**Files:**
- `apps/consumer/src/middleware.ts` (replaces the stub).
- `src/lib/auth/supabase-server.ts` and `src/lib/auth/supabase-browser.ts`.
- `src/pages/auth/*.ts`.
- `src/components/site/AccountButton.tsx`.
- `src/lib/visitor/stores.ts`: add account sync.
- `src/pages/saved.astro` and `src/pages/me.astro`.

**Tests:**
- Unit: the saved-merge function (device list plus account list gives a union, device order kept first).
- RLS: nobody can read another person's saved list.
- Manual: sign in on phone, then on desktop, and saved cafes match.

## Task 5 · W4 · Reviews (PRD 4.3: reviews with a rating and optional photo)

**Scope:**
- **Writing a review** from the walkthrough panel and the cafe page: a sheet with a 1–5 rating, text and an optional photo. Signed-out visitors are asked to sign in first, and their draft is kept.
- **Photos:**
  - `POST /api/uploads/review-photo` returns a signed R2 upload URL (PRD 5.5, "signed upload URLs").
  - Resized in the browser to 1600px JPEG before upload.
  - Key format `reviews/<review-id>/<uuid>.jpg`.
- **Reading reviews:** a server island on the cafe page lists visible reviews, newest first, with the average rating. The reviewer sees their own review even when hidden, with a "hidden by a moderator" notice.
- **Edit and delete** your own review, within the existing RLS and column grants.
- **Owners can't review their own venue:** a new check in the insert policy, once `venue_owners` exists in W5.

**Files:**
- `src/components/reviews/`: `ReviewSheet.tsx`, `ReviewList.astro`, `ReviewCard.astro`.
- `src/pages/api/uploads/review-photo.ts`.
- `src/lib/uploads/resize.ts`, with a test.

**Tests:**
- Upload API: refuses a non-image, a file over 8 MB, and a caller who isn't signed in.
- RLS: covered by the existing smoke tests, plus the new owner rule.
- Manual (Review Focus #5): a failed upload keeps the text.

## Task 6 · W5 · Owner app: shell, registration, approvals (PRD 4.4 owner accounts; 4.5 owner approvals)

**Scope:**
- **App:** `apps/admin` becomes the owner and admin app: Tailwind and the shared kit, react-router, and Supabase Google sign-in.
- **Owner registration:**
  1. Sign in, then **claim a venue**: search the existing listings, or request a new one.
  2. Give your role and contact number, plus proof: a photo of the business permit or a storefront selfie, uploaded to R2 with restricted access.
  3. **Pending** until an admin approves.
- **Admin approvals:** a queue with approve and reject plus a note. An approved owner sees their venue dashboard.
- **Routing by role:**
  - admin: admin area;
  - approved owner: that venue's dashboard;
  - pending: a status page;
  - neither: the claim flow.

**Schema: migration `venue_owners`**
- Columns: `id`, `venue_id` (nullable for a new-venue request), `profile_id`, `status` (`pending`, `approved` or `rejected`), `role_title`, `contact_phone`, `proof_key`, `proposed_venue` (jsonb), `review_note`, `reviewed_by`, `reviewed_at`, `created_at`.
- Constraint: one pending or approved claim per person per venue.
- Helper `is_venue_owner(venue_id)`, a security definer function.
- RLS:
  - a person reads and creates their own claims;
  - admins read and update everything;
  - approved owners read their venue's owner list.
- Add the rule to the reviews insert policy: no reviewing a venue you own.

**Files:**
- `apps/admin/src/`: `routes/`, `auth/`, `pages/claim/`, `pages/pending/`, `pages/admin/approvals/`.
- `supabase/migrations/<date>_venue_owners.sql`, plus RLS smoke tests.

**Tests (RLS, Review Focus #2):**
- A pending owner can't touch the venue.
- An owner of venue A can't touch venue B.
- A person can't approve their own claim.

## Task 7 · W6 · Owner workflow (PRD 4.4: listing editor, events, occupancy, review responses)

**Scope:**
- **Listing editor:**
  - edits the menu (items, prices, sections), hours (per day, overnight, closed) and events **directly**;
  - **verified amenity changes** go to `amenity_change_requests` and show as "Pending review" until an admin approves (PRD 4.4).
- **Direct edits go through an RPC,** `owner_update_listing(venue_id, patch)`, security definer. It checks `is_venue_owner` and allows only `menu` and `hours`, which are validated by the existing triggers.
- **Events:** `venue_events` (title, description, start and end, optional photo). Shown on the cafe page and walkthrough panel while current or upcoming.
- **Occupancy:**
  - one tap for quiet, moderate or full, in `venue_occupancy`, with `expires_at = set_at + 3 hours`;
  - shown with "20 min ago", and hidden after it expires;
  - live via Supabase Realtime on the walkthrough and cafe pages.
- **Review responses:** `review_replies`, one per review. The owner writes it and it shows publicly under the review.

**Schema:** migrations for `amenity_change_requests`, `venue_events`, `venue_occupancy`, `review_replies`, and the `owner_update_listing` RPC, each with RLS and smoke tests.

**Files:**
- `apps/admin/src/pages/venue/`: `ListingEditor.tsx`, `MenuEditor.tsx`, `HoursEditor.tsx`, `EventsEditor.tsx`, `OccupancyButtons.tsx`, `Reviews.tsx`.
- Consumer additions: an occupancy pill and an events section in `InfoPanel.tsx` and the cafe page, and owner replies in `ReviewCard.astro`.

**Tests:**
- Unit: the hours editor round-trip (UI state to the `WeeklyHours` shape), including overnight.
- RPC: refuses a non-owner and refuses fields outside the allowed set.
- Occupancy: expiry hides the pill.

## Task 8 · W7 · Analytics (PRD 4.4, full list, Tier 1)

**Scope:**
- **Collection starts with the visitor pages (W1–W4), so data exists by the stakeholder test.** Events:
  - `profile_view`, `walkthrough_open` and `directions_tap`;
  - `search_appearance`, recording which venues appeared in results;
  - `filter_click`, recording which active filters led to opening a venue;
  - `demand_tap`.
- **Ingest:**
  - `POST /api/track`, batched with `sendBeacon`;
  - consent-gated on the client **and** checked on the server, via a header the client sets only when consent is given;
  - IP rate-limited;
  - the session ID is random, per tab, and not linked to the account.
- **Owner dashboard,** per venue, 7 / 30 / 90 days:
  - profile views, walkthrough opens and directions taps;
  - conversion (directions taps divided by profile views);
  - search appearances;
  - peak hours, as a heatmap by weekday and hour, in Manila time;
  - the top filters that brought people in;
  - demand interest from before the venue signed up.
  - Charts follow the dataviz skill.
- **Aggregation:** SQL views and RPC functions that return totals only. Owners never see individual events.

**Schema: migration `analytics_events`**
- Columns: `id` (bigint), `venue_id`, `type` (enum), `session_id`, `props` (jsonb), `occurred_at`.
- Indexes on `(venue_id, occurred_at)`.
- **No client access;** the service role inserts.
- RPC `venue_stats(venue_id, from, to)`, security definer, which checks owner or admin.
- A retention job deletes raw events after 24 months, as the privacy policy says.

**Files:**
- `apps/consumer/src/lib/analytics/track.ts` (with a test) and `src/pages/api/track.ts`.
- `apps/admin/src/pages/venue/Analytics.tsx`.

**Tests:**
- Unit: nothing is sent without consent; batching; beacon fallback.
- API: rejects unknown event types; rate limit.
- RPC: an owner of A can't read B's stats.

## Task 9 · W8 · Admin panel (PRD 4.5 subset)

**Scope:**
- **Venue management:**
  - list, search, create and edit every field (including amenities and `is_top_pick`), and publish or unpublish;
  - amenity definitions stay editable in Studio for now.
- **Scan uploads:** upload a `.sog` and its preview through a signed R2 upload, with the key set to `splats/<slug>/v<n+1>.sog`, then set `splat_url`, `splat_preview_url` and `scanned_at`. Making the preview stays the CLI step in `infra/r2/README.md`.
- **Amenity edit queue:** approve or reject owner requests. On approve, the RPC writes to `venues.amenities`.
- **Review moderation:** list recent and reported reviews, and hide or unhide them. The existing `status` column and admin RLS already cover this.
- Owner approvals are built in W5.

**Files:**
- `apps/admin/src/pages/admin/`: `Venues.tsx`, `VenueForm.tsx`, `ScanUpload.tsx`, `AmenityQueue.tsx`, `Moderation.tsx`.
- `apps/consumer/src/pages/api/uploads/scan.ts`, admin-only.

**Tests:**
- Scan upload API: refuses non-admins; keys never overwrite an existing version.
- RPC: amenity approval writes validated JSON, and a bad value is rejected by the existing trigger.

---

## How this gets verified at each checkpoint

- **Automated:**
  - `pnpm test` (Vitest units);
  - `pnpm db:test:rls` (the SQL smoke suite, extended in every workstream that adds tables);
  - `pnpm typecheck` and `pnpm build`.
- **Phone checklist:** posted with each deploy, as for the walkthrough, on your iPhone plus one mid-range Android before stakeholder testing.
- **Out of scope for Tier 1:**
  - end-to-end browser tests. At this size they'd cost more than they catch, and they can come before the beta.
  - Tier 2 and Tier 3 items (amenity verification, menu photo capture, manual billing, offline support, demand queue UI, Places fallback, the points economy).
