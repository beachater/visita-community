import { describe, expect, it } from "vitest";
import type { CafeRow } from "../venue/load";
import { cardActions, pinnable, toMapVenue, toWalkthrough } from "./venues";

const row = (over: Partial<CafeRow> = {}): CafeRow => ({
  id: "aaaaaaaa-0000-0000-0000-000000000001",
  slug: "sonnys",
  name: "Sonny's Coffee + Diner",
  address: "Sonny's, Cagayan de Oro",
  city: "Cagayan de Oro",
  lat: 8.47,
  lng: 124.64,
  google_place_id: null,
  splat_url: "splats/sonnys/v1.sog",
  splat_preview_url: "splats/sonnys/v1-preview.sog",
  scanned_at: null,
  amenities: { wifi: { value: true } },
  hours: { fri: ["10:00", "22:00"] },
  menu: [{ name: "Latte", price_php: 120 }],
  is_top_pick: true,
  search_terms: ["sonnys", "sonny's diner"],
  ...over,
});

describe("toMapVenue", () => {
  it("keeps the venue id, for live occupancy and events", () => expect(toMapVenue(row()).id).toBe("aaaaaaaa-0000-0000-0000-000000000001"));
  it("passes the id on to the walkthrough", () => expect(toWalkthrough(toMapVenue(row()))?.id).toBe("aaaaaaaa-0000-0000-0000-000000000001"));
  it("marks a venue with a walkthrough as scanned", () => expect(toMapVenue(row()).scanned).toBe(true));
  it("marks a venue without one as not scanned", () => expect(toMapVenue(row({ splat_url: null, splat_preview_url: null })).scanned).toBe(false));
  it("keeps top pick and search terms", () => {
    const v = toMapVenue(row());
    expect(v.isTopPick).toBe(true);
    expect(v.searchTerms).toEqual(["sonnys", "sonny's diner"]);
  });
  it("tolerates a venue with no data at all", () => {
    const v = toMapVenue(row({ amenities: {}, hours: null, menu: [], address: null, search_terms: [] }));
    expect(v.amenities).toEqual({});
    expect(v.hours).toBeNull();
    expect(v.menu).toEqual([]);
  });
});

describe("pinnable", () => {
  it("pins venues with coordinates", () => expect(pinnable(toMapVenue(row()))).toBe(true));
  it("can't pin a venue without coordinates", () => expect(pinnable(toMapVenue(row({ lat: null, lng: null })))).toBe(false));
});

describe("cardActions", () => {
  it("offers the walkthrough and directions for a scanned cafe", () =>
    expect(cardActions(toMapVenue(row()))).toEqual(["walkthrough", "directions"]));
  it("offers 'I want to see inside' and directions for an unscanned cafe", () =>
    expect(cardActions(toMapVenue(row({ splat_url: null, splat_preview_url: null })))).toEqual(["demand", "directions"]));
  it("drops directions when the location is unknown", () =>
    expect(cardActions(toMapVenue(row({ lat: null, lng: null, address: null })))).toEqual(["walkthrough"]));
});

describe("toWalkthrough", () => {
  it("gives the walkthrough screen what it needs", () => {
    const w = toWalkthrough(toMapVenue(row()));
    expect(w?.splatKey).toBe("splats/sonnys/v1.sog");
    expect(w?.previewKey).toBe("splats/sonnys/v1-preview.sog");
  });
  it("is null for an unscanned venue", () => expect(toWalkthrough(toMapVenue(row({ splat_url: null, splat_preview_url: null })))).toBeNull());
});
