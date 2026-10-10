# Consumer UI foundations (proposal)

Status: **for review**, 11 October 2026. These are working dimensions for mockups, not final branding or approval to change the production UI.

## Intent

- Make the map immediately legible. A visitor should understand search, browse, venue details, and the 3D walkthrough without scanning all four corners.
- Borrow familiar map control placement: search and browse together; zoom and location together; a selected venue gets one clear detail surface.
- Keep the Visita identity through typography, navy/ocean color, soft glass over the map, and amber reserved for scanned/verified venues. The existing palette and font choices remain provisional in `packages/ui/src/styles/tokens.css`.
- Do not invent venue facts, ratings, reviews, hours, or live occupancy in prototypes. Mock data must say it is illustrative.

## Spacing and sizing scale

Use an 8 px base rhythm with 4 px steps for compact details. Values below are CSS pixels at 100% zoom.

| Item | Mobile | Desktop | Rule |
| --- | ---: | ---: | --- |
| Screen edge inset | 16 | 24 | Also add the relevant safe-area inset. |
| Floating group gap | 12 | 16 | Between search, chips, and panels. |
| Inside card gap | 12 | 16 | Use 8 only for icon and label pairs. |
| Card padding | 20 | 24 | Do not squeeze text to fit more controls. |
| Search height | 52 | 56 | Text at least 16; one primary search field. |
| Search width | available width | 400–440 | Keep room for account and map actions. |
| Primary action height | 48 | 48 | Use 44 minimum for all targets. |
| Category chip height | 40–44 | 40–44 | Horizontally scroll on small screens. |
| Round map control | 48 | 48 | Group zoom in/out, separate locate. |
| Venue card width | viewport minus 32 | 360–400 | On mobile use a bottom sheet. |
| Account right inset | 16 | 24 | Never flush with the viewport edge. |
| Map overlay corner radius | 20–24 | 20–24 | Pills are fully rounded. |

## Layout zones

1. **Top left:** brand plus search; browse filters directly beneath search.
2. **Top right:** sign in/account with a full edge inset.
3. **Bottom right:** zoom and current location in one control zone, above any selected venue sheet on mobile.
4. **Selected venue:** one left-side card on desktop, one bottom sheet on mobile. It carries the primary action to enter a walkthrough.
5. Keep map attribution visible and do not cover it with the card or controls.

At under 768 px, collapse the desktop brand/search arrangement into a compact brand row and a full-width search row. Keep the map usable with one hand. Inactive controls should not occupy a full-width bottom bar.

## Globe intro hypothesis

The reference prototype uses Google's `gmp-map-3d` with a 4.5-second flight from a Philippines-scale satellite view toward Cagayan de Oro. A globe-to-CDO transition can also be explored with the existing MapLibre stack; it supports globe projection and camera flight. A matching **satellite/photoreal** look depends on imagery and its licensing, performance, and cost, so that is a separate decision.

For the product, test a short first-visit-only transition, provide Skip, avoid replaying it on every navigation, and honor reduced-motion preferences. The design-lab animation is a visual sketch, not a map implementation.

## Open decisions

- A: map-first, with search and chips together and venue details on selection; B: a persistent discovery panel on desktop. Which is easier to understand and gives the map enough room?
- Should first-visit globe animation use vector globe, licensed satellite imagery, or a branded non-map intro? Validate on mid-range phones before selecting.
- Which browse choices deserve always-visible chips? Candidate: Scanned in 3D, Open now, Filters. Top Picks and Saved can live in a browse sheet or panel.
- Should root and `/explore` be one continuous map experience, or should root have editorial content below the map later?

## Approval path

Review desktop and mobile mockups, record the chosen layout and changes here, then implement in `apps/consumer`. The mockup lives in `design/consumer-root` and has no production route, API key, or deployment script.
