import { describe, expect, it } from "vitest";
import { cacheKeyFor, isEdgeCacheable, PUBLIC_CACHE_CONTROL } from "./edge-cache";

describe("isEdgeCacheable", () => {
  it.each(["/cafe/sonnys", "/cafe/gaston-park", "/api/venues.json"])("caches %s, the same for every visitor", (p) =>
    expect(isEdgeCacheable("GET", p)).toBe(true));
  it.each([
    ["GET", "/cafe/sonnys/verify"],
    ["GET", "/api/saved"],
    ["GET", "/me"],
    ["GET", "/_server-islands/ReviewList"],
    ["GET", "/cafe/Not_A_Slug"],
    ["POST", "/api/venues.json"],
  ])("never caches %s %s", (m, p) => expect(isEdgeCacheable(m, p)).toBe(false));
});

describe("cacheKeyFor", () => {
  it("ignores the query string, so ?review=1 or tracking tags share one copy", () =>
    expect(cacheKeyFor("https://visita.ph/cafe/sonnys?review=1&utm_source=fb")).toBe("https://visita.ph/cafe/sonnys"));
});

describe("PUBLIC_CACHE_CONTROL", () => {
  it("caches at the edge for 5 minutes and serves stale while refreshing", () => {
    expect(PUBLIC_CACHE_CONTROL).toContain("s-maxage=300");
    expect(PUBLIC_CACHE_CONTROL).toContain("stale-while-revalidate");
  });
});
