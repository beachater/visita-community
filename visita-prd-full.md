# Visita — Product & Technical PRD

**Step Inside With Confidence**
Version 2 (merged product + technical) · September 2026

---

## 1. Product Overview

Visita is a web application that lets people virtually step inside a cafe through an interactive 3D walkthrough before visiting in person. No download, no app store — it runs in a browser.

**Tagline:** Step Inside With Confidence

### The problem

Cafe-goers choose a cafe from photos on TikTok, Google Maps, and Facebook, then arrive to find the space looks nothing like the pictures — crowded when it looked calm, smaller than shown, no outlets, wrong lighting, wrong vibe. Time, fare, and money wasted.

This is a **trust gap, not an information gap.** People are not short of cafe content — they are drowning in it, and none of it is verifiable. Visita is the verification layer that does not exist yet.

**Honesty is the product.** Every scan is a real, unedited walkthrough. One filtered photo would destroy the entire proposition.

### Principles

- **Never show anything that is not real.** No stock imagery, no invented reviews, no fabricated occupancy, no filtered photos. Where data is unknown, show nothing rather than a guess.
- **Amber means verified.** It carries one meaning across the product and is never spent on a button.
- **Contribution over presence.** The points economy rewards making the data better, not merely showing up.
- **Fix the walkthrough before adding to it.** Beta testing put confidence at 3/4 for technical reasons, not conceptual ones. Performance is the gatekeeper — this shapes the architecture decisions in Section 5 as much as it shapes the feature list.

---

## 2. Branding — "Clarity & Light"

**Essence:** Illuminating, trusted, professionally human. Filipino warmth (amber, the light inside a cafe) meets platform credibility (navy, trust for venue owners).

### Colour

| Token | Hex | Use |
|---|---|---|
| Navy | #042C53 | Primary. Surfaces, wordmark, body text, authority |
| Ocean | #185FA5 | Headings, links, primary interactive |
| Sky | #378ADD | Icons, secondary interactive |
| Mist | #B5D4F4 | Borders, dividers |
| Cloud | #E6F1FB | Backgrounds, breathing room |
| Amber | #EF9F27 | Accent only. Never a text colour |
| Gold | #FAC775 | Soft accent support |
| Amber Deep | #A85F0A | Star ratings and amber icons on light surfaces |

**The amber rule.** Navy sets the stage, amber draws the eye, cloud gives room. One amber element per screen. In Visita, amber means one thing: *this venue is scanned and verified.* It never means "press this."

**Contrast, verified.** Amber on white is 2.17:1 and fails accessibility as a foreground, so it is a background only. Amber backgrounds take navy text at 6.48:1, never white.

### Type

- **Playfair Display** (Bold, Semibold) — wordmark, headlines, display only. Never body text; serifs strain at small sizes on mobile.
- **DM Sans** — everything else: body, UI, buttons, captions, data.

### Logo and voice

Wordmark in Playfair Display Bold, title case always. Navy on light, white or cloud on dark.

Voice is a trusted local friend who already scouted the place. Plain verbs, sentence case, no hype. Never overhype — overhyping recreates the problem the product solves. Never negative about any venue.

---

## 3. Scope & Roadmap

### V1 scope
Cafes in Cagayan de Oro. All feature descriptions below are written from that lens.

### Planned expansion — multi-industry
The long-term plan is to extend beyond cafes to other bookable/visitable spaces: pickleball courts, function rooms, Airbnbs, etc. To avoid a schema rewrite later, the data model (Section 5.5) is built **venue-generic from V1**, even though the UI and copy stay cafe-specific for now.

### Explicitly out of scope for now
- **Reservations / booking / availability calendars.** Not needed for cafes (walk-in model). Revisit only if/when a vertical that requires scheduled bookings (courts, rooms) is greenlit — this is a genuinely new subsystem, not a schema tweak.
- **Payments processing** beyond whatever the eventual booking system requires.

### Growth channel — embeddable widget
A venue owner can embed their Visita walkthrough on their own website via `<iframe>`, with a "Powered by Visita" badge linking back to the full listing. See Section 5.4.

---

## 4. Features (consumer-facing)

### 4.1 Discovery

| Feature | Description |
|---|---|
| Interactive map | Map of Cagayan de Oro with a pin for every result |
| Amber pin differentiation | Scanned cafes render as amber pins, unscanned stay white |
| Search | Searches Visita's own cafes first with a 3D badge, then falls back to Google Places |
| Filters | Price range, minimum outlets, WiFi, open 24/7, outdoor, parking. Shows a match count and hides cafes with no amenity data, with a one-tap override |
| Top Picks | Curated shortlist, flagged per cafe record rather than hardcoded |
| Open now | Derived from structured hours, handling overnight spans and closed days |
| Distance | Distance from the user to each cafe, lists sorted nearest first when location is available |
| Saved cafes | Heart any scanned cafe and browse saved ones from a dedicated dock pill |
| Recently viewed | The last five cafes viewed, surfaced when the search box is empty |
| Demand button | "I want to see inside" on unscanned cafes, recording interest and building a queue of cafes to sell to next |

### 4.2 The Walkthrough

| Feature | Description |
|---|---|
| 3D walkthrough | Continuous Gaussian Splat walkthrough of the real interior, in-browser, with keyboard, mouse, and touch joystick controls |
| Loading progress | The Visita "V" fills with amber as bytes arrive, with real megabyte figures and stage copy, rather than an indeterminate spinner |
| Cafe info panel | A single glass container on the left holding every known detail. Collapsed to a three-stat strip by default, expanding to the full set |
| Amenity cards | WiFi speed, power outlets, tables, seats, hours, payment methods, climate, table types, restroom, parking, minimum spend, time limit, accessibility. Unknown fields do not render |
| Scan date | When the cafe was last scanned, shown in plain sight. Muted past twelve months. The subscription is what keeps this current |
| Menu | Items and prices, in the panel and in a scrollable sheet for longer menus |
| Get directions | Route, distance, and ETA from the user's location, with a one-tap return to the walkthrough |
| Share | Shares a direct link to the cafe via the native share sheet, or copies the link |
| Deep links | Every cafe has its own URL, with correct page title and link preview tags |

### 4.3 Community

| Feature | Description |
|---|---|
| Accounts | Google sign-in only. No passwords to reset, no email to deliver |
| Reviews | Written reviews with a rating and optional photo, stored centrally so they are visible to everyone rather than to one device |
| Points | Earned for contributing: writing reviews, adding photos, being first to review a cafe, confirming an amenity is still accurate, reporting outdated info, verified check-ins, and streaks. Contribution pays more than presence |
| Amenity verification | Users confirm or dispute amenity details, keeping data true between rescans |
| Awards | Users spend their own points to award someone else's review |
| Badges | Milestones for cafes visited, reviews written, first reviews, amenity verifications, and founding membership |
| Check-ins | GPS presence plus a dwell period, rate-limited and pattern-checked, so points cannot be farmed by spoofing location |
| Referral codes | A memorable shareable code per user. Both sides earn, with milestone rewards, payout triggers only once the referred user does something real |
| Vouchers | Points redeemed for cafe offers, funded as a perk of the boosted listing |
| Community page | Leaderboard, most-awarded reviews, recent activity, badge showcase |

### 4.4 For venue owners

| Feature | Description |
|---|---|
| Owner accounts | Self-registration with manual approval, so nobody can claim a venue they do not own |
| Listing editor | Owners freely edit menu, prices, hours, and events. Verified amenities go through an approval queue and show as pending until confirmed |
| Menu photo capture | Photograph a menu board and have the items and prices extracted automatically into an editable table. Never saves without owner confirmation. Also the mechanism for cheap monthly re-verification |
| Occupancy | One-tap quiet, moderate, or full, timestamped and auto-expiring after three hours |
| Events | Post events and promotions to the venue's listing |
| Analytics | Profile views, walkthrough opens, directions taps, conversion, search appearances, peak hours, which filters brought people in, demand-button interest from before sign-up |
| Monthly report | Performance vs. the CDO average, review themes, a walkthrough heatmap, one evidence-backed suggestion |
| Review responses | Reply publicly to reviews |
| Billing | Subscription status, payment history, upgrade to boosted, switch to annual |

### 4.5 Platform / Admin

| Feature | Description |
|---|---|
| Admin panel | Venue management, scan uploads, owner approvals, amenity edit queue, review moderation, demand queue, points/referral fraud monitoring, subscription/churn view, audit log |
| Monthly user recap | Cafes visited, new ones tried, points and badges earned, what's newly scanned nearby |
| Offline support | Listings, amenities, and photos remain available without a connection, with a visible stale-data notice |
| Privacy compliance | Privacy policy, terms, storage consent notice covering the Data Privacy Act of 2012 (RA 10173) |

---

## 5. System Architecture

### 5.1 Repos

| Repo | Stack / Hosting | Contains | Talks to |
|---|---|---|---|
| **Consumer app** | Astro + React islands, on Cloudflare Pages/Workers | `/map` discovery, `/venue/[id]` detail + `.sog` walkthrough, Community (reviews, points, badges, check-ins, referrals, vouchers), Google auth, saved/recently-viewed | Supabase, Cloudflare R2 |
| **Owner/Admin app** | Vite + React SPA, on Cloudflare Pages | Owner: listing editor, menu/photo capture, occupancy, events, analytics, billing. Admin: venue mgmt, scan uploads, approvals, moderation, fraud monitoring, audit log | Supabase (role-gated via RLS), Cloudflare R2 |
| **Embed widget** *(small, own repo optional)* | Static HTML/JS, Cloudflare Pages, iframe-served | Just the splat viewer for one venue, "Powered by Visita" badge | Cloudflare R2, Supabase (public read only, no auth) |

Rationale for the split: consumer and admin have different audiences, different auth needs, and no reason to ship admin code to cafe browsers. The embed widget needs different CORS/CSP rules (`frame-ancestors`) since it's loaded on third-party domains, and should stay deliberately minimal — no map, no auth, no community features, just the viewer.

A shared Supabase types/schema file (and R2 upload/CORS config) should be kept in one place all three repos reference, so they don't drift out of sync — a lightweight monorepo (e.g. pnpm workspaces: `apps/consumer`, `apps/admin`, `apps/embed`, `packages/shared-types`) is a reasonable way to do this without losing independent deploys.

### 5.2 Consumer app (Astro + React islands)

**Why Astro:** the majority of surveyed users are on Android, where JS parse/execution (not just download) is often the real bottleneck on mid/low-tier devices. Astro ships zero JS by default and only hydrates components explicitly marked as islands, which is a real, felt win on the content-heavy surfaces (venue detail info, amenity cards, community leaderboard/badges). On the interactive surfaces (map, splat viewer, write-heavy community actions), Astro costs nothing extra vs. any other framework — those routes become one island each, same JS payload as a full SPA page would ship anyway.

**Rendering mode is not uniformly static.** Visita is a *server-rendered app with cacheable routes*, not a static site — the moment a route depends on who's logged in (saved venues, points balance, check-in state, review authorship), it needs `output: 'server'` / `prerender = false`, since build-time HTML can't know who's visiting. Per-route rendering strategy:

| Route type | Mode | Examples |
|---|---|---|
| Same for every visitor | Prerendered/cached (`prerender = true`) | Venue detail static content (amenity cards, menu, scan date), community leaderboard, badge showcase, public review lists |
| Personalized | Server-rendered per request | Saved venues, points balance, check-in flow, amenity verification, referrals, vouchers |
| Fully interactive widget (any framework pays this cost) | Client island (`client:visible` / `client:only`) | Map + search + filters, the `.sog` splat viewer, review-award button, menu sheet toggle |

Default hydration directive to `client:visible` or `client:idle` over `client:load` unless something genuinely needs to react the instant the page loads (e.g. nav-level state).

**Cross-island state:** islands don't share React context automatically. Anything that needs to update in more than one place at once — e.g. a "saved" count in the header changing when a venue is hearted on the map — needs a lightweight shared client store (nanostores is the standard pairing with Astro).

**Auth:** Supabase Auth, Google sign-in only. Requires Astro middleware populating `Astro.locals` from Supabase's SSR cookie helpers (this pattern is less turn-key than the Next.js equivalent — budget extra research time here specifically, since auth touches nearly every route).

### 5.3 Owner/Admin app

Plain Vite + React SPA — no meta-framework needed here. No public SEO requirement (it's behind login), so skip SSR entirely and take the simpler dev model. Role-gated access enforced via Supabase Row-Level Security, not just client-side route guards.

### 5.4 Embed widget

Standalone, iframe-served, intentionally dumb: fetch one venue's `.sog` from R2 + minimal metadata from Supabase's public read API, render the viewer, show a "Powered by Visita" badge linking back to the full listing (this is the actual growth loop). No auth, no server required — could be a single static HTML/JS file. Requires R2 CORS configured to allow fetches from arbitrary third-party embedding domains.

### 5.5 Backend / data

No custom backend server — Supabase functions as the backend directly for both frontends via RLS policies:

- **Supabase:** Postgres (structured data), Auth (Google sign-in), Realtime (e.g. live occupancy, points updates), Row-Level Security for all access control.
- **Cloudflare R2:** binary asset storage — `.sog` splats, images, video. Chosen over Supabase Storage specifically because R2's free tier has no egress fees, while Supabase's free bandwidth would be exhausted quickly by repeated 20–50MB splat downloads.
- **Small Cloudflare Worker functions** (not a full backend repo) for logic that shouldn't live client-side: points/badge rule enforcement, referral fraud checks, check-in rate limiting/pattern checks, generating signed upload URLs to R2.

**Data model — venue-generic from V1:**

```
venues
├── id
├── name
├── venue_type        -- 'cafe' | 'pickleball_court' | 'function_room' | 'airbnb' | ...
├── address
├── splat_url          -- points at the .sog file in R2, not the file itself
├── amenities (jsonb)  -- flexible per venue_type, avoids rigid columns/migrations per vertical
└── ...
```

A cafe row references its splat via `splat_url`; the actual binary lives in R2. This keeps Postgres rows small and fast, and the CDN in front of R2 handles the large-file delivery.

### 5.6 Gaussian Splat pipeline

1. Capture (photos/video of the real interior) → raw `.ply` scan.
2. Clean up/crop in **SuperSplat** (PlayCanvas's browser-based splat editor).
3. Export as **`.sog`** (PlayCanvas's compressed format — a zip of `meta.json` + `.webp` textures; ~95% smaller than raw PLY).
4. Upload to Cloudflare R2; venue record's `splat_url` points at it.
5. On `/venue/[id]`, the **PlayCanvas engine** loads and renders the splat — client-side only, code-split so this bundle never ships to the map/discovery route.
6. Loading UI reads real byte-progress from the PlayCanvas asset loader (not an indeterminate spinner), matching the "V fills with amber" spec in 4.2.
7. Before mounting the viewer: check WebGL2 support and a rough device-memory heuristic, falling back gracefully to photos on devices that can't handle it.
8. **iOS Safari is the higher-risk target, not Android** — Safari is historically more aggressive about killing/reloading WebGL contexts under memory pressure. Test real `.sog` loads on physical iOS Safari early, not late.

### 5.7 Map / discovery approach

**Open decision, needs sign-off** (see Section 6): the client's reference prototype uses Google's **Photorealistic 3D Tiles API** for the "zoom from globe into city" intro. This is a paid, metered API (1,000 free requests/month, then ~$6 per 1,000) — a real recurring cost that conflicts with the $0 budget target.

Recommended alternative:
- Pre-render the globe-to-city flythrough once as a video/loop (it's the same animation every time — not a live interactive globe), eliminating the ongoing API cost.
- Use **MapLibre GL JS** (free, open-source) with a pitched/tilted 2D basemap for the actual pin-browsing, filtering, and interaction — where users spend the majority of their time.

Trade-off to flag: this gives up a live, freely-spinnable 3D globe in favor of a fixed cinematic intro. Needs explicit product sign-off, not just an engineering call.

### 5.8 Hosting & budget

- **Cloudflare Pages/Workers only** — not Vercel. Vercel's free Hobby tier is licensed for personal/non-commercial use only, which a commercial product violates; Cloudflare Pages has no such restriction and pairs with R2 with zero cross-cloud egress fees.
- **Target budget: $0**, using free tiers throughout — Supabase free (Postgres, Auth, Realtime), Cloudflare Pages/Workers free, Cloudflare R2 free tier (10GB storage, no egress fees — the key unlock for serving large splat files affordably).
- Google Maps Platform (Photorealistic 3D Tiles, Places API fallback in search) is the one component **not** naturally free at scale — see Section 5.7 and Section 6.

---

## 6. Open decisions

- **Google Photorealistic 3D Tiles vs. pre-rendered intro + MapLibre** — needs explicit client/product sign-off given the cost trade-off (Section 5.7).
- **Reservations/booking** — confirmed out of scope for now; revisit only if a scheduling-dependent vertical (courts, rooms) is greenlit.
- **Multi-industry rollout timing** — schema is generalized now (venue-generic), but vertical-specific UI/logic (e.g. court-specific amenities) is not yet designed.
