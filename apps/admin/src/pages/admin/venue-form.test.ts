import { describe, expect, it } from "vitest";
import { slugify, toVenueRow, type VenueFormState } from "./venue-form";

const form = (over: Partial<VenueFormState> = {}): VenueFormState => ({
  name: "Bagong Kape",
  slug: "bagong-kape",
  address: "Divisoria, CDO",
  city: "Cagayan de Oro",
  lat: "8.4822",
  lng: "124.6465",
  googlePlaceId: "",
  searchTerms: "kape, bagong kape ,",
  isTopPick: false,
  isPublished: false,
  ...over,
});

describe("slugify", () => {
  it.each([
    ["Sonny's Coffee + Diner", "sonny-s-coffee-diner"],
    ["  Lito's  ", "lito-s"],
    ["Café Ñora", "caf-ora"],
  ])("%s → %s", (name, slug) => expect(slugify(name)).toBe(slug));
});

describe("toVenueRow", () => {
  it("turns the form into a venues row", () =>
    expect(toVenueRow(form())).toEqual({
      ok: true,
      row: {
        name: "Bagong Kape",
        slug: "bagong-kape",
        address: "Divisoria, CDO",
        city: "Cagayan de Oro",
        lat: 8.4822,
        lng: 124.6465,
        google_place_id: null,
        search_terms: ["kape", "bagong kape"],
        is_top_pick: false,
        is_published: false,
      },
    }));
  it("allows no location at all", () => expect(toVenueRow(form({ lat: "", lng: "" }))).toMatchObject({ ok: true, row: { lat: null, lng: null } }));
  it.each<[Partial<VenueFormState>, string]>([
    [{ name: " " }, "name"],
    [{ slug: "Bad Slug" }, "slug"],
    [{ lat: "8.48", lng: "" }, "lat"],
    [{ lat: "95", lng: "124" }, "lat"],
    [{ lat: "north", lng: "124" }, "lat"],
    [{ city: "" }, "city"],
  ])("refuses %j (field %s)", (over, field) => expect(toVenueRow(form(over))).toMatchObject({ ok: false, field }));
});
