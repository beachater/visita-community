# Consumer UI foundations (proposal)

Status: **for review**, 11 October 2026. These are working dimensions for mockups, not final branding or approval to change the production UI.

## Decision recorded 11 October 2026

The Map-first layout (A) was selected for the consumer root page. Its search and browse controls sit together at the top left, account/menu at the top right, map controls at the bottom right, and a selected cafe card at the bottom left or as a mobile bottom card. This has been implemented locally for review; the final appearance and intro motion remain open to feedback.

The mobile map mock was approved for local implementation: three compact filters below search (3D, Open now, Filter), an Explore CDO bottom entry for cafe lists, and map controls above that entry or a selected cafe card. The mobile menu uses a bottom sheet presentation. The first local implementation followed this arrangement.

After review, the mobile top cluster was reduced to two rows: brand/account/menu, then search with a direct Filter button. The 3D and Open now toggles moved into Explore CDO. This keeps the search field readable on narrow phones while retaining one-tap access to detailed filters.

Before deployment review, the sign-in/menu pill was found too close to the phone edge. All floating home-map elements now use a single 24 px inset (`--map-overlay-inset`) on mobile and desktop: header, search, map controls, Explore CDO entry, and selected cafe card. Keep this edge alignment when changing their sizes.

The account/menu capsule needs more visual breathing room than the smaller controls. Its outer edge now uses `--map-account-inset: clamp(3rem, 8vw, 9rem)`, giving 48 px on narrow phones and increasing with desktop width up to 144 px, plus any right safe-area inset. The brand and other floating controls retain the 24 px alignment.

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
| Floating home-map inset | 24 | 24 | Shared by header, search, controls, bottom entry, and card. |
| Floating group gap | 12 | 16 | Between search, chips, and panels. |
| Inside card gap | 12 | 16 | Use 8 only for icon and label pairs. |
| Card padding | 20 | 24 | Do not squeeze text to fit more controls. |
| Search height | 52 | 56 | Text at least 16; one primary search field. |
| Search width | available width | 400–440 | Keep room for account and map actions. |
| Primary action height | 48 | 48 | Use 44 minimum for all targets. |
| Category chip height | 40–44 | 40–44 | Put mobile toggles in Explore CDO. |
| Round map control | 48 | 48 | Group zoom in/out, separate locate. |
| Venue card width | viewport minus 48 | 360–400 | On mobile use a bottom card. |
| Account right inset | 48 minimum | 8vw, capped at 144 | Use `--map-account-inset`; include the right safe-area inset. |
| Map overlay corner radius | 20–24 | 20–24 | Pills are fully rounded. |

## Layout zones

1. **Top left:** brand/account row, then search with Filter on mobile; desktop browse controls stay beside search.
2. **Top right:** sign in/account with a full edge inset.
3. **Bottom right:** zoom and current location in one control zone, above any selected venue sheet on mobile.
4. **Selected venue:** one left-side card on desktop, one bottom sheet on mobile. It carries the primary action to enter a walkthrough.
5. Keep map attribution visible and do not cover it with the card or controls.

At under 768 px, collapse the desktop brand/search arrangement into a compact brand row and a full-width search row. Keep the map usable with one hand. Inactive controls should not occupy a full-width bottom bar.

## Mobile walkthrough layout

The approved hybrid peek uses a 16 px inset around the floating close, save, and share controls and the bottom cafe card. Each control is at least 44 px tall. The card is at least 66 px tall and sits 16 px above the viewport edge or the phone safe area, whichever is larger. It shows the cafe name and known status; a tap opens a details sheet capped at 85% of the viewport. The sheet holds directions, reviews, amenities and their accuracy checks, hours, events, and menu when those details exist. The 3D scene keeps its existing left-side movement and right-side look gestures. Desktop retains its expandable left info panel.

The card replaces the persistent mobile top info panel. Keep scan download status above the top controls so it cannot cover the card or the gesture area.

## Globe intro implementation

The root page uses a short illustrated globe flight into Cagayan de Oro, based on the original consumer-root concept. A static SVG poster appears immediately. Then the globe itself rotates using Natural Earth 110m land outlines in an orthographic projection until CDO (124.6465° E, 8.4822° N) faces forward. Only then does it zoom into that centered point and reveal the map. It requests no global map tiles or video. The normal interactive map continues to use the CDO-only PMTiles basemap underneath.

It plays once per session, supports Skip, and honors reduced-motion preferences. `/?intro=1` replays it for review. The poster and Skip are available before the local vector geometry and renderer load. The rotating flight takes about 3 seconds after loading; a 5.5-second safety limit reveals the map if anything stalls. Physical phone review remains before deployment. A matching **satellite/photoreal** look would need a separate imagery, licensing, performance, and cost decision.

## Open decisions

- A: map-first, with search and chips together and venue details on selection; B: a persistent discovery panel on desktop. Which is easier to understand and gives the map enough room?
- Validate the illustrated flight on mid-range phones before deployment.
- Should root and `/explore` be one continuous map experience, or should root have editorial content below the map later?

## Approval path

The desktop and mobile mockups were reviewed, and the chosen layouts are implemented locally in `apps/consumer`. Review the live page on phone and desktop before committing or deploying. The mockups remain in `design/consumer-root` and use no API key or venue database.
