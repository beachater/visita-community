import { describe, expect, it, vi } from "vitest";
import { assetUrl, listingUrl, loadVenue, toEmbedVenue, venueQuery, venueSlug, VenueLoadError, type EmbedConfig } from "./venue";

const config: EmbedConfig = {
  supabaseUrl: "https://example.supabase.co/",
  publishableKey: "sb_publishable_test",
  assetsBaseUrl: "https://visita.ph/assets/",
  siteUrl: "https://visita.ph/",
};

const experience = {
  rotation: [180, 0, 0],
  start: { position: [0, 1.5, 0], rotation: [0, 0, 0] },
  walkable: [[-1, -1], [1, -1], [1, 1], [-1, 1]],
  stops: [],
};

const row = {
  slug: "sonnys",
  name: "Sonny's",
  splat_url: "splats/sonnys/v1.sog",
  splat_preview_url: "splats/sonnys/v1-preview.sog",
  scan_experience: experience,
};

describe("venueSlug", () => {
  it("reads ?venue=", () => expect(venueSlug("?venue=sonnys")).toBe("sonnys"));
  it("normalizes case and whitespace", () => expect(venueSlug("?venue=%20Litos-Cafe%20")).toBe("litos-cafe"));
  it("rejects a missing or malformed slug", () => {
    expect(venueSlug("")).toBeNull();
    expect(venueSlug("?venue=")).toBeNull();
    expect(venueSlug("?venue=a%26is_published%3Deq.false")).toBeNull();
    expect(venueSlug("?venue=../admin")).toBeNull();
    expect(venueSlug(`?venue=${"a".repeat(121)}`)).toBeNull();
  });
});

describe("urls", () => {
  it("joins keys onto the assets base", () => {
    expect(assetUrl("splats/a/v1.sog", "https://visita.ph/assets/")).toBe("https://visita.ph/assets/splats/a/v1.sog");
    expect(assetUrl("/splats/a/v1.sog", "https://visita.ph/assets")).toBe("https://visita.ph/assets/splats/a/v1.sog");
    expect(assetUrl("https://cdn.example/x.sog", "https://visita.ph/assets")).toBe("https://cdn.example/x.sog");
  });
  it("links the badge to the listing, or the home page without a venue", () => {
    expect(listingUrl("https://visita.ph/", "sonnys")).toBe("https://visita.ph/cafe/sonnys");
    expect(listingUrl("https://visita.ph/", null)).toBe("https://visita.ph");
  });
  it("asks only for published cafes", () => {
    const url = new URL(venueQuery(config, "sonnys"));
    expect(url.origin + url.pathname).toBe("https://example.supabase.co/rest/v1/venues");
    expect(url.searchParams.get("slug")).toBe("eq.sonnys");
    expect(url.searchParams.get("is_published")).toBe("eq.true");
    expect(url.searchParams.get("venue_type")).toBe("eq.cafe");
  });
});

describe("toEmbedVenue", () => {
  it("resolves the full scan, preview, and experience", () => {
    expect(toEmbedVenue(row, config.assetsBaseUrl)).toEqual({
      slug: "sonnys",
      name: "Sonny's",
      src: "https://visita.ph/assets/splats/sonnys/v1.sog",
      previewSrc: "https://visita.ph/assets/splats/sonnys/v1-preview.sog",
      experience,
    });
  });
  it("works without a preview or experience", () => {
    const venue = toEmbedVenue({ ...row, splat_preview_url: null, scan_experience: null }, config.assetsBaseUrl);
    expect(venue?.previewSrc).toBeNull();
    expect(venue?.experience).toBeNull();
  });
  it("ignores an invalid experience rather than failing", () => {
    expect(toEmbedVenue({ ...row, scan_experience: { rotation: "x" } }, config.assetsBaseUrl)?.experience).toBeNull();
  });
  it("is null for an unscanned or missing venue", () => {
    expect(toEmbedVenue({ ...row, splat_url: null, splat_preview_url: null }, config.assetsBaseUrl)).toBeNull();
    expect(toEmbedVenue(undefined, config.assetsBaseUrl)).toBeNull();
  });
});

describe("loadVenue", () => {
  const respond = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("sends the publishable key and returns the venue", async () => {
    const fetchImpl = respond([row]);
    const venue = await loadVenue(config, "sonnys", fetchImpl as unknown as typeof fetch);
    expect(venue?.name).toBe("Sonny's");
    const init = (fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>).apikey).toBe("sb_publishable_test");
  });
  it("returns null when nothing is published under the slug", async () => {
    expect(await loadVenue(config, "nope", respond([]) as unknown as typeof fetch)).toBeNull();
  });
  it("throws VenueLoadError on API or network failure", async () => {
    await expect(loadVenue(config, "sonnys", respond({}, 500) as unknown as typeof fetch)).rejects.toBeInstanceOf(VenueLoadError);
    const offline = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    await expect(loadVenue(config, "sonnys", offline as unknown as typeof fetch)).rejects.toBeInstanceOf(VenueLoadError);
  });
});
