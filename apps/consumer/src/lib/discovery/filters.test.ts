import { describe, expect, it } from "vitest";
import { venue } from "./fixtures";
import { applyFilters, EMPTY_FILTERS, activeFilterCount, activeFilterNames, priceRange, type Filters } from "./filters";

const allDay = ["00:00", "00:00"] as [string, string];
const always = { mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay, sun: allDay };

const sonnys = venue({
  slug: "sonnys",
  amenities: { wifi: { label: "100 Mbps", value: true }, power_outlets: { value: 9 }, parking: { value: false } },
  menu: [{ name: "Latte", price_php: 120 }, { name: "Pasta", price_php: 245 }],
});
const gaston = venue({ slug: "gaston", amenities: { wifi: { value: true }, outdoor: { value: true } }, hours: always });
const empty = venue({ slug: "empty" });
const f = (over: Partial<Filters>): Filters => ({ ...EMPTY_FILTERS, ...over });

describe("priceRange", () => {
  it("spans the priced menu items", () => expect(priceRange(sonnys)).toEqual([120, 245]));
  it("is unknown without prices", () => expect(priceRange(empty)).toBeNull());
});

describe("applyFilters", () => {
  const venues = [sonnys, gaston, empty];

  it("shows everything with no filters", () => {
    const r = applyFilters(venues, EMPTY_FILTERS, false);
    expect(r.shown.map((v) => v.slug)).toEqual(["sonnys", "gaston", "empty"]);
    expect(r.hiddenForMissingData).toBe(0);
  });

  it("keeps cafes with Wi-Fi", () => expect(applyFilters(venues, f({ wifi: true }), false).matches.map((v) => v.slug)).toEqual(["sonnys", "gaston"]));

  it("hides cafes that don't list the filtered amenity, and counts them", () => {
    const r = applyFilters(venues, f({ wifi: true }), false);
    expect(r.shown.map((v) => v.slug)).toEqual(["sonnys", "gaston"]);
    expect(r.hiddenForMissingData).toBe(1);
  });

  it("shows them anyway when asked, after the matches", () =>
    expect(applyFilters(venues, f({ wifi: true }), true).shown.map((v) => v.slug)).toEqual(["sonnys", "gaston", "empty"]));

  it("never shows a cafe that fails a filter, even when showing unknowns", () =>
    expect(applyFilters(venues, f({ parking: true }), true).shown.map((v) => v.slug)).toEqual(["gaston", "empty"]));

  it("filters by minimum outlets", () => {
    expect(applyFilters(venues, f({ minOutlets: 5 }), false).matches.map((v) => v.slug)).toEqual(["sonnys"]);
    expect(applyFilters(venues, f({ minOutlets: 10 }), false).matches).toEqual([]);
  });

  it("filters by open 24/7 from structured hours", () =>
    expect(applyFilters(venues, f({ open247: true }), false).matches.map((v) => v.slug)).toEqual(["gaston"]));

  it("filters by outdoor area", () => expect(applyFilters(venues, f({ outdoor: true }), false).matches.map((v) => v.slug)).toEqual(["gaston"]));

  it("filters by price range overlap with the menu", () => {
    expect(applyFilters(venues, f({ priceMax: 150 }), false).matches.map((v) => v.slug)).toEqual(["sonnys"]);
    expect(applyFilters(venues, f({ priceMin: 300 }), false).matches).toEqual([]);
  });

  it("combines filters (all must hold)", () =>
    expect(applyFilters(venues, f({ wifi: true, outdoor: true }), false).matches.map((v) => v.slug)).toEqual(["gaston"]));

  it("counts a cafe missing any one filtered field as unknown, not failed", () => {
    // Gaston has Wi-Fi but no outlet count: unknown for minOutlets, not a fail.
    const r = applyFilters([gaston], f({ wifi: true, minOutlets: 2 }), false);
    expect(r.matches).toEqual([]);
    expect(r.hiddenForMissingData).toBe(1);
  });
});

describe("activeFilterCount", () => {
  it("counts active filters", () => expect(activeFilterCount(f({ wifi: true, minOutlets: 2, priceMax: 200 }))).toBe(3));
  it("is zero by default", () => expect(activeFilterCount(EMPTY_FILTERS)).toBe(0));
});

describe("activeFilterNames", () => {
  it("names the filters that are on, for analytics", () =>
    expect(activeFilterNames({ ...EMPTY_FILTERS, priceMax: 200, wifi: true, parking: true })).toEqual(["price", "wifi", "parking"]));
  it("is empty with no filters", () => expect(activeFilterNames(EMPTY_FILTERS)).toEqual([]));
});
