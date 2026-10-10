# Visita project state

Reviewed: 11 October 2026. Snapshot of local main at b6c8bef.

## Assessment

Visita has its Tier 1 visitor, owner and admin implementation in place. The next step is deployed-flow and physical-device validation, followed by the remaining launch work. The full PRD includes later tiers and should not be read as a list of features already completed.

The Tier 1 ledger marks all nine tasks complete, including hosted Supabase and request-time cafe pages. That is implementation status; it does not close the outstanding live sign-in, phone checklist, final-design or production-readiness checks.

## Sources and precedence

- visita-prd-full.md: overall product and technical requirements.
- visita-session1-plan.md: approved initial architecture and prototype-review revisions.
- docs/superpowers/plans/2026-09-28-tier-1-roadmap.md: Tier 1 implementation scope.
- .superpowers/sdd/2026-09-28-tier-1-roadmap/progress.md: detailed decisions, completion records, review fixes and deferred issues.
- docs/visita-launch-timeline.html: launch phases and stakeholder inputs.
- CLAUDE.md: no AI attribution in commits or PR descriptions.
- Visita-specific Claude memory under the user's .claude/projects directory: priority tiers, walkthrough decisions, branding, stakeholder questions and deployment handoff. These memories are outside Git; their relevant project decisions are summarized here without account identifiers or credentials.
- Current routes, components, migrations and tests were compared with these records. Later dated updates and implementation resolve stale initial notes.

## Repository and architecture

- Remote: https://github.com/beachater/visita-community.git
- Branch: main. Git reports 31 commits ahead of the locally recorded origin/main; no remote fetch was performed.
- Initial tracked working tree was clean; .claude/ was untracked.
- pnpm monorepo; consumer Astro + React islands; owner/admin Vite + React SPA; embed static HTML/JS.
- Supabase for Postgres, Google auth, RLS and Realtime; Cloudflare Workers for hosting/server routes; R2 for scans, images and Protomaps PMTiles.
- Shared packages: UI, database/amenity types and image-upload helpers.

## Product decisions to preserve

- V1 serves cafes in Cagayan de Oro; the schema remains venue-generic.
- No booking or reservations in current scope.
- Never invent venues, reviews, occupancy or unknown amenity values.
- Amber signifies scanned/verified; keep the provisional Clarity & Light palette, Playfair display type and DM Sans UI/body type.
- Latest aesthetic preference: rounded, glass controls and squircle reading surfaces. Consumer restyle is committed; memory records it as not yet deployed, and admin styling is not fully aligned.
- Prototype supplies flow, content and inspiration, not architecture.
- PlayCanvas .sog only. Load a roughly 300K-splat preview, then replace it with full detail without moving the camera. Streamed SOG was rejected for the cafe use case; lab support remains for comparison.
- Current priority is UI/UX flow. Further scan/bundle/loading tuning was explicitly deferred unless requested. Device correctness still needs validation before release.
- Own-venue search in Tier 1. Google Places fallback waits for approval/budget in Tier 2.
- MapLibre + Protomaps PMTiles is the current working implementation; stakeholder approval of the map approach is not recorded as resolved.
- Directions hand off to Google Maps, with an Apple Maps choice on Apple devices; no embedded routing API.
- Owner edits to menu/hours are direct; verified amenity edits require admin review.
- Access control is in RLS/server code. Client guards provide navigation only.
- Analytics require usage consent. Never put secret keys in chat, documentation or Git.

## Implemented Tier 1 surfaces

| Area | Evidence in the current repo |
|---|---|
| Discovery | Map, scanned/unscanned pins, pin cards, search, filters, Top Picks, saved/recent venues, distance/open-now helpers, demand endpoint |
| Walkthrough | PlayCanvas viewer, preview/full loading, real byte-progress V loader, controls, info/menu panels, scan date, share and deep-link flow |
| Accounts | Google OAuth routes, Supabase session middleware, account UI, saved-list merge/sync |
| Reviews | Rating/text/photo, edit/delete, server-island review list, owner replies and moderation |
| Owner onboarding | Claim/request-new-venue flow, restricted proof assets, claim status and admin approval |
| Owner workflow | Menu/hours editors, amenity requests, events, occupancy with three-hour expiry, replies |
| Analytics | Consent-gated tracking, server validation/dedupe/limits, aggregate owner dashboard |
| Admin | Venue management/publishing, versioned multipart scan upload, owner/amenity queues, moderation |
| Hosted data | Handoff records hosted migrations, explicit anonymous read grants, five cafes, both Workers deployed on 4 October |

Hosted/deployment entries above are historical handoff evidence, not a fresh live inspection in this review. The latest consumer restyle comes after that deployment.

## Remaining scope

### Tier 2: aimed at launch

Amenity verification, menu OCR/photo capture, manual billing, marketing content (home, For Cafes, About, Contact, FAQ), offline support, admin demand queue and optional Google Places fallback. Current verification and marketing routes contain placeholders.

### Tier 3: after launch

Points economy, awards, badges, verified check-ins, referrals, vouchers/boosted listings, community leaderboard, monthly reports/recaps and advanced admin fraud/subscription/audit features. Some database foundations and routes exist, but they are not complete working product features.

### Embed

apps/embed/embed.js remains a scaffold: it sets a backlink and logs the venue slug. It does not fetch or render a walkthrough. Its release priority is not explicitly assigned in the Tier 1 plan.

## Verification in this review

- pnpm test: PASS, 368 tests in 36 files.
- pnpm typecheck: PASS, exit 0; Astro checked 144 files with zero errors, warnings or hints. Wrangler emitted restricted log-write diagnostics and a recommendation to install @types/node, but type generation and both app checks completed.
- No fresh production build, hosted SQL smoke suite, deployment, Google round trip or physical-phone test was performed.
- Existing tests primarily cover units/helpers and selected server logic; this does not prove complete browser flows.

## Outstanding checks and known issues

1. Latest handoff still awaits live Google sign-in on deployed links and the physical-phone checklist. Confirm sign-in/return routes, save across devices, review/photo retry, owner claims/approval, menu updates, occupancy, scan upload and analytics consent.
2. Validate current real scans on iOS Safari and mid-range Android, including preview swap, navigation/back and WebGL memory loss. The handoff contains previous iPhone measurements, not current coverage of every scan/device.
3. Reviews are limited to the newest 100; the average uses that subset, and an older own review can disappear from the page. Confirmed in ReviewList.astro and recorded as deferred.
4. Owner-claim RPC enforces admin, non-self review and pending status, but does not itself require proof to approve or a note to reject; those checks are UI-only. Confirmed in the migration and recorded as deferred.
5. The ledger also defers concurrent scan-version allocation, first-sync unsave races, some missing SQL negative cases, buffered upload-size checks and stale local review drafts. Reassess before public beta.
6. The consumer V loader exists despite a stale brand-memory note saying it was not built. Initial S1/Task 1b blockers are likewise resolved by later updates.
7. Check latest restyle deployment and GitHub push status. Local Git's ahead count is relative to the last known origin ref.

## Stakeholder inputs still recorded as pending

- Map choice and pre-rendered intro video (S3).
- Business model/pricing: needed by 6 November; prototype founder pricing is provisional.
- Final UI/UX and branding: needed by 20 November.
- Google Places approval, key and billing: needed by 20 November or defer.
- In-app payment provider and points/voucher economics: after launch.
- Google-only auth is the product decision; an older handoff suggests disabling Supabase's Email provider but does not confirm it was done.

## Recorded schedule

- Visitor checkpoint: 23 October.
- Owner/admin checkpoint: 6 November.
- Stakeholder testing: 9–20 November.
- Tier 2 target window: 9 November–4 December.
- Fixes and design pass: 23 November–4 December.
- Public beta: 7–18 December.
- Launch preparation: 21–28 December.
- Public launch: 29 December 2026.

These are planned dates, not confirmed readiness milestones. Tier 1 implementation is ahead of its planned finish; validation and stakeholder inputs remain the next gates.

## Recommended next work

Complete a focused live/phone validation pass and record its results, resolve the deferred issues that affect tested flows, then start the Tier 2 work that does not depend on missing stakeholder inputs. Keep this snapshot updated when new evidence or decisions change the assessment.
