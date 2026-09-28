# Visita

Step inside with confidence. See `visita-prd-full.md` for the product and technical PRD.

## Layout

| Path | What | Stack |
|---|---|---|
| `apps/consumer` | Public app: map, venue pages, walkthrough, community | Astro + React islands, Cloudflare |
| `apps/admin` | Owner and admin app | Vite + React SPA |
| `apps/embed` | Iframe walkthrough widget for venue websites | Static HTML/JS |
| `packages/shared-types` | Generated Supabase types plus amenity/hours shapes | TypeScript |
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
| `/cafe/[slug]` | prerendered per published cafe; personal bits are server islands |
| `/community`, `/community/badges`, `/for-cafes`, `/about`, `/contact`, `/faq`, `/privacy`, `/terms` | prerendered |
| `/saved`, `/me`, `/referrals`, `/vouchers`, `/check-in/[slug]`, `/cafe/[slug]/verify`, `/r/[code]`, `/auth/*` | server-rendered |

The walkthrough opens as an overlay inside the map island (the viewer is
lazy-loaded on demand) and pushes `/cafe/<slug>`, so every walkthrough has a
shareable URL whose direct visit gets correct link-preview tags.

## Rendering (consumer)

`output: 'server'`, and every page declares `export const prerender = true | false`.
Prerendered pages that need per-visitor or fast-changing content use server
islands (`server:defer`), so the shell stays cached. Venue pages are built from
published venues at deploy time, so publishing or rescanning a venue must
trigger a deploy hook (not wired yet).

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
