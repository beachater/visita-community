// @ts-check
// Tier 3 routes: community, badges, referrals, vouchers, check-ins and amenity
// verification. Their pages are placeholders, and the PRD rule is to never show
// anything that isn't real, so v1 ships without them (BEA-5).
//
// The pages live here, outside src/pages, so Astro doesn't route them on its
// own. astro.config.mjs injects them only when TIER3_ENABLED is true. While it's
// false they aren't built at all and any visit gets the normal 404 page.
//
// To bring them back: set TIER3_ENABLED to true, then add any nav or footer
// links by hand. Nothing links to them while they're off.

export const TIER3_ENABLED = false;

/** @type {ReadonlyArray<{ pattern: string, entrypoint: string }>} */
export const TIER3_ROUTES = [
  { pattern: "/community", entrypoint: "./src/tier3/community.astro" },
  { pattern: "/community/badges", entrypoint: "./src/tier3/community-badges.astro" },
  { pattern: "/referrals", entrypoint: "./src/tier3/referrals.astro" },
  { pattern: "/vouchers", entrypoint: "./src/tier3/vouchers.astro" },
  { pattern: "/check-in/[slug]", entrypoint: "./src/tier3/check-in.astro" },
  { pattern: "/r/[code]", entrypoint: "./src/tier3/referral-invite.astro" },
  { pattern: "/cafe/[slug]/verify", entrypoint: "./src/tier3/cafe-verify.astro" },
];
