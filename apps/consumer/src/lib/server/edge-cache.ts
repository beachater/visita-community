// Plan Task 1b: cafe pages and the map's venue list render on request (so
// publishing a venue or editing a menu shows up without a rebuild) and are
// cached at Cloudflare's edge for 5 minutes. Only responses that are the same
// for every visitor qualify; personal parts come from server islands.
// The Workers Cache API is a no-op on *.workers.dev, so caching takes effect
// on a custom domain (visita.ph); the test link renders fresh each time.

const CAFE_PAGE = /^\/cafe\/[a-z0-9]+(-[a-z0-9]+)*$/;
const CACHED_EXACT = new Set(["/api/venues.json"]);

export const PUBLIC_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=86400";

export function isEdgeCacheable(method: string, pathname: string): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  return CACHED_EXACT.has(pathname) || CAFE_PAGE.test(pathname);
}

/** One cached copy per page, whatever query string (?review=1, utm tags) a link carries. */
export function cacheKeyFor(url: string): string {
  const u = new URL(url);
  u.search = "";
  u.hash = "";
  return u.toString();
}
