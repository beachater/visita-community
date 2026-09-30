# Visita

Step inside with confidence. See `visita-prd-full.md` for the product and technical PRD.

## Layout

| Path | What | Stack |
|---|---|---|
| `apps/consumer` | Public app: map, venue pages, walkthrough, community | Astro + React islands, Cloudflare |
| `apps/admin` | Owner and admin app | Vite + React SPA on a Cloudflare Worker (static assets + `/api`) |
| `apps/embed` | Iframe walkthrough widget for venue websites | Static HTML/JS |
| `packages/shared-types` | Generated Supabase types plus amenity/hours shapes | TypeScript |
| `packages/ui` | Shared UI kit (tokens, shadcn components, map) | React + Tailwind |
| `packages/uploads` | Photo checks (type from bytes, size) and browser resizing | TypeScript |
| `supabase` | Migrations (schema + RLS), local config | Supabase CLI |

## Setup

Requirements: Node 22+, pnpm 10, Docker, Supabase CLI.

```sh
pnpm install
pnpm db:start           # local Supabase on ports 554xx (see supabase/config.toml)
cp apps/consumer/.env.example apps/consumer/.env
cp apps/admin/.env.example apps/admin/.env
# paste the Publishable key printed by db:start into both .env files
```

## Everyday commands

```sh
pnpm dev:consumer       # http://localhost:4321
pnpm dev:admin          # http://localhost:4322
pnpm dev:embed          # http://localhost:4323/?venue=<slug>

pnpm db:reset           # rebuild the local DB from migrations
pnpm db:types           # regenerate packages/shared-types/src/database.types.ts
pnpm db:test:rls        # RLS + validation smoke test (one transaction, rolled back)

# Load the client prototype's cafes for local testing (upserts on slug):
SUPABASE_SECRET_KEY=<Secret from `supabase status`> pnpm db:import-prototype <path/to/cafes.json>

pnpm typecheck
pnpm build
```

Run `pnpm db:types` after every migration and commit the result.

## Data rules worth knowing

- **Supabase is the backend; RLS is the access control.** Client-side guards are UX only.
- **Users never write points, badges, check-ins or referrals.** Those rows come
  from Cloudflare Workers (service role) or security definer RPCs, where the
  anti-farming rules live. `point_events` is an append-only ledger with an
  idempotency index on `(user_id, reason, source_id)`.
- **Admins are rows in `user_roles`**, never a column on `profiles`. Grant via SQL.
- **Amenities are configured in the database.** `amenity_definitions` lists each
  venue type's amenities (label, icon, value type, unit, filterable, position in
  the three-stat strip). Adding one is a row insert, not a deploy.
- **Each stored amenity is `{ label?, value? }`**: `label` is what the card shows
  ("7 inside, 2 outside"), `value` is what filters use (9). Unknown amenities are
  absent, never null. A trigger rejects undefined keys and wrong value types, and
  also validates `hours` and `menu`. Shapes are in `packages/shared-types/src/amenities.ts`.
- **Walkthroughs are PlayCanvas `.sog` only.**
- **No seed data.** Visita never shows anything that isn't real. Local test data comes
  from the client prototype's real cafes via `db:import-prototype`.

## Routes (consumer)

| Route | Mode |
|---|---|
| `/` (map hero + marketing), `/explore` (map only) | prerendered shell, map is a `client:only` island |
| `/cafe/[slug]` | prerendered per published cafe; reviews (incl. your own) are a server island |
| `/community`, `/community/badges`, `/for-cafes`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms` | prerendered |
| `/saved` | prerendered shell; list from this device, merged with the account via `/api/saved` when signed in |
| `/me`, `/auth/login`, `/referrals`, `/vouchers`, `/check-in/[slug]`, `/cafe/[slug]/verify`, `/r/[code]` | server-rendered |
| `/auth/google` (POST), `/auth/callback`, `/auth/logout` (POST), `/api/saved`, `/api/reviews`, `/api/uploads/review-photo` (POST) | endpoints |

Sign-in is Google only (Supabase Auth, PKCE, cookies via `@supabase/ssr`). The
header account area is a server island, so page shells stay prerendered.

The walkthrough opens as an overlay inside the map island (the viewer is
lazy-loaded on demand) and pushes `/cafe/<slug>`, so every walkthrough has a
shareable URL whose direct visit gets correct link-preview tags.

## Rendering (consumer)

`output: 'server'`, and every page declares `export const prerender = true | false`.
Prerendered pages that need per-visitor or fast-changing content use server
islands (`server:defer`), so the shell stays cached. Venue pages are built from
published venues at deploy time, so publishing or rescanning a venue must
trigger a deploy hook (not wired yet).

## Owner and admin app

`apps/admin` is a React SPA served by the `visita-admin` Worker. It talks to
Supabase directly as the signed-in person (Google only), so RLS decides what
they can see and do. Routes only send people to the right place:

| Who | Lands on |
|---|---|
| Admin | `/admin/approvals`: pending owner claims with proof, approve or reject with a note |
| Approved owner | `/venue/<id>` (or `/venues` when they own several) |
| Claimant | `/status`: pending or rejected claims and the reviewer's note |
| Anyone else | `/claim`: find the listing (or request a new one), role, contact number, proof |

Claims live in `venue_owners`; only `review_owner_claim()` changes their status,
only admins may call it, and nobody reviews their own claim. Proof photos are
stored in R2 under `owner-proofs/<claim id>/`, which the public site never
serves; the Worker's `/api/claims/<id>/proof` streams them to the claimant and
admins only.

An approved owner's venue area has four tabs:

| Tab | What changes | How |
|---|---|---|
| Overview | Occupancy: quiet / moderate / full, cleared after 3 hours | `set_occupancy()`; live on the cafe page and walkthrough via Realtime |
| Listing | Menu and hours, directly; verified amenities, by request | `owner_update_listing()` (menu and hours only); `amenity_change_requests`, approved with `review_amenity_change()` |
| Events | Events and promotions, with an optional photo | `venue_events`; photos under the public `events/<id>/` prefix via the Worker |
| Reviews | One public reply per review | `review_replies` |

Cafe pages are still built at deploy time, so menu and hours edits reach the
deployed site on the next deploy until cafe pages render on request (plan Task
1b). Occupancy, events and replies load fresh on every visit.

Local setup: copy `apps/admin/.env.example` to `.env` and
`.dev.vars.example` to `.dev.vars`, then `pnpm dev:admin` (port 4322).

## Analytics

Owner analytics (PRD 4.4) are collected **only when the visitor chose "Allow
usage stats"** on the privacy notice (RA 10173):

- `apps/consumer/src/lib/analytics/track.ts` queues events (profile views,
  walkthrough opens, directions taps, search appearances, demand taps; active
  filters ride along on views and opens), batches them, and sends with
  `sendBeacon` when the page is hidden. Nothing is queued without consent,
  and a batch is dropped if consent is withdrawn before it's sent.
- `POST /api/track` refuses batches without the `consent: "usage"` marker,
  unknown event types and bad ids, rate-limits per IP (`TRACK_LIMITER`,
  60/min), keeps only published venues and known filter names, and stamps
  the server time. The session id is random per tab and never tied to an account.
- Raw events (`analytics_events`) have no client access. Owners and admins
  read totals through `venue_stats(venue, from, to)`; the owner app's
  Analytics tab charts them. A daily pg_cron job turns events older than 24
  months into daily totals (`analytics_daily`), as the privacy policy says.

## UI kit

- **Tokens:** `packages/ui/src/styles/tokens.css`. Every colour, font and radius
  is a CSS variable there. The values are **provisional** until the final
  UI/UX and branding arrive, and the rebrand is a change to that file only.
- **Shared components (`@visita/ui`):**
  - shadcn/ui primitives: `@visita/ui/button`, `sheet`, `dialog` and so on;
  - `@visita/ui/bottom-sheet`;
  - `cn()` from `@visita/ui/utils`.
  - Used by the consumer app and, from Task 6, the owner/admin app. Apps import
    `@visita/ui/tokens.css` and `@source` the package so Tailwind sees its
    classes.
- **Consumer-only kit (`apps/consumer/src/components/kit`):** zero-JS Astro
  pieces: the Scanned badge, status pill, glass panel, rating, map pin, page
  header, empty state and draft notice.
- **Rules:**
  - Amber (`--verified`) means "scanned and verified" and nothing else. It's
    never used on a button or for text.
  - Playfair Display is for headlines only.
  - Touch targets are at least 44px.
- **Shell:** `SiteHeader` and `SiteFooter` are zero-JS Astro; the mobile menu is
  a native `<dialog>`. `BaseLayout chrome="bare"` drops them for full-screen
  views. `ConsentBanner` stores the RA 10173 choice, and analytics must check
  `hasUsageConsent()` from `src/lib/consent.ts`.
- **Review pages:** `/lab/ui` and `/lab/screen/<slug>` (noindex).

## Tests

`pnpm test` runs Vitest across the workspace. Tests live beside their code as
`*.test.ts`. Database rules are covered separately by `pnpm db:test:rls`.
